import fs from 'fs/promises';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface EditSourceTextOptions {
  projectRoot: string;
  file: string;
  component?: string;
  originalText: string;
  newText: string;
  line?: number;
}

export interface EditSourceResult {
  success: boolean;
  file: string;
  oldText: string;
  newText: string;
  line?: number;
  error?: string;
}

export interface SaveComponentSourceOptions {
  projectRoot: string;
  file: string;
  component?: string;
  newSource: string;
  startLine?: number;
  endLine?: number;
}

export interface UndoEntry {
  file: string;
  previousContent: string;
  timestamp: number;
  description: string;
}

export class SourceEditor {
  private undoStack: UndoEntry[] = [];
  private readonly MAX_UNDO_ENTRIES = 30;

  constructor(private projectRoot: string) {}

  public getUndoStack(): { file: string; timestamp: number; description: string }[] {
    return this.undoStack.map(u => ({
      file: u.file,
      timestamp: u.timestamp,
      description: u.description
    }));
  }

  public async editSourceText(options: EditSourceTextOptions): Promise<EditSourceResult> {
    const { file, component, originalText, newText, line } = options;
    const absolutePath = path.isAbsolute(file) ? file : path.join(this.projectRoot, file);
    const relativeFile = path.isAbsolute(file) ? path.relative(this.projectRoot, file) : file;

    let code: string;
    try {
      code = await fs.readFile(absolutePath, 'utf-8');
    } catch (e: any) {
      return {
        success: false,
        file: relativeFile,
        oldText: originalText,
        newText,
        error: `Failed to read file ${relativeFile}: ${e.message}`
      };
    }

    let ast: any;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
    } catch (e: any) {
      return {
        success: false,
        file: relativeFile,
        oldText: originalText,
        newText,
        error: `Failed to parse file AST: ${e.message}`
      };
    }

    // Determine component line boundaries if component name or line is given
    let compStartLine: number | null = null;
    let compEndLine: number | null = null;

    // @ts-ignore - handle default export differences
    const traverseFunc = traverse.default || traverse;

    traverseFunc(ast, {
      FunctionDeclaration(p: any) {
        if (!p.node.loc) return;
        const name = p.node.id?.name;
        if (component && name === component) {
          compStartLine = p.node.loc.start.line;
          compEndLine = p.node.loc.end.line;
        } else if (!compStartLine && line && p.node.loc.start.line <= line && p.node.loc.end.line >= line) {
          compStartLine = p.node.loc.start.line;
          compEndLine = p.node.loc.end.line;
        }
      },
      VariableDeclarator(p: any) {
        if (!p.node.loc) return;
        const name = t.isIdentifier(p.node.id) ? p.node.id.name : null;
        if (component && name === component) {
          compStartLine = p.node.loc.start.line;
          compEndLine = p.node.loc.end.line;
        } else if (!compStartLine && line && p.node.loc.start.line <= line && p.node.loc.end.line >= line) {
          compStartLine = p.node.loc.start.line;
          compEndLine = p.node.loc.end.line;
        }
      }
    });

    interface MatchCandidate {
      start: number;
      end: number;
      line: number;
      replaceWith: string;
      dist: number;
    }

    const matches: MatchCandidate[] = [];
    const trimmedOriginal = originalText.trim();

    traverseFunc(ast, {
      JSXText(p: any) {
        if (!p.node.loc) return;
        if (compStartLine && (p.node.loc.start.line < compStartLine || p.node.loc.end.line > compEndLine!)) return;

        const val = p.node.value;
        const trimmedVal = val.trim();
        if (trimmedVal === trimmedOriginal) {
          matches.push({
            start: p.node.start,
            end: p.node.end,
            line: p.node.loc.start.line,
            replaceWith: val.replace(trimmedVal, newText),
            dist: line ? Math.abs(p.node.loc.start.line - line) : 0,
          });
        } else if (val.includes(originalText)) {
          matches.push({
            start: p.node.start,
            end: p.node.end,
            line: p.node.loc.start.line,
            replaceWith: val.replace(originalText, newText),
            dist: line ? Math.abs(p.node.loc.start.line - line) : 0,
          });
        }
      },
      JSXAttribute(p: any) {
        if (!p.node.loc) return;
        if (compStartLine && (p.node.loc.start.line < compStartLine || p.node.loc.end.line > compEndLine!)) return;

        if (t.isStringLiteral(p.node.value)) {
          const strVal = p.node.value.value;
          if (strVal === originalText || strVal.trim() === trimmedOriginal) {
            matches.push({
              start: p.node.value.start,
              end: p.node.value.end,
              line: p.node.value.loc.start.line,
              replaceWith: JSON.stringify(newText),
              dist: line ? Math.abs(p.node.value.loc.start.line - line) : 0,
            });
          }
        }
      },
      StringLiteral(p: any) {
        if (!p.node.loc) return;
        if (p.parentPath && t.isJSXAttribute(p.parentPath.node)) return; // handled by JSXAttribute
        if (compStartLine && (p.node.loc.start.line < compStartLine || p.node.loc.end.line > compEndLine!)) return;

        const strVal = p.node.value;
        if (strVal === originalText || strVal.trim() === trimmedOriginal) {
          matches.push({
            start: p.node.start,
            end: p.node.end,
            line: p.node.loc.start.line,
            replaceWith: JSON.stringify(newText),
            dist: line ? Math.abs(p.node.loc.start.line - line) : 0,
          });
        }
      }
    });

    let updatedCode = '';
    let matchedLine: number | undefined = undefined;

    if (matches.length > 0) {
      // Sort matches by proximity to the target line
      matches.sort((a, b) => a.dist - b.dist);
      const best = matches[0];
      matchedLine = best.line;
      updatedCode = code.slice(0, best.start) + best.replaceWith + code.slice(best.end);
    } else {
      // Fallback: line-targeted replacement within the component lines
      const lines = code.split('\n');
      const searchStart = compStartLine ? compStartLine - 1 : 0;
      const searchEnd = compEndLine ? compEndLine : lines.length;
      let replaced = false;

      // Prefer line around 'line' if given
      const targetIndices: number[] = [];
      if (line && line - 1 >= searchStart && line - 1 < searchEnd) {
        targetIndices.push(line - 1);
      }
      for (let i = searchStart; i < searchEnd; i++) {
        if (!targetIndices.includes(i)) targetIndices.push(i);
      }

      for (const idx of targetIndices) {
        if (lines[idx].includes(originalText) || lines[idx].includes(trimmedOriginal)) {
          matchedLine = idx + 1;
          const targetStr = lines[idx].includes(originalText) ? originalText : trimmedOriginal;
          lines[idx] = lines[idx].replace(targetStr, newText);
          replaced = true;
          break;
        }
      }

      // If not replaced within component bounds, broaden search to the whole file
      if (!replaced && (searchStart > 0 || searchEnd < lines.length)) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(originalText) || lines[i].includes(trimmedOriginal)) {
            matchedLine = i + 1;
            const targetStr = lines[i].includes(originalText) ? originalText : trimmedOriginal;
            lines[i] = lines[i].replace(targetStr, newText);
            replaced = true;
            break;
          }
        }
      }

      if (!replaced) {
        return {
          success: false,
          file: relativeFile,
          oldText: originalText,
          newText,
          error: `Could not locate static text "${originalText}" in ${component || 'component'} (${relativeFile})`
        };
      }
      updatedCode = lines.join('\n');
    }

    // Validate that the updated code parses cleanly
    try {
      parse(updatedCode, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
    } catch (e: any) {
      return {
        success: false,
        file: relativeFile,
        oldText: originalText,
        newText,
        error: `Syntax validation failed after replacement: ${e.message}`
      };
    }

    // Save previous version to undo stack
    this.pushUndo(relativeFile, code, `Edit text: "${originalText}" → "${newText}"`);

    // Write file to disk
    try {
      await fs.writeFile(absolutePath, updatedCode, 'utf-8');
    } catch (e: any) {
      return {
        success: false,
        file: relativeFile,
        oldText: originalText,
        newText,
        error: `Failed to write file to disk: ${e.message}`
      };
    }

    return {
      success: true,
      file: relativeFile,
      oldText: originalText,
      newText,
      line: matchedLine
    };
  }

  public async saveComponentSource(options: SaveComponentSourceOptions): Promise<{ success: boolean; file: string; error?: string }> {
    const { file, component, newSource, startLine, endLine } = options;
    const absolutePath = path.isAbsolute(file) ? file : path.join(this.projectRoot, file);
    const relativeFile = path.isAbsolute(file) ? path.relative(this.projectRoot, file) : file;

    let code: string;
    try {
      code = await fs.readFile(absolutePath, 'utf-8');
    } catch (e: any) {
      return { success: false, file: relativeFile, error: `Failed to read file: ${e.message}` };
    }

    let updatedCode = '';

    if (startLine && endLine && startLine > 0 && endLine >= startLine) {
      const lines = code.split('\n');
      lines.splice(startLine - 1, endLine - startLine + 1, newSource);
      updatedCode = lines.join('\n');
    } else {
      // Find component boundaries via AST
      let ast: any;
      try {
        ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
      } catch (e: any) {
        return { success: false, file: relativeFile, error: `Failed to parse file: ${e.message}` };
      }

      let cStart: number | null = null;
      let cEnd: number | null = null;

      // @ts-ignore
      const traverseFunc = traverse.default || traverse;
      traverseFunc(ast, {
        FunctionDeclaration(p: any) {
          if (component && p.node.id?.name === component) {
            cStart = p.node.start;
            cEnd = p.node.end;
          }
        },
        VariableDeclaration(p: any) {
          for (const d of p.node.declarations) {
            if (component && t.isIdentifier(d.id) && d.id.name === component) {
              cStart = p.node.start;
              cEnd = p.node.end;
            }
          }
        }
      });

      if (cStart !== null && cEnd !== null) {
        updatedCode = code.slice(0, cStart) + newSource + code.slice(cEnd);
      } else {
        return { success: false, file: relativeFile, error: `Could not locate component ${component} in ${relativeFile}` };
      }
    }

    // Validate syntax
    try {
      parse(updatedCode, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
    } catch (e: any) {
      return { success: false, file: relativeFile, error: `Syntax validation failed: ${e.message}` };
    }

    // Save undo entry
    this.pushUndo(relativeFile, code, `Edit component: ${component || relativeFile}`);

    // Write file
    try {
      await fs.writeFile(absolutePath, updatedCode, 'utf-8');
    } catch (e: any) {
      return { success: false, file: relativeFile, error: `Failed to write file: ${e.message}` };
    }

    return { success: true, file: relativeFile };
  }

  public async undo(): Promise<{ success: boolean; file?: string; description?: string; error?: string }> {
    const entry = this.undoStack.pop();
    if (!entry) {
      return { success: false, error: 'No undo history available' };
    }

    const absolutePath = path.isAbsolute(entry.file) ? entry.file : path.join(this.projectRoot, entry.file);
    try {
      await fs.writeFile(absolutePath, entry.previousContent, 'utf-8');
      return { success: true, file: entry.file, description: entry.description };
    } catch (e: any) {
      return { success: false, file: entry.file, error: `Failed to revert file: ${e.message}` };
    }
  }

  private pushUndo(file: string, previousContent: string, description: string) {
    this.undoStack.push({
      file,
      previousContent,
      timestamp: Date.now(),
      description
    });
    if (this.undoStack.length > this.MAX_UNDO_ENTRIES) {
      this.undoStack.shift();
    }
  }
}
