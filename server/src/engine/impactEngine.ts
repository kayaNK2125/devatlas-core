import path from 'path';
import {
  AnalysisRecord,
  AffectedFile,
  CandidateTest,
  HeuristicRiskAssessment,
  ImpactAnalysisResult
} from '../scanner/types';

export class TargetFileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`Target file '${filePath}' was not found in the repository analysis.`);
    this.name = 'TargetFileNotFoundError';
  }
}

/**
 * Calculates the change impact analysis for a specified target file using reverse dependency traversal
 */
export function calculateChangeImpact(
  analysis: AnalysisRecord,
  targetFilePath: string
): ImpactAnalysisResult {
  // Normalize target file path with forward slashes
  const normalizedTarget = targetFilePath.replace(/\\/g, '/');

  // Verify target file exists in the analysis graph
  const nodeExists = analysis.graph.nodes.some(n => n.id === normalizedTarget);
  if (!nodeExists) {
    throw new TargetFileNotFoundError(normalizedTarget);
  }

  // 1. Build Reverse Adjacency List:
  // Edge is source -> target (source imports target, so source depends on target).
  // If target changes, source is affected!
  // reverseMap: target -> [sources that import target]
  const reverseMap = new Map<string, string[]>();
  for (const node of analysis.graph.nodes) {
    reverseMap.set(node.id, []);
  }

  for (const edge of analysis.graph.edges) {
    const list = reverseMap.get(edge.target) || [];
    list.push(edge.source);
    reverseMap.set(edge.target, list);
  }

  // 2. BFS Traversal along reverse edges
  const queue: Array<{ file: string; depth: number; chain: string[] }> = [
    { file: normalizedTarget, depth: 0, chain: [normalizedTarget] }
  ];

  // Map of affected file path -> minimum depth and chain
  const affectedMap = new Map<string, { depth: number; chain: string[] }>();

  while (queue.length > 0) {
    const { file, depth, chain } = queue.shift()!;
    const dependents = reverseMap.get(file) || [];

    for (const dependent of dependents) {
      if (dependent === normalizedTarget) continue; // Skip cycles back to target

      if (!affectedMap.has(dependent)) {
        const newChain = [...chain, dependent];
        affectedMap.set(dependent, { depth: depth + 1, chain: newChain });
        queue.push({ file: dependent, depth: depth + 1, chain: newChain });
      }
    }
  }

  // Node lookup for quick property check
  const nodeMap = new Map(analysis.graph.nodes.map(n => [n.id, n]));

  // 3. Assemble Affected Files List
  const affectedFiles: AffectedFile[] = [];
  let maxDepth = 0;
  let directDependentsCount = 0;
  let transitiveDependentsCount = 0;

  for (const [filePath, info] of affectedMap.entries()) {
    const isDirect = info.depth === 1;
    if (isDirect) {
      directDependentsCount++;
    } else {
      transitiveDependentsCount++;
    }

    if (info.depth > maxDepth) {
      maxDepth = info.depth;
    }

    const node = nodeMap.get(filePath);
    affectedFiles.push({
      path: filePath,
      depth: info.depth,
      isDirect,
      isTest: !!node?.isTest,
      dependencyChain: info.chain
    });
  }

  // Sort by depth ascending, then path
  affectedFiles.sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));

  // 4. Identify Candidate Tests
  const candidateTestsMap = new Map<string, CandidateTest>();

  // A. Any test file found in the affected list
  for (const aff of affectedFiles) {
    if (aff.isTest) {
      candidateTestsMap.set(aff.path, {
        path: aff.path,
        depth: aff.depth,
        isDirect: aff.isDirect,
        reason: aff.isDirect ? 'imports_target' : 'imports_transitive'
      });
    }
  }

  // B. Name matching tests in repo (e.g. auth.service.ts -> auth.service.test.ts)
  const targetNode = nodeMap.get(normalizedTarget);
  if (targetNode?.language !== 'HTML' && targetNode?.nodeType !== 'document') {
    const targetBaseName = path.basename(normalizedTarget, path.extname(normalizedTarget));
    for (const testPath of analysis.testFiles) {
      if (!candidateTestsMap.has(testPath)) {
        const testBase = path.basename(testPath);
        if (
          testBase.startsWith(`${targetBaseName}.test.`) ||
          testBase.startsWith(`${targetBaseName}.spec.`) ||
          testBase === `${targetBaseName}.test.ts` ||
          testBase === `${targetBaseName}.test.js` ||
          testBase === `${targetBaseName}.test.tsx` ||
          testBase === `${targetBaseName}.test.jsx`
        ) {
          candidateTestsMap.set(testPath, {
            path: testPath,
            depth: affectedMap.get(testPath)?.depth || 1,
            isDirect: affectedMap.get(testPath)?.depth === 1 || false,
            reason: 'name_match'
          });
        }
      }
    }
  }

  const candidateTests = Array.from(candidateTestsMap.values()).sort(
    (a, b) => a.depth - b.depth || a.path.localeCompare(b.path)
  );

  // 5. Compute Heuristic Risk Score
  const totalCodebaseFiles = analysis.summary.totalFiles;
  const totalAffected = affectedFiles.length;
  const codebaseAffectedPercent =
    totalCodebaseFiles > 1
      ? Math.round((totalAffected / (totalCodebaseFiles - 1)) * 1000) / 10
      : 0;

  const heuristicRisk = computeHeuristicRisk({
    totalCodebaseFiles,
    totalAffected,
    directDependentsCount,
    transitiveDependentsCount,
    maxDepth,
    candidateTestsCount: candidateTests.length,
    codebaseAffectedPercent
  });

  return {
    targetFile: normalizedTarget,
    analysisId: analysis.id,
    heuristicRisk,
    affectedFiles,
    candidateTests,
    totalCodebaseFiles
  };
}

interface RiskCalculationInput {
  totalCodebaseFiles: number;
  totalAffected: number;
  directDependentsCount: number;
  transitiveDependentsCount: number;
  maxDepth: number;
  candidateTestsCount: number;
  codebaseAffectedPercent: number;
}

function computeHeuristicRisk(input: RiskCalculationInput): HeuristicRiskAssessment {
  const {
    totalAffected,
    directDependentsCount,
    transitiveDependentsCount,
    maxDepth,
    candidateTestsCount,
    codebaseAffectedPercent
  } = input;

  if (totalAffected === 0) {
    return {
      score: 5,
      level: 'Low',
      explanation:
        'Isolated leaf file: No direct or transitive dependents detected. Low risk for hypothetical change.',
      disclaimer:
        'Heuristic Assessment: This score is a static dependency-based heuristic estimation to prioritize review and testing, not a formal guarantee or calibrated probability of runtime failure.',
      factors: {
        directDependentsCount: 0,
        transitiveDependentsCount: 0,
        totalAffected: 0,
        maxDepth: 0,
        codebaseAffectedPercent: 0,
        candidateTestsCount,
        hasCoveringTests: candidateTestsCount > 0
      }
    };
  }

  // 1. Breadth score (0 to 40)
  const breadthScore = Math.min(40, (codebaseAffectedPercent / 100) * 40 * 1.5);

  // 2. Direct impact score (0 to 25)
  const directScore = Math.min(25, (directDependentsCount / 4) * 25);

  // 3. Depth score (0 to 20)
  const depthScore = Math.min(20, (maxDepth / 3) * 20);

  // 4. Test protection modifier (-10 to +15)
  let testModifier = 0;
  if (candidateTestsCount === 0) {
    testModifier = 15; // Penalty: zero candidate tests found for affected blast radius
  } else if (candidateTestsCount >= directDependentsCount) {
    testModifier = -10; // Bonus: tests cover direct blast radius
  } else {
    testModifier = 0;
  }

  let rawScore = Math.round(breadthScore + directScore + depthScore + testModifier);
  const finalScore = Math.max(5, Math.min(98, rawScore));

  let level: 'Low' | 'Moderate' | 'High' | 'Critical';
  if (finalScore <= 25) {
    level = 'Low';
  } else if (finalScore <= 50) {
    level = 'Moderate';
  } else if (finalScore <= 75) {
    level = 'High';
  } else {
    level = 'Critical';
  }

  const testStatusDesc =
    candidateTestsCount > 0
      ? `${candidateTestsCount} candidate test file(s) available to verify impacts.`
      : 'No automated tests detected in the impact radius.';

  const explanation =
    `Hypothetical modification impacts ${totalAffected} file(s) (${directDependentsCount} direct, ${transitiveDependentsCount} transitive) ` +
    `across depth ${maxDepth} (~${codebaseAffectedPercent}% of repository). ${testStatusDesc} Heuristic risk level: ${level} (${finalScore}/100).`;

  return {
    score: finalScore,
    level,
    explanation,
    disclaimer:
      'Heuristic Assessment: This score is a static dependency-based heuristic estimation to prioritize review and testing, not a formal guarantee or calibrated probability of runtime failure.',
    factors: {
      directDependentsCount,
      transitiveDependentsCount,
      totalAffected,
      maxDepth,
      codebaseAffectedPercent,
      candidateTestsCount,
      hasCoveringTests: candidateTestsCount > 0
    }
  };
}
