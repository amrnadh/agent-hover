import { glob } from 'tinyglobby';
import fs from 'fs/promises';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type { PinEntry, PinSet } from './types.js';

/**
 * Extracts all import and re-export specifiers from file content, handling:
 * - Single-line and multi-line destructured imports
 * - Type-only imports (import type { ... })
 * - Re-exports (export { ... } from '...' and export * from '...')
 * - Dynamic import() statements with string literals
 * - Side-effect imports (import './style.css')
 */
export function extractImportSources(content: string): string[] {
  const imports = new Set<string>();

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    // @ts-ignore
    const traverseFunc = traverse.default || traverse;
    traverseFunc(ast, {
      ImportDeclaration(p: any) {
        if (p.node.source?.value) {
          imports.add(p.node.source.value);
        }
      },
      ExportNamedDeclaration(p: any) {
        if (p.node.source?.value) {
          imports.add(p.node.source.value);
        }
      },
      ExportAllDeclaration(p: any) {
        if (p.node.source?.value) {
          imports.add(p.node.source.value);
        }
      },
      CallExpression(p: any) {
        if (p.node.callee?.type === 'Import' && p.node.arguments?.[0]?.type === 'StringLiteral') {
          imports.add(p.node.arguments[0].value);
        }
      },
    });

    return Array.from(imports);
  } catch {
    // Robust whole-file dotAll regex fallback for syntax variations
    return extractImportsWithRegex(content);
  }
}

/**
 * Regex fallback using dotAll mode ([\s\S]*?) to extract imports across newlines.
 */
export function extractImportsWithRegex(content: string): string[] {
  const imports = new Set<string>();

  // Static imports: import ... from '...'
  const staticImportRe = /import(?:[\s\S]*?)from\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = staticImportRe.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // Side-effect imports: import '...'
  const sideEffectRe = /import\s*['"]([^'"]+)['"]/g;
  while ((match = sideEffectRe.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // Re-exports: export ... from '...'
  const exportFromRe = /export(?:[\s\S]*?)from\s*['"]([^'"]+)['"]/g;
  while ((match = exportFromRe.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // Dynamic import(): import('...')
  const dynamicImportRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRe.exec(content)) !== null) {
    imports.add(match[1]);
  }

  return Array.from(imports);
}

export class RelationshipResolver {
  constructor(private projectRoot: string) {}

  async buildImportGraph(): Promise<Map<string, string[]>> {
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**'],
    });

    const graph = new Map<string, string[]>();

    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(this.projectRoot, file), 'utf-8');
        const imports = extractImportSources(content);
        graph.set(file, imports);
      } catch (err) {
        // skip read errors
      }
    }

    return graph;
  }

  async getUsages(componentFile: string): Promise<{ file: string; component?: string }[]> {
    const graph = await this.buildImportGraph();
    const usages: { file: string; component?: string }[] = [];
    const baseName = path.basename(componentFile, path.extname(componentFile));

    for (const [file, imports] of graph.entries()) {
      for (const imp of imports) {
        if (imp.includes(baseName)) {
          usages.push({ file });
          break;
        }
      }
    }
    return usages;
  }

  resolveRelationships(pins: PinEntry[]): PinSet['relationships'] {
    const relationships: PinSet['relationships'] = [];

    for (let i = 0; i < pins.length; i++) {
      for (let j = 0; j < pins.length; j++) {
        if (i === j) continue;
        const pinA = pins[i];
        const pinB = pins[j];

        if (
          pinA.context.imports?.some((imp) =>
            imp.source.includes(
              path.basename(pinB.context.source.file, path.extname(pinB.context.source.file))
            )
          )
        ) {
          relationships.push({
            pinId: pinA.id,
            relation: 'parent of',
            targetPinId: pinB.id,
          });
        }
      }
    }

    return relationships;
  }
}
