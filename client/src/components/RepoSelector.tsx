import React from 'react';
import { FolderGit2, Play, BookmarkCheck, AlertCircle } from 'lucide-react';

interface RepoSelectorProps {
  repoPath: string;
  setRepoPath: (path: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  allowedRoot?: string;
  error?: string | null;
}

export const RepoSelector: React.FC<RepoSelectorProps> = ({
  repoPath,
  setRepoPath,
  onAnalyze,
  isLoading,
  allowedRoot,
  error
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      onAnalyze();
    }
  };

  const handleUseSample = () => {
    setRepoPath('sample-repo');
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div className="glass-panel repo-bar">
        <div className="repo-input-wrapper">
          <FolderGit2 size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="repo-input"
            placeholder="e.g. sample-repo or relative path within allowed root..."
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
        </div>

        <button
          type="button"
          onClick={handleUseSample}
          className="btn-secondary"
          title="Fill input with the built-in sample repository fixture"
          disabled={isLoading}
        >
          <BookmarkCheck size={16} />
          Use Sample Repo
        </button>

        <button
          type="button"
          onClick={onAnalyze}
          className="btn-primary"
          disabled={isLoading || !repoPath.trim()}
        >
          {isLoading ? (
            <>
              <span className="radar-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              Scanning...
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              Analyze Repository
            </>
          )}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <div>
          Allowed Root: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{allowedRoot || 'Loading root...'}</span>
        </div>
        <div>
          Enter a path relative to the root or absolute within root. Traversal outside is blocked.
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '12px 16px',
          background: 'var(--risk-crit-bg)',
          border: '1px solid var(--risk-crit-border)',
          borderRadius: 'var(--radius-md)',
          color: '#fca5a5',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
