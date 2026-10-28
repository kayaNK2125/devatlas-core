import path from 'path';
import fs from 'fs';

export class PathValidationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 400, code = 'INVALID_PATH') {
    super(message);
    this.name = 'PathValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Normalizes a path for comparison by converting backslashes to forward slashes
 * and converting Windows drive letter to uppercase for consistent comparison.
 */
function normalizeForComparison(p: string): string {
  let normalized = path.normalize(p).replace(/\\/g, '/');
  // Match Windows drive letter like c:/ -> C:/
  if (/^[a-zA-Z]:\//.test(normalized)) {
    normalized = normalized[0].toUpperCase() + normalized.slice(1);
  }
  // Remove trailing slash unless root
  if (normalized.length > 3 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export interface ValidatedPath {
  resolvedPath: string;
  relativePath: string;
}

/**
 * Validates that a requested repository path is strictly contained within the allowed root.
 * Enforces:
 * - Non-empty path
 * - No path traversal escaping the root
 * - Symlink resolution check (target cannot escape allowed root)
 * - Directory must exist and be a valid directory
 */
export function validateRepositoryPath(inputPath: string, allowedRoot: string): ValidatedPath {
  if (!inputPath || typeof inputPath !== 'string' || inputPath.trim().length === 0) {
    throw new PathValidationError('Repository path cannot be empty.', 400, 'EMPTY_PATH');
  }

  const trimmed = inputPath.trim();

  // Check for obvious traversal sequences
  if (trimmed.includes('\0')) {
    throw new PathValidationError('Path contains null bytes.', 400, 'NULL_BYTE_DETECTED');
  }

  // Resolve absolute path: if relative, resolve relative to allowedRoot
  const resolvedAllowedRoot = path.resolve(allowedRoot);
  let targetPath: string;

  if (path.isAbsolute(trimmed)) {
    targetPath = path.resolve(trimmed);
  } else {
    targetPath = path.resolve(resolvedAllowedRoot, trimmed);
  }

  const normRoot = normalizeForComparison(resolvedAllowedRoot);
  const normTarget = normalizeForComparison(targetPath);

  // Check prefix containment
  const isContained = normTarget === normRoot || normTarget.startsWith(normRoot + '/');
  if (!isContained) {
    throw new PathValidationError(
      `Access denied: Target path '${trimmed}' resolves outside the allowed root directory.`,
      403,
      'PATH_TRAVERSAL_DENIED'
    );
  }

  // Check directory existence
  if (!fs.existsSync(targetPath)) {
    throw new PathValidationError(
      `Repository directory does not exist: '${trimmed}'.`,
      404,
      'DIRECTORY_NOT_FOUND'
    );
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    throw new PathValidationError(
      `Specified path is not a directory: '${trimmed}'.`,
      400,
      'NOT_A_DIRECTORY'
    );
  }

  // Symlink escape check: ensure real path also remains within allowed root
  try {
    const realRoot = normalizeForComparison(fs.realpathSync(resolvedAllowedRoot));
    const realTarget = normalizeForComparison(fs.realpathSync(targetPath));

    const isRealContained = realTarget === realRoot || realTarget.startsWith(realRoot + '/');
    if (!isRealContained) {
      throw new PathValidationError(
        'Access denied: Symlink resolves outside the allowed root directory.',
        403,
        'SYMLINK_ESCAPE_DENIED'
      );
    }
  } catch (err: unknown) {
    if (err instanceof PathValidationError) throw err;
    throw new PathValidationError(
      `Failed to verify real filesystem path: ${err instanceof Error ? err.message : String(err)}`,
      500,
      'REALPATH_RESOLUTION_ERROR'
    );
  }

  // Calculate clean relative path for display
  let relativePath = path.relative(resolvedAllowedRoot, targetPath).replace(/\\/g, '/');
  if (!relativePath || relativePath === '.') {
    relativePath = './';
  }

  return {
    resolvedPath: targetPath,
    relativePath
  };
}
