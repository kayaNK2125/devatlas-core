export interface GraphNode {
  id: string;
  label: string;
  path: string;
  language: 'TypeScript' | 'TSX' | 'JavaScript' | 'JSX' | 'HTML' | string;
  nodeType?: 'source' | 'document';
  isTest: boolean;
  linesOfCode: number;
  importsCount: number;
  importedByCount: number;
  exportsCount: number;
  externalDependencies: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'static' | 'dynamic' | 'require' | 'reexport' | 'script-load';
  isTypeOnly: boolean;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LanguageStat {
  name: string;
  filesCount: number;
  percentage: number;
}

export interface PackageStat {
  name: string;
  version: string;
  isDev: boolean;
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

export interface AnalyzeResponse {
  analysisId: string;
  repoPath: string;
  repoName?: string;
  sourceType?: 'local' | 'github';
  gitHubUrl?: string;
  commitSha?: string;
  scannedAt: string;
  summary: AnalysisSummary;
  graph: DependencyGraph;
  languages: LanguageStat[];
  packages: PackageStat[];
  testFiles: string[];
  circularDependencies: string[][];
  warnings?: string[];
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
  score: number;
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

export interface ImpactResponse {
  targetFile: string;
  analysisId: string;
  heuristicRisk: HeuristicRiskAssessment;
  affectedFiles: AffectedFile[];
  candidateTests: CandidateTest[];
  totalCodebaseFiles: number;
}

export interface CareerEvidence {
  schemaVersion: string;
  analysisId: string;
  repository: {
    path: string;
    name: string;
    sourceType?: 'local' | 'github';
    gitHubUrl?: string;
    commitSha?: string;
    totalFiles: number;
    totalDependencies: number;
  };
  generatedAt: string;
  skillsAndTechnologies: {
    languages: LanguageStat[];
    packages: PackageStat[];
    categorizedTools: {
      testing: string[];
      backend: string[];
      frontend: string[];
      buildAndTypes: string[];
    };
  };
  architectureEvidence: {
    modularityRatio: number;
    dependencyDensity: number;
    hasCircularDependencies: boolean;
    circularChainsCount: number;
  };
  testEvidence: {
    totalTestFiles: number;
    testToCodeRatio: number;
    testFilePaths: string[];
  };
  fileInventoryEvidence: Array<{
    path: string;
    language: string;
    linesOfCode: number;
    isTest: boolean;
    importsCount: number;
    importedByCount: number;
  }>;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  allowedRoot: string;
  maxFileCount: number;
}
