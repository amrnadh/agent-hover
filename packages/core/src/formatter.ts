import type { ComponentContext, ContextLevel, PinSet, TaskContext } from './types.js';

export function formatContextMarkdown(context: ComponentContext, level: ContextLevel): string {
  let md = `## ${context.component.name}\n`;
  md += `**Source**: \`${context.source.file}:${context.source.startLine}-${context.source.endLine}\`\n\n`;

  if (context.interface?.props && context.interface.props.length > 0) {
    md += `### Props\n`;
    md += `| Name | Type | Required | Default |\n`;
    md += `|------|------|----------|---------|\n`;
    for (const prop of context.interface.props) {
      md += `| ${prop.name} | \`${prop.type.replace(/\|/g, '\\|')}\` | ${prop.required ? '✓' : '✗'} | ${prop.defaultValue ?? ''} |\n`;
    }
    md += `\n`;
  }

  if (level !== 'minimal') {
    if (context.source.code) {
      md += `### Source Code\n`;
      md += `\`\`\`tsx\n${context.source.code}\n\`\`\`\n\n`;
    }

    if (context.imports && context.imports.length > 0) {
      md += `### Imports\n`;
      for (const imp of context.imports) {
        md += `- ${imp.name} (${imp.isLocal ? 'local' : 'external'} - \`${imp.source}\`)\n`;
      }
      md += `\n`;
    }

    if (context.interface?.hooks && context.interface.hooks.length > 0) {
      md += `### Hooks\n`;
      for (const hook of context.interface.hooks) {
        md += `- ${hook}\n`;
      }
      md += `\n`;
    }
  }

  if (level === 'full') {
    if (context.relationships?.parent) {
      md += `### Parent\n`;
      md += `- ${context.relationships.parent.component} (\`${context.relationships.parent.file}:${context.relationships.parent.line}\`)\n\n`;
    }

    if (context.styling) {
      md += `### Styling\n`;
      md += `- Approach: ${context.styling.approach}\n`;
      if (context.styling.classes && context.styling.classes.length > 0) {
        md += `- Classes: \`${context.styling.classes.join(' ')}\`\n`;
      }
      if (context.styling.styleFile) {
        md += `- Style File: \`${context.styling.styleFile}\`\n`;
      }
      md += `\n`;
    }
  }

  md += `**Token estimate**: ${context.tokens?.current ?? 0} tokens (${level} level)\n`;

  return md;
}

export function formatPinSetMarkdown(pinSet: PinSet): string {
  let md = `# Pinned Components\n\n`;
  for (const pin of pinSet.pins) {
    md += formatContextMarkdown(pin.context, pin.context.contextLevel) + `\n\n---\n\n`;
  }
  
  if (pinSet.relationships.length > 0) {
    md += `## Relationships\n`;
    for (const rel of pinSet.relationships) {
      md += `- Pin ${rel.pinId} is ${rel.relation} Pin ${rel.targetPinId}\n`;
    }
  }
  return md;
}

export function formatTaskContext(pinSet: PinSet, instruction: string): TaskContext {
  const contextMd = formatPinSetMarkdown(pinSet);
  return {
    instruction,
    targets: pinSet.pins.map(p => ({
      component: p.context.component.name,
      source: `${p.context.source.file}:${p.context.source.startLine}`
    })),
    context: contextMd,
    tokenCost: pinSet.totalTokens.current
  };
}
