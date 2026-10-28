import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { validateRepositoryPath, PathValidationError } from '../scanner/pathValidator';
import { scanRepository } from '../scanner/fileScanner';
import { buildDependencyGraph } from '../engine/dependencyEngine';
import { analysisStore } from '../store/analysisStore';

const router = Router();

const AnalyzeRequestSchema = z.object({
  repoPath: z.string({
    required_error: 'repoPath is required'
  }).min(1, 'repoPath cannot be empty')
});

router.post('/api/v1/analyze', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AnalyzeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.errors.map(e => e.message).join(', ')
      });
    }

    const { repoPath } = parseResult.data;

    // Validate path containment and existence
    const validated = validateRepositoryPath(repoPath, config.allowedRoot);

    // Scan repository for JavaScript/TypeScript files
    const scanResult = scanRepository(validated.resolvedPath);

    if (scanResult.files.length === 0) {
      return res.status(422).json({
        error: 'NO_SOURCE_FILES_FOUND',
        message: `No supported JavaScript or TypeScript source files were found in '${validated.relativePath}'.`,
        warnings: scanResult.warnings
      });
    }

    // Build RepoAtlas dependency graph and analysis record
    const analysisRecord = buildDependencyGraph(
      scanResult.files,
      scanResult.packageManifest,
      validated.relativePath
    );

    // Store in-memory for subsequent ChangeScope and CareerEvidence queries
    analysisStore.save(analysisRecord);

    return res.status(200).json({
      analysisId: analysisRecord.id,
      repoPath: analysisRecord.repoPath,
      scannedAt: analysisRecord.scannedAt,
      summary: analysisRecord.summary,
      graph: analysisRecord.graph,
      languages: analysisRecord.languages,
      packages: analysisRecord.packages,
      testFiles: analysisRecord.testFiles,
      circularDependencies: analysisRecord.circularDependencies,
      warnings: scanResult.warnings
    });
  } catch (err: unknown) {
    if (err instanceof PathValidationError) {
      return res.status(err.statusCode).json({
        error: err.code,
        message: err.message
      });
    }
    return next(err);
  }
});

export default router;
