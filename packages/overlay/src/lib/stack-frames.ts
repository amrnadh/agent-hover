/**
 * React 19 dropped `_debugSource` but records, on every element, the stack where it was created (`_debugStack`).
 * Its first frame in the app's own code is the exact JSX line, in the dev server's transformed module; the bridge
 * maps it back to the source file through the dev server's source maps. Parsing works for Chrome/Edge
 * ("at fn (url:1:2)"), Firefox and Safari ("fn@url:1:2").
 *
 * The urls a frame can have:
 * - Vite: `http://localhost:5173/src/components/Hero.tsx?t=…`
 * - Next.js with Turbopack: `http://localhost:3000/_next/static/chunks/<chunk>.js` (many modules per chunk)
 * - Next.js with webpack: `webpack-internal:///(app-pages-browser)/./components/Hero.tsx`
 * - Server Components: `about://React/Server/<url>?N` (older React: `rsc://React/Server/…`), where the url is a
 *   server chunk (`file:///…/.next/…`) or a webpack module; the wrapper is dropped here, the bridge drops the `?N`.
 */
export interface Frame { url: string; line: number; column: number }

const CHROME = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?\s*$/;
const FIREFOX = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;
const SERVER = /^(?:about|rsc):\/\/React\/Server\//;
const SCHEME = /^(?:https?:\/\/|file:\/\/|webpack-internal:\/\/)/;

/** React's own frames around the element: the JSX call and the renderer's entry. */
const REACT_FRAME = /(^|\.)(jsx|jsxs|jsxDEV|fakeJSXCallSite|react_stack_bottom_frame)$/;

/** Next.js runtime chunks (Turbopack names chunks after their content: node_modules_…, …_next_dist_…). */
const NEXT_RUNTIME_CHUNK = /^(node_modules_|\[turbopack\]|\[externals\]|webpack\.js$|main\.js$|main-app\.js$|app-pages-internals\.js$|react-refresh\.js$|polyfills\.js$)|_next_dist_/;

/** Frames that are not the app's code: React itself, pre-bundled dependencies, the dev server's client, inline page scripts. */
function isLibrary(url: string, fn: string): boolean {
  if (fn && REACT_FRAME.test(fn)) return true;
  let path = url;
  try { path = decodeURIComponent(new URL(url).pathname); } catch { /* keep the raw url */ }
  if (url.startsWith('webpack-internal:')) path = url.replace(/^webpack-internal:\/*/, '/');
  const base = path.slice(path.lastIndexOf('/') + 1);
  return path.includes('/node_modules/')
    || path.includes('/.vite/deps/')
    || path.startsWith('/@vite/')
    || path.startsWith('/@react-refresh')
    || path.startsWith('/@id/')
    || path === '/'
    || path.endsWith('.html')
    || ((path.includes('/_next/static/') || path.includes('/.next/')) && NEXT_RUNTIME_CHUNK.test(base));
}

/**
 * Files of shared UI building blocks (shadcn's components/ui, design-system folders). An element written inside one
 * (<button> in ui/button.tsx) is better described where that block is used (<Button> in Hero.tsx): changing the
 * block changes every button.
 */
export function isSharedFile(file: string): boolean {
  return /(^|\/)(ui|shared|common|primitives)\//.test(file.replace(/\\/g, '/'));
}

function parseLine(text: string): (Frame & { fn: string }) | null {
  const m = CHROME.exec(text) || FIREFOX.exec(text);
  if (!m) return null;
  const url = m[2].replace(SERVER, '');
  if (!SCHEME.test(url)) return null;
  return { fn: (m[1] || '').trim(), url, line: Number(m[3]), column: Number(m[4]) };
}

export function parseFrames(stack: string | undefined | null): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const text of stack.split('\n')) {
    const f = parseLine(text);
    if (f) frames.push({ url: f.url, line: f.line, column: f.column });
  }
  return frames;
}

/** The first frame in the app's own code, or null (production build, or a stack from library code only). */
export function firstAppFrame(stack: string | undefined | null): Frame | null {
  if (!stack) return null;
  for (const text of stack.split('\n')) {
    const f = parseLine(text);
    if (f && !isLibrary(f.url, f.fn)) return { url: f.url, line: f.line, column: f.column };
  }
  return null;
}
