import { AnalyzeResponse, ImpactResponse, CareerEvidence, HealthResponse } from './types';

const API_BASE = ''; // Uses Vite proxy in development

export class ApiError extends Error {
  public code: string;
  public status: number;

  constructor(message: string, status = 500, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data.message || `Request failed with status ${res.status}`,
      res.status,
      data.error || 'SERVER_ERROR'
    );
  }
  return data as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse<HealthResponse>(res);
}

export async function analyzeRepository(repoPath: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/v1/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath })
  });
  return handleResponse<AnalyzeResponse>(res);
}

export async function analyzeImpact(analysisId: string, targetFile: string): Promise<ImpactResponse> {
  const res = await fetch(`${API_BASE}/api/v1/impact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysisId, targetFile })
  });
  return handleResponse<ImpactResponse>(res);
}

export async function fetchCareerEvidence(analysisId: string): Promise<CareerEvidence> {
  const res = await fetch(`${API_BASE}/api/v1/analyses/${analysisId}/career-evidence`);
  return handleResponse<CareerEvidence>(res);
}
