import React from 'react';
import { Files, Network, TestTube2, Code2, AlertTriangle, CheckCircle2, Globe, FolderGit2, GitCommit } from 'lucide-react';
import { AnalysisSummary, LanguageStat } from '../types';

interface OverviewMetricsProps {
  summary: AnalysisSummary;
  languages: LanguageStat[];
  repoPath?: string;
  sourceType?: 'local' | 'github';
  gitHubUrl?: string;
  commitSha?: string;
  repoName?: string;
}

export const OverviewMetrics: React.FC<OverviewMetricsProps> = ({
  summary,
  languages,
  repoPath,
  sourceType,
  gitHubUrl,
  commitSha,
  repoName
}) => {
  const primaryLang = languages[0]?.name || 'TypeScript';
  const testRatio =
    summary.totalFiles > 0
      ? Math.round((summary.testFilesCount / summary.totalFiles) * 100)
      : 0;

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Repository Provenance Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '16px',
        fontSize: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {sourceType === 'github' ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                <Globe size={12} />
                <span>GITHUB REPO</span>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {repoName || repoPath}
              </span>
              {gitHubUrl && (
                <a
                  href={gitHubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--accent-cyan)',
                    textDecoration: 'none',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {gitHubUrl}
                </a>
              )}
            </>
          ) : (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                <FolderGit2 size={12} />
                <span>LOCAL WORKSPACE</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {repoPath}
              </span>
            </>
          )}
        </div>

        {commitSha && commitSha !== 'unknown' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)'
          }}>
            <GitCommit size={14} />
            <span>Commit: <strong style={{ color: 'var(--text-secondary)' }}>{commitSha.slice(0, 7)}</strong></span>
          </div>
        )}
      </div>

      {/* Metrics Cards Grid */}
      <div className="metrics-grid" style={{ marginBottom: 0 }}>
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
    </div>
  );
};
