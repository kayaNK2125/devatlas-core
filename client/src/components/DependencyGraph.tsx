import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape, { Core } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { ZoomIn, ZoomOut, Maximize2, Search, SlidersHorizontal } from 'lucide-react';
import { DependencyGraph as GraphData, ImpactResponse } from '../types';

// Register dagre layout extension
try {
  cytoscape.use(dagre);
} catch {
  // Already registered or fallback
}

interface DependencyGraphProps {
  graph: GraphData;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  impactResult: ImpactResponse | null;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  graph,
  selectedFile,
  onSelectFile,
  impactResult
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [layoutName, setLayoutName] = useState<'dagre' | 'cose' | 'concentric' | 'breadthfirst'>('dagre');
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize and update Cytoscape instance
  useEffect(() => {
    if (!containerRef.current || graph.nodes.length === 0) return;

    const cyElements = [
      ...graph.nodes.map(n => ({
        data: {
          id: n.id,
          label: n.label,
          path: n.path,
          language: n.language,
          isTest: n.isTest,
          linesOfCode: n.linesOfCode
        }
      })),
      ...graph.edges.map(e => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          isTypeOnly: e.isTypeOnly
        }
      }))
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements: cyElements,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        {
          selector: 'node',
          style: {
            'content': 'data(label)',
            'font-family': 'Plus Jakarta Sans, sans-serif',
            'font-size': '11px',
            'font-weight': 600,
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#f8fafc',
            'background-color': '#162032',
            'border-width': 2,
            'border-color': '#3b82f6',
            'width': 'label',
            'height': '32px',
            'padding': '10px',
            'shape': 'roundrectangle',
            'text-wrap': 'none',
            'text-max-width': '120px',
            'transition-property': 'background-color, border-color, opacity, border-width',
            'transition-duration': 0.2
          }
        },
        {
          selector: 'node[language = "HTML"]',
          style: {
            'border-color': '#a855f7',
            'background-color': '#2e1065',
            'color': '#f3e8ff'
          }
        },
        {
          selector: 'node[?isTest]',
          style: {
            'border-color': '#10b981',
            'background-color': '#062d22',
            'color': '#6ee7b7'
          }
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': '#2a3a52',
            'target-arrow-color': '#3b82f6',
            'width': 1.5,
            'arrow-scale': 0.8,
            'opacity': 0.7,
            'transition-property': 'line-color, target-arrow-color, width, opacity',
            'transition-duration': 0.2
          }
        },
        {
          selector: 'edge[type = "script-load"]',
          style: {
            'line-color': '#a855f7',
            'target-arrow-color': '#c084fc',
            'line-style': 'dashed',
            'width': 2,
            'opacity': 0.85
          }
        },
        {
          selector: 'edge[?isTypeOnly]',
          style: {
            'line-style': 'dashed',
            'opacity': 0.4
          }
        },
        // Selected target file
        {
          selector: '.selected-target',
          style: {
            'background-color': '#78350f',
            'border-color': '#f59e0b',
            'border-width': 3,
            'color': '#fef3c7',
            'opacity': 1,
            'z-index': 100
          }
        },
        // Directly affected file
        {
          selector: '.impact-direct',
          style: {
            'background-color': '#431407',
            'border-color': '#f97316',
            'border-width': 2.5,
            'color': '#ffedd5',
            'opacity': 1,
            'z-index': 90
          }
        },
        // Transitively affected file
        {
          selector: '.impact-transitive',
          style: {
            'background-color': '#450a0a',
            'border-color': '#ef4444',
            'border-width': 2,
            'color': '#fee2e2',
            'opacity': 1,
            'z-index': 80
          }
        },
        // Dimmed nodes when impact mode is on
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.15
          }
        },
        // Highlighted active edges
        {
          selector: '.impact-edge',
          style: {
            'line-color': '#f97316',
            'target-arrow-color': '#f97316',
            'width': 2.5,
            'opacity': 1,
            'z-index': 50
          }
        }
      ]
    });

    // Node click selection
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const filePath = node.data('id');
      onSelectFile(filePath);
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graph, onSelectFile]);

  // Apply Layout
  const runLayout = useCallback((layoutType: string) => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    let options: cytoscape.LayoutOptions;
    if (layoutType === 'dagre') {
      options = {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 50,
        rankSep: 80,
        padding: 40
      } as any;
    } else if (layoutType === 'cose') {
      options = {
        name: 'cose',
        animate: true,
        nodeRepulsion: () => 6000,
        idealEdgeLength: () => 100,
        padding: 40
      };
    } else if (layoutType === 'concentric') {
      options = {
        name: 'concentric',
        padding: 40
      };
    } else {
      options = {
        name: 'breadthfirst',
        directed: true,
        padding: 40
      };
    }

    const layout = cy.layout(options);
    layout.run();
  }, []);

  // Update layout on layoutName change or graph reload
  useEffect(() => {
    runLayout(layoutName);
  }, [layoutName, graph, runLayout]);

  // Update visual classes based on selected file and ChangeScope impact
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    cy.batch(() => {
      // Clear previous classes
      cy.elements().removeClass('selected-target impact-direct impact-transitive dimmed impact-edge');

      if (!selectedFile) return;

      const targetNode = cy.$(`node[id = "${selectedFile}"]`);
      if (targetNode.length > 0) {
        targetNode.addClass('selected-target');
      }

      if (impactResult && impactResult.targetFile === selectedFile) {
        // Collect direct and transitive nodes
        const directPaths = new Set(
          impactResult.affectedFiles.filter(a => a.isDirect).map(a => a.path)
        );
        const transitivePaths = new Set(
          impactResult.affectedFiles.filter(a => !a.isDirect).map(a => a.path)
        );

        // Highlight affected nodes
        cy.nodes().forEach(node => {
          const id = node.data('id');
          if (id === selectedFile) {
            // Already selected-target
          } else if (directPaths.has(id)) {
            node.addClass('impact-direct');
          } else if (transitivePaths.has(id)) {
            node.addClass('impact-transitive');
          } else {
            node.addClass('dimmed');
          }
        });

        // Highlight reverse dependency edges
        cy.edges().forEach(edge => {
          const src = edge.data('source');
          const tgt = edge.data('target');
          // If source depends on target, and target is in affected set or targetFile
          if (
            (tgt === selectedFile && directPaths.has(src)) ||
            (directPaths.has(tgt) && transitivePaths.has(src)) ||
            (transitivePaths.has(tgt) && transitivePaths.has(src))
          ) {
            edge.addClass('impact-edge');
          } else {
            edge.addClass('dimmed');
          }
        });
      }
    });
  }, [selectedFile, impactResult]);

  // Filter / Search highlight
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    if (!searchQuery.trim()) {
      if (!selectedFile) {
        cy.elements().removeClass('dimmed');
      }
      return;
    }

    const q = searchQuery.toLowerCase();
    cy.batch(() => {
      cy.nodes().forEach(node => {
        const path = (node.data('path') || '').toLowerCase();
        if (path.includes(q)) {
          node.removeClass('dimmed');
        } else if (!selectedFile) {
          node.addClass('dimmed');
        }
      });
    });
  }, [searchQuery, selectedFile]);

  // Controls
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 30);

  return (
    <div className="glass-panel graph-panel">
      <div className="graph-toolbar">
        <div className="graph-toolbar-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Dependency Graph
            </span>
            <span className="brand-badge" style={{ fontSize: '0.65rem' }}>
              {graph.nodes.length} nodes · {graph.edges.length} edges
            </span>
          </div>
        </div>

        <div className="graph-toolbar-group">
          {/* Search file input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            fontSize: '0.78rem'
          }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Find file..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                width: '110px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem'
              }}
            />
          </div>

          {/* Layout Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {(['dagre', 'cose', 'concentric'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLayoutName(l)}
                className={`toolbar-btn ${layoutName === l ? 'active' : ''}`}
                title={`Switch layout to ${l}`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Zoom controls */}
          <button onClick={handleZoomIn} className="toolbar-btn" title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button onClick={handleZoomOut} className="toolbar-btn" title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button onClick={handleFit} className="toolbar-btn" title="Fit to screen">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className="graph-viewport">
        <div ref={containerRef} id="cy" />

        <div className="graph-legend">
          <div className="legend-item">
            <span className="legend-chip" style={{ background: '#162032', border: '1px solid #3b82f6' }} />
            <span>Code Source</span>
          </div>
          <div className="legend-item">
            <span className="legend-chip" style={{ background: '#2e1065', border: '1px solid #a855f7' }} />
            <span>HTML Document</span>
          </div>
          <div className="legend-item">
            <span className="legend-chip" style={{ background: '#062d22', border: '1px solid #10b981' }} />
            <span>Test File</span>
          </div>
          <div className="legend-item">
            <span className="legend-chip" style={{ background: '#78350f', border: '1px solid #f59e0b' }} />
            <span>Target Changed</span>
          </div>
          <div className="legend-item">
            <span className="legend-chip" style={{ background: '#431407', border: '1px solid #f97316' }} />
            <span>Direct Impact</span>
          </div>
          <div className="legend-item">
            <span className="legend-chip" style={{ background: '#450a0a', border: '1px solid #ef4444' }} />
            <span>Transitive Impact</span>
          </div>
        </div>
      </div>
    </div>
  );
};
