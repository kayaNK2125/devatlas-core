import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseSourceFile, isRelativeSpecifier, extractPackageName } from '../src/engine/astParser';
import { ScannedFile } from '../src/scanner/types';

describe('TypeScript AST Parser', () => {
  const sampleRepoPath = path.resolve(__dirname, '../../sample-repo');

  it('determines relative vs package specifiers correctly', () => {
    expect(isRelativeSpecifier('./logger')).toBe(true);
    expect(isRelativeSpecifier('../utils/crypto')).toBe(true);
    expect(isRelativeSpecifier('/absolute')).toBe(true);
    expect(isRelativeSpecifier('express')).toBe(false);
    expect(isRelativeSpecifier('@types/node')).toBe(false);
    expect(isRelativeSpecifier('lodash/debounce')).toBe(false);
  });

  it('extracts package names cleanly', () => {
    expect(extractPackageName('express')).toBe('express');
    expect(extractPackageName('lodash/get')).toBe('lodash');
    expect(extractPackageName('@types/node/fs')).toBe('@types/node');
  });

  it('extracts imports and exports from TypeScript source file', () => {
    const authFile: ScannedFile = {
      path: 'src/services/auth.service.ts',
      fullPath: path.join(sampleRepoPath, 'src/services/auth.service.ts'),
      name: 'auth.service.ts',
      extension: '.ts',
      size: 500,
      isTest: false,
      language: 'TypeScript'
    };

    const parsed = parseSourceFile(authFile);
    expect(parsed.linesOfCode).toBeGreaterThan(10);
    expect(parsed.exports).toContain('AuthService');

    const specifiers = parsed.imports.map(i => i.specifier);
    expect(specifiers).toContain('./token.service');
    expect(specifiers).toContain('./user.service');
    expect(specifiers).toContain('../utils/crypto');
    expect(specifiers).toContain('../utils/logger');
  });

  it('detects CommonJS require() calls', () => {
    const formatFile: ScannedFile = {
      path: 'src/utils/format.js',
      fullPath: path.join(sampleRepoPath, 'src/utils/format.js'),
      name: 'format.js',
      extension: '.js',
      size: 200,
      isTest: false,
      language: 'JavaScript'
    };

    const parsed = parseSourceFile(formatFile);
    const requireImport = parsed.imports.find(i => i.type === 'require');
    expect(requireImport).toBeDefined();
    expect(requireImport?.specifier).toBe('./logger');
  });
});
