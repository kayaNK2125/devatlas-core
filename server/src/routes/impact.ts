import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { analysisStore } from '../store/analysisStore';
import { calculateChangeImpact, TargetFileNotFoundError } from '../engine/impactEngine';

const router = Router();

const ImpactRequestSchema = z.object({
  analysisId: z.string({
    required_error: 'analysisId is required'
  }).uuid('analysisId must be a valid UUID'),
  targetFile: z.string({
    required_error: 'targetFile is required'
  }).min(1, 'targetFile cannot be empty')
});

router.post('/api/v1/impact', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = ImpactRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.errors.map(e => e.message).join(', ')
      });
    }

    const { analysisId, targetFile } = parseResult.data;

    // Look up cached analysis
    const analysis = analysisStore.get(analysisId);
    if (!analysis) {
      return res.status(404).json({
        error: 'ANALYSIS_NOT_FOUND',
        message: `Analysis session '${analysisId}' was not found. Please analyze the repository first.`
      });
    }

    // Run ChangeScope impact analysis
    const impactResult = calculateChangeImpact(analysis, targetFile);

    return res.status(200).json(impactResult);
  } catch (err: unknown) {
    if (err instanceof TargetFileNotFoundError) {
      return res.status(404).json({
        error: 'TARGET_FILE_NOT_FOUND',
        message: err.message
      });
    }
    return next(err);
  }
});

export default router;
