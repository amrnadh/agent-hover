import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BRAND, DISPLAY_NAME, NEXT_PACKAGE } from './brand.js';
import { findClient, MCP_CLIENTS, statusCommand, type McpClient } from './clients.js';
import { inspectProject, installCommand, type ProjectInfo } from './project.js';
import { mergeCommandFile, mergeGitignore, mergeJsonMcp, mergeOpencodeMcp, mergeRules, mergeTomlMcp, type Merge } from './setup-files.js';
import { addPluginToViteConfig, VITE_MANUAL_STEPS } from './vite-config.js';
import {
  addToDocument,
  addToInstrumentation,
  addToLayout,
  DOCUMENT_MANUAL,
  INSTRUMENTATION_MANUAL,
  LAYOUT_MANUAL,
  newDocument,
  newInstrumentation,
  NEXT_CONFIG_MANUAL,
  wrapNextConfig,
  type Edit,
} from './next-setup.js';
import type { Style } from './render.js';
import type { Choice } from './prompt.js';

export interface InitOptions {
  agents?: string[];
  yes?: boolean;
  dryRun?: boolean;
  install?: boolean;
  /** Home folder for global agent configs (tests point it at a temp folder). */
  home?: string;
}

/** Side effects, injectable for tests. */
export interface InitIO {
  interactive: boolean;
  ask(question: string): Promise<string>;
  /** A checklist (arrow keys and space) in a real terminal; null when cancelled. Without it, `ask` takes typed ids. */
  choose?(message: string, choices: Choice[]): Promise<string[] | null>;
  /** Yes/no in a real terminal; null when cancelled. Without it, `ask` takes Y/n. */
  confirm?(message: string): Promise<boolean | null>;
  /** Run a command in the project; returns the exit code. */
  exec(cmd: string, args: string[], cwd: string): number;
  out(text: string): void;
  /** Home folder for global agent configs; defaults to the real one. */
  home?: string;
}

type StepState = 'done' | 'todo' | 'manual';

interface FileWrite { file: string; content: string; backup: boolean }

export interface Step {
  title: string;
  state: StepState;
  /** Shown under the title: a reason (done/manual) or what will happen. */
  detail?: string;
  write?: FileWrite;
  command?: { cmd: string; args: string[]; display: string };
  /** Changes a file in the home folder rather than the project. */
  global?: boolean;
  /** The agent this step is for; project steps have none. The plan groups by it. */
  agent?: string;
}

const read = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

/** Agents to set up when none are named: the ones this project already shows signs of using. */
export function detectAgents(root: string): string[] {
  const has = (p: string) => existsSync(path.join(root, p));
  const found: string[] = [];
  if (has('CLAUDE.md') || has('.claude') || has('.mcp.json')) found.push('claude');
  if (has('.cursor') || has('.cursorrules')) found.push('cursor');
  if (has('AGENTS.md') || has('.codex')) found.push('codex');
  if (has('.windsurf') || has('.windsurfrules')) found.push('windsurf');
  if (has('opencode.json') || has('opencode.jsonc') || has('.opencode')) found.push('opencode');
  return found;
}

/** The agent checklist: what `init` would write for each, with the ones this project already uses ticked. */
export function agentChoices(detected: string[], checked: string[]): Choice[] {
  return MCP_CLIENTS.map((c) => {
    const where = c.projectConfig ? c.projectConfig.file : c.globalConfig ? `~/${c.globalConfig[0]} (global)` : 'prints the setup to paste';
    return { value: c.id, label: c.title, hint: (detected.includes(c.id) ? 'found here · ' : '') + where, checked: checked.includes(c.id) };
  });
}

/** `rewrites` marks merges that re-serialize the file (JSON); those keep a .bak. Appends do not need one.
 * `shown` is how the file is named in the plan (for a home-folder file, `~/…`). */
function fileStep(root: string, title: string, rel: string, merge: (existing: string | null) => Merge, rewrites = false, shown = rel): Step {
  const file = path.join(root, rel);
  const existing = read(file);
  const result = merge(existing);
  if (!result.ok) return { title, state: 'manual', detail: `${shown}: ${result.reason}. Add it by hand.` };
  if (result.content === null) return { title, state: 'done', detail: shown };
  return { title, state: 'todo', detail: `${existing === null ? 'create' : 'update'} ${shown}`, write: { file, content: result.content, backup: rewrites && !!existing?.trim() } };
}

/** Edit (or create) one file of a Next.js app; `manual` is what to add by hand when it can't be edited. */
function editStep(root: string, title: string, rel: string, edit: (src: string) => Edit, create: string | null, what: string, manual: string): Step {
  const file = path.join(root, rel);
  const existing = read(file);
  if (existing === null) {
    if (create === null) return { title, state: 'manual', detail: `${rel} not found. Add:\n${manual}` };
    return { title, state: 'todo', detail: `create ${rel}`, write: { file, content: create, backup: false } };
  }
  const result = edit(existing);
  if (!result.ok) return { title, state: 'manual', detail: `${rel}: not edited automatically (${result.reason}). Add:\n${manual}` };
  if (result.code === existing) return { title, state: 'done', detail: rel };
  return { title, state: 'todo', detail: `${what} in ${rel}`, write: { file, content: result.code, backup: false } };
}

/** Next.js: wrap next.config, start the bridge from instrumentation.ts, show the dock from the root layout or _document. */
function planNext(p: ProjectInfo): Step[] {
  const n = p.next!;
  const root = p.root;
  const steps: Step[] = [];
  const configRel = n.config ?? (n.typescript ? 'next.config.ts' : 'next.config.mjs');
  const newConfig = `import { withAgentHover } from '${NEXT_PACKAGE}';\n\nexport default withAgentHover({});\n`;
  steps.push(editStep(root, `Wrap ${configRel}`, configRel, wrapNextConfig, newConfig, 'withAgentHover(...)', NEXT_CONFIG_MANUAL));
  steps.push(editStep(root, `Start it from ${n.instrumentation}`, n.instrumentation, addToInstrumentation, newInstrumentation(), 'register() starts the bridge', INSTRUMENTATION_MANUAL));
  if (n.appDir) {
    const layout = n.layout ?? `${n.appDir}/layout.tsx`;
    steps.push(editStep(root, `Show the dock in ${layout}`, layout, addToLayout, null, '<AgentHover /> at the end of <body>', LAYOUT_MANUAL));
  }
  if (n.pagesDir) {
    steps.push(editStep(root, `Show the dock in ${n.document}`, n.document!, addToDocument, newDocument(), '<AgentHover /> after <NextScript />', DOCUMENT_MANUAL));
  }
  if (!n.appDir && !n.pagesDir) steps.push({ title: 'Show the dock', state: 'manual', detail: `No app/ or pages/ folder found. In your root layout add:\n${LAYOUT_MANUAL}` });
  return steps;
}

/** Everything `init` would do in this project, without doing any of it. */
export function planInit(p: ProjectInfo, agents: McpClient[], opts: InitOptions = {}): Step[] {
  const steps: Step[] = [];
  const root = p.root;

  const pkg = p.pluginPackage;
  if (p.pluginInstalled) steps.push({ title: `Install ${pkg}`, state: 'done', detail: 'already in package.json' });
  else if (opts.install === false) steps.push({ title: `Install ${pkg}`, state: 'manual', detail: installCommand(p.packageManager, pkg) });
  else {
    const display = installCommand(p.packageManager, pkg);
    const [cmd, ...args] = display.split(' ');
    steps.push({ title: `Install ${pkg}`, state: 'todo', detail: display, command: { cmd, args, display } });
  }

  if (p.framework === 'next') steps.push(...planNext(p));
  else {
    const configRel = p.viteConfig!;
    const configFile = path.join(root, configRel);
    const edit = addPluginToViteConfig(readFileSync(configFile, 'utf8'));
    if (p.pluginConfigured) steps.push({ title: `Add the plugin to ${configRel}`, state: 'done' });
    else if (!edit.ok) steps.push({ title: `Add the plugin to ${configRel}`, state: 'manual', detail: `Not edited automatically (${edit.reason}). Add:\n${VITE_MANUAL_STEPS}` });
    else steps.push({ title: `Add the plugin to ${configRel}`, state: 'todo', detail: `import agentHover and add agentHover() to plugins`, write: { file: configFile, content: edit.code, backup: false } });
  }

  const home = opts.home ?? os.homedir();
  // Agents can share a rules file (Codex and OpenCode both read AGENTS.md): plan each file once.
  const rulesPlanned = new Set<string>();
  for (const agent of agents) {
    const first = steps.length;
    if (agent.projectConfig?.format === 'opencode' && !existsSync(path.join(root, 'opencode.json')) && existsSync(path.join(root, 'opencode.jsonc'))) {
      steps.push({ title: 'MCP server', state: 'manual', detail: `opencode.jsonc may have comments, so it was not edited. Add the agent-hover entry under "mcp":\n${agent.snippet}` });
    } else if (agent.projectConfig) {
      const { file, format } = agent.projectConfig;
      const merge = format === 'json' ? (t: string | null) => mergeJsonMcp(t) : format === 'opencode' ? (t: string | null) => mergeOpencodeMcp(t) : (t: string | null) => mergeTomlMcp(t);
      steps.push(fileStep(root, 'MCP server', file, merge, format !== 'toml'));
    } else if (agent.globalConfig) {
      // Global only: the first location is created when missing; older locations are updated only if present.
      agent.globalConfig.forEach((rel, i) => {
        if (i > 0 && !existsSync(path.join(home, rel))) return;
        const shown = '~/' + rel.split(path.sep).join('/');
        steps.push({ ...fileStep(home, 'MCP server (global config)', rel, (t) => mergeJsonMcp(t), true, shown), global: true });
      });
    } else {
      steps.push({
        title: 'MCP server',
        state: 'manual',
        detail: agent.command ? `Run: ${agent.command}` : `${agent.title} only has a global config. Add to ${agent.configPath}:\n${agent.snippet}`,
      });
    }
    if (agent.rulesFile && !rulesPlanned.has(agent.rulesFile.file)) {
      const { file, kind } = agent.rulesFile;
      rulesPlanned.add(file);
      steps.push(fileStep(root, 'Task rules', file, (t) => mergeRules(t, kind)));
    }
    if (agent.commandFile) {
      const { file, kind, invoke } = agent.commandFile;
      steps.push(fileStep(root, invoke, file, (t) => mergeCommandFile(t, kind)));
      const status = statusCommand(agent.commandFile);
      steps.push(fileStep(root, status.invoke, status.file, (t) => mergeCommandFile(t, kind, 'status')));
    }
    for (const step of steps.slice(first)) step.agent = agent.title;
  }

  // Project steps first, then each agent's.
  const gitignore = fileStep(root, `Keep ${BRAND.dataDir} data out of git`, '.gitignore', mergeGitignore);
  const project = steps.filter((x) => !x.agent);
  return [...project, gitignore, ...steps.filter((x) => x.agent)];
}

/** The plan, grouped: This project, then each agent. One line per step, with what it does on the right. */
export function renderPlan(steps: Step[], s: Style): string {
  const icon = { done: s.ok('✓'), todo: s.bold('+'), manual: s.todo('!') };
  const width = Math.min(34, Math.max(...steps.map((x) => x.title.length)));
  const out: string[] = [];
  let group: string | undefined = '\0';
  for (const step of steps) {
    if (step.agent !== group) {
      group = step.agent;
      out.push(`${out.length ? '\n' : ''}  ${s.bold(group ?? 'This project')}`);
    }
    const [first, ...rest] = (step.state === 'done' ? 'already done' : step.detail || '').split('\n');
    const note = step.state === 'manual' && !rest.length ? first : s.dim(first);
    out.push(`    ${icon[step.state]} ${step.title.padEnd(width)}  ${first ? note : ''}`.trimEnd());
    out.push(...rest.map((l) => '        ' + l));
  }
  return out.join('\n');
}

function applyWrite(w: FileWrite) {
  mkdirSync(path.dirname(w.file), { recursive: true });
  if (w.backup) copyFileSync(w.file, w.file + '.bak');
  writeFileSync(w.file, w.content);
}

/** `agent-hover init`: install the package, add it to the Vite or Next.js app, connect agents, ignore local data. */
export async function runInit(root: string, opts: InitOptions, io: InitIO, s: Style): Promise<number> {
  const p = inspectProject(root);
  if (!p.hasPackageJson) {
    io.out(`\n  No package.json here. Run ${BRAND.cliName} init in your app's folder.\n`);
    return 1;
  }
  if (!p.framework) {
    io.out(`\n  No Vite config or Next.js app found. ${DISPLAY_NAME} works with Vite + React and Next.js.\n`);
    return 1;
  }
  if (p.framework === 'next' && p.next?.major && p.next.major < 15) {
    io.out(`\n  ${DISPLAY_NAME} needs Next.js 15 or later (this app has Next.js ${p.next.major}).\n`);
    return 1;
  }

  io.out(`\n  ${s.bold(DISPLAY_NAME)} ${s.dim('· set up in ' + root)}\n\n`);
  const detected = detectAgents(root);
  let ids = opts.agents?.length ? opts.agents : detected;
  if (!opts.agents?.length && io.interactive && !opts.yes && !opts.dryRun) {
    const fallback = ids.length ? ids : ['claude'];
    if (io.choose) {
      const picked = await io.choose('Which coding agents do you use?', agentChoices(detected, fallback));
      if (!picked) { io.out('\n  Nothing changed.\n'); return 1; }
      ids = picked;
      io.out('\n');
    } else {
      const choices = MCP_CLIENTS.map((c) => c.id).join(', ');
      const answer = (await io.ask(`  Which coding agents do you use? (${choices})\n  [${fallback.join(', ')}] `)).trim();
      ids = answer ? answer.split(/[\s,]+/).filter(Boolean) : fallback;
    }
  }
  if (!ids.length) ids = ['claude'];
  const agents: McpClient[] = [];
  for (const id of ids) {
    const c = findClient(id);
    if (!c) {
      io.out(`  Unknown agent "${id}". Use one of: ${MCP_CLIENTS.map((x) => x.id).join(', ')}\n`);
      return 1;
    }
    if (!agents.includes(c)) agents.push(c);
  }

  const steps = planInit(p, agents, { ...opts, home: opts.home ?? io.home });
  const todo = steps.filter((x) => x.state === 'todo');
  io.out(`  ${s.bold('Plan')}\n${renderPlan(steps, s)}\n`);

  if (opts.dryRun) {
    io.out(s.dim(`\n  Dry run: nothing was changed.${todo.length ? ` Run without --dry-run to apply ${todo.length} change${todo.length === 1 ? '' : 's'}.` : ''}\n`));
    return 0;
  }
  if (!todo.length) {
    io.out(`\n  Everything is set up.${steps.some((x) => x.state === 'manual') ? ' Finish the steps marked ! by hand.' : ''}\n`);
    return 0;
  }
  if (!opts.yes) {
    if (!io.interactive) {
      io.out(`\n  Run with --yes to apply these changes, or --dry-run to only show them.\n`);
      return 1;
    }
    const globals = todo.filter((x) => x.global).length;
    const where = globals ? ` (${globals} in your home folder, for every project)` : '';
    const question = `Apply ${todo.length} change${todo.length === 1 ? '' : 's'}${where}?`;
    let yes: boolean | null;
    if (io.confirm) {
      io.out('\n');
      yes = await io.confirm(question);
    } else {
      const answer = (await io.ask(`\n  ${question} [Y/n] `)).trim().toLowerCase();
      yes = !answer || answer === 'y' || answer === 'yes';
    }
    if (!yes) {
      io.out('  Nothing changed.\n');
      return 1;
    }
  }

  let failed = false;
  for (const step of todo) {
    if (step.command) {
      io.out(`\n  ${s.dim('$ ' + step.command.display)}\n`);
      const code = io.exec(step.command.cmd, step.command.args, root);
      if (code !== 0) {
        io.out(`  ${s.todo('!')} ${step.agent ? step.agent + ': ' : ''}${step.title} failed (exit ${code}). Run it yourself: ${step.command.display}\n`);
        failed = true;
      }
    } else if (step.write) {
      applyWrite(step.write);
      io.out(`  ${s.ok('✓')} ${step.agent ? step.agent + ': ' : ''}${step.title}${step.write.backup ? s.dim(` (backup: ${path.basename(step.write.file)}.bak)`) : ''}\n`);
    }
  }

  const titles = agents.map((a) => a.title);
  const names = titles.length > 1 ? `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}` : titles[0] || 'your agent';
  const starts = agents.filter((a) => a.commandFile).map((a) => `${a.title} ${s.bold(a.commandFile!.invoke)}`);
  io.out([
    '',
    `  ${s.bold('Next')}`,
    `  1. Start your dev server and open the app. Press ${s.bold('Alt')} (or the pointer in the dock) and click anything.`,
    `  2. Restart ${names} so ${agents.length > 1 ? 'they load' : 'it loads'} the MCP server${agents.some((a) => a.id === 'claude') ? ' (Claude Code asks you to approve .mcp.json once)' : ''}.`,
    `  3. Start listening: ${starts.length ? starts.join(' · ') : `tell your agent ${s.bold('"Listen for agent-hover tasks"')}`}. Then press Ask on any element and send.`,
    ...(starts.length ? [`     ${s.dim(`The -status command (e.g. ${agents.find((a) => a.commandFile)!.commandFile!.invoke}-status) shows what is waiting.`)}`] : []),
    '',
    s.dim(`  Check everything with: ${BRAND.cliName} doctor`),
    '',
  ].join('\n'));
  return failed ? 1 : 0;
}
