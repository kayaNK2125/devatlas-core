import { describe, it, expect } from 'vitest';
import path from 'path';
import { validateRepositoryPath, PathValidationError } from '../src/scanner/pathValidator';

describe('Path Containment Validator', () => {
  const allowedRoot = path.resolve(__dirname, '../..'); // C:\Users\Mayank\Projects\FINAL_YEAR

  it('allows valid directories within the allowed root', () => {
    const result = validateRepositoryPath('sample-repo', allowedRoot);
    expect(result.resolvedPath).toBe(path.resolve(allowedRoot, 'sample-repo'));
    expect(result.relativePath).toBe('sample-repo');
  });

  it('allows the allowed root itself', () => {
    const result = validateRepositoryPath('.', allowedRoot);
    expect(result.resolvedPath).toBe(allowedRoot);
  });

  it('rejects path traversal attempting to escape the allowed root', () => {
    expect(() => {
      validateRepositoryPath('../../Windows', allowedRoot);
    }).toThrow(PathValidationError);

    try {
      validateRepositoryPath('../../../etc', allowedRoot);
    } catch (err) {
      expect(err).toBeInstanceOf(PathValidationError);
      expect((err as PathValidationError).statusCode).toBe(403);
      expect((err as PathValidationError).code).toBe('PATH_TRAVERSAL_DENIED');
    }
  });

  it('rejects empty paths', () => {
    expect(() => validateRepositoryPath('', allowedRoot)).toThrow('Repository path cannot be empty.');
    expect(() => validateRepositoryPath('   ', allowedRoot)).toThrow('Repository path cannot be empty.');
  });

  it('rejects non-existent directories', () => {
    try {
      validateRepositoryPath('non-existent-subfolder-12345', allowedRoot);
    } catch (err) {
      expect(err).toBeInstanceOf(PathValidationError);
      expect((err as PathValidationError).statusCode).toBe(404);
      expect((err as PathValidationError).code).toBe('DIRECTORY_NOT_FOUND');
    }
  });

  it('rejects files when a directory is required', () => {
    try {
      validateRepositoryPath('sample-repo/package.json', allowedRoot);
    } catch (err) {
      expect(err).toBeInstanceOf(PathValidationError);
      expect((err as PathValidationError).statusCode).toBe(400);
      expect((err as PathValidationError).code).toBe('NOT_A_DIRECTORY');
    }
  });
});
