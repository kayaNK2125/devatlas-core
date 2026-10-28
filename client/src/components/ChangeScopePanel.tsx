import React, { useState } from 'react';
import {
  GitCommit,
  AlertTriangle,
  TestTube,
  FileCode,
  FileText,
  ArrowRight,
  ShieldAlert,
  Info,
  FolderTree,
  ChevronRight
} from 'lucide-react';
import { DependencyGraph, ImpactResponse, GraphNode } from '../types';

interface ChangeScopePanelProps {
  graph: DependencyGraph;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  impactResult: ImpactResponse | null;
  isLoadingImpact: boolean;
  onRunImpact: (file: string) => void;
}

export const ChangeScopePanel: React.FC<ChangeScopePanelProps> = ({
  graph,
  selectedFile,
  onSelectFile,
  impactResult,
  isLoadingImpact,
  onRunImpact
}) => {
  const [activeTab, setActiveTab] = useState<'impact' | 'files'>('impact');
  const [fileFilter, setFileFilter] = useState('');

  const selectedNode: GraphNode | undefined = graph.nodes.find(n => n.id === selectedFile);

  const filteredFiles = graph.nodes.filter(n =>
    n.path.toLowerCase().includes(fileFilter.toLowerCase())
  );

  return (
    <div className="glass-panel side-panel">
      {/* Panel Tabs */}
      <div className="panel-tabs">
        <button
          className={`panel-tab ${activeTab === 'impact' ? 'active' : ''}`}
          onClick={() => setActiveTab('impact')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <GitCommit size={15} />
            <span>ChangeScope Impact</span>
          </div>
        </button>
        <button
          className={`panel-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <FolderTree size={15} />
            <span>All Files ({graph.nodes.length})</span>
          </div>
        </button>
      </div>

      <div className="panel-body">
        {activeTab === 'impact' ? (
          <div>
            {/* Target File Selection Card */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              marginBottom: '18px'
            }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                Target Source File Under Change
              </div>

              <select
                value={selectedFile || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    onSelectFile(val);
                    onRunImpact(val);
                  }
                }}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="" disabled>Select a file to simulate change...</option>
                {graph.nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.path} {n.isTest ? '(Test)' : n.language === 'HTML' ? '(HTML Doc)' : ''}
                  </option>
                ))}
              </select>

              {selectedNode && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '10px',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}>
                  <span>Language: <strong style={{ color: 'var(--text-primary)' }}>{selectedNode.language}</strong></span>
                  <span>LOC: <strong style={{ color: 'var(--text-primary)' }}>{selectedNode.linesOfCode}</strong></span>
                  <span>Direct Dependents: <strong style={{ color: 'var(--text-primary)' }}>{selectedNode.importedByCount}</strong></span>
                </div>
              )}
            </div>

            {/* Impact Loading */}
            {isLoadingImpact && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div className="radar-spinner" style={{ margin: '0 auto 14px' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Traversing reverse dependency tree & computing blast radius...
                </p>
              </div>
            )}

            {/* Impact Result Display */}
            {!isLoadingImpact && impactResult && (
              <div>
                {/* Risk Card */}
                <div className={`risk-card ${impactResult.heuristicRisk.level}`}>
                  <div className="risk-header">
                    <div>
                      <span className="metric-title">ChangeScope Risk</span>
                      <div className="risk-score-display">
                        {impactResult.heuristicRisk.score}
                        <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span>
                      </div>
                    </div>
                    <span className={`risk-badge ${impactResult.heuristicRisk.level}`}>
                      {impactResult.heuristicRisk.level} Risk
                    </span>
                  </div>

                  <div className="risk-meter-bar">
                    <div
                      className={`risk-meter-fill ${impactResult.heuristicRisk.level}`}
                      style={{ width: `${impactResult.heuristicRisk.score}%` }}
                    />
                  </div>

                  <p className="risk-explanation">
                    {impactResult.heuristicRisk.explanation}
                  </p>

                  <div className="risk-disclaimer">
                    <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
                    {impactResult.heuristicRisk.disclaimer}
                  </div>
                </div>

                {/* Candidate Tests Section */}
                <div className="section-subtitle">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TestTube size={15} style={{ color: 'var(--risk-low)' }} />
                    <span>Candidate Tests to Run</span>
                  </div>
                  <span className="depth-badge">
                    {impactResult.candidateTests.length} suite(s)
                  </span>
                </div>

                {impactResult.candidateTests.length > 0 ? (
                  impactResult.candidateTests.map(test => (
                    <div key={test.path} className="file-item">
                      <div className="file-item-left">
                        <TestTube size={14} style={{ color: 'var(--risk-low)', flexShrink: 0 }} />
                        <span className="file-path">{test.path}</span>
                      </div>
                      <span className="depth-badge direct">
                        {test.isDirect ? 'Direct Test' : `Transitive (Depth ${test.depth})`}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{
                    padding: '12px 14px',
                    background: 'var(--bg-surface)',
                    border: '1px dashed var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertTriangle size={15} style={{ color: 'var(--risk-mod)', flexShrink: 0 }} />
                    <span>No test files detectably import or cover this change. Manual test creation advised.</span>
                  </div>
                )}

                {/* Affected Files List */}
                <div className="section-subtitle">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlert size={15} style={{ color: 'var(--risk-high)' }} />
                    <span>Affected Dependents (Blast Radius)</span>
                  </div>
                  <span className="depth-badge">
                    {impactResult.affectedFiles.length} file(s)
                  </span>
                </div>

                {impactResult.affectedFiles.length > 0 ? (
                  impactResult.affectedFiles.map(aff => {
                    const isHtml = aff.path.endsWith('.html');
                    return (
                      <div key={aff.path} className="file-item">
                        <div className="file-item-left">
                          {isHtml ? (
                            <FileText size={14} style={{ color: '#a855f7', flexShrink: 0 }} />
                          ) : (
                            <FileCode size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                          )}
                          <div>
                            <div className="file-path">
                              {aff.path}
                              {isHtml && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  marginLeft: '6px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: 'rgba(168, 85, 247, 0.15)',
                                  color: '#c084fc',
                                  border: '1px solid rgba(168, 85, 247, 0.3)'
                                }}>
                                  HTML Document
                                </span>
                              )}
                            </div>
                            {aff.dependencyChain.length > 2 && (
                              <div style={{
                                fontSize: '0.68rem',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginTop: '2px'
                              }}>
                                <span>Chain:</span>
                                {aff.dependencyChain.map((step, idx) => (
                                  <React.Fragment key={step}>
                                    {idx > 0 && <ChevronRight size={10} />}
                                    <span>{step.split('/').pop()}</span>
                                  </React.Fragment>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`depth-badge ${aff.isDirect ? 'direct' : ''}`}>
                          {aff.isDirect ? 'Direct (Depth 1)' : `Transitive (Depth ${aff.depth})`}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{
                    padding: '12px 14px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)'
                  }}>
                    No other files import this module. Changes are self-contained.
                  </div>
                )}
              </div>
            )}

            {!isLoadingImpact && !impactResult && (
              <div style={{
                textAlign: 'center',
                padding: '40px 16px',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
              }}>
                <GitCommit size={36} style={{ color: 'var(--border-medium)', margin: '0 auto 12px' }} />
                <p>Click on any node in the dependency graph or select a file above to simulate a code change.</p>
              </div>
            )}
          </div>
        ) : (
          /* All Files Explorer Tab */
          <div>
            <div style={{ marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="Filter files in repository..."
                value={fileFilter}
                onChange={e => setFileFilter(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ maxHeight: '580px', overflowY: 'auto' }}>
              {filteredFiles.map(node => (
                <div
                  key={node.id}
                  className="file-item"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedFile === node.id ? 'var(--primary)' : 'var(--border-subtle)',
                    background: selectedFile === node.id ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)'
                  }}
                  onClick={() => {
                    onSelectFile(node.id);
                    onRunImpact(node.id);
                    setActiveTab('impact');
                  }}
                >
                  <div className="file-item-left">
                    {node.language === 'HTML' ? (
                      <FileText size={14} style={{ color: '#a855f7', flexShrink: 0 }} />
                    ) : (
                      <FileCode
                        size={14}
                        style={{ color: node.isTest ? 'var(--risk-low)' : 'var(--accent-cyan)', flexShrink: 0 }}
                      />
                    )}
                    <span className="file-path">{node.path}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {node.importedByCount} deps
                    </span>
                    <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
