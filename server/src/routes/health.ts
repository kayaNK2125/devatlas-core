import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'DevAtlas Core API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    allowedRoot: config.allowedRoot,
    maxFileCount: config.maxFileCount
  });
});

export default router;
