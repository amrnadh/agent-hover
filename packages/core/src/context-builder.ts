import fs from 'fs/promises';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import crypto from 'crypto';
import type { ComponentContext, ContextLevel, ImportInfo, PropInfo } from './types.js';
import { TokenEstimator } from './token-estimator.js';
import { detectStyles } from './style-detector.js';

interface ComponentCandidate {
  name: string;
  type: ComponentContext['component']['type'];
  exportType: ComponentContext['component']['exportType'];
  startLine: number;
  endLine: number;
  params: any[];
  /** The type annotation name referenced in params (e.g. 'StatCardProps') */
  propsTypeName?: string;
}

export class ContextBuilder {
  private tokenEstimator = new TokenEstimator();

  constructor(private projectRoot: string) {}

  async getContext(file: string, line: number, level: ContextLevel): Promise<ComponentContext> {
    const absolutePath = path.isAbsolute(file) ? file : path.join(this.projectRoot, file);
    // Forward slashes on every platform: this path goes into prompts and back to the page.
    const relativeFile = (path.isAbsolute(file) ? path.relative(this.projectRoot, file) : file).split(path.sep).join('/');

    let code: string;
    try {
      code = await fs.readFile(absolutePath, 'utf-8');
    } catch (e) {
      throw new Error(`Failed to read file ${absolutePath}: ${e}`);
    }

    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    // Collect ALL components in the file + all type/interface declarations
    const candidates: ComponentCandidate[] = [];
    const typeDeclarations = new Map<string, any>(); // name -> TSTypeAliasDeclaration or TSInterfaceDeclaration node
    const hooks = new Set<string>();
    const children = new Set<string>();
    const imports: ImportInfo[] = [];

    // @ts-ignore - handle default export differences
    const traverseFunc = traverse.default || traverse;

    traverseFunc(ast, {
      // --- Collect imports ---
      ImportDeclaration(p: any) {
        const source = p.node.source.value;
        const isLocal = source.startsWith('.') || source.startsWith('/');
        for (const specifier of p.node.specifiers) {
          imports.push({
            name: specifier.local.name,
            source,
            isDefault: t.isImportDefaultSpecifier(specifier),
            isLocal,
          });
        }
      },

      // --- Collect hooks ---
      CallExpression(p: any) {
        if (t.isIdentifier(p.node.callee) && p.node.callee.name.startsWith('use')) {
          hooks.add(p.node.callee.name);
        }
      },

      // --- Collect JSX children ---
      JSXOpeningElement(p: any) {
        if (t.isJSXIdentifier(p.node.name)) {
          const name = p.node.name.name;
          if (name[0] === name[0].toUpperCase()) {
            children.add(name);
          }
        }
      },

      // --- Collect TypeScript type/interface declarations ---
      TSTypeAliasDeclaration(p: any) {
        if (p.node.id && t.isIdentifier(p.node.id)) {
          typeDeclarations.set(p.node.id.name, p.node);
        }
      },
      TSInterfaceDeclaration(p: any) {
        if (p.node.id && t.isIdentifier(p.node.id)) {
          typeDeclarations.set(p.node.id.name, p.node);
        }
      },

      // --- Collect function declarations ---
      FunctionDeclaration(p: any) {
        if (!p.node.loc || !p.node.id) return;
        const candidate: ComponentCandidate = {
          name: p.node.id.name,
          type: 'function',
          exportType: 'none',
          startLine: p.node.loc.start.line,
          endLine: p.node.loc.end.line,
          params: p.node.params,
        };
        if (t.isExportDefaultDeclaration(p.parent)) candidate.exportType = 'default';
        else if (t.isExportNamedDeclaration(p.parent)) candidate.exportType = 'named';

        // Extract props type name from annotation
        candidate.propsTypeName = extractPropsTypeName(p.node.params);

        candidates.push(candidate);
      },

      // --- Collect arrow/const components ---
      VariableDeclarator(p: any) {
        if (!p.node.loc || !t.isIdentifier(p.node.id)) return;
        const name = p.node.id.name;
        // Only consider PascalCase names as components
        if (name[0] !== name[0].toUpperCase()) return;

        let compType: ComponentCandidate['type'] = 'arrow';
        let params: any[] = [];

        if (t.isArrowFunctionExpression(p.node.init)) {
          params = p.node.init.params;
        } else if (t.isCallExpression(p.node.init)) {
          const callee = p.node.init.callee;
          if (
            (t.isIdentifier(callee) && callee.name === 'forwardRef') ||
            (t.isMemberExpression(callee) && t.isIdentifier(callee.property) && callee.property.name === 'forwardRef')
          ) {
            compType = 'forwardRef';
            // forwardRef((props, ref) => ...) — get params from the inner function
            const arg = p.node.init.arguments[0];
            if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
              params = arg.params;
            }
          } else if (
            (t.isIdentifier(callee) && callee.name === 'memo') ||
            (t.isMemberExpression(callee) && t.isIdentifier(callee.property) && callee.property.name === 'memo')
          ) {
            compType = 'memo';
            const arg = p.node.init.arguments[0];
            if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
              params = arg.params;
            }
          }
        } else {
          return; // not a component
        }

        const candidate: ComponentCandidate = {
          name,
          type: compType,
          exportType: 'none',
          startLine: p.node.loc.start.line,
          endLine: p.node.loc.end.line,
          params,
        };

        const decl = p.parentPath;
        if (decl && t.isExportDefaultDeclaration(decl.parent)) candidate.exportType = 'default';
        else if (decl && t.isExportNamedDeclaration(decl.parent)) candidate.exportType = 'named';

        candidate.propsTypeName = extractPropsTypeName(params);
        candidates.push(candidate);
      },

      // --- Collect class components ---
      ClassDeclaration(p: any) {
        if (!p.node.loc || !p.node.id) return;
        const candidate: ComponentCandidate = {
          name: p.node.id.name,
          type: 'class',
          exportType: 'none',
          startLine: p.node.loc.start.line,
          endLine: p.node.loc.end.line,
          params: [],
        };
        if (t.isExportDefaultDeclaration(p.parent)) candidate.exportType = 'default';
        else if (t.isExportNamedDeclaration(p.parent)) candidate.exportType = 'named';
        candidates.push(candidate);
      },
    });

    // --- Select the best component for this line ---
    let selected = selectComponent(candidates, line);

    // --- Extract props with resolved types ---
    const props = selected
      ? extractProps(selected.params, selected.propsTypeName, typeDeclarations)
      : [];

    const componentName = selected?.name ?? 'UnknownComponent';
    const componentType = selected?.type ?? 'function';
    const exportType = selected?.exportType ?? 'none';
    const startLine = selected?.startLine ?? 1;
    const endLine = selected?.endLine ?? code.split('\n').length;

    const lines = code.split('\n');
    const sourceCode = lines.slice(startLine - 1, endLine).join('\n');

    const id = crypto.createHash('md5').update(`${relativeFile}:${componentName}`).digest('hex');

    const context: ComponentContext = {
      id,
      component: { name: componentName, type: componentType, exportType },
      source: { file: relativeFile, absolutePath, startLine, endLine },
      tokens: { minimal: 0, standard: 0, full: 0, current: 0 },
      contextLevel: level,
    };

    if (level === 'minimal') {
      context.interface = { props, hooks: [], refs: [] };
    } else {
      context.source.code = sourceCode;
      context.imports = imports;
      context.interface = {
        props,
        hooks: Array.from(hooks),
        refs: [],
      };
    }

    if (level === 'full') {
      const styling = detectStyles(absolutePath, ast);
      context.styling = styling;
      context.relationships = {
        children: Array.from(children).map((c) => ({ component: c, file: 'unknown', line: 0 })),
        siblings: [],
        usedBy: [],
      };
    }

    context.tokens = this.tokenEstimator.estimateContext(context);

    return context;
  }
}

// ==========================================
// Helper functions
// ==========================================

/**
 * Select the best component for a given line number.
 *
 * Strategy:
 * 1. Exact match — line is inside a component's body
 * 2. Nearest below — line is above a component (e.g. on its interface/import), pick the closest one after
 * 3. First component in file — ultimate fallback
 */
function selectComponent(candidates: ComponentCandidate[], line: number): ComponentCandidate | null {
  if (candidates.length === 0) return null;

  // 1. Exact: line is inside the component
  const exact = candidates.filter((c) => line >= c.startLine && line <= c.endLine);
  if (exact.length > 0) {
    // Pick the tightest match (smallest range containing the line)
    return exact.reduce((best, c) =>
      (c.endLine - c.startLine) < (best.endLine - best.startLine) ? c : best
    );
  }

  // 2. Nearest below: line is before a component (e.g. on its Props interface)
  const below = candidates.filter((c) => c.startLine > line);
  if (below.length > 0) {
    return below.reduce((closest, c) =>
      c.startLine < closest.startLine ? c : closest
    );
  }

  // 3. Nearest above: line is after all components (e.g. on an export default at bottom)
  const above = candidates.filter((c) => c.endLine < line);
  if (above.length > 0) {
    return above.reduce((closest, c) =>
      c.endLine > closest.endLine ? c : closest
    );
  }

  // 4. Fallback: first component
  return candidates[0];
}

/**
 * Extract the props type name from function parameters.
 *
 * Handles:
 *   function Foo(props: MyProps)        → 'MyProps'
 *   function Foo({ a, b }: MyProps)     → 'MyProps'
 *   React.FC<MyProps>                   → null (handled differently)
 */
function extractPropsTypeName(params: any[]): string | undefined {
  if (params.length === 0) return undefined;
  const first = params[0];

  // function Component(props: PropsType)
  if (t.isIdentifier(first) && (first as any).typeAnnotation?.typeAnnotation) {
    const ta = (first as any).typeAnnotation.typeAnnotation;
    if (t.isTSTypeReference(ta) && t.isIdentifier(ta.typeName)) {
      return ta.typeName.name;
    }
  }

  // function Component({ a, b }: PropsType)
  if (t.isObjectPattern(first) && (first as any).typeAnnotation?.typeAnnotation) {
    const ta = (first as any).typeAnnotation.typeAnnotation;
    if (t.isTSTypeReference(ta) && t.isIdentifier(ta.typeName)) {
      return ta.typeName.name;
    }
  }

  return undefined;
}

/**
 * Extract props with resolved types from function parameters and type declarations.
 */
function extractProps(
  params: any[],
  propsTypeName: string | undefined,
  typeDeclarations: Map<string, any>
): PropInfo[] {
  const props: PropInfo[] = [];

  if (params.length === 0) return props;
  const first = params[0];

  // Build a type map from the interface/type declaration
  const typeMap = new Map<string, { type: string; required: boolean; defaultValue?: string }>();

  if (propsTypeName && typeDeclarations.has(propsTypeName)) {
    const decl = typeDeclarations.get(propsTypeName);

    // TSInterfaceDeclaration → body.body is TSPropertySignature[]
    if (decl.type === 'TSInterfaceDeclaration' && decl.body?.body) {
      for (const member of decl.body.body) {
        if (member.type === 'TSPropertySignature' && t.isIdentifier(member.key)) {
          const name = member.key.name;
          const required = !member.optional;
          const type = typeAnnotationToString(member.typeAnnotation?.typeAnnotation);
          typeMap.set(name, { type, required });
        }
      }
    }

    // TSTypeAliasDeclaration → typeAnnotation is TSTypeLiteral with members
    if (decl.type === 'TSTypeAliasDeclaration' && decl.typeAnnotation?.type === 'TSTypeLiteral') {
      for (const member of decl.typeAnnotation.members) {
        if (member.type === 'TSPropertySignature' && t.isIdentifier(member.key)) {
          const name = member.key.name;
          const required = !member.optional;
          const type = typeAnnotationToString(member.typeAnnotation?.typeAnnotation);
          typeMap.set(name, { type, required });
        }
      }
    }
  }

  // Case 1: Destructured props — function Component({ a, b }: Props)
  if (t.isObjectPattern(first)) {
    for (const prop of first.properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        const name = prop.key.name;
        const resolved = typeMap.get(name);
        const hasDefault = t.isAssignmentPattern(prop.value);
        props.push({
          name,
          type: resolved?.type ?? 'unknown',
          required: resolved ? resolved.required : !hasDefault,
          defaultValue: hasDefault ? sourceOf((prop.value as any).right) : undefined,
        });
      }
      // Rest element: ...rest
      if (t.isRestElement(prop) && t.isIdentifier(prop.argument)) {
        props.push({
          name: `...${prop.argument.name}`,
          type: 'object',
          required: false,
        });
      }
    }
    return props;
  }

  // Case 2: Single props parameter — function Component(props: Props)
  if (t.isIdentifier(first)) {
    if (typeMap.size > 0) {
      // We resolved the interface — expand its members
      for (const [name, info] of typeMap) {
        props.push({ name, type: info.type, required: info.required });
      }
    } else {
      // Couldn't resolve — just report the parameter
      const typeName = propsTypeName ?? 'unknown';
      props.push({ name: first.name, type: typeName, required: true });
    }
    return props;
  }

  return props;
}

/**
 * Convert a TypeScript type annotation AST node to a readable string.
 */
function typeAnnotationToString(node: any): string {
  if (!node) return 'unknown';

  switch (node.type) {
    case 'TSStringKeyword':
      return 'string';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSBooleanKeyword':
      return 'boolean';
    case 'TSAnyKeyword':
      return 'any';
    case 'TSVoidKeyword':
      return 'void';
    case 'TSNullKeyword':
      return 'null';
    case 'TSUndefinedKeyword':
      return 'undefined';
    case 'TSNeverKeyword':
      return 'never';
    case 'TSUnknownKeyword':
      return 'unknown';

    case 'TSArrayType':
      return `${typeAnnotationToString(node.elementType)}[]`;

    case 'TSUnionType':
      return node.types.map((t: any) => typeAnnotationToString(t)).join(' | ');

    case 'TSIntersectionType':
      return node.types.map((t: any) => typeAnnotationToString(t)).join(' & ');

    case 'TSLiteralType':
      if (t.isStringLiteral(node.literal)) return `"${node.literal.value}"`;
      if (t.isNumericLiteral(node.literal)) return `${node.literal.value}`;
      if (t.isBooleanLiteral(node.literal)) return `${node.literal.value}`;
      return 'literal';

    case 'TSTypeReference':
      if (t.isIdentifier(node.typeName)) {
        let name = node.typeName.name;
        if (node.typeParameters?.params?.length) {
          const params = node.typeParameters.params.map((p: any) => typeAnnotationToString(p));
          name += `<${params.join(', ')}>`;
        }
        return name;
      }
      return 'unknown';

    case 'TSFunctionType':
      return '(...) => ' + typeAnnotationToString(node.typeAnnotation?.typeAnnotation);

    case 'TSTypeLiteral':
      return '{ ... }';

    case 'TSTupleType':
      return `[${node.elementTypes.map((t: any) => typeAnnotationToString(t)).join(', ')}]`;

    case 'TSParenthesizedType':
      return `(${typeAnnotationToString(node.typeAnnotation)})`;

    case 'TSOptionalType':
      return `${typeAnnotationToString(node.typeAnnotation)}?`;

    default:
      return 'unknown';
  }
}

/**
 * Get a rough source string for a simple AST node (for default values).
 */
function sourceOf(node: any): string {
  if (t.isStringLiteral(node)) return `"${node.value}"`;
  if (t.isNumericLiteral(node)) return `${node.value}`;
  if (t.isBooleanLiteral(node)) return `${node.value}`;
  if (t.isNullLiteral(node)) return 'null';
  if (t.isIdentifier(node)) return node.name;
  return '...';
}
