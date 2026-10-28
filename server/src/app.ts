import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import analyzeRouter from './routes/analyze';
import impactRouter from './routes/impact';
import careerEvidenceRouter from './routes/careerEvidence';
import importGithubRouter from './routes/importGithub';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Mount Routes
app.use(healthRouter);
app.use(analyzeRouter);
app.use(impactRouter);
app.use(careerEvidenceRouter);
app.use(importGithubRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Resource not found: ${req.method} ${req.url}`
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred.'
  });
});
