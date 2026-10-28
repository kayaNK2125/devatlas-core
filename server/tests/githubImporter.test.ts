import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app';
import { config } from '../src/config';
import {
  validateGitHubUrl,
  safeRemoveDirectory,
  calculateDirectorySize,
  importAndAnalyzeGitHubRepository,
  GitHubValidationError,
  GitHubImportError,
  GitCloneOptions
} from '../src/services/githubImporter';
import { calculateChangeImpact } from '../src/engine/impactEngine';
import { analysisStore } from '../src/store/analysisStore';

describe('GitHub Repository Import and Analysis Engine', () => {
  describe('validateGitHubUrl', () => {
    it('accepts standard canonical repository URLs', () => {
      const result = validateGitHubUrl('https://github.com/kayaNK2125/devatlas-core');
      expect(result.owner).toBe('kayaNK2125');
      expect(result.repo).toBe('devatlas-core');
      expect(result.canonicalUrl).toBe('https://github.com/kayaNK2125/devatlas-core.git');
      expect(result.displayUrl).toBe('https://github.com/kayaNK2125/devatlas-core');
      expect(result.ref).toBeUndefined();
    });

    it('accepts repository URLs with trailing .git and www subdomain', () => {
      const result = validateGitHubUrl('https://www.github.com/facebook/react.git');
      expect(result.owner).toBe('facebook');
      expect(result.repo).toBe('react');
      expect(result.canonicalUrl).toBe('https://github.com/facebook/react.git');
      expect(result.displayUrl).toBe('https://github.com/facebook/react');
    });

    it('accepts repository URLs with specific branch ref', () => {
      const result = validateGitHubUrl('https://github.com/owner/my-repo/tree/feature/v1');
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('my-repo');
      expect(result.ref).toBe('feature/v1');
    });

    it('rejects empty or whitespace-only inputs', () => {
      expect(() => validateGitHubUrl('')).toThrow(GitHubValidationError);
      expect(() => validateGitHubUrl('   ')).toThrow(GitHubValidationError);
    });

    it('rejects non-HTTPS protocols (e.g. http:// or git://)', () => {
      expect(() => validateGitHubUrl('http://github.com/owner/repo')).toThrow(
        /Only HTTPS repository URLs are supported/
      );
      expect(() => validateGitHubUrl('git://github.com/owner/repo')).toThrow(
        /Only HTTPS repository URLs are supported/
      );
    });

    it('rejects non-GitHub hosts to prevent SSRF', () => {
      expect(() => validateGitHubUrl('https://gitlab.com/owner/repo')).toThrow(
        /Unsupported host/
      );
      expect(() => validateGitHubUrl('https://evil-host.com/owner/repo')).toThrow(
        /Unsupported host/
      );
    });

    it('rejects embedded credentials in URL', () => {
      expect(() => validateGitHubUrl('https://user:token@github.com/owner/repo')).toThrow(
        /Embedded credentials in repository URLs are not permitted/
      );
    });

    it('rejects non-standard ports', () => {
      expect(() => validateGitHubUrl('https://github.com:8443/owner/repo')).toThrow(
        /Non-standard ports are not allowed/
      );
    });

    it('rejects path traversal sequences in owner or repo', () => {
      expect(() => validateGitHubUrl('https://github.com/../../etc/passwd')).toThrow(
        GitHubValidationError
      );
      expect(() => validateGitHubUrl('https://github.com/owner/..')).toThrow(
        GitHubValidationError
      );
    });

    it('rejects malicious or invalid branch references', () => {
      expect(() => validateGitHubUrl('https://github.com/owner/repo/tree/--upload-pack=exploit')).toThrow(
        /Invalid branch or reference name/
      );
      expect(() => validateGitHubUrl('https://github.com/owner/repo/tree/invalid$branch;name')).toThrow(
        /Invalid branch or reference name/
      );
    });

    it('rejects unsupported extra path components (e.g. issues, pull requests)', () => {
      expect(() => validateGitHubUrl('https://github.com/owner/repo/issues/42')).toThrow(
        /Extra unsupported path components/
      );
    });
  });

  describe('safeRemoveDirectory and Directory Size', () => {
    const testTempDir = path.join(config.tempWorkspaceRoot, 'test-cleanup-fixture');

    beforeEach(() => {
      if (!fs.existsSync(config.tempWorkspaceRoot)) {
        fs.mkdirSync(config.tempWorkspaceRoot, { recursive: true });
      }
      if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (fs.existsSync(testTempDir)) {
        fs.rmSync(testTempDir, { recursive: true, force: true });
      }
    });

    it('safely removes an isolated directory inside tempWorkspaceRoot', () => {
      const nestedFile = path.join(testTempDir, 'test.txt');
      fs.writeFileSync(nestedFile, 'sample content', 'utf8');
      expect(fs.existsSync(nestedFile)).toBe(true);

      safeRemoveDirectory(testTempDir, config.tempWorkspaceRoot);
      expect(fs.existsSync(testTempDir)).toBe(false);
    });

    it('refuses to delete the tempWorkspaceRoot itself', () => {
      safeRemoveDirectory(config.tempWorkspaceRoot, config.tempWorkspaceRoot);
      expect(fs.existsSync(config.tempWorkspaceRoot)).toBe(true);
    });

    it('refuses to delete directories outside tempWorkspaceRoot', () => {
      const outsideDir = config.allowedRoot;
      safeRemoveDirectory(outsideDir, config.tempWorkspaceRoot);
      expect(fs.existsSync(outsideDir)).toBe(true);
    });

    it('calculates directory size and ignores .git internals', () => {
      const gitDir = path.join(testTempDir, '.git');
      fs.mkdirSync(gitDir, { recursive: true });
      fs.writeFileSync(path.join(gitDir, 'gitfile.bin'), Buffer.alloc(5000));

      const sourceFile = path.join(testTempDir, 'index.ts');
      fs.writeFileSync(sourceFile, Buffer.alloc(1200));

      const size = calculateDirectorySize(testTempDir);
      expect(size).toBe(1200);
    });
  });

  describe('importAndAnalyzeGitHubRepository with Mock Git Executor', () => {
    // Helper to recursively copy directory
    function copyDirSync(src: string, dest: string) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDirSync(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    it('successfully imports, parses JS/TS/HTML, records provenance, cleans up workspace, and supports ChangeScope & CareerLens', async () => {
      let createdWorkspace = '';

      // Mock git clone executor: copies sample-repo into workspace
      const mockGitExecutor = async (options: GitCloneOptions) => {
        createdWorkspace = options.workspacePath;
        const sampleRepoPath = path.join(config.allowedRoot, 'sample-repo');
        copyDirSync(sampleRepoPath, options.workspacePath);
        const demoShopPublic = path.join(config.allowedRoot, 'demo-shop-easy', 'public');
        if (fs.existsSync(demoShopPublic)) {
          copyDirSync(demoShopPublic, path.join(options.workspacePath, 'public'));
        }
        return { stdout: 'Cloned successfully', stderr: '' };
      };

      const mockCommitShaResolver = async () => 'test-commit-sha-12345';

      const analysis = await importAndAnalyzeGitHubRepository({
        repositoryUrl: 'https://github.com/kayaNK2125/devatlas-core',
        gitExecutor: mockGitExecutor,
        commitShaResolver: mockCommitShaResolver
      });

      // 1. Check analysis output and provenance
      expect(analysis.id).toBeDefined();
      expect(analysis.sourceType).toBe('github');
      expect(analysis.gitHubUrl).toBe('https://github.com/kayaNK2125/devatlas-core');
      expect(analysis.commitSha).toBe('test-commit-sha-12345');
      expect(analysis.repoName).toBe('devatlas-core');

      // 2. Check that existing RepoAtlas engines analyzed the files
      expect(analysis.summary.totalFiles).toBeGreaterThanOrEqual(8);
      expect(analysis.graph.nodes.length).toBeGreaterThanOrEqual(8);
      expect(analysis.graph.edges.length).toBeGreaterThan(0);

      // Verify HTML document and script load dependencies were captured
      const htmlNode = analysis.graph.nodes.find(n => n.nodeType === 'document');
      expect(htmlNode).toBeDefined();

      // 3. Verify workspace cleanup: directory must NOT exist after analysis
      expect(createdWorkspace).toBeTruthy();
      expect(fs.existsSync(createdWorkspace)).toBe(false);

      // 4. Verify in-memory session: ChangeScope impact engine works after checkout removal
      const impact = calculateChangeImpact(analysis, 'src/utils/crypto.ts');
      expect(impact.affectedFiles.length).toBeGreaterThan(0);
      expect(impact.heuristicRisk).toBeDefined();

      // 5. Verify CareerLens evidence endpoint returns GitHub provenance
      const evidenceRes = await request(app).get(`/api/v1/analyses/${analysis.id}/career-evidence`);
      expect(evidenceRes.status).toBe(200);
      expect(evidenceRes.body.repository.sourceType).toBe('github');
      expect(evidenceRes.body.repository.gitHubUrl).toBe('https://github.com/kayaNK2125/devatlas-core');
      expect(evidenceRes.body.repository.commitSha).toBe('test-commit-sha-12345');
    });

    it('rejects oversized repository and cleans up temporary workspace', async () => {
      let createdWorkspace = '';

      const mockOversizedGitExecutor = async (options: GitCloneOptions) => {
        createdWorkspace = options.workspacePath;
        fs.mkdirSync(options.workspacePath, { recursive: true });
        // Create an oversized file exceeding maxRepoSizeBytes (mocked or small)
        const bigFile = path.join(options.workspacePath, 'huge-bundle.js');
        // Write larger than 50MB would be slow, let's verify error when limit exceeded
        // We can write 55MB or mock calculateDirectorySize
        fs.writeFileSync(bigFile, Buffer.alloc(1024 * 1024 * 51)); // 51MB
        return { stdout: '', stderr: '' };
      };

      await expect(
        importAndAnalyzeGitHubRepository({
          repositoryUrl: 'https://github.com/owner/oversized-repo',
          gitExecutor: mockOversizedGitExecutor
        })
      ).rejects.toThrow(GitHubImportError);

      // Workspace must be safely cleaned up on failure
      expect(fs.existsSync(createdWorkspace)).toBe(false);
    });

    it('cleans up temporary workspace when clone fails', async () => {
      let createdWorkspace = '';

      const mockFailingGitExecutor = async (options: GitCloneOptions) => {
        createdWorkspace = options.workspacePath;
        fs.mkdirSync(options.workspacePath, { recursive: true });
        throw new GitHubImportError('Remote repository not found', 404, 'REPOSITORY_NOT_FOUND');
      };

      await expect(
        importAndAnalyzeGitHubRepository({
          repositoryUrl: 'https://github.com/owner/nonexistent-repo',
          gitExecutor: mockFailingGitExecutor
        })
      ).rejects.toThrow(GitHubImportError);

      expect(fs.existsSync(createdWorkspace)).toBe(false);
    });

    it('fails cleanly without exposing credentials when repository is private or terminal prompt disabled', async () => {
      let createdWorkspace = '';

      const mockPrivateRepoExecutor = async (options: GitCloneOptions) => {
        createdWorkspace = options.workspacePath;
        fs.mkdirSync(options.workspacePath, { recursive: true });
        // Simulates git clone exiting with terminal prompts disabled / auth failure
        throw new GitHubImportError(
          'Repository not found or private. DevAtlas Core only imports public GitHub repositories.',
          404,
          'REPOSITORY_NOT_FOUND'
        );
      };

      try {
        await importAndAnalyzeGitHubRepository({
          repositoryUrl: 'https://github.com/secret-org/private-repo',
          gitExecutor: mockPrivateRepoExecutor
        });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GitHubImportError);
        const importErr = err as GitHubImportError;
        expect(importErr.statusCode).toBe(404);
        expect(importErr.code).toBe('REPOSITORY_NOT_FOUND');
        expect(importErr.message).not.toContain('password');
        expect(importErr.message).not.toContain('token');
        expect(importErr.message).toContain('public GitHub repositories');
      }

      expect(fs.existsSync(createdWorkspace)).toBe(false);
    });

    it('cleans up temporary workspace when repository has no supported source files', async () => {
      let createdWorkspace = '';

      const mockEmptyRepoGitExecutor = async (options: GitCloneOptions) => {
        createdWorkspace = options.workspacePath;
        fs.mkdirSync(options.workspacePath, { recursive: true });
        fs.writeFileSync(path.join(options.workspacePath, 'README.md'), '# Just markdown');
        return { stdout: '', stderr: '' };
      };

      await expect(
        importAndAnalyzeGitHubRepository({
          repositoryUrl: 'https://github.com/owner/docs-only-repo',
          gitExecutor: mockEmptyRepoGitExecutor
        })
      ).rejects.toThrow(/No supported JavaScript or TypeScript source files/);

      expect(fs.existsSync(createdWorkspace)).toBe(false);
    });
  });

  describe('POST /api/v1/repositories/import-github HTTP API', () => {
    it('returns 400 when repositoryUrl is missing', async () => {
      const res = await request(app)
        .post('/api/v1/repositories/import-github')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when repositoryUrl has unsupported host', async () => {
      const res = await request(app)
        .post('/api/v1/repositories/import-github')
        .send({ repositoryUrl: 'https://bitbucket.org/owner/repo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('UNSUPPORTED_HOST');
    });

    it('returns 400 when repositoryUrl contains credentials', async () => {
      const res = await request(app)
        .post('/api/v1/repositories/import-github')
        .send({ repositoryUrl: 'https://admin:secret@github.com/owner/repo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('CREDENTIALS_NOT_ALLOWED');
    });

    it('returns 400 when repositoryUrl has path traversal sequence', async () => {
      const res = await request(app)
        .post('/api/v1/repositories/import-github')
        .send({ repositoryUrl: 'https://github.com/owner/../evil' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_REPO_NAME');
    });
  });

  describe('Security & Path Containment Regression Protection', () => {
    it('existing /api/v1/analyze continues to reject path traversal attempts outside root', async () => {
      const res = await request(app)
        .post('/api/v1/analyze')
        .send({ repoPath: '../../outside-root' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PATH_TRAVERSAL_DENIED');
    });

    it('existing /api/v1/analyze continues to scan valid local sample-repo', async () => {
      const res = await request(app)
        .post('/api/v1/analyze')
        .send({ repoPath: 'sample-repo' });

      expect(res.status).toBe(200);
      expect(res.body.summary.totalFiles).toBeGreaterThanOrEqual(8);
    });
  });
});
