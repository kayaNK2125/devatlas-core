import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  importAndAnalyzeGitHubRepository,
  GitHubValidationError,
  GitHubImportError
} from '../services/githubImporter';

const router = Router();

const ImportGitHubRequestSchema = z.object({
  repositoryUrl: z
    .string({
      required_error: 'repositoryUrl is required'
    })
    .min(1, 'repositoryUrl cannot be empty')
});

router.post('/api/v1/repositories/import-github', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = ImportGitHubRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.errors.map(e => e.message).join(', ')
      });
    }

    const { repositoryUrl } = parseResult.data;

    const analysisRecord = await importAndAnalyzeGitHubRepository({
      repositoryUrl
    });

    return res.status(200).json({
      analysisId: analysisRecord.id,
      repoPath: analysisRecord.repoPath,
      repoName: analysisRecord.repoName,
      sourceType: analysisRecord.sourceType,
      gitHubUrl: analysisRecord.gitHubUrl,
      commitSha: analysisRecord.commitSha,
      scannedAt: analysisRecord.scannedAt,
      summary: analysisRecord.summary,
      graph: analysisRecord.graph,
      languages: analysisRecord.languages,
      packages: analysisRecord.packages,
      testFiles: analysisRecord.testFiles,
      circularDependencies: analysisRecord.circularDependencies
    });
  } catch (err: unknown) {
    if (err instanceof GitHubValidationError || err instanceof GitHubImportError) {
      return res.status(err.statusCode).json({
        error: err.code,
        message: err.message
      });
    }
    return next(err);
  }
});

export default router;
