import { describe, it, expect } from 'vitest';
import path from 'path';
import { scanRepository } from '../src/scanner/fileScanner';
import { buildDependencyGraph, detectCircularDependencies } from '../src/engine/dependencyEngine';

describe('RepoAtlas Dependency Engine', () => {
  const sampleRepoPath = path.resolve(__dirname, '../../sample-repo');

  it('scans the sample repository and finds expected files', () => {
    const scan = scanRepository(sampleRepoPath);
    expect(scan.files.length).toBeGreaterThanOrEqual(8);
    const paths = scan.files.map(f => f.path);
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('src/services/auth.service.ts');
    expect(paths).toContain('src/utils/crypto.ts');
    expect(paths).toContain('test/auth.service.test.ts');
  });

  it('builds a dependency graph with correct nodes and edges', () => {
    const scan = scanRepository(sampleRepoPath);
    const analysis = buildDependencyGraph(scan.files, scan.packageManifest, 'sample-repo');

    expect(analysis.graph.nodes.length).toBe(scan.files.length);
    expect(analysis.graph.edges.length).toBeGreaterThan(5);

    // Verify auth.service.ts depends on crypto.ts
    const authToCrypto = analysis.graph.edges.find(
      e => e.source === 'src/services/auth.service.ts' && e.target === 'src/utils/crypto.ts'
    );
    expect(authToCrypto).toBeDefined();

    // Verify crypto test file detected
    expect(analysis.testFiles).toContain('test/crypto.test.ts');
    expect(analysis.testFiles).toContain('test/auth.service.test.ts');

    // Verify packages detected
    const packageNames = analysis.packages.map(p => p.name);
    expect(packageNames).toContain('express');
    expect(packageNames).toContain('jsonwebtoken');
  });

  it('detects circular dependencies when present', () => {
    const nodes = ['A.ts', 'B.ts', 'C.ts', 'D.ts'];
    const adj = new Map<string, string[]>([
      ['A.ts', ['B.ts']],
      ['B.ts', ['C.ts']],
      ['C.ts', ['A.ts', 'D.ts']],
      ['D.ts', []]
    ]);

    const cycles = detectCircularDependencies(nodes, adj);
    expect(cycles.length).toBe(1);
    expect(cycles[0]).toContain('A.ts');
    expect(cycles[0]).toContain('B.ts');
    expect(cycles[0]).toContain('C.ts');
  });
});
