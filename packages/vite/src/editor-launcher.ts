import { execFile } from 'child_process';
import { promisify } from 'util';
import { validateSafePath } from './path-validator.js';

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

/** An editor's own link for a file (`vscode://file/C:/app/a.tsx:3:1`), with forward slashes on every platform. */
export function editorFileUrl(scheme: string, file: string, line: number, col: number): string {
  const p = file.replace(/\\/g, '/');
  return `${scheme}://file${p.startsWith('/') ? '' : '/'}${p}:${line}:${col}`;
}

/** Link schemes for editors that register one. On Windows their CLIs are .cmd shims, which Node won't run without a
 * shell, so the link is opened instead (rundll32 hands it to the registered app; still no shell). */
const URL_SCHEMES: Record<string, string> = { cursor: 'cursor', windsurf: 'windsurf', antigravity: 'antigravity-ide', code: 'vscode', vscode: 'vscode' };

/**
 * Builds safe argument arrays without invoking a shell.
 * Prevents command injection by guaranteeing arguments are passed directly to execFile/spawn.
 */
export function buildEditorLaunchPlan(options: EditorLaunchOptions, platform: NodeJS.Platform = process.platform): LaunchCommand {
  const line = Number.isInteger(options.targetLine) && options.targetLine! > 0 ? options.targetLine! : 1;
  const col = Number.isInteger(options.targetColumn) && options.targetColumn! > 0 ? options.targetColumn! : 1;
  const file = options.targetFile;
  const ed = options.editor.toLowerCase();

  const scheme = URL_SCHEMES[ed] ?? (['webstorm', 'zed'].includes(ed) ? undefined : 'vscode');
  if (platform === 'win32' && scheme) {
    return { bin: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', editorFileUrl(scheme, file, line, col)] };
  }

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
 * Builds safe argument array for opening a local folder without invoking a shell.
 */
export function buildFolderLaunchPlan(folderPath: string, platform: NodeJS.Platform = process.platform): { bin: string; args: string[] } {
  if (platform === 'win32') {
    return { bin: 'explorer.exe', args: [folderPath] };
  } else if (platform === 'linux') {
    return { bin: 'xdg-open', args: [folderPath] };
  }
  return { bin: 'open', args: [folderPath] };
}

/**
 * Safely opens a directory after validating it is confined to the project (NO SHELL).
 */
export async function launchFolderSafely(targetPath: string, projectRoot: string): Promise<void> {
  const safePath = validateSafePath(targetPath, projectRoot);
  const plan = buildFolderLaunchPlan(safePath);
  try {
    await execFileAsync(plan.bin, plan.args, { windowsHide: true });
  } catch (err: any) {
    // explorer.exe exits with 1 even when the window opened.
    if (!(process.platform === 'win32' && err?.code === 1)) throw err;
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
