import type { ComponentContext, ContextLevel, PinSet, TaskContext, FreezeEntry, FrozenFileDirective, ComputedStyleInfo } from './types.js';

export function formatContextMarkdown(context: ComponentContext, level: ContextLevel): string {
  let md = `## ${context.component.name}\n`;
  md += `**Source**: \`${context.source.file}:${context.source.startLine}-${context.source.endLine}\`\n\n`;

  if (context.interface?.props && context.interface.props.length > 0) {
    md += `### Props\n`;
    md += `| Name | Type | Required | Default |\n`;
    md += `|------|------|----------|--------|\n`;
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

export function formatTaskContext(
  pinSet: PinSet,
  instruction: string,
  frozenEntries: FreezeEntry[] = []
): TaskContext {
  const contextMd = formatPinSetMarkdown(pinSet);

  const frozenFiles: FrozenFileDirective[] = frozenEntries.map(f => ({
    file: f.file,
    component: f.component,
    reason: 'Developer has explicitly frozen this component — it is working correctly and MUST NOT be modified.',
  }));

  let fullContext = contextMd;
  if (frozenFiles.length > 0) {
    fullContext += `\n\n## ⛔ FROZEN COMPONENTS — DO NOT MODIFY\n\n`;
    fullContext += `The following components have been explicitly locked by the developer. `;
    fullContext += `They are working correctly and **MUST NOT be edited, moved, renamed, or have their imports changed**:\n\n`;
    for (const f of frozenFiles) {
      fullContext += `- ⛔ **${f.component}** (\`${f.file}\`) — ${f.reason}\n`;
    }
    fullContext += `\n**Any changes to the above files will be rejected.**\n`;
  }

  return {
    instruction,
    targets: pinSet.pins.map(p => ({
      component: p.context.component.name,
      source: `${p.context.source.file}:${p.context.source.startLine}`
    })),
    context: fullContext,
    tokenCost: pinSet.totalTokens.current,
    frozenFiles: frozenFiles.length > 0 ? frozenFiles : undefined,
  };
}

/**
 * Formats computed styles into a concise markdown block for AI consumption.
 */
export function formatComputedStyles(styles: ComputedStyleInfo): string {
  let md = `### Computed Styles (Live Browser)\n`;
  md += `| Property | Value |\n`;
  md += `|----------|-------|\n`;
  md += `| display | \`${styles.display}\` |\n`;
  md += `| position | \`${styles.position}\` |\n`;
  md += `| width × height | \`${styles.width} × ${styles.height}\` |\n`;
  md += `| padding | \`${styles.padding}\` |\n`;
  md += `| margin | \`${styles.margin}\` |\n`;
  md += `| border | \`${styles.border}\` |\n`;

  if (styles.flexDirection) md += `| flex-direction | \`${styles.flexDirection}\` |\n`;
  if (styles.alignItems) md += `| align-items | \`${styles.alignItems}\` |\n`;
  if (styles.justifyContent) md += `| justify-content | \`${styles.justifyContent}\` |\n`;
  if (styles.gridTemplateColumns) md += `| grid-template-columns | \`${styles.gridTemplateColumns}\` |\n`;
  if (styles.gap) md += `| gap | \`${styles.gap}\` |\n`;

  md += `| z-index | \`${styles.zIndex}\` |\n`;
  md += `| overflow | \`${styles.overflow}\` |\n`;
  md += `| opacity | \`${styles.opacity}\` |\n`;
  md += `| font-size | \`${styles.fontSize}\` |\n`;
  md += `| line-height | \`${styles.lineHeight}\` |\n`;
  md += `| color | \`${styles.color}\` |\n`;
  md += `| background | \`${styles.backgroundColor}\` |\n`;

  if (styles.boundingBox) {
    const b = styles.boundingBox;
    md += `\n**Bounding Box**: top=${b.top}px, left=${b.left}px, ${b.width}×${b.height}px\n`;
  }

  return md;
}
