#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findClient, MCP_CLIENTS } from './clients.js';
import { defaultDoctorIO, renderChecks, runChecks, type DoctorIO } from './doctor.js';
import { runInit, type InitIO } from './init.js';
import { inspectProject } from './project.js';
import { askChecklist, askConfirm, type Choice } from './prompt.js';
import { COLOR, PLAIN, renderClient, renderClientList, renderHelp, renderOverview, renderRules, type Style } from './render.js';

function version(): string {
  const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunIO {
  init?: InitIO;
  doctor?: DoctorIO;
}

function flags(args: string[]) {
  const has = (f: string) => args.includes(f);
  const value = (f: string) => {
    const inline = args.find((a) => a.startsWith(f + '='));
    if (inline) return inline.slice(f.length + 1);
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return { has, value };
}

export async function run(argv: string[], cwd: string, style: Style, io: RunIO = {}): Promise<RunResult> {
  const [cmd, arg] = argv;
  const ok = (stdout: string): RunResult => ({ code: 0, stdout, stderr: '' });

  if (!cmd) return ok(renderOverview(inspectProject(cwd), style));
  if (cmd === '-v' || cmd === '--version') return ok(version() + '\n');
  if (cmd === 'help' || cmd === '-h' || cmd === '--help') return ok(renderHelp(version(), style));
  if (cmd === 'rules') return ok(renderRules(style));
  if (cmd === 'mcp') {
    if (!arg) return ok(renderClientList(style));
    const client = findClient(arg);
    if (client) return ok(renderClient(client, style));
    return {
      code: 1,
      stdout: '',
      stderr: `Unknown agent "${arg}". Try one of: ${MCP_CLIENTS.map((c) => c.id).join(', ')}\n`,
    };
  }
  if (cmd === 'init') {
    const f = flags(argv.slice(1));
    const agent = f.value('--agent');
    let stdout = '';
    const initIO: InitIO = io.init ?? terminalIO(style);
    const out = initIO.out;
    const code = await runInit(cwd, {
      agents: agent ? agent.split(',').map((a) => a.trim()).filter(Boolean) : undefined,
      yes: f.has('--yes') || f.has('-y'),
      dryRun: f.has('--dry-run'),
      install: !f.has('--no-install'),
    }, { ...initIO, out: (t) => { if (io.init) stdout += t; else out(t); } }, style);
    return { code, stdout, stderr: '' };
  }
  if (cmd === 'doctor') {
    const checks = await runChecks(cwd, io.doctor ?? defaultDoctorIO());
    return { code: checks.some((c) => c.state === 'fail') ? 1 : 0, stdout: renderChecks(checks, style), stderr: '' };
  }
  return { code: 1, stdout: renderHelp(version(), style), stderr: `Unknown command "${cmd}".\n` };
}

/** Real terminal: prompts on stdin (a checklist and yes/no), installs with the project's package manager, prints as it goes. */
function terminalIO(style: Style): InitIO {
  const interactive = !!process.stdin.isTTY && !!process.stdout.isTTY;
  return {
    interactive,
    ...(interactive ? {
      choose: (message: string, choices: Choice[]) => askChecklist(message, choices, style),
      confirm: (message: string) => askConfirm(message, style),
    } : {}),
    async ask(question) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try { return await rl.question(question); } finally { rl.close(); }
    },
    exec(cmd, args, cwd) {
      const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
      return r.status ?? 1;
    },
    out: (t) => process.stdout.write(t),
  };
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    // npx and npm bins run through a symlink, so compare real paths.
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

const isMain = isMainModule();
if (isMain) {
  const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
  run(process.argv.slice(2), process.cwd(), useColor ? COLOR : PLAIN).then((result) => {
    if (result.stdout) process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : result.stdout + '\n');
    if (result.stderr) process.stderr.write(result.stderr);
    process.exitCode = result.code;
  });
}
