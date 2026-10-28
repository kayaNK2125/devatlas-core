import { describe, it, expect } from 'vitest';
import path from 'path';
import { scanRepository } from '../src/scanner/fileScanner';
import { buildDependencyGraph } from '../src/engine/dependencyEngine';
import { calculateChangeImpact, TargetFileNotFoundError } from '../src/engine/impactEngine';

describe('ChangeScope Impact Engine', () => {
  const sampleRepoPath = path.resolve(__dirname, '../../sample-repo');
  const scan = scanRepository(sampleRepoPath);
  const analysis = buildDependencyGraph(scan.files, scan.packageManifest, 'sample-repo');

  it('computes reverse impact and identifies affected files for crypto.ts', () => {
    const impact = calculateChangeImpact(analysis, 'src/utils/crypto.ts');

    expect(impact.targetFile).toBe('src/utils/crypto.ts');
    expect(impact.affectedFiles.length).toBeGreaterThan(0);

    const affectedPaths = impact.affectedFiles.map(a => a.path);
    // Direct dependents
    expect(affectedPaths).toContain('src/services/token.service.ts');
    expect(affectedPaths).toContain('src/services/auth.service.ts');

    // Transitive dependents (index.ts imports auth.service.ts)
    expect(affectedPaths).toContain('src/index.ts');

    // Candidate test files
    const candidateTestPaths = impact.candidateTests.map(t => t.path);
    expect(candidateTestPaths).toContain('test/crypto.test.ts');

    // Heuristic risk score validation
    expect(impact.heuristicRisk.score).toBeGreaterThan(0);
    expect(impact.heuristicRisk.score).toBeLessThanOrEqual(100);
    expect(['Low', 'Moderate', 'High', 'Critical']).toContain(impact.heuristicRisk.level);
    expect(impact.heuristicRisk.disclaimer).toContain('Heuristic Assessment');
    expect(impact.heuristicRisk.explanation.length).toBeGreaterThan(20);
  });

  it('identifies isolated leaf file as low risk', () => {
    // index.ts is an entry point, nobody imports it
    const impact = calculateChangeImpact(analysis, 'src/index.ts');
    expect(impact.affectedFiles.length).toBe(0);
    expect(impact.heuristicRisk.level).toBe('Low');
    expect(impact.heuristicRisk.score).toBe(5);
  });

  it('throws TargetFileNotFoundError for non-existent file', () => {
    expect(() => {
      calculateChangeImpact(analysis, 'src/services/ghost.ts');
    }).toThrow(TargetFileNotFoundError);
  });
});
