import React, { useState } from 'react';
import { X, Copy, Check, Sparkles, Download, Code } from 'lucide-react';
import { CareerEvidence } from '../types';

interface CareerEvidenceModalProps {
  evidence: CareerEvidence | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
}

export const CareerEvidenceModal: React.FC<CareerEvidenceModalProps> = ({
  evidence,
  isOpen,
  onClose,
  isLoading
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonString = evidence ? JSON.stringify(evidence, null, 2) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!evidence) return;
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `career-evidence-${evidence.analysisId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-logo-icon" style={{ width: '32px', height: '32px' }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>CareerLens Evidence Artifact</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Compliant with Schema v1.0.0 for external portfolio & skill verification
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleCopy}
              className="toolbar-btn"
              disabled={!evidence || isLoading}
            >
              {copied ? <Check size={14} style={{ color: 'var(--risk-low)' }} /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="toolbar-btn"
              disabled={!evidence || isLoading}
            >
              <Download size={14} />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="toolbar-btn"
              style={{ padding: '6px' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <div className="radar-spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Extracting CareerLens skill telemetry...</p>
            </div>
          )}

          {!isLoading && evidence && (
            <div>
              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '16px',
                fontFamily: 'var(--font-sans)'
              }}>
                <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DETECTED STACK</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {evidence.skillsAndTechnologies.languages.map(l => l.name).join(', ')}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MODULARITY RATIO</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-cyan)', marginTop: '4px' }}>
                    {evidence.architectureEvidence.modularityRatio} deps / file
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AUTOMATED TEST RATIO</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--risk-low)', marginTop: '4px' }}>
                    {evidence.testEvidence.testToCodeRatio} test / prod
                  </div>
                </div>
              </div>

              {/* Raw JSON Code Block */}
              <pre className="code-block">
                <code>{jsonString}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
