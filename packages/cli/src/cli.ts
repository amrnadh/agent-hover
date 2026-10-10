#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findClient, MCP_CLIENTS } from './clients.js';
import { inspectProject } from './project.js';
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

export function run(argv: string[], cwd: string, style: Style): RunResult {
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
  return { code: 1, stdout: renderHelp(version(), style), stderr: `Unknown command "${cmd}".\n` };
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
  const result = run(process.argv.slice(2), process.cwd(), useColor ? COLOR : PLAIN);
  if (result.stdout) process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : result.stdout + '\n');
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.code;
}
