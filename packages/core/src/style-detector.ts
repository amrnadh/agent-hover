import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { StyleInfo } from './types.js';

export function detectStyles(filePath: string, ast: any): StyleInfo {
  let approach: StyleInfo['approach'] = 'none';
  const classes = new Set<string>();
  let styleFile: string | undefined;

  // @ts-ignore
  const traverseFunc = traverse.default || traverse;
  
  traverseFunc(ast, {
    ImportDeclaration(path: any) {
      const source = path.node.source.value;
      if (source.endsWith('.module.css') || source.endsWith('.module.scss')) {
        approach = 'css-modules';
        styleFile = source;
      } else if (source.endsWith('.css') || source.endsWith('.scss')) {
        if (approach === 'none') approach = 'inline';
        styleFile = source;
      } else if (source === 'styled-components' || source.includes('@emotion')) {
        approach = 'styled-components';
      }
    },
    JSXAttribute(path: any) {
      if (path.node.name.name === 'className') {
        const value = path.node.value;
        if (t.isStringLiteral(value)) {
          if (approach === 'none') approach = 'tailwind';
          value.value.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
        } else if (t.isJSXExpressionContainer(value)) {
          if (t.isTemplateLiteral(value.expression)) {
            if (approach === 'none') approach = 'tailwind';
            value.expression.quasis.forEach(q => {
              q.value.raw.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
            });
          }
        }
      }
    }
  });

  return {
    approach,
    classes: classes.size > 0 ? Array.from(classes) : undefined,
    styleFile
  };
}
