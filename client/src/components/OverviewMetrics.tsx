import React from 'react';
import { Files, Network, TestTube2, Code2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AnalysisSummary, LanguageStat } from '../types';

interface OverviewMetricsProps {
  summary: AnalysisSummary;
  languages: LanguageStat[];
}

export const OverviewMetrics: React.FC<OverviewMetricsProps> = ({ summary, languages }) => {
  const primaryLang = languages[0]?.name || 'TypeScript';
  const testRatio =
    summary.totalFiles > 0
      ? Math.round((summary.testFilesCount / summary.totalFiles) * 100)
      : 0;

  return (
    <div className="metrics-grid">
      <div className="glass-card metric-card">
        <div className="metric-header">
          <span className="metric-title">Repository Files</span>
          <div className="metric-icon-wrap">
            <Files size={18} />
          </div>
        </div>
        <div className="metric-value">{summary.totalFiles}</div>
        <div className="metric-subtitle">
          {summary.codeFilesCount !== undefined ? (
            <span>
              <strong>{summary.codeFilesCount}</strong> code · <strong>{summary.htmlDocumentsCount}</strong> HTML · <strong>{summary.testFilesCount}</strong> tests
            </span>
          ) : (
            summary.totalFiles > 0 ? `${summary.totalFiles - summary.testFilesCount} production + ${summary.testFilesCount} test` : 'No files scanned'
          )}
        </div>
      </div>

      <div className="glass-card metric-card">
        <div className="metric-header">
          <span className="metric-title">Dependencies</span>
          <div className="metric-icon-wrap">
            <Network size={18} />
          </div>
        </div>
        <div className="metric-value">{summary.totalDependencies}</div>
        <div className="metric-subtitle">
          {summary.moduleImportsCount !== undefined ? (
            <span>
              <strong>{summary.moduleImportsCount}</strong> module imports · <strong>{summary.scriptLoadsCount}</strong> script loads
            </span>
          ) : (
            'Directed internal module imports'
          )}
        </div>
      </div>

      <div className="glass-card metric-card">
        <div className="metric-header">
          <span className="metric-title">Automated Tests</span>
          <div className="metric-icon-wrap" style={{ color: 'var(--risk-low)' }}>
            <TestTube2 size={18} />
          </div>
        </div>
        <div className="metric-value">{summary.testFilesCount}</div>
        <div className="metric-subtitle">
          {testRatio}% of repository files
        </div>
      </div>

      <div className="glass-card metric-card">
        <div className="metric-header">
          <span className="metric-title">Tech & Languages</span>
          <div className="metric-icon-wrap" style={{ color: 'var(--accent-cyan)' }}>
            <Code2 size={18} />
          </div>
        </div>
        <div className="metric-value">{primaryLang}</div>
        <div className="metric-subtitle">
          {summary.packagesCount} package dependencies detected
        </div>
      </div>

      <div className="glass-card metric-card">
        <div className="metric-header">
          <span className="metric-title">Circular Cycles</span>
          <div
            className="metric-icon-wrap"
            style={{ color: summary.circularDependencyChainsCount > 0 ? 'var(--risk-mod)' : 'var(--risk-low)' }}
          >
            {summary.circularDependencyChainsCount > 0 ? (
              <AlertTriangle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
          </div>
        </div>
        <div className="metric-value">{summary.circularDependencyChainsCount}</div>
        <div className="metric-subtitle">
          {summary.circularDependencyChainsCount === 0 ? 'Clean acyclic architecture' : 'Dependency cycles detected'}
        </div>
      </div>
    </div>
  );
};
