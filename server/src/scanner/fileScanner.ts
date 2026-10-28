import fs from 'fs';
import path from 'path';
import { ScannedFile, PackageManifest } from './types';
import { config } from '../config';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html']);

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.github',
  '.gitlab',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '.turbo',
  '.cache',
  '.idea',
  '.vscode',
  'temp',
  'tmp',
  'vendor'
]);

const EXCLUDED_FILE_PATTERNS = [
  /\.env(\..+)?$/i,
  /\.lock$/i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /\.min\.js$/i,
  /\.map$/i,
  /\.d\.ts$/i,
  /id_rsa/i,
  /\.pem$/i,
  /\.key$/i
];

/**
 * Checks whether a given directory name should be skipped
 */
function isIgnoredDirectory(dirName: string): boolean {
  return EXCLUDED_DIR_NAMES.has(dirName) || dirName.startsWith('.');
}

/**
 * Checks whether a file matches any excluded pattern
 */
function isIgnoredFile(fileName: string): boolean {
  return EXCLUDED_FILE_PATTERNS.some(pattern => pattern.test(fileName));
}

/**
 * Determines whether a file path corresponds to a test file
 */
export function isTestFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  const ext = path.extname(normalized);

  // HTML files are documents and are never automated test files
  if (ext === '.html') {
    return false;
  }

  const baseName = path.basename(normalized);

  // Check test directory pattern
  if (
    normalized.startsWith('test/') ||
    normalized.startsWith('tests/') ||
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/__tests__/')
  ) {
    return true;
  }

  // Check test file name extensions
  if (
    baseName.includes('.test.') ||
    baseName.includes('.spec.') ||
    baseName.endsWith('.test.ts') ||
    baseName.endsWith('.test.tsx') ||
    baseName.endsWith('.test.js') ||
    baseName.endsWith('.test.jsx') ||
    baseName.endsWith('.spec.ts') ||
    baseName.endsWith('.spec.tsx') ||
    baseName.endsWith('.spec.js') ||
    baseName.endsWith('.spec.jsx')
  ) {
    return true;
  }

  return false;
}

/**
 * Maps extension to language classification
 */
function getLanguageForExtension(ext: string): 'TypeScript' | 'TSX' | 'JavaScript' | 'JSX' | 'HTML' {
  switch (ext) {
    case '.ts':
      return 'TypeScript';
    case '.tsx':
      return 'TSX';
    case '.jsx':
      return 'JSX';
    case '.html':
      return 'HTML';
    case '.js':
    case '.mjs':
    case '.cjs':
    default:
      return 'JavaScript';
  }
}

export interface ScanResult {
  files: ScannedFile[];
  packageManifest?: PackageManifest;
  warnings: string[];
}

/**
 * Recursively scans a repository directory for JavaScript/TypeScript source files.
 * Enforces file count and size limits. Read-only operation.
 */
export function scanRepository(repoFullPath: string): ScanResult {
  const files: ScannedFile[] = [];
  const warnings: string[] = [];
  let fileCounter = 0;

  function traverse(currentDir: string): void {
    if (fileCounter >= config.maxFileCount) {
      warnings.push(`File count limit reached (${config.maxFileCount}). Additional files were skipped.`);
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (err: unknown) {
      warnings.push(`Unable to read directory ${currentDir}: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    for (const entry of entries) {
      if (fileCounter >= config.maxFileCount) break;

      const entryName = entry.name;
      const fullPath = path.join(currentDir, entryName);

      if (entry.isDirectory()) {
        if (!isIgnoredDirectory(entryName)) {
          traverse(fullPath);
        }
      } else if (entry.isFile()) {
        if (isIgnoredFile(entryName)) {
          continue;
        }

        const ext = path.extname(entryName).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          let stat: fs.Stats;
          try {
            stat = fs.statSync(fullPath);
          } catch {
            continue;
          }

          if (stat.size > config.maxFileSizeBytes) {
            warnings.push(`Skipped ${entryName} (${(stat.size / 1024 / 1024).toFixed(2)} MB): exceeds maximum file size limit.`);
            continue;
          }

          fileCounter++;
          const relativePath = path.relative(repoFullPath, fullPath).replace(/\\/g, '/');

          files.push({
            path: relativePath,
            fullPath,
            name: entryName,
            extension: ext,
            size: stat.size,
            isTest: ext === '.html' ? false : isTestFile(relativePath),
            language: getLanguageForExtension(ext),
            nodeType: ext === '.html' ? 'document' : 'source'
          });
        }
      }
    }
  }

  traverse(repoFullPath);

  // Parse root package.json if it exists
  let packageManifest: PackageManifest | undefined;
  const pkgPath = path.join(repoFullPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, 'utf-8');
      packageManifest = JSON.parse(content);
    } catch {
      warnings.push('Could not parse root package.json');
    }
  }

  return {
    files,
    packageManifest,
    warnings
  };
}
