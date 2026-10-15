import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BRAND, DISPLAY_NAME, VITE_PACKAGE } from './brand.js';
import { findClient, MCP_CLIENTS, type McpClient } from './clients.js';
import { inspectProject, installCommand, type ProjectInfo } from './project.js';
import { mergeCommandFile, mergeGitignore, mergeJsonMcp, mergeRules, mergeTomlMcp, type Merge } from './setup-files.js';
import { addPluginToViteConfig, VITE_MANUAL_STEPS } from './vite-config.js';
import type { Style } from './render.js';

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
  return found;
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

/** Everything `init` would do in this project, without doing any of it. */
export function planInit(p: ProjectInfo, agents: McpClient[], opts: InitOptions = {}): Step[] {
  const steps: Step[] = [];
  const root = p.root;

  if (p.pluginInstalled) steps.push({ title: `Install ${VITE_PACKAGE}`, state: 'done', detail: 'already in package.json' });
  else if (opts.install === false) steps.push({ title: `Install ${VITE_PACKAGE}`, state: 'manual', detail: installCommand(p.packageManager, VITE_PACKAGE) });
  else {
    const display = installCommand(p.packageManager, VITE_PACKAGE);
    const [cmd, ...args] = display.split(' ');
    steps.push({ title: `Install ${VITE_PACKAGE}`, state: 'todo', detail: display, command: { cmd, args, display } });
  }

  const configRel = p.viteConfig!;
  const configFile = path.join(root, configRel);
  const edit = addPluginToViteConfig(readFileSync(configFile, 'utf8'));
  if (p.pluginConfigured) steps.push({ title: `Add the plugin to ${configRel}`, state: 'done' });
  else if (!edit.ok) steps.push({ title: `Add the plugin to ${configRel}`, state: 'manual', detail: `Not edited automatically (${edit.reason}). Add:\n${VITE_MANUAL_STEPS}` });
  else steps.push({ title: `Add the plugin to ${configRel}`, state: 'todo', detail: `import agentHover and add agentHover() to plugins`, write: { file: configFile, content: edit.code, backup: false } });

  const home = opts.home ?? os.homedir();
  for (const agent of agents) {
    if (agent.projectConfig) {
      const { file, format } = agent.projectConfig;
      steps.push(fileStep(root, `Connect ${agent.title} (MCP server)`, file, format === 'json' ? (t) => mergeJsonMcp(t) : (t) => mergeTomlMcp(t), format === 'json'));
    } else if (agent.globalConfig) {
      // Global only: the first location is created when missing; older locations are updated only if present.
      agent.globalConfig.forEach((rel, i) => {
        if (i > 0 && !existsSync(path.join(home, rel))) return;
        const shown = '~/' + rel.split(path.sep).join('/');
        steps.push({ ...fileStep(home, `Connect ${agent.title} (MCP server, global config)`, rel, (t) => mergeJsonMcp(t), true, shown), global: true });
      });
    } else {
      steps.push({
        title: `Connect ${agent.title} (MCP server)`,
        state: 'manual',
        detail: agent.command ? `Run: ${agent.command}` : `${agent.title} only has a global config. Add to ${agent.configPath}:\n${agent.snippet}`,
      });
    }
    if (agent.rulesFile) {
      const { file, kind } = agent.rulesFile;
      steps.push(fileStep(root, `Teach ${agent.title} to pick up tasks`, file, (t) => mergeRules(t, kind)));
    }
    if (agent.commandFile) {
      const { file, kind, invoke } = agent.commandFile;
      steps.push(fileStep(root, `Add ${invoke} to ${agent.title} (starts listening)`, file, (t) => mergeCommandFile(t, kind)));
    }
  }

  steps.push(fileStep(root, `Keep ${BRAND.dataDir} data out of git`, '.gitignore', mergeGitignore));
  return steps;
}

export function renderPlan(steps: Step[], s: Style): string {
  const icon = { done: s.ok('✓'), todo: s.bold('+'), manual: s.todo('!') };
  const out: string[] = [];
  for (const step of steps) {
    out.push(`  ${icon[step.state]} ${step.title}${step.state === 'done' ? s.dim(' · already done') : ''}`);
    if (step.detail && step.state !== 'done') out.push(...step.detail.split('\n').map((l) => '      ' + (step.state === 'manual' ? l : s.dim(l))));
  }
  return out.join('\n');
}

function applyWrite(w: FileWrite) {
  mkdirSync(path.dirname(w.file), { recursive: true });
  if (w.backup) copyFileSync(w.file, w.file + '.bak');
  writeFileSync(w.file, w.content);
}

/** `agent-hover init`: install the plugin, add it to the Vite config, connect agents, ignore local data. */
export async function runInit(root: string, opts: InitOptions, io: InitIO, s: Style): Promise<number> {
  const p = inspectProject(root);
  if (!p.hasPackageJson) {
    io.out(`\n  No package.json here. Run ${BRAND.cliName} init in your app's folder.\n`);
    return 1;
  }
  if (!p.viteConfig) {
    io.out(`\n  No Vite config found. ${BRAND.name} 0.2 supports Vite + React (Next.js is planned).\n`);
    return 1;
  }

  let ids = opts.agents?.length ? opts.agents : detectAgents(root);
  if (!opts.agents?.length && io.interactive && !opts.yes && !opts.dryRun) {
    const choices = MCP_CLIENTS.map((c) => c.id).join(', ');
    const fallback = ids.length ? ids : ['claude'];
    const answer = (await io.ask(`  Which coding agents do you use? (${choices})\n  [${fallback.join(', ')}] `)).trim();
    ids = answer ? answer.split(/[\s,]+/).filter(Boolean) : fallback;
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
  io.out(`\n  ${s.bold(`Set up ${DISPLAY_NAME}`)} ${s.dim('in ' + root)}\n\n${renderPlan(steps, s)}\n`);

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
    const answer = (await io.ask(`\n  Apply ${todo.length} change${todo.length === 1 ? '' : 's'}${where}? [Y/n] `)).trim().toLowerCase();
    if (answer && answer !== 'y' && answer !== 'yes') {
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
        io.out(`  ${s.todo('!')} ${step.title} failed (exit ${code}). Run it yourself: ${step.command.display}\n`);
        failed = true;
      }
    } else if (step.write) {
      applyWrite(step.write);
      io.out(`  ${s.ok('✓')} ${step.title}${step.write.backup ? s.dim(` (backup: ${path.basename(step.write.file)}.bak)`) : ''}\n`);
    }
  }

  const agentName = agents[0]?.title || 'your agent';
  const invoke = agents[0]?.commandFile?.invoke;
  io.out([
    '',
    `  ${s.bold('Next')}`,
    `  1. Start your dev server and open the app. Press ${s.bold('Alt')} (or the pointer in the dock) and click anything.`,
    `  2. Restart ${agentName} so it loads the MCP server${agents.some((a) => a.id === 'claude') ? ' (Claude Code asks you to approve .mcp.json once)' : ''}.`,
    `  3. ${invoke ? `Run ${s.bold(invoke)} in ${agentName} (or say ${s.bold('"Listen for agent-hover tasks"')})` : `Tell it once: ${s.bold('"Listen for agent-hover tasks"')}`}. Then press Ask on any element and send.`,
    '',
    s.dim(`  Check everything with: ${BRAND.cliName} doctor`),
    '',
  ].join('\n'));
  return failed ? 1 : 0;
}
