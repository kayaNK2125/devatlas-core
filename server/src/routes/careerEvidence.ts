import { Router, Request, Response } from 'express';
import path from 'path';
import { analysisStore } from '../store/analysisStore';
import schemaContent from '../schemas/careerEvidenceSchema.json';

const router = Router();

// Expose JSON schema for CareerLens developers
router.get('/api/v1/career-evidence/schema', (req: Request, res: Response) => {
  res.json(schemaContent);
});

router.get('/api/v1/analyses/:id/career-evidence', (req: Request, res: Response) => {
  const { id } = req.params;

  const analysis = analysisStore.get(id);
  if (!analysis) {
    return res.status(404).json({
      error: 'ANALYSIS_NOT_FOUND',
      message: `Analysis '${id}' not found. Please submit a repository for analysis first.`
    });
  }

  // Categorize detected packages and tools
  const testingTools: string[] = [];
  const backendTools: string[] = [];
  const frontendTools: string[] = [];
  const buildAndTypes: string[] = [];

  for (const pkg of analysis.packages) {
    const name = pkg.name.toLowerCase();
    if (
      name.includes('jest') ||
      name.includes('vitest') ||
      name.includes('mocha') ||
      name.includes('chai') ||
      name.includes('cypress') ||
      name.includes('playwright') ||
      name.includes('supertest') ||
      name.includes('testing-library')
    ) {
      testingTools.push(pkg.name);
    } else if (
      name.includes('express') ||
      name.includes('fastify') ||
      name.includes('koa') ||
      name.includes('nest') ||
      name.includes('jwt') ||
      name.includes('jsonwebtoken') ||
      name.includes('bcrypt') ||
      name.includes('prisma') ||
      name.includes('mongoose') ||
      name.includes('typeorm') ||
      name.includes('zod')
    ) {
      backendTools.push(pkg.name);
    } else if (
      name === 'react' ||
      name === 'react-dom' ||
      name.includes('vue') ||
      name.includes('svelte') ||
      name.includes('angular') ||
      name.includes('next') ||
      name.includes('redux') ||
      name.includes('zustand')
    ) {
      frontendTools.push(pkg.name);
    } else if (
      name.includes('typescript') ||
      name.includes('webpack') ||
      name.includes('vite') ||
      name.includes('esbuild') ||
      name.startsWith('@types/') ||
      name.includes('tsx') ||
      name.includes('ts-node')
    ) {
      buildAndTypes.push(pkg.name);
    }
  }

  const nonTestFilesCount = Math.max(1, analysis.summary.totalFiles - analysis.summary.testFilesCount);
  const testToCodeRatio =
    Math.round((analysis.summary.testFilesCount / nonTestFilesCount) * 100) / 100;

  const modularityRatio =
    analysis.summary.totalFiles > 0
      ? Math.round((analysis.summary.totalDependencies / analysis.summary.totalFiles) * 100) / 100
      : 0;

  const fileInventory = analysis.graph.nodes.map(n => ({
    path: n.path,
    language: n.language,
    linesOfCode: n.linesOfCode,
    isTest: n.isTest,
    importsCount: n.importsCount,
    importedByCount: n.importedByCount
  }));

  const careerEvidence = {
    schemaVersion: '1.0.0',
    analysisId: analysis.id,
    repository: {
      path: analysis.repoPath,
      name: analysis.repoName || path.basename(analysis.repoPath) || 'root',
      sourceType: analysis.sourceType || 'local',
      gitHubUrl: analysis.gitHubUrl,
      commitSha: analysis.commitSha,
      totalFiles: analysis.summary.totalFiles,
      totalDependencies: analysis.summary.totalDependencies
    },
    generatedAt: new Date().toISOString(),
    skillsAndTechnologies: {
      languages: analysis.languages,
      packages: analysis.packages,
      categorizedTools: {
        testing: testingTools,
        backend: backendTools,
        frontend: frontendTools,
        buildAndTypes
      }
    },
    architectureEvidence: {
      modularityRatio,
      dependencyDensity: modularityRatio,
      hasCircularDependencies: analysis.circularDependencies.length > 0,
      circularChainsCount: analysis.circularDependencies.length
    },
    testEvidence: {
      totalTestFiles: analysis.summary.testFilesCount,
      testToCodeRatio,
      testFilePaths: analysis.testFiles
    },
    fileInventoryEvidence: fileInventory
  };

  return res.json(careerEvidence);
});

export default router;
