import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Determine allowed root: defaults to the project workspace root C:\Users\Mayank\Projects\FINAL_YEAR
const defaultAllowedRoot = path.resolve(__dirname, '../..');

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  allowedRoot: path.resolve(process.env.DEVATLAS_ALLOWED_ROOT || defaultAllowedRoot),
  maxFileCount: parseInt(process.env.DEVATLAS_MAX_FILE_COUNT || '2000', 10),
  maxFileSizeBytes: parseInt(process.env.DEVATLAS_MAX_FILE_SIZE_BYTES || String(2 * 1024 * 1024), 10), // 2MB
  tempWorkspaceRoot: path.resolve(process.env.DEVATLAS_TEMP_WORKSPACE_ROOT || path.join(defaultAllowedRoot, '.temp-workspaces')),
  gitCloneTimeoutMs: parseInt(process.env.DEVATLAS_GIT_CLONE_TIMEOUT_MS || '45000', 10), // 45 seconds
  maxRepoSizeBytes: parseInt(process.env.DEVATLAS_MAX_REPO_SIZE_BYTES || String(50 * 1024 * 1024), 10), // 50MB
  env: process.env.NODE_ENV || 'development'
};
