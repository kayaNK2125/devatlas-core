import React from 'react';
import { Layers, ShieldCheck, Sparkles } from 'lucide-react';
import { HealthResponse } from '../types';

interface HeaderProps {
  health: HealthResponse | null;
  hasAnalysis: boolean;
  onOpenCareerEvidence: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health, hasAnalysis, onOpenCareerEvidence }) => {
  return (
    <header className="header">
      <div className="brand-section">
        <div className="brand-logo-icon">
          <Layers size={20} strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="brand-title">DevAtlas</span>
            <span className="brand-badge">Core Engine</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            RepoAtlas Intelligence & ChangeScope Blast Radius
          </p>
        </div>
      </div>

      <div className="header-meta">
        {hasAnalysis && (
          <button
            onClick={onOpenCareerEvidence}
            className="btn-secondary"
            style={{ height: '36px', fontSize: '0.8rem', gap: '6px' }}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-cyan)' }} />
            CareerLens Evidence
          </button>
        )}

        <div className="connection-pill">
          <span className={`status-dot ${health?.status === 'ok' ? 'online' : 'offline'}`} />
          <span>{health?.status === 'ok' ? 'Core API Connected' : 'Connecting...'}</span>
        </div>
      </div>
    </header>
  );
};
