import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const SUPPORTED_EDITORS = ['cursor', 'vscode', 'code', 'windsurf', 'webstorm', 'zed', 'antigravity'] as const;
export type SupportedEditor = (typeof SUPPORTED_EDITORS)[number];

export interface EditorLaunchOptions {
  editor: string;
  targetFile: string;
  targetLine?: number;
  targetColumn?: number;
  projectRoot: string;
}

export interface LaunchCommand {
  bin: string;
  args: string[];
  fallback?: { bin: string; args: string[] };
}

/**
 * Builds safe argument arrays without invoking a shell.
 * Prevents command injection by guaranteeing arguments are passed directly to execFile/spawn.
 */
export function buildEditorLaunchPlan(options: EditorLaunchOptions): LaunchCommand {
  const line = Number.isInteger(options.targetLine) && options.targetLine! > 0 ? options.targetLine! : 1;
  const col = Number.isInteger(options.targetColumn) && options.targetColumn! > 0 ? options.targetColumn! : 1;
  const file = options.targetFile;
  const ed = options.editor.toLowerCase();

  switch (ed) {
    case 'cursor':
      return {
        bin: 'cursor',
        args: ['-g', `${file}:${line}:${col}`],
        fallback: process.platform === 'darwin' ? { bin: 'open', args: [`cursor://file${file}:${line}:${col}`] } : undefined,
      };

    case 'windsurf':
      return {
        bin: 'windsurf',
        args: ['-g', `${file}:${line}:${col}`],
        fallback: process.platform === 'darwin' ? { bin: 'open', args: [`windsurf://file${file}:${line}:${col}`] } : undefined,
      };

    case 'antigravity':
      return {
        bin: 'agy',
        args: [options.projectRoot, file],
        fallback: process.platform === 'darwin' ? { bin: 'open', args: [`antigravity-ide://file${file}:${line}:${col}`] } : undefined,
      };

    case 'webstorm':
      return {
        bin: 'webstorm',
        args: ['--line', String(line), file],
      };

    case 'zed':
      return {
        bin: 'zed',
        args: [`${file}:${line}:${col}`],
      };

    case 'code':
    case 'vscode':
    default:
      return {
        bin: 'code',
        args: ['-g', `${file}:${line}:${col}`],
        fallback: process.platform === 'darwin' ? { bin: 'open', args: [`vscode://file${file}:${line}:${col}`] } : undefined,
      };
  }
}

/**
 * Safely executes the editor launch using execFile with an argument array (NO SHELL).
 */
export async function launchEditorSafely(options: EditorLaunchOptions): Promise<void> {
  const plan = buildEditorLaunchPlan(options);

  try {
    await execFileAsync(plan.bin, plan.args, { windowsHide: true });
  } catch (primaryErr) {
    if (plan.fallback) {
      await execFileAsync(plan.fallback.bin, plan.fallback.args, { windowsHide: true });
    } else {
      throw primaryErr;
    }
  }
}
