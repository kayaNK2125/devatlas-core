import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RepoSelector } from './components/RepoSelector';
import { OverviewMetrics } from './components/OverviewMetrics';
import { DependencyGraph } from './components/DependencyGraph';
import { ChangeScopePanel } from './components/ChangeScopePanel';
import { CareerEvidenceModal } from './components/CareerEvidenceModal';
import { EmptyState } from './components/EmptyState';
import {
  fetchHealth,
  analyzeRepository,
  analyzeImpact,
  fetchCareerEvidence,
  ApiError
} from './api';
import {
  HealthResponse,
  AnalyzeResponse,
  ImpactResponse,
  CareerEvidence
} from './types';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [repoPath, setRepoPath] = useState<string>('sample-repo');
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [impactResult, setImpactResult] = useState<ImpactResponse | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState<boolean>(false);

  const [isCareerModalOpen, setIsCareerModalOpen] = useState<boolean>(false);
  const [careerEvidence, setCareerEvidence] = useState<CareerEvidence | null>(null);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState<boolean>(false);

  // Check backend health on initial load
  useEffect(() => {
    fetchHealth()
      .then(data => setHealth(data))
      .catch(() => {
        setHealth(null);
      });
  }, []);

  // Run impact analysis for a specific file
  const handleRunImpact = useCallback(async (filePath: string, currentAnalysisId?: string) => {
    const aid = currentAnalysisId || analysis?.analysisId;
    if (!aid) return;

    setIsLoadingImpact(true);
    try {
      const result = await analyzeImpact(aid, filePath);
      setImpactResult(result);
    } catch (err: unknown) {
      console.error('Impact analysis error:', err);
    } finally {
      setIsLoadingImpact(false);
    }
  }, [analysis]);

  // Handle repository analysis
  const handleAnalyze = async (customPath?: string) => {
    const pathToScan = customPath !== undefined ? customPath : repoPath;
    if (!pathToScan.trim()) return;

    setIsLoading(true);
    setError(null);
    setSelectedFile(null);
    setImpactResult(null);

    try {
      const data = await analyzeRepository(pathToScan);
      setAnalysis(data);

      // Auto-select a file with dependencies (e.g., crypto.ts or first non-test node) for immediate wow factor
      const defaultTarget =
        data.graph.nodes.find(n => n.id.includes('crypto.ts'))?.id ||
        data.graph.nodes.find(n => !n.isTest && n.importedByCount > 0)?.id ||
        data.graph.nodes[0]?.id;

      if (defaultTarget) {
        setSelectedFile(defaultTarget);
        handleRunImpact(defaultTarget, data.analysisId);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to analyze repository');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = (filePath: string) => {
    setSelectedFile(filePath);
    handleRunImpact(filePath);
  };

  const handleOpenCareerEvidence = async () => {
    if (!analysis) return;
    setIsCareerModalOpen(true);
    setIsLoadingEvidence(true);
    try {
      const evidence = await fetchCareerEvidence(analysis.analysisId);
      setCareerEvidence(evidence);
    } catch (err: unknown) {
      console.error('Career evidence error:', err);
    } finally {
      setIsLoadingEvidence(false);
    }
  };

  return (
    <div className="app-container">
      <Header
        health={health}
        hasAnalysis={!!analysis}
        onOpenCareerEvidence={handleOpenCareerEvidence}
      />

      <main className="main-content">
        <RepoSelector
          repoPath={repoPath}
          setRepoPath={setRepoPath}
          onAnalyze={() => handleAnalyze()}
          isLoading={isLoading}
          allowedRoot={health?.allowedRoot}
          error={error}
        />

        {analysis ? (
          <div>
            <OverviewMetrics
              summary={analysis.summary}
              languages={analysis.languages}
            />

            <div className="workspace-grid">
              <DependencyGraph
                graph={analysis.graph}
                selectedFile={selectedFile}
                onSelectFile={handleSelectFile}
                impactResult={impactResult}
              />

              <ChangeScopePanel
                graph={analysis.graph}
                selectedFile={selectedFile}
                onSelectFile={handleSelectFile}
                impactResult={impactResult}
                isLoadingImpact={isLoadingImpact}
                onRunImpact={handleRunImpact}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            onLoadSample={() => {
              setRepoPath('sample-repo');
              handleAnalyze('sample-repo');
            }}
            isLoading={isLoading}
          />
        )}
      </main>

      <CareerEvidenceModal
        evidence={careerEvidence}
        isOpen={isCareerModalOpen}
        onClose={() => setIsCareerModalOpen(false)}
        isLoading={isLoadingEvidence}
      />
    </div>
  );
};

export default App;
