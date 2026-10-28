import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseHtmlFile, resolveHtmlScriptSrc, isExternalOrSpecialUrl } from '../src/engine/htmlParser';
import { scanRepository } from '../src/scanner/fileScanner';
import { buildDependencyGraph } from '../src/engine/dependencyEngine';
import { calculateChangeImpact } from '../src/engine/impactEngine';
import { ScannedFile } from '../src/scanner/types';

describe('HTML Script Dependency Detection', () => {
  const availableFiles = new Set([
    'public/index.html',
    'public/cart.html',
    'public/theme.js',
    'public/app.js',
    'public/cart.js',
    'public/shared/bundle.js',
    'src/main.js'
  ]);

  it('filters external and special URLs accurately', () => {
    expect(isExternalOrSpecialUrl('https://cdn.jsdelivr.net/npm/bootstrap@5/dist/js/bootstrap.bundle.min.js')).toBe(true);
    expect(isExternalOrSpecialUrl('http://example.com/analytics.js')).toBe(true);
    expect(isExternalOrSpecialUrl('//cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js')).toBe(true);
    expect(isExternalOrSpecialUrl('data:text/javascript;base64,console.log(1)')).toBe(true);
    expect(isExternalOrSpecialUrl('blob:http://localhost/uuid')).toBe(true);
    expect(isExternalOrSpecialUrl('javascript:void(0)')).toBe(true);
    expect(isExternalOrSpecialUrl('#')).toBe(true);
    expect(isExternalOrSpecialUrl('')).toBe(true);

    expect(isExternalOrSpecialUrl('theme.js')).toBe(false);
    expect(isExternalOrSpecialUrl('./app.js')).toBe(false);
    expect(isExternalOrSpecialUrl('../src/main.js')).toBe(false);
  });

  it('resolves relative paths from an HTML document directory', () => {
    // Relative to public/index.html
    const resolvedTheme = resolveHtmlScriptSrc('public/index.html', 'theme.js', availableFiles);
    expect(resolvedTheme).toBe('public/theme.js');

    const resolvedDotApp = resolveHtmlScriptSrc('public/index.html', './app.js', availableFiles);
    expect(resolvedDotApp).toBe('public/app.js');

    // Subdirectory relative
    const resolvedBundle = resolveHtmlScriptSrc('public/index.html', 'shared/bundle.js', availableFiles);
    expect(resolvedBundle).toBe('public/shared/bundle.js');

    // Strips query string and fragments
    const resolvedWithQuery = resolveHtmlScriptSrc('public/index.html', 'theme.js?v=2.1.0#cache', availableFiles);
    expect(resolvedWithQuery).toBe('public/theme.js');
  });

  it('safely handles missing script files without errors', () => {
    const missing = resolveHtmlScriptSrc('public/index.html', 'ghost-script.js', availableFiles);
    expect(missing).toBeNull();
  });

  it('rejects path traversal attempting to escape repository root', () => {
    const escaped = resolveHtmlScriptSrc('public/index.html', '../../outside.js', availableFiles);
    expect(escaped).toBeNull();
  });

  it('parses a page loading two local scripts, ignoring external scripts and non-js types', () => {
    const testHtmlFile: ScannedFile = {
      path: 'public/index.html',
      fullPath: path.resolve(__dirname, '../../demo-shop-easy/public/index.html'),
      name: 'index.html',
      extension: '.html',
      size: 1500,
      isTest: false,
      language: 'HTML',
      nodeType: 'document'
    };

    const parsed = parseHtmlFile(testHtmlFile, availableFiles);
    expect(parsed.linesOfCode).toBeGreaterThan(10);

    const resolvedFiles = parsed.scriptReferences.map(r => r.resolvedFile);
    expect(resolvedFiles).toContain('public/theme.js');
    expect(resolvedFiles).toContain('public/app.js');
    expect(resolvedFiles.length).toBe(2);
  });

  it('builds dependency graph with distinct HTML document nodes and script-load edges', () => {
    const demoShopPath = path.resolve(__dirname, '../../demo-shop-easy');
    const scan = scanRepository(demoShopPath);

    const htmlFiles = scan.files.filter(f => f.language === 'HTML');
    expect(htmlFiles.length).toBeGreaterThanOrEqual(4);

    // Verify HTML files are never classified as tests
    for (const hf of htmlFiles) {
      expect(hf.isTest).toBe(false);
      expect(hf.nodeType).toBe('document');
    }

    const analysis = buildDependencyGraph(scan.files, scan.packageManifest, 'demo-shop-easy');

    // Check summary distinctions
    expect(analysis.summary.htmlDocumentsCount).toBeGreaterThanOrEqual(4);
    expect(analysis.summary.codeFilesCount).toBeGreaterThanOrEqual(5);
    expect(analysis.summary.scriptLoadsCount).toBeGreaterThanOrEqual(5);

    // Verify script-load edges connect HTML document to loaded script
    const scriptEdges = analysis.graph.edges.filter(e => e.type === 'script-load');
    expect(scriptEdges.length).toBeGreaterThanOrEqual(5);

    const indexToTheme = scriptEdges.find(
      e => e.source === 'public/index.html' && e.target === 'public/theme.js'
    );
    expect(indexToTheme).toBeDefined();
    expect(indexToTheme?.type).toBe('script-load');
  });

  it('ChangeScope: a changed shared script identifies multiple dependent HTML documents', () => {
    const demoShopPath = path.resolve(__dirname, '../../demo-shop-easy');
    const scan = scanRepository(demoShopPath);
    const analysis = buildDependencyGraph(scan.files, scan.packageManifest, 'demo-shop-easy');

    // When theme.js changes:
    const impact = calculateChangeImpact(analysis, 'public/theme.js');

    expect(impact.targetFile).toBe('public/theme.js');
    const affectedPaths = impact.affectedFiles.map(a => a.path);

    // Multiple HTML documents load theme.js
    expect(affectedPaths).toContain('public/index.html');
    expect(affectedPaths).toContain('public/cart.html');
    expect(affectedPaths).toContain('public/contact.html');
    expect(affectedPaths).toContain('public/login.html');
    expect(affectedPaths).toContain('public/payment.html');

    // Verify HTML documents are not misclassified as test files
    for (const aff of impact.affectedFiles) {
      if (aff.path.endsWith('.html')) {
        expect(aff.isTest).toBe(false);
      }
    }

    // Verify heuristic risk assessment
    expect(impact.heuristicRisk.factors.directDependentsCount).toBeGreaterThanOrEqual(4);
    expect(impact.heuristicRisk.disclaimer).toContain('Heuristic Assessment');
  });

  it('preserves existing TypeScript/JavaScript import graph and ChangeScope behavior', () => {
    const sampleRepoPath = path.resolve(__dirname, '../../sample-repo');
    const scan = scanRepository(sampleRepoPath);
    const analysis = buildDependencyGraph(scan.files, scan.packageManifest, 'sample-repo');

    // Sample repo is pure TS/JS, 0 HTML docs
    expect(analysis.summary.htmlDocumentsCount).toBe(0);
    expect(analysis.summary.codeFilesCount).toBe(scan.files.length);
    expect(analysis.summary.scriptLoadsCount).toBe(0);
    expect(analysis.summary.moduleImportsCount).toBe(analysis.graph.edges.length);

    // ChangeScope on crypto.ts still functions identically
    const impact = calculateChangeImpact(analysis, 'src/utils/crypto.ts');
    expect(impact.affectedFiles.map(a => a.path)).toContain('src/services/auth.service.ts');
    expect(impact.candidateTests.map(t => t.path)).toContain('test/crypto.test.ts');
  });
});
