import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import type { PinEntry, PinSet } from './types.js';

export class RelationshipResolver {
  constructor(private projectRoot: string) {}

  async buildImportGraph(): Promise<Map<string, string[]>> {
    const files = await fg('**/*.{ts,tsx,js,jsx}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**']
    });

    const graph = new Map<string, string[]>();

    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(this.projectRoot, file), 'utf-8');
        const imports: string[] = [];
        const lines = content.split('\n');
        for (const line of lines) {
          const match = line.match(/import\\s+.*?from\\s+['"](.+?)['"]/);
          if (match) {
            imports.push(match[1]);
          }
        }
        graph.set(file, imports);
      } catch (err) {
        // skip read errors
      }
    }

    return graph;
  }

  async getUsages(componentFile: string): Promise<{file: string, component?: string}[]> {
    const graph = await this.buildImportGraph();
    const usages: {file: string, component?: string}[] = [];
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

        if (pinA.context.imports?.some(imp => imp.source.includes(path.basename(pinB.context.source.file, path.extname(pinB.context.source.file))))) {
           relationships.push({
             pinId: pinA.id,
             relation: 'parent of',
             targetPinId: pinB.id
           });
        }
      }
    }

    return relationships;
  }
}
