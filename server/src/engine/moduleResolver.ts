import path from 'path';

const CANDIDATE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const CANDIDATE_INDEX_FILES = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
  'index.mjs',
  'index.cjs'
];

/**
 * Resolves a local import specifier to a concrete relative file path within the repository
 */
export function resolveLocalModule(
  importingFilePath: string,
  specifier: string,
  availableFilePaths: Set<string>
): string | null {
  const importingDir = path.posix.dirname(importingFilePath);
  const rawTarget = path.posix.normalize(path.posix.join(importingDir, specifier));

  // 1. Direct exact match (e.g., if specifier already had .js or .ts)
  if (availableFilePaths.has(rawTarget)) {
    return rawTarget;
  }

  // 2. Try appending candidate extensions (.ts, .tsx, .js, .jsx, etc.)
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = `${rawTarget}${ext}`;
    if (availableFilePaths.has(candidate)) {
      return candidate;
    }
  }

  // 3. Try directory index files (e.g. ./utils -> ./utils/index.ts)
  for (const indexFile of CANDIDATE_INDEX_FILES) {
    const candidate = path.posix.join(rawTarget, indexFile);
    if (availableFilePaths.has(candidate)) {
      return candidate;
    }
  }

  // 4. Case-insensitive fallback (for Windows or case mismatches)
  const lowerTarget = rawTarget.toLowerCase();
  for (const filePath of availableFilePaths) {
    const lowerCandidate = filePath.toLowerCase();
    if (lowerCandidate === lowerTarget) {
      return filePath;
    }
    for (const ext of CANDIDATE_EXTENSIONS) {
      if (lowerCandidate === `${lowerTarget}${ext}`) {
        return filePath;
      }
    }
    for (const indexFile of CANDIDATE_INDEX_FILES) {
      if (lowerCandidate === path.posix.join(lowerTarget, indexFile).toLowerCase()) {
        return filePath;
      }
    }
  }

  return null;
}
