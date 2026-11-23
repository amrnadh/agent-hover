import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BRAND, NEXT_PACKAGE, VITE_PACKAGE } from './brand.js';
import { inspectNext, NEXT_CONFIGS, type NextInfo } from './next-setup.js';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface ProjectInfo {
  root: string;
  hasPackageJson: boolean;
  packageManager: PackageManager;
  /** What the app runs on: Next.js when it depends on next (even with a vite.config for tests), else Vite when it has a Vite config. */
  framework: 'vite' | 'next' | null;
  /** The Agent Hover package for that framework: @agent-hover/vite or @agent-hover/next. */
  pluginPackage: string;
  viteConfig: string | null;
  /** Next.js details (config, app/ or pages/, instrumentation), when the app is a Next.js app. */
  next: NextInfo | null;
  /** Vite: the config mentions the plugin package. Next.js: config, instrumentation and layout or document are all set up. */
  pluginConfigured: boolean;
  pluginInstalled: boolean;
  usesReact: boolean;
  /** MCP config files in this project that already register the server. */
  mcpConfigured: string[];
}

const VITE_CONFIGS = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cts', 'vite.config.cjs'];
const PROJECT_MCP_FILES = ['.mcp.json', '.cursor/mcp.json', '.codex/config.toml'];

function readText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function detectPackageManager(root: string): PackageManager {
  if (existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(path.join(root, 'bun.lockb')) || existsSync(path.join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

export function installCommand(pm: PackageManager, pkg: string): string {
  if (pm === 'npm') return `npm install -D ${pkg}`;
  if (pm === 'bun') return `bun add -d ${pkg}`;
  return `${pm} add -D ${pkg}`;
}

/** Read-only inspection of the current directory. Never writes anything. */
export function inspectProject(root: string): ProjectInfo {
  const pkgText = readText(path.join(root, 'package.json'));
  let deps: Record<string, string> = {};
  if (pkgText) {
    try {
      const pkg = JSON.parse(pkgText);
      deps = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch {
      // Malformed package.json: treat as no dependencies.
    }
  }

  const viteConfig = VITE_CONFIGS.find((f) => existsSync(path.join(root, f))) ?? null;
  const viteText = viteConfig ? readText(path.join(root, viteConfig)) ?? '' : '';
  const next = 'next' in deps || NEXT_CONFIGS.some((f) => existsSync(path.join(root, f))) ? inspectNext(root, deps.next) : null;
  const framework = next ? 'next' : viteConfig ? 'vite' : null;
  const pluginPackage = framework === 'next' ? NEXT_PACKAGE : VITE_PACKAGE;

  const mcpConfigured = PROJECT_MCP_FILES.filter((f) => {
    const text = readText(path.join(root, f));
    return !!text && text.includes(BRAND.mcpServerName);
  });

  return {
    root,
    hasPackageJson: !!pkgText,
    packageManager: detectPackageManager(root),
    framework,
    pluginPackage,
    viteConfig,
    next,
    pluginConfigured: next ? next.configured : viteText.includes(VITE_PACKAGE),
    pluginInstalled: pluginPackage in deps,
    usesReact: 'react' in deps,
    mcpConfigured,
  };
}
