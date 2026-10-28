import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('DevAtlas Core API Endpoints', () => {
  let createdAnalysisId = '';

  it('GET /health returns 200 and server status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('DevAtlas Core API');
    expect(res.body.allowedRoot).toBeDefined();
  });

  it('POST /api/v1/analyze scans repository and builds dependency graph', async () => {
    const res = await request(app)
      .post('/api/v1/analyze')
      .send({ repoPath: 'sample-repo' });

    expect(res.status).toBe(200);
    expect(res.body.analysisId).toBeDefined();
    expect(res.body.summary.totalFiles).toBeGreaterThanOrEqual(8);
    expect(res.body.graph.nodes.length).toBeGreaterThanOrEqual(8);
    expect(res.body.graph.edges.length).toBeGreaterThan(0);
    expect(res.body.languages.length).toBeGreaterThan(0);
    expect(res.body.packages.length).toBeGreaterThan(0);

    createdAnalysisId = res.body.analysisId;
  });

  it('POST /api/v1/analyze rejects path traversal outside root', async () => {
    const res = await request(app)
      .post('/api/v1/analyze')
      .send({ repoPath: '../../escaped-path' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PATH_TRAVERSAL_DENIED');
  });

  it('POST /api/v1/impact calculates change blast radius for target file', async () => {
    const res = await request(app)
      .post('/api/v1/impact')
      .send({
        analysisId: createdAnalysisId,
        targetFile: 'src/utils/crypto.ts'
      });

    expect(res.status).toBe(200);
    expect(res.body.targetFile).toBe('src/utils/crypto.ts');
    expect(res.body.affectedFiles.length).toBeGreaterThan(0);
    expect(res.body.heuristicRisk).toBeDefined();
    expect(res.body.heuristicRisk.disclaimer).toContain('Heuristic Assessment');
  });

  it('POST /api/v1/impact returns 404 for unknown analysisId', async () => {
    const res = await request(app)
      .post('/api/v1/impact')
      .send({
        analysisId: '00000000-0000-0000-0000-000000000000',
        targetFile: 'src/utils/crypto.ts'
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ANALYSIS_NOT_FOUND');
  });

  it('GET /api/v1/analyses/:id/career-evidence produces valid CareerLens evidence', async () => {
    const res = await request(app).get(`/api/v1/analyses/${createdAnalysisId}/career-evidence`);

    expect(res.status).toBe(200);
    expect(res.body.schemaVersion).toBe('1.0.0');
    expect(res.body.analysisId).toBe(createdAnalysisId);
    expect(res.body.skillsAndTechnologies.languages.length).toBeGreaterThan(0);
    expect(res.body.skillsAndTechnologies.packages.length).toBeGreaterThan(0);
    expect(res.body.testEvidence.totalTestFiles).toBeGreaterThanOrEqual(1);
    expect(res.body.architectureEvidence.dependencyDensity).toBeDefined();
    expect(res.body.fileInventoryEvidence.length).toBeGreaterThanOrEqual(8);
  });

  it('GET /api/v1/career-evidence/schema serves documentation schema', async () => {
    const res = await request(app).get('/api/v1/career-evidence/schema');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('CareerLensEvidenceArtifact');
  });
});
