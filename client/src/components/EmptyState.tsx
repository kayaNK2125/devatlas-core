import React from 'react';
import { Compass, GitBranch, ShieldCheck, Zap } from 'lucide-react';

interface EmptyStateProps {
  onLoadSample: () => void;
  isLoading: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onLoadSample, isLoading }) => {
  return (
    <div className="glass-panel empty-state-card">
      <div className="empty-icon-wrap">
        <Compass size={32} />
      </div>

      <div style={{ maxWidth: '640px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
          Explore Repository Architecture & Change Blast Radius
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          DevAtlas Core combines <strong>RepoAtlas</strong> (AST-driven TypeScript/JavaScript dependency extraction)
          and <strong>ChangeScope</strong> (reverse-dependency impact analysis with heuristic risk evaluation).
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        width: '100%',
        maxWidth: '780px',
        margin: '16px 0 24px',
        textAlign: 'left'
      }}>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', marginBottom: '6px' }}>
            <GitBranch size={16} />
            <strong style={{ fontSize: '0.85rem' }}>1. RepoAtlas Intelligence</strong>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Real AST scanning via TypeScript Compiler API. Detects static imports, re-exports, dynamic imports, CommonJS require, and circular chains.
          </p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--risk-mod)', marginBottom: '6px' }}>
            <Zap size={16} />
            <strong style={{ fontSize: '0.85rem' }}>2. ChangeScope Impact</strong>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Select any file to simulate hypothetical change. Traverses reverse edges to compute blast radius, depth, candidate tests, and heuristic risk.
          </p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--risk-low)', marginBottom: '6px' }}>
            <ShieldCheck size={16} />
            <strong style={{ fontSize: '0.85rem' }}>3. CareerLens Ready</strong>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Exports verified repository skill evidence (languages, packages, testing maturity, modularity) adhering to a schema for CareerLens.
          </p>
        </div>
      </div>

      <button
        onClick={onLoadSample}
        className="btn-primary"
        disabled={isLoading}
        style={{ padding: '0 28px' }}
      >
        <Zap size={16} fill="currentColor" />
        Analyze Sample Repository Fixture
      </button>
    </div>
  );
};
