import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import type { DoctorIO } from '../doctor.js';
import type { InitIO } from '../init.js';
import { addToDocument, addToInstrumentation, addToLayout, inspectNext, wrapNextConfig } from '../next-setup.js';
import { inspectProject } from '../project.js';
import { PLAIN } from '../render.js';

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ah-next-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}
const read = (dir: string, f: string) => readFileSync(path.join(dir, f), 'utf8');

function fakeIO(): InitIO & { commands: string[] } {
  const commands: string[] = [];
  return {
    interactive: false,
    home: mkdtempSync(path.join(tmpdir(), 'ah-home-')),
    commands,
    ask: async () => '',
    exec: (cmd, args) => { commands.push([cmd, ...args].join(' ')); return 0; },
    out: () => {},
  };
}

// What create-next-app writes (App Router, TypeScript).
const CONFIG_TS = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
`;
const LAYOUT = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "App" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
`;
const nextApp = (extra: Record<string, string> = {}) => fixture({
  'package.json': JSON.stringify({ dependencies: { next: '16.1.0', react: '19.2.0', 'react-dom': '19.2.0' } }),
  'tsconfig.json': '{}',
  'next.config.ts': CONFIG_TS,
  'app/layout.tsx': LAYOUT,
  'app/page.tsx': 'export default function Page() { return <main />; }',
  ...extra,
});

describe('next.config edit', () => {
  it('wraps the exported config and imports withAgentHover', () => {
    const r = wrapNextConfig(CONFIG_TS);
    expect(r.ok && r.code).toContain('import type { NextConfig } from "next";\nimport { withAgentHover } from "@agent-hover/next";');
    expect(r.ok && r.code).toContain('export default withAgentHover(nextConfig);');
    expect(wrapNextConfig(r.ok ? r.code : '')).toEqual(r); // a second run changes nothing
  });

  it('wraps object literals, other wrappers, config functions and CommonJS', () => {
    const literal = wrapNextConfig("export default {\n  images: { domains: ['a.com'] },\n} satisfies NextConfig\n");
    expect(literal.ok && literal.code).toContain("export default withAgentHover({\n  images: { domains: ['a.com'] },\n} satisfies NextConfig)\n");
    expect(literal.ok && literal.code.startsWith("import { withAgentHover } from '@agent-hover/next';\n\n")).toBe(true);

    const wrapped = wrapNextConfig("import withMDX from '@next/mdx'\nexport default withMDX()(config)\n\nexport const runtime = 'x'\n");
    expect(wrapped.ok && wrapped.code).toContain("import withMDX from '@next/mdx'\nimport { withAgentHover } from '@agent-hover/next'\nexport default withAgentHover(withMDX()(config))\n\nexport const runtime");

    const fn = wrapNextConfig('export default (phase) => ({ reactStrictMode: phase !== "x" });');
    expect(fn.ok && fn.code).toContain('export default withAgentHover((phase) => ({ reactStrictMode: phase !== "x" }));');

    const cjs = wrapNextConfig("// @ts-check\n/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nmodule.exports = nextConfig;\n");
    expect(cjs.ok && cjs.code).toBe("// @ts-check\nconst { withAgentHover } = require('@agent-hover/next');\n/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nmodule.exports = withAgentHover(nextConfig);\n");
    const cjsRequire = wrapNextConfig("const path = require('path');\nmodule.exports = { distDir: path.join('x') };\n");
    expect(cjsRequire.ok && cjsRequire.code).toBe("const path = require('path');\nconst { withAgentHover } = require('@agent-hover/next');\nmodule.exports = withAgentHover({ distDir: path.join('x') });\n");
  });

  it('leaves configs it does not understand to the user', () => {
    expect(wrapNextConfig('export default async function config() { return {}; }').ok).toBe(false);
    expect(wrapNextConfig('const withAgentHover = 1; export default {}').ok).toBe(false);
    expect(wrapNextConfig('const x = {};').ok).toBe(false);
  });
});

describe('instrumentation, layout and document edits', () => {
  it('starts Agent Hover at the top of an existing register(), making it async', () => {
    const r = addToInstrumentation("import * as Sentry from '@sentry/nextjs';\n\nexport function register() {\n  Sentry.init({});\n}\n");
    expect(r.ok && r.code).toContain("export async function register() {\n  // Agent Hover");
    expect(r.ok && r.code).toContain("    await (await import('@agent-hover/next/register')).register();\n  }\n  Sentry.init({});\n}");
    expect(addToInstrumentation('export const onRequestError = () => {};').ok).toBe(false);
  });

  it('adds <AgentHover /> at the end of <body> in the root layout', () => {
    const r = addToLayout(LAYOUT);
    expect(r.ok && r.code).toContain('import "./globals.css";\nimport { AgentHover } from "@agent-hover/next/script";');
    expect(r.ok && r.code).toContain('        {children}\n        <AgentHover />\n      </body>');
    const inline = addToLayout('export default function L({ children }) { return <html><body>{children}</body></html>; }');
    expect(inline.ok && inline.code).toContain('<body>{children}<AgentHover /></body>');
    expect(addToLayout("'use client';\nexport default function L() { return <body></body>; }").ok).toBe(false);
  });

  it('adds <AgentHover /> after <NextScript /> in pages/_document', () => {
    const src = "import { Html, Head, Main, NextScript } from 'next/document';\n\nexport default function Document() {\n  return (\n    <Html>\n      <Head />\n      <body>\n        <Main />\n        <NextScript />\n      </body>\n    </Html>\n  );\n}\n";
    const r = addToDocument(src);
    expect(r.ok && r.code).toContain("import { AgentHover } from '@agent-hover/next/document';");
    expect(r.ok && r.code).toContain('        <NextScript />\n        <AgentHover />\n      </body>');
  });

  it('finds src/ folders, the Pages Router and an existing instrumentation file', () => {
    const dir = fixture({ 'src/pages/index.tsx': '', 'src/instrumentation.js': 'export function register() {}', 'next.config.mjs': '' });
    expect(inspectNext(dir, '^15.3.0')).toMatchObject({ major: 15, appDir: null, pagesDir: 'src/pages', document: 'src/pages/_document.js', documentExists: false, instrumentation: 'src/instrumentation.js', instrumentationExists: true, config: 'next.config.mjs' });
  });
});

describe('agent-hover init in a Next.js app', () => {
  it('installs @agent-hover/next, wraps the config, writes instrumentation.ts and adds <AgentHover />; a second run changes nothing', async () => {
    const dir = nextApp({ 'vite.config.ts': "// vitest only\nexport default {}" });
    expect(inspectProject(dir)).toMatchObject({ framework: 'next', pluginPackage: '@agent-hover/next', pluginConfigured: false });

    const dry = await run(['init', '--dry-run', '--agent', 'claude'], dir, PLAIN, { init: fakeIO() });
    expect(dry.stdout).toContain('npm install -D @agent-hover/next');
    expect(dry.stdout).toContain('create instrumentation.ts');
    expect(dry.stdout).toContain('<AgentHover /> at the end of <body> in app/layout.tsx');
    expect(existsSync(path.join(dir, 'instrumentation.ts'))).toBe(false);

    const io = fakeIO();
    const r = await run(['init', '--yes', '--agent', 'claude'], dir, PLAIN, { init: io });
    expect(r.code).toBe(0);
    expect(io.commands).toEqual(['npm install -D @agent-hover/next']);
    expect(read(dir, 'next.config.ts')).toContain('export default withAgentHover(nextConfig);');
    expect(read(dir, 'instrumentation.ts')).toContain("import('@agent-hover/next/register')");
    expect(read(dir, 'app/layout.tsx')).toContain('<AgentHover />');
    expect(read(dir, 'vite.config.ts')).not.toContain('agent-hover');
    expect(read(dir, '.mcp.json')).toContain('agent-hover');

    // Installed now: everything is done.
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '16.1.0', react: '19.2.0' }, devDependencies: { '@agent-hover/next': '^0.3.0' } }));
    const again = await run(['init', '--yes', '--agent', 'claude'], dir, PLAIN, { init: fakeIO() });
    expect(again.stdout).toContain('Everything is set up.');
    expect(inspectProject(dir).pluginConfigured).toBe(true);
  });

  it('creates pages/_document and next.config for a Pages Router app without them', async () => {
    const dir = fixture({ 'package.json': JSON.stringify({ dependencies: { next: '15.5.0', react: '19.0.0' } }), 'pages/index.js': '' });
    const r = await run(['init', '--yes', '--agent', 'claude', '--no-install'], dir, PLAIN, { init: fakeIO() });
    expect(r.code).toBe(0);
    expect(read(dir, 'pages/_document.js')).toContain('<NextScript />\n        <AgentHover />');
    expect(read(dir, 'next.config.mjs')).toContain('export default withAgentHover({});');
    expect(read(dir, 'instrumentation.js')).toContain('export async function register()');
  });

  it('refuses Next.js 14 and older', async () => {
    const dir = fixture({ 'package.json': JSON.stringify({ dependencies: { next: '^14.2.0' } }), 'app/layout.tsx': LAYOUT });
    const r = await run(['init', '--yes'], dir, PLAIN, { init: fakeIO() });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('needs Next.js 15 or later');
  });

  it('shows the Next.js steps in the overview and checks them in doctor', async () => {
    const dir = nextApp();
    const overview = await run([], dir, PLAIN);
    expect(overview.stdout).toContain('Next.js app found (app/)');
    expect(overview.stdout).toContain('npm install -D @agent-hover/next');
    expect(overview.stdout).toContain("import { AgentHover } from '@agent-hover/next/script';");

    const io: DoctorIO = { fetch: globalThis.fetch, home: fixture({}), nodeVersion: '22.1.0', isPidAlive: () => false };
    const before = await run(['doctor'], dir, PLAIN, { doctor: io });
    expect(before.stdout).toContain('✓ Next.js 16 (app/)');
    expect(before.stdout).toContain('✗ @agent-hover/next is not a dependency');
    expect(before.stdout).toContain('✗ next.config.ts does not use withAgentHover');
    expect(before.stdout).toContain('✗ instrumentation.ts does not start the bridge');
    expect(before.stdout).toContain('✗ <AgentHover /> is not in app/layout.tsx');

    await run(['init', '--yes', '--agent', 'claude', '--no-install'], dir, PLAIN, { init: fakeIO() });
    const after = await run(['doctor'], dir, PLAIN, { doctor: io });
    expect(after.stdout).toContain('✓ next.config.ts uses withAgentHover');
    expect(after.stdout).toContain('✓ instrumentation.ts starts the bridge');
    expect(after.stdout).toContain('✓ <AgentHover /> is in app/layout.tsx');
  });
});
