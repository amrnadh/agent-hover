import type { ComponentContext, ContextLevel, PinSet, TaskContext, FreezeEntry, FrozenFileDirective, ComputedStyleInfo, ScreenshotDiff, AgentTask } from './types.js';

export function formatContextMarkdown(context: ComponentContext, level: ContextLevel): string {
  let md = `## ${context.component.name}\n`;
  md += `**Source**: \`${context.source.file}:${context.source.startLine}-${context.source.endLine}\`\n\n`;

  if (context.interface?.props && context.interface.props.length > 0) {
    md += `### Props\n`;
    md += `| Name | Type | Required | Default |\n`;
    md += `|------|------|----------|--------|\n`;
    for (const prop of context.interface.props) {
      md += `| ${prop.name} | \`${prop.type.replace(/\|/g, '\\|')}\` | ${prop.required ? 'true' : 'false'} | ${prop.defaultValue ?? ''} |\n`;
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
  let fullContext = `# Coordinated Multi-Component Task Brief\n\n`;
  if (instruction && instruction.trim()) {
    fullContext += `**Goal**: ${instruction.trim()}\n\n`;
  }

  fullContext += `Please execute the following tasks in the order listed:\n\n`;

  pinSet.pins.forEach((pin, index) => {
    const num = index + 1;
    const name = pin.context.component.name;
    const src = `${pin.context.source.file}:${pin.context.source.startLine}-${pin.context.source.endLine}`;
    fullContext += `### ${num}. <${name} /> (\`${src}\`)\n`;
    if (pin.task && pin.task.trim()) {
      fullContext += `**Task / Requested Change**:\n> ${pin.task.trim()}\n\n`;
    } else {
      fullContext += `**Task / Requested Change**: Refactor/update according to main goal.\n\n`;
    }

    if (pin.context.interface?.props && pin.context.interface.props.length > 0) {
      const propStr = pin.context.interface.props
        .map(p => `${p.name}: \`${p.type}\`${p.required ? ' (req)' : ''}`)
        .join(', ');
      fullContext += `- **Props**: ${propStr}\n`;
    }

    if (pin.context.source.code) {
      fullContext += `\n\`\`\`tsx\n${pin.context.source.code}\n\`\`\`\n\n`;
    }
  });

  const frozenFiles: FrozenFileDirective[] = frozenEntries.map(f => ({
    file: f.file,
    component: f.component,
    reason: 'Developer has explicitly frozen this component — it is working correctly and MUST NOT be modified.',
  }));

  if (frozenFiles.length > 0) {
    fullContext += `\n## [LOCKED] FROZEN COMPONENTS — DO NOT MODIFY\n\n`;
    fullContext += `The following components have been explicitly locked by the developer. `;
    fullContext += `They are working correctly and **MUST NOT be edited, moved, renamed, or have their imports changed**:\n\n`;
    for (const f of frozenFiles) {
      fullContext += `- [LOCKED] **${f.component}** (\`${f.file}\`) — ${f.reason}\n`;
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

/**
 * Formats a screenshot diff result into a concise markdown block for AI consumption.
 */
export function formatScreenshotDiff(diff: ScreenshotDiff): string {
  let md = `## Visual Diff: ${diff.componentName}\n\n`;
  md += `**Component**: \`${diff.componentId}\`\n`;
  md += `**Captured at**: ${diff.createdAt}\n\n`;

  const pct = diff.changedPixelPercent;
  let status: string;
  if (pct === 0) {
    status = 'NO VISUAL CHANGE — the component looks identical before and after.';
  } else if (pct < 0.5) {
    status = `MINIMAL CHANGE — only ${pct}% of pixels differ (likely sub-pixel rendering or anti-aliasing).`;
  } else if (pct < 10) {
    status = `MODERATE CHANGE — ${pct}% of pixels differ. This appears to be an intentional UI change.`;
  } else {
    status = `SIGNIFICANT CHANGE — ${pct}% of pixels differ. Please verify this is intentional.`;
  }

  md += `### Result\n${status}\n\n`;

  md += `### Before\n`;
  md += `- Size: ${diff.before.boundingBox.width}×${diff.before.boundingBox.height}px\n`;
  md += `- Position: (${diff.before.boundingBox.left}, ${diff.before.boundingBox.top})\n`;
  md += `- Viewport: ${diff.before.viewport.width}×${diff.before.viewport.height}\n\n`;

  md += `### After\n`;
  md += `- Size: ${diff.after.boundingBox.width}×${diff.after.boundingBox.height}px\n`;
  md += `- Position: (${diff.after.boundingBox.left}, ${diff.after.boundingBox.top})\n`;
  md += `- Viewport: ${diff.after.viewport.width}×${diff.after.viewport.height}\n\n`;

  const widthDelta = diff.after.boundingBox.width - diff.before.boundingBox.width;
  const heightDelta = diff.after.boundingBox.height - diff.before.boundingBox.height;
  if (widthDelta !== 0 || heightDelta !== 0) {
    md += `### Size Change\n`;
    md += `- Width: ${widthDelta > 0 ? '+' : ''}${widthDelta}px\n`;
    md += `- Height: ${heightDelta > 0 ? '+' : ''}${heightDelta}px\n\n`;
  }

  md += `**Pixels changed**: ${pct}%\n`;
  return md;
}

/**
 * Formats an AgentTask into markdown prompt text at the requested detail level (P1-07).
 */
export function formatTaskMarkdown(
  task: AgentTask,
  format: 'compact' | 'standard' | 'deep' = 'standard'
): string {
  // The overlay sends a complete prompt (request, location, element, constraints, source).
  // Compact drops the source sections; standard and deep return it whole.
  if (task.payload?.prompt) {
    if (format === 'compact') return task.payload.prompt.split(/\n## Source/)[0].trimEnd() + '\n';
    return task.payload.prompt;
  }

  let md = `# Task [${task.id}]\n\n`;

  if (task.instruction) {
    md += `**Instruction**: ${task.instruction}\n\n`;
  }

  if (task.intent) {
    md += `**Intent**: ${task.intent}\n`;
  }
  if (task.scope && task.scope !== 'unspecified') {
    md += `**Scope**: ${task.scope}\n`;
    if (task.scope === 'instance') {
      md += `> Change only the instance at ${task.target.selector || 'this location'}. Do not alter behavior or styles other instances rely on. If the component must change, add an optional prop or local override and explain.\n`;
    } else if (task.scope === 'component') {
      md += `> This component is used in ${task.target.instanceCount || 'multiple'} places; changes apply to all.\n`;
    }
  }

  if (task.target.component || task.target.file) {
    md += `\n### Target\n`;
    if (task.target.component) md += `- **Component**: \`<${task.target.component} />\`\n`;
    if (task.target.file) {
      const loc = task.target.lineStart ? `:${task.target.lineStart}${task.target.lineEnd ? `-${task.target.lineEnd}` : ''}` : '';
      md += `- **Location**: \`${task.target.file}${loc}\`\n`;
    }
    if (task.target.selector) md += `- **Selector**: \`${task.target.selector}\`\n`;
  }

  if (task.payload.notes && task.payload.notes.length > 0) {
    md += `\n### Notes\n`;
    for (const note of task.payload.notes) {
      md += `- ${note}\n`;
    }
  }

  if (task.payload.goal) {
    md += `\n### Goal\n${task.payload.goal}\n`;
  }

  if (task.payload.pins && task.payload.pins.length > 0) {
    md += `\n### Pinned Components\n`;
    for (const pin of task.payload.pins) {
      md += `- **<${pin.component} />** (\`${pin.file}\`) [${pin.role}]\n`;
    }
  }

  if (format === 'deep' && task.payload.source) {
    md += `\n### Source\n\`\`\`tsx\n${task.payload.source}\n\`\`\`\n`;
  }

  return md.trim();
}

