import fs from 'fs/promises';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import crypto from 'crypto';
import type { ComponentContext, ContextLevel, ImportInfo, PropInfo, SourceLocation } from './types.js';
import { TokenEstimator } from './token-estimator.js';
import { detectStyles } from './style-detector.js';

export class ContextBuilder {
  private tokenEstimator = new TokenEstimator();

  constructor(private projectRoot: string) {}

  async getContext(file: string, line: number, level: ContextLevel): Promise<ComponentContext> {
    const absolutePath = path.isAbsolute(file) ? file : path.join(this.projectRoot, file);
    const relativeFile = path.isAbsolute(file) ? path.relative(this.projectRoot, file) : file;
    
    let code: string;
    try {
      code = await fs.readFile(absolutePath, 'utf-8');
    } catch (e) {
      throw new Error(`Failed to read file ${absolutePath}: ${e}`);
    }

    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx']
    });

    let componentName = 'UnknownComponent';
    let componentType: ComponentContext['component']['type'] = 'function';
    let exportType: ComponentContext['component']['exportType'] = 'none';
    let startLine = 1;
    let endLine = code.split('\n').length;
    const props: PropInfo[] = [];
    const hooks: Set<string> = new Set();
    const children: Set<string> = new Set();
    const imports: ImportInfo[] = [];
    
    // @ts-ignore
    const traverseFunc = traverse.default || traverse;

    traverseFunc(ast, {
      ImportDeclaration(path: any) {
        const source = path.node.source.value;
        const isLocal = source.startsWith('.') || source.startsWith('/');
        for (const specifier of path.node.specifiers) {
          imports.push({
            name: specifier.local.name,
            source,
            isDefault: t.isImportDefaultSpecifier(specifier),
            isLocal
          });
        }
      },
      CallExpression(path: any) {
        if (t.isIdentifier(path.node.callee) && path.node.callee.name.startsWith('use')) {
          hooks.add(path.node.callee.name);
        }
      },
      JSXOpeningElement(path: any) {
        if (t.isJSXIdentifier(path.node.name)) {
          const name = path.node.name.name;
          if (name[0] === name[0].toUpperCase()) {
            children.add(name);
          }
        }
      },
      FunctionDeclaration(p: any) {
        if (p.node.loc && line >= p.node.loc.start.line && line <= p.node.loc.end.line) {
          if (p.node.id) componentName = p.node.id.name;
          componentType = 'function';
          startLine = p.node.loc.start.line;
          endLine = p.node.loc.end.line;
          
          if (t.isExportDefaultDeclaration(p.parent)) {
             exportType = 'default';
          } else if (t.isExportNamedDeclaration(p.parent)) {
             exportType = 'named';
          }
          
          if (p.node.params.length > 0) {
            const firstParam = p.node.params[0];
            if (t.isIdentifier(firstParam) && firstParam.typeAnnotation) {
              props.push({ name: 'props', type: 'any', required: true });
            } else if (t.isObjectPattern(firstParam)) {
              for (const prop of firstParam.properties) {
                if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                  props.push({ name: prop.key.name, type: 'any', required: true });
                }
              }
            }
          }
        }
      },
      VariableDeclarator(p: any) {
        if (p.node.loc && line >= p.node.loc.start.line && line <= p.node.loc.end.line) {
          if (t.isIdentifier(p.node.id)) {
            componentName = p.node.id.name;
            if (t.isArrowFunctionExpression(p.node.init)) componentType = 'arrow';
            else if (t.isCallExpression(p.node.init)) {
               if (t.isIdentifier(p.node.init.callee) && p.node.init.callee.name === 'forwardRef') {
                  componentType = 'forwardRef';
               } else if (t.isMemberExpression(p.node.init.callee) && t.isIdentifier(p.node.init.callee.property) && p.node.init.callee.property.name === 'forwardRef') {
                  componentType = 'forwardRef';
               } else if (t.isIdentifier(p.node.init.callee) && p.node.init.callee.name === 'memo') {
                  componentType = 'memo';
               } else if (t.isMemberExpression(p.node.init.callee) && t.isIdentifier(p.node.init.callee.property) && p.node.init.callee.property.name === 'memo') {
                  componentType = 'memo';
               }
            }
            startLine = p.node.loc.start.line;
            endLine = p.node.loc.end.line;
            
            const decl = p.parentPath;
            if (decl && t.isExportDefaultDeclaration(decl.parent)) {
              exportType = 'default';
            } else if (decl && t.isExportNamedDeclaration(decl.parent)) {
              exportType = 'named';
            }
          }
        }
      },
      ClassDeclaration(p: any) {
        if (p.node.loc && line >= p.node.loc.start.line && line <= p.node.loc.end.line) {
          if (p.node.id) componentName = p.node.id.name;
          componentType = 'class';
          startLine = p.node.loc.start.line;
          endLine = p.node.loc.end.line;
          
          if (t.isExportDefaultDeclaration(p.parent)) {
             exportType = 'default';
          } else if (t.isExportNamedDeclaration(p.parent)) {
             exportType = 'named';
          }
        }
      }
    });

    const lines = code.split('\n');
    const sourceCode = lines.slice(startLine - 1, endLine).join('\n');
    
    const id = crypto.createHash('md5').update(`${relativeFile}:${componentName}`).digest('hex');
    
    const context: ComponentContext = {
      id,
      component: {
        name: componentName,
        type: componentType,
        exportType
      },
      source: {
        file: relativeFile,
        absolutePath,
        startLine,
        endLine
      },
      tokens: { minimal: 0, standard: 0, full: 0, current: 0 },
      contextLevel: level
    };
    
    if (level === 'minimal') {
       context.interface = { props, hooks: [], refs: [] };
    } else {
       context.source.code = sourceCode;
       context.imports = imports;
       context.interface = {
         props,
         hooks: Array.from(hooks),
         refs: []
       };
    }
    
    if (level === 'full') {
       const styling = detectStyles(absolutePath, ast);
       context.styling = styling;
       context.relationships = {
         children: Array.from(children).map(c => ({ component: c, file: 'unknown', line: 0 })),
         siblings: [],
         usedBy: []
       };
    }
    
    context.tokens = this.tokenEstimator.estimateContext(context);
    
    return context;
  }
}
