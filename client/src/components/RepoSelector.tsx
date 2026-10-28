import React, { useState } from 'react';
import { FolderGit2, Play, BookmarkCheck, AlertCircle, Globe, GitBranch } from 'lucide-react';

interface RepoSelectorProps {
  repoPath: string;
  setRepoPath: (path: string) => void;
  onAnalyze: () => void;
  onImportGitHub: (url: string) => void;
  isLoading: boolean;
  allowedRoot?: string;
  error?: string | null;
}

export const RepoSelector: React.FC<RepoSelectorProps> = ({
  repoPath,
  setRepoPath,
  onAnalyze,
  onImportGitHub,
  isLoading,
  allowedRoot,
  error
}) => {
  const [mode, setMode] = useState<'local' | 'github'>('local');
  const [gitHubUrl, setGitHubUrl] = useState<string>('https://github.com/kayaNK2125/devatlas-core');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      if (mode === 'local') {
        onAnalyze();
      } else {
        onImportGitHub(gitHubUrl);
      }
    }
  };

  const handleUseSample = () => {
    setRepoPath('sample-repo');
  };

  const handleUseShopEasy = () => {
    setRepoPath('demo-shop-easy');
  };

  const handleUseSampleGitHub = () => {
    setGitHubUrl('https://github.com/kayaNK2125/devatlas-core');
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setMode('local')}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid',
            borderColor: mode === 'local' ? 'var(--primary)' : 'var(--border-subtle)',
            background: mode === 'local' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface)',
            color: mode === 'local' ? '#ffffff' : 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          <FolderGit2 size={14} />
          <span>Local Repository</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('github')}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid',
            borderColor: mode === 'github' ? 'var(--accent-cyan)' : 'var(--border-subtle)',
            background: mode === 'github' ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-surface)',
            color: mode === 'github' ? '#ffffff' : 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          <Globe size={14} />
          <span>Public GitHub Repository</span>
        </button>
      </div>

      {/* Main Input Bar */}
      <div className="glass-panel repo-bar">
        {mode === 'local' ? (
          <>
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
              Sample Repo
            </button>

            <button
              type="button"
              onClick={handleUseShopEasy}
              className="btn-secondary"
              title="Fill input with the demo ShopEasy repository"
              disabled={isLoading}
            >
              <GitBranch size={16} />
              Demo ShopEasy
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
          </>
        ) : (
          <>
            <div className="repo-input-wrapper">
              <Globe size={18} style={{ color: 'var(--accent-cyan)' }} />
              <input
                type="text"
                className="repo-input"
                placeholder="https://github.com/owner/repository (public repos only)..."
                value={gitHubUrl}
                onChange={(e) => setGitHubUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
            </div>

            <button
              type="button"
              onClick={handleUseSampleGitHub}
              className="btn-secondary"
              title="Fill input with sample public GitHub repository"
              disabled={isLoading}
            >
              <BookmarkCheck size={16} />
              e.g. devatlas-core
            </button>

            <button
              type="button"
              onClick={() => onImportGitHub(gitHubUrl)}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                boxShadow: '0 4px 14px rgba(6, 182, 212, 0.3)'
              }}
              disabled={isLoading || !gitHubUrl.trim()}
            >
              {isLoading ? (
                <>
                  <span className="radar-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  Cloning & Analyzing...
                </>
              ) : (
                <>
                  <Globe size={16} />
                  Analyze GitHub Repository
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Helper Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {mode === 'local' ? (
          <>
            <div>
              Allowed Root: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{allowedRoot || 'Loading root...'}</span>
            </div>
            <div>
              Enter a path relative to the root or absolute within root. Traversal outside is blocked.
            </div>
          </>
        ) : (
          <>
            <div>
              SSRF Protected: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>github.com (HTTPS only)</span>
            </div>
            <div>
              Shallow clone (--depth 1) into isolated sandbox with automatic cleanup.
            </div>
          </>
        )}
      </div>

      {/* Error Banner */}
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
