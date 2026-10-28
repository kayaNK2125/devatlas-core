import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { ScannedFile, ImportDetail } from '../scanner/types';

export interface ParsedFileAst {
  file: ScannedFile;
  imports: ImportDetail[];
  exports: string[];
  externalDependencies: string[];
  linesOfCode: number;
}

/**
 * Determines whether an import specifier points to a local file rather than an external package
 */
export function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('/') ||
    specifier === '.' ||
    specifier === '..'
  );
}

/**
 * Extracts base package name from an external import (e.g., "lodash/debounce" -> "lodash", "@scope/pkg/sub" -> "@scope/pkg")
 */
export function extractPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return specifier;
  }
  return specifier.split('/')[0];
}

/**
 * Returns the appropriate TypeScript ScriptKind based on file extension
 */
function getScriptKind(ext: string): ts.ScriptKind {
  switch (ext) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.ts':
      return ts.ScriptKind.TS;
    case '.js':
    case '.mjs':
    case '.cjs':
    default:
      return ts.ScriptKind.JS;
  }
}

/**
 * Parses a single source file using TypeScript Compiler API AST traversal
 */
export function parseSourceFile(file: ScannedFile): ParsedFileAst {
  let content = '';
  try {
    content = fs.readFileSync(file.fullPath, 'utf-8');
  } catch (err: unknown) {
    // If reading fails, return empty analysis
    return {
      file,
      imports: [],
      exports: [],
      externalDependencies: [],
      linesOfCode: 0
    };
  }

  const linesOfCode = content.split('\n').length;
  const scriptKind = getScriptKind(file.extension);

  const sourceFile = ts.createSourceFile(
    file.path,
    content,
    ts.ScriptTarget.Latest,
    true, // setParentNodes
    scriptKind
  );

  const rawImports: ImportDetail[] = [];
  const exportedNames: Set<string> = new Set();
  const externalDependencies: Set<string> = new Set();

  function visit(node: ts.Node): void {
    // 1. Static imports: `import ... from '...'`
    if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        const isLocal = isRelativeSpecifier(specifier);
        const isTypeOnly = !!node.importClause?.isTypeOnly;

        rawImports.push({
          specifier,
          isLocal,
          type: 'static',
          isTypeOnly
        });

        if (!isLocal) {
          externalDependencies.add(extractPackageName(specifier));
        }
      }
    }

    // 2. Re-exports: `export ... from '...'`
    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        const isLocal = isRelativeSpecifier(specifier);
        const isTypeOnly = !!node.isTypeOnly;

        rawImports.push({
          specifier,
          isLocal,
          type: 'reexport',
          isTypeOnly
        });

        if (!isLocal) {
          externalDependencies.add(extractPackageName(specifier));
        }
      }

      // Track named exports
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const elem of node.exportClause.elements) {
          exportedNames.add(elem.name.text);
        }
      }
    }

    // 3. Export assignments: `export default ...` or `module.exports = ...`
    if (ts.isExportAssignment(node)) {
      exportedNames.add('default');
    }

    // 4. Declarations with `export` modifier
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      const isExported = modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported && node.name) {
        exportedNames.add(node.name.text);
      }
    }

    // 5. Variable statements with `export`
    if (ts.isVariableStatement(node)) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      const isExported = modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exportedNames.add(decl.name.text);
          }
        }
      }
    }

    // 6. Dynamic imports: `import('...')`
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          const specifier = firstArg.text;
          const isLocal = isRelativeSpecifier(specifier);
          rawImports.push({
            specifier,
            isLocal,
            type: 'dynamic',
            isTypeOnly: false
          });

          if (!isLocal) {
            externalDependencies.add(extractPackageName(specifier));
          }
        }
      }

      // 7. CommonJS `require('...')`
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          const specifier = firstArg.text;
          const isLocal = isRelativeSpecifier(specifier);
          rawImports.push({
            specifier,
            isLocal,
            type: 'require',
            isTypeOnly: false
          });

          if (!isLocal) {
            externalDependencies.add(extractPackageName(specifier));
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    file,
    imports: rawImports,
    exports: Array.from(exportedNames),
    externalDependencies: Array.from(externalDependencies),
    linesOfCode
  };
}
