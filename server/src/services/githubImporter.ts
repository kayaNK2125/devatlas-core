import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config';
import { scanRepository } from '../scanner/fileScanner';
import { buildDependencyGraph } from '../engine/dependencyEngine';
import { analysisStore } from '../store/analysisStore';
import { AnalysisRecord } from '../scanner/types';

export class GitHubValidationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 400, code = 'INVALID_GITHUB_URL') {
    super(message);
    this.name = 'GitHubValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class GitHubImportError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 500, code = 'GITHUB_IMPORT_ERROR') {
    super(message);
    this.name = 'GitHubImportError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface ValidatedGitHubRepo {
  canonicalUrl: string;
  displayUrl: string;
  owner: string;
  repo: string;
  ref?: string;
}

const GITHUB_NAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

/**
 * Validates and canonicalizes a public GitHub repository URL.
 * Strictly enforces:
 * - HTTPS protocol only
 * - Host must be github.com (SSRF prevention)
 * - No embedded credentials
 * - Standard path syntax (owner/repo or owner/repo/tree/ref)
 * - No traversal or unexpected components
 */
export function validateGitHubUrl(inputUrl: string): ValidatedGitHubRepo {
  if (!inputUrl || typeof inputUrl !== 'string' || inputUrl.trim().length === 0) {
    throw new GitHubValidationError('Repository URL cannot be empty.', 400, 'EMPTY_URL');
  }

  const trimmed = inputUrl.trim();

  // Basic sanity check against null bytes or control characters
  if (/[\0\r\n]/.test(trimmed)) {
    throw new GitHubValidationError('URL contains illegal control characters.', 400, 'MALFORMED_URL');
  }

  // Reject path traversal sequences, directory escapes, backslashes, or URL-encoded dots
  if (
    trimmed.includes('/..') ||
    trimmed.includes('../') ||
    trimmed.includes('/.') ||
    trimmed.includes('./') ||
    /%2e/i.test(trimmed) ||
    /%2f/i.test(trimmed) ||
    /\\/.test(trimmed)
  ) {
    throw new GitHubValidationError(
      'Repository path contains invalid characters or path traversal sequences.',
      400,
      'INVALID_REPO_NAME'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new GitHubValidationError(
      'Invalid URL format. Please provide a canonical GitHub URL (e.g. https://github.com/owner/repository).',
      400,
      'MALFORMED_URL'
    );
  }

  // 1. Protocol check (HTTPS only)
  if (parsed.protocol.toLowerCase() !== 'https:') {
    throw new GitHubValidationError(
      'Only HTTPS repository URLs are supported (e.g. https://github.com/owner/repository).',
      400,
      'UNSUPPORTED_PROTOCOL'
    );
  }

  // 2. Host check: strictly github.com or www.github.com
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    throw new GitHubValidationError(
      `Unsupported host '${parsed.hostname}'. DevAtlas Core only imports public repositories from github.com.`,
      400,
      'UNSUPPORTED_HOST'
    );
  }

  // 3. Embedded credentials check
  if (parsed.username || parsed.password) {
    throw new GitHubValidationError(
      'Embedded credentials in repository URLs are not permitted.',
      400,
      'CREDENTIALS_NOT_ALLOWED'
    );
  }

  // 4. Non-standard port check
  if (parsed.port && parsed.port !== '443') {
    throw new GitHubValidationError(
      'Non-standard ports are not allowed for GitHub imports.',
      400,
      'INVALID_PORT'
    );
  }

  // 5. Path segment validation
  const segments = parsed.pathname
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    throw new GitHubValidationError(
      'URL must include both an owner and repository name (e.g. https://github.com/owner/repository).',
      400,
      'INVALID_PATH'
    );
  }

  const owner = segments[0];
  let repo = segments[1];

  // Strip trailing .git if present
  if (repo.toLowerCase().endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  // Reject path traversal attempts or invalid characters in owner / repo
  if (
    owner === '.' ||
    owner === '..' ||
    repo === '.' ||
    repo === '..' ||
    !GITHUB_NAME_REGEX.test(owner) ||
    !GITHUB_NAME_REGEX.test(repo)
  ) {
    throw new GitHubValidationError(
      'Repository path contains invalid characters or path traversal sequences.',
      400,
      'INVALID_REPO_NAME'
    );
  }

  let ref: string | undefined;

  if (segments.length === 2) {
    ref = undefined;
  } else if (segments.length >= 4 && segments[2] === 'tree') {
    const rawRef = segments.slice(3).join('/');
    if (
      rawRef.startsWith('-') ||
      rawRef.includes('..') ||
      /[\s\0]/.test(rawRef) ||
      !GITHUB_NAME_REGEX.test(rawRef.replace(/\//g, '_'))
    ) {
      throw new GitHubValidationError(
        'Invalid branch or reference name in GitHub URL.',
        400,
        'INVALID_REF'
      );
    }
    ref = rawRef;
  } else {
    throw new GitHubValidationError(
      'Extra unsupported path components in GitHub URL. Supported formats: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch.',
      400,
      'UNSUPPORTED_PATH_FORMAT'
    );
  }

  const canonicalUrl = `https://github.com/${owner}/${repo}.git`;
  const displayUrl = `https://github.com/${owner}/${repo}`;

  return {
    canonicalUrl,
    displayUrl,
    owner,
    repo,
    ref
  };
}

/**
 * Safely removes a directory strictly contained within the base temporary root.
 * Never deletes anything outside the generated workspace.
 */
export function safeRemoveDirectory(targetDir: string, baseRoot: string): void {
  try {
    const normTarget = path.resolve(targetDir);
    const normBase = path.resolve(baseRoot);

    // Strict containment check: must be inside baseRoot and not baseRoot itself
    if (normTarget === normBase || !normTarget.startsWith(normBase + path.sep)) {
      console.warn(`[Security] Refusing to delete path outside temp root: ${targetDir}`);
      return;
    }

    if (fs.existsSync(normTarget)) {
      fs.rmSync(normTarget, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    }
  } catch (err: unknown) {
    console.error(`[Cleanup Warning] Failed to remove temp directory ${targetDir}:`, err);
  }
}

/**
 * Calculates directory size in bytes recursively
 */
export function calculateDirectorySize(dirPath: string): number {
  let totalBytes = 0;
  function walk(current: string) {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') continue; // Don't count git internals in source payload
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        try {
          totalBytes += fs.statSync(full).size;
        } catch {
          // ignore transient stat error
        }
      }
    }
  }
  walk(dirPath);
  return totalBytes;
}

export interface GitCloneOptions {
  canonicalUrl: string;
  workspacePath: string;
  ref?: string;
  timeoutMs: number;
}

export type GitCloneExecutor = (options: GitCloneOptions) => Promise<{ stdout: string; stderr: string }>;

/**
 * Default Git shallow clone executor using child_process.spawn with no shell interpolation
 */
export const defaultGitCloneExecutor: GitCloneExecutor = ({
  canonicalUrl,
  workspacePath,
  ref,
  timeoutMs
}) => {
  return new Promise((resolve, reject) => {
    const gitArgs = [
      '-c', 'credential.helper=',
      'clone',
      '--depth', '1',
      '--single-branch',
      '--no-tags',
      '--no-recurse-submodules'
    ];

    if (ref) {
      gitArgs.push('--branch', ref);
    }

    gitArgs.push(canonicalUrl, workspacePath);

    // Disable interactive prompts, credential helpers, and external configs
    const env = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: '',
      SSH_ASKPASS: '',
      GIT_CONFIG_NOSYSTEM: '1'
    };

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('git', gitArgs, {
      shell: false,
      env,
      windowsHide: true
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill('SIGKILL');
      } catch {
        // ignore
      }
      reject(new GitHubImportError(`Git clone timed out after ${timeoutMs / 1000} seconds.`, 504, 'CLONE_TIMEOUT'));
    }, timeoutMs);

    proc.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    proc.on('error', err => {
      clearTimeout(timer);
      if (!timedOut) {
        reject(new GitHubImportError(`Failed to execute git: ${err.message}`, 500, 'GIT_EXEC_ERROR'));
      }
    });

    proc.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const errorText = stderr || stdout || `Git clone exited with code ${code}`;
        if (/Repository not found|Authentication failed|could not read (Username|Password)|terminal prompts disabled/i.test(errorText)) {
          reject(
            new GitHubImportError(
              'Repository not found or private. DevAtlas Core only imports public GitHub repositories.',
              404,
              'REPOSITORY_NOT_FOUND'
            )
          );
        } else if (/Remote branch .* not found/i.test(errorText)) {
          reject(
            new GitHubImportError(
              `Branch or tag reference '${ref}' was not found in the repository.`,
              404,
              'REF_NOT_FOUND'
            )
          );
        } else if (/Could not resolve host/i.test(errorText)) {
          reject(
            new GitHubImportError(
              'Network failure: Could not resolve github.com.',
              502,
              'NETWORK_ERROR'
            )
          );
        } else if (/rate limit/i.test(errorText)) {
          reject(
            new GitHubImportError(
              'GitHub network transfer rate limit encountered. Please retry later.',
              429,
              'RATE_LIMITED'
            )
          );
        } else {
          reject(
            new GitHubImportError(
              `Git clone failed: ${errorText.trim()}`,
              422,
              'CLONE_FAILED'
            )
          );
        }
      }
    });
  });
};

/**
 * Retrieves the commit SHA of the shallow clone
 */
export function getCommitSha(workspacePath: string): Promise<string> {
  return new Promise(resolve => {
    execFile('git', ['rev-parse', 'HEAD'], { cwd: workspacePath, shell: false }, (err, stdout) => {
      if (err || !stdout) {
        resolve('unknown');
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export interface ImportGitHubOptions {
  repositoryUrl: string;
  gitExecutor?: GitCloneExecutor;
  commitShaResolver?: (workspacePath: string) => Promise<string>;
}

/**
 * Imports a public GitHub repository, analyzes it with RepoAtlas,
 * and retains the in-memory session while safely cleaning up the downloaded source.
 */
export async function importAndAnalyzeGitHubRepository(
  options: ImportGitHubOptions
): Promise<AnalysisRecord> {
  const { repositoryUrl, gitExecutor = defaultGitCloneExecutor, commitShaResolver = getCommitSha } = options;

  // 1. Validate repository URL
  const validated = validateGitHubUrl(repositoryUrl);

  // 2. Ensure base temp directory exists
  if (!fs.existsSync(config.tempWorkspaceRoot)) {
    fs.mkdirSync(config.tempWorkspaceRoot, { recursive: true });
  }

  // 3. Create isolated unique temporary workspace path
  const workspaceId = `gh-${crypto.randomUUID()}`;
  const workspacePath = path.join(config.tempWorkspaceRoot, workspaceId);

  try {
    // 4. Perform shallow clone using process API
    await gitExecutor({
      canonicalUrl: validated.canonicalUrl,
      workspacePath,
      ref: validated.ref,
      timeoutMs: config.gitCloneTimeoutMs
    });

    // 5. Resolve commit SHA
    const commitSha = await commitShaResolver(workspacePath);

    // 6. Check repository payload size limit
    const repoSize = calculateDirectorySize(workspacePath);
    if (repoSize > config.maxRepoSizeBytes) {
      throw new GitHubImportError(
        `Repository size (${(repoSize / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit (${config.maxRepoSizeBytes / 1024 / 1024} MB).`,
        413,
        'REPO_TOO_LARGE'
      );
    }

    // 7. Run the existing RepoAtlas scanner
    const scanResult = scanRepository(workspacePath);

    if (scanResult.files.length === 0) {
      throw new GitHubImportError(
        `No supported JavaScript or TypeScript source files were found in repository '${validated.owner}/${validated.repo}'.`,
        422,
        'NO_SOURCE_FILES_FOUND'
      );
    }

    // 8. Build the dependency graph and analysis record
    const repoDisplayName = `${validated.owner}/${validated.repo}`;
    const analysisRecord = buildDependencyGraph(
      scanResult.files,
      scanResult.packageManifest,
      repoDisplayName
    );

    // 9. Attach repository provenance
    analysisRecord.sourceType = 'github';
    analysisRecord.gitHubUrl = validated.displayUrl;
    analysisRecord.commitSha = commitSha;
    analysisRecord.repoName = validated.repo;

    // 10. Cache in-memory for ChangeScope and CareerLens queries
    analysisStore.save(analysisRecord);

    return analysisRecord;
  } finally {
    // 11. Guaranteed safe cleanup of temporary workspace
    safeRemoveDirectory(workspacePath, config.tempWorkspaceRoot);
  }
}
