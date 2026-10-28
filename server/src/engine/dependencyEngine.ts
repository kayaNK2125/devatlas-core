import { ScannedFile, PackageManifest, GraphNode, GraphEdge, DependencyGraph, AnalysisSummary, AnalysisRecord } from '../scanner/types';
import { parseSourceFile, ParsedFileAst } from './astParser';
import { resolveLocalModule } from './moduleResolver';
import { parseHtmlFile, ParsedHtmlDocument } from './htmlParser';
import crypto from 'crypto';

/**
 * Finds all simple circular dependency cycles in a directed graph using DFS
 */
export function detectCircularDependencies(nodes: string[], adjacencyList: Map<string, string[]>): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  const cycleSignatures = new Set<string>();

  function dfs(current: string, pathStack: string[]): void {
    visited.add(current);
    recursionStack.add(current);
    pathStack.push(current);

    const neighbors = adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, pathStack);
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected: extract cycle from pathStack
        const cycleStartIndex = pathStack.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          const cycle = pathStack.slice(cycleStartIndex);
          cycle.push(neighbor);

          // Create normalized signature to avoid duplicates (e.g. A->B->A vs B->A->B)
          const baseCycle = cycle.slice(0, -1);
          const minIndex = baseCycle.indexOf([...baseCycle].sort()[0]);
          const normalized = [...baseCycle.slice(minIndex), ...baseCycle.slice(0, minIndex)].join('->');

          if (!cycleSignatures.has(normalized)) {
            cycleSignatures.add(normalized);
            cycles.push(cycle);
          }
        }
      }
    }

    pathStack.pop();
    recursionStack.delete(current);
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Builds the comprehensive RepoAtlas dependency graph and repository intelligence
 */
export function buildDependencyGraph(
  scannedFiles: ScannedFile[],
  packageManifest?: PackageManifest,
  repoPath = ''
): AnalysisRecord {
  const filePathsSet = new Set(scannedFiles.map(f => f.path));
  const parsedFiles = new Map<string, ParsedFileAst>();
  const parsedHtmlDocs = new Map<string, ParsedHtmlDocument>();

  // 1. Parse all files to extract AST imports / HTML script references
  for (const file of scannedFiles) {
    if (file.language === 'HTML') {
      const parsedHtml = parseHtmlFile(file, filePathsSet);
      parsedHtmlDocs.set(file.path, parsedHtml);
    } else {
      const parsed = parseSourceFile(file);
      parsedFiles.set(file.path, parsed);
    }
  }

  // 2. Resolve local modules and build graph edges
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();
  const importedByCounts = new Map<string, number>();
  const importsCounts = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  // Initialize maps
  for (const file of scannedFiles) {
    importedByCounts.set(file.path, 0);
    importsCounts.set(file.path, 0);
    adjacencyList.set(file.path, []);
  }

  // A. Build module import edges (TypeScript / JavaScript)
  for (const [sourcePath, analysis] of parsedFiles.entries()) {
    let fileImportCount = 0;

    for (const imp of analysis.imports) {
      if (imp.isLocal) {
        const resolvedTarget = resolveLocalModule(sourcePath, imp.specifier, filePathsSet);
        if (resolvedTarget) {
          imp.resolvedFile = resolvedTarget;
          const edgeId = `${sourcePath}->${resolvedTarget}`;

          // Avoid duplicate edges between same pair
          if (!edgeSet.has(edgeId) && sourcePath !== resolvedTarget) {
            edgeSet.add(edgeId);
            edges.push({
              id: edgeId,
              source: sourcePath,
              target: resolvedTarget,
              type: imp.type,
              isTypeOnly: imp.isTypeOnly
            });

            fileImportCount++;
            importedByCounts.set(resolvedTarget, (importedByCounts.get(resolvedTarget) || 0) + 1);

            const currentNeighbors = adjacencyList.get(sourcePath) || [];
            currentNeighbors.push(resolvedTarget);
            adjacencyList.set(sourcePath, currentNeighbors);
          }
        }
      }
    }

    importsCounts.set(sourcePath, fileImportCount);
  }

  // B. Build HTML script loading edges (HTML Document -> Script Source)
  for (const [htmlPath, htmlDoc] of parsedHtmlDocs.entries()) {
    let scriptLoadCount = 0;

    for (const ref of htmlDoc.scriptReferences) {
      const resolvedTarget = ref.resolvedFile;
      const edgeId = `${htmlPath}->${resolvedTarget}`;

      if (!edgeSet.has(edgeId) && htmlPath !== resolvedTarget) {
        edgeSet.add(edgeId);
        edges.push({
          id: edgeId,
          source: htmlPath,
          target: resolvedTarget,
          type: 'script-load',
          isTypeOnly: false
        });

        scriptLoadCount++;
        importedByCounts.set(resolvedTarget, (importedByCounts.get(resolvedTarget) || 0) + 1);

        const currentNeighbors = adjacencyList.get(htmlPath) || [];
        currentNeighbors.push(resolvedTarget);
        adjacencyList.set(htmlPath, currentNeighbors);
      }
    }

    importsCounts.set(htmlPath, scriptLoadCount);
  }

  // 3. Build Graph Nodes
  const nodes: GraphNode[] = scannedFiles.map(file => {
    const analysis = parsedFiles.get(file.path);
    const htmlDoc = parsedHtmlDocs.get(file.path);
    const loc = file.language === 'HTML' ? (htmlDoc?.linesOfCode || 0) : (analysis?.linesOfCode || 0);

    return {
      id: file.path,
      label: file.name,
      path: file.path,
      language: file.language,
      nodeType: file.nodeType,
      isTest: file.isTest,
      linesOfCode: loc,
      importsCount: importsCounts.get(file.path) || 0,
      importedByCount: importedByCounts.get(file.path) || 0,
      exportsCount: analysis?.exports.length || 0,
      externalDependencies: analysis?.externalDependencies || []
    };
  });

  // 4. Detect Circular Dependencies
  const allNodeIds = scannedFiles.map(f => f.path);
  const circularDependencies = detectCircularDependencies(allNodeIds, adjacencyList);

  // 5. Aggregate Languages
  const langCounts: Record<string, number> = {};
  for (const file of scannedFiles) {
    langCounts[file.language] = (langCounts[file.language] || 0) + 1;
  }
  const totalFiles = scannedFiles.length;
  const languagesList = Object.entries(langCounts).map(([name, count]) => ({
    name,
    filesCount: count,
    percentage: totalFiles > 0 ? Math.round((count / totalFiles) * 100) : 0
  })).sort((a, b) => b.filesCount - a.filesCount);

  // 6. Aggregate Packages
  const packagesMap = new Map<string, { name: string; version: string; isDev: boolean }>();

  // Add manifest packages if present
  if (packageManifest?.dependencies) {
    for (const [name, version] of Object.entries(packageManifest.dependencies)) {
      packagesMap.set(name, { name, version, isDev: false });
    }
  }
  if (packageManifest?.devDependencies) {
    for (const [name, version] of Object.entries(packageManifest.devDependencies)) {
      if (!packagesMap.has(name)) {
        packagesMap.set(name, { name, version, isDev: true });
      }
    }
  }

  // Add any discovered external dependencies from AST imports
  for (const analysis of parsedFiles.values()) {
    for (const extDep of analysis.externalDependencies) {
      if (!packagesMap.has(extDep)) {
        packagesMap.set(extDep, { name: extDep, version: 'detected-in-source', isDev: false });
      }
    }
  }

  const packages = Array.from(packagesMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // 7. Test Files
  const testFiles = scannedFiles.filter(f => f.isTest).map(f => f.path);

  const codeFilesCount = scannedFiles.filter(f => f.nodeType === 'source').length;
  const htmlDocumentsCount = scannedFiles.filter(f => f.nodeType === 'document').length;
  const moduleImportsCount = edges.filter(e => e.type !== 'script-load').length;
  const scriptLoadsCount = edges.filter(e => e.type === 'script-load').length;

  const summary: AnalysisSummary = {
    totalFiles,
    totalDependencies: edges.length,
    testFilesCount: testFiles.length,
    languages: langCounts,
    packagesCount: packages.length,
    circularDependencyChainsCount: circularDependencies.length,
    codeFilesCount,
    htmlDocumentsCount,
    moduleImportsCount,
    scriptLoadsCount
  };

  const analysisId = crypto.randomUUID();

  return {
    id: analysisId,
    repoPath,
    scannedAt: new Date().toISOString(),
    summary,
    graph: {
      nodes,
      edges
    },
    languages: languagesList,
    packages,
    testFiles,
    circularDependencies,
    rawFiles: parsedFiles as Map<string, any>
  };
}
