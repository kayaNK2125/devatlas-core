import fs from 'fs';
import path from 'path';
import { ScannedFile } from '../scanner/types';

export interface HtmlScriptReference {
  rawSrc: string;
  resolvedFile: string;
}

export interface ParsedHtmlDocument {
  file: ScannedFile;
  scriptReferences: HtmlScriptReference[];
  linesOfCode: number;
}

const SCRIPT_TAG_REGEX = /<script\b([^>]*)>/gi;

const SUPPORTED_SCRIPT_TYPES = new Set([
  '',
  'text/javascript',
  'module',
  'application/javascript',
  'javascript'
]);

/**
 * Checks whether an attribute string specifies an executable script type
 */
function isSupportedScriptType(attrs: string): boolean {
  const typeMatch = attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!typeMatch) {
    return true; // Default is JavaScript
  }
  const typeVal = (typeMatch[1] ?? typeMatch[2] ?? typeMatch[3] ?? '').trim().toLowerCase();
  return SUPPORTED_SCRIPT_TYPES.has(typeVal);
}

/**
 * Checks whether a src URL is external, a data URI, or a fragment
 */
export function isExternalOrSpecialUrl(src: string): boolean {
  const trimmed = src.trim().toLowerCase();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('#') ||
    trimmed === ''
  );
}

/**
 * Resolves a local script path relative to the HTML document's location in the repository
 */
export function resolveHtmlScriptSrc(
  htmlRelativePath: string,
  rawSrc: string,
  availableFilePaths: Set<string>
): string | null {
  if (isExternalOrSpecialUrl(rawSrc)) {
    return null;
  }

  // Strip query string and fragment
  const cleanSrc = rawSrc.split('?')[0].split('#')[0].trim();
  if (!cleanSrc) {
    return null;
  }

  const htmlDir = path.posix.dirname(htmlRelativePath);
  const candidates: string[] = [];

  if (cleanSrc.startsWith('/')) {
    // Leading slash: try relative to HTML dir, then relative to repo root
    const withoutLeadingSlash = cleanSrc.replace(/^\/+/, '');
    candidates.push(path.posix.normalize(path.posix.join(htmlDir, withoutLeadingSlash)));
    candidates.push(path.posix.normalize(withoutLeadingSlash));
  } else {
    // Relative path: resolve relative to HTML document's directory
    candidates.push(path.posix.normalize(path.posix.join(htmlDir, cleanSrc)));
  }

  for (const candidate of candidates) {
    // Containment check: reject paths escaping repo root
    if (candidate.startsWith('../') || candidate === '..') {
      continue;
    }

    // Direct match
    if (availableFilePaths.has(candidate)) {
      return candidate;
    }

    // Case-insensitive fallback
    const lowerCandidate = candidate.toLowerCase();
    for (const filePath of availableFilePaths) {
      if (filePath.toLowerCase() === lowerCandidate) {
        return filePath;
      }
    }
  }

  return null;
}

/**
 * Parses an HTML file to extract local script dependencies
 */
export function parseHtmlFile(file: ScannedFile, availableFilePaths: Set<string>): ParsedHtmlDocument {
  let content = '';
  try {
    content = fs.readFileSync(file.fullPath, 'utf-8');
  } catch {
    return {
      file,
      scriptReferences: [],
      linesOfCode: 0
    };
  }

  const linesOfCode = content.split('\n').length;
  const scriptReferences: HtmlScriptReference[] = [];
  const resolvedTargets = new Set<string>();

  let match: RegExpExecArray | null;
  // Reset regex index
  SCRIPT_TAG_REGEX.lastIndex = 0;

  while ((match = SCRIPT_TAG_REGEX.exec(content)) !== null) {
    const attrs = match[1];

    if (!isSupportedScriptType(attrs)) {
      continue;
    }

    const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!srcMatch) {
      continue; // Inline script without src
    }

    const rawSrc = (srcMatch[1] ?? srcMatch[2] ?? srcMatch[3] ?? '').trim();
    const resolvedFile = resolveHtmlScriptSrc(file.path, rawSrc, availableFilePaths);

    if (resolvedFile && !resolvedTargets.has(resolvedFile)) {
      resolvedTargets.add(resolvedFile);
      scriptReferences.push({
        rawSrc,
        resolvedFile
      });
    }
  }

  return {
    file,
    scriptReferences,
    linesOfCode
  };
}
