export interface ScannedFile {
  path: string;           // Relative path from repo root with forward slashes, e.g. "src/index.ts"
  fullPath: string;       // Absolute file path
  name: string;           // File name, e.g. "index.ts"
  extension: string;      // Extension with dot, e.g. ".ts"
  size: number;           // File size in bytes
  isTest: boolean;        // Whether the file is classified as a test
  language: 'TypeScript' | 'TSX' | 'JavaScript' | 'JSX' | 'HTML';
  nodeType: 'source' | 'document';
}

export interface PackageManifest {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface ImportDetail {
  specifier: string;      // The raw import specifier, e.g. "./logger" or "express"
  isLocal: boolean;       // True if specifier starts with ./ or ../ or /
  resolvedFile?: string;  // Relative path if resolved to local file, e.g. "src/utils/logger.ts"
  type: 'static' | 'dynamic' | 'require' | 'reexport';
  isTypeOnly: boolean;
}

export interface FileAnalysis {
  file: ScannedFile;
  imports: ImportDetail[];
  exports: string[];
  externalDependencies: string[];
  linesOfCode: number;
}

export interface GraphNode {
  id: string;             // Unique identifier (relative file path, e.g. "src/index.ts")
  label: string;          // Short display label, e.g. "index.ts"
  path: string;           // Full relative path
  language: string;
  nodeType: 'source' | 'document';
  isTest: boolean;
  linesOfCode: number;
  importsCount: number;
  importedByCount: number;
  exportsCount: number;
  externalDependencies: string[];
}

export interface GraphEdge {
  id: string;
  source: string;         // Importing or loading file (relative path)
  target: string;         // Imported or loaded file (relative path)
  type: 'static' | 'dynamic' | 'require' | 'reexport' | 'script-load';
  isTypeOnly: boolean;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AnalysisSummary {
  totalFiles: number;
  totalDependencies: number;
  testFilesCount: number;
  languages: Record<string, number>;
  packagesCount: number;
  circularDependencyChainsCount: number;
  codeFilesCount: number;
  htmlDocumentsCount: number;
  moduleImportsCount: number;
  scriptLoadsCount: number;
}

export interface AnalysisRecord {
  id: string;
  repoPath: string;
  scannedAt: string;
  summary: AnalysisSummary;
  graph: DependencyGraph;
  languages: { name: string; filesCount: number; percentage: number }[];
  packages: { name: string; version: string; isDev: boolean }[];
  testFiles: string[];
  circularDependencies: string[][];
  rawFiles: Map<string, FileAnalysis>;
  sourceType?: 'local' | 'github';
  gitHubUrl?: string;
  commitSha?: string;
  repoName?: string;
}

export interface AffectedFile {
  path: string;
  depth: number;
  isDirect: boolean;
  isTest: boolean;
  dependencyChain: string[];
}

export interface CandidateTest {
  path: string;
  depth: number;
  isDirect: boolean;
  reason: 'imports_target' | 'imports_transitive' | 'name_match';
}

export interface HeuristicRiskAssessment {
  score: number;          // 0-100
  level: 'Low' | 'Moderate' | 'High' | 'Critical';
  explanation: string;
  disclaimer: string;
  factors: {
    directDependentsCount: number;
    transitiveDependentsCount: number;
    totalAffected: number;
    maxDepth: number;
    codebaseAffectedPercent: number;
    candidateTestsCount: number;
    hasCoveringTests: boolean;
  };
}

export interface ImpactAnalysisResult {
  targetFile: string;
  analysisId: string;
  heuristicRisk: HeuristicRiskAssessment;
  affectedFiles: AffectedFile[];
  candidateTests: CandidateTest[];
  totalCodebaseFiles: number;
}
