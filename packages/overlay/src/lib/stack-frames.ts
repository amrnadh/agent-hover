/**
 * React 19 dropped `_debugSource` but records, on every element, the stack where it was created (`_debugStack`).
 * Its first frame in the app's own code is the exact JSX line, in the dev server's transformed module; the bridge
 * maps it back to the source file through Vite's source map. Parsing works for Chrome/Edge ("at fn (url:1:2)"),
 * Firefox and Safari ("fn@url:1:2").
 */
export interface Frame { url: string; line: number; column: number }

const FRAME = /((?:https?|file):\/\/[^\s()@]+?):(\d+):(\d+)/;

/** Frames that are not the app's code: React itself, pre-bundled dependencies, Vite's client, inline page scripts. */
function isLibrary(url: string): boolean {
  let path = url;
  try { path = new URL(url).pathname; } catch { /* keep the raw url */ }
  return path.includes('/node_modules/')
    || path.includes('/.vite/deps/')
    || path.startsWith('/@vite/')
    || path.startsWith('/@react-refresh')
    || path.startsWith('/@id/')
    || path === '/'
    || path.endsWith('.html');
}

/**
 * Files of shared UI building blocks (shadcn's components/ui, design-system folders). An element written inside one
 * (<button> in ui/button.tsx) is better described where that block is used (<Button> in Hero.tsx): changing the
 * block changes every button.
 */
export function isSharedFile(file: string): boolean {
  return /(^|\/)(ui|shared|common|primitives)\//.test(file.replace(/\\/g, '/'));
}

export function parseFrames(stack: string | undefined | null): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const line of stack.split('\n')) {
    const m = FRAME.exec(line);
    if (m) frames.push({ url: m[1], line: Number(m[2]), column: Number(m[3]) });
  }
  return frames;
}

/** The first frame in the app's own code, or null (production build, or a stack from library code only). */
export function firstAppFrame(stack: string | undefined | null): Frame | null {
  return parseFrames(stack).find((f) => !isLibrary(f.url)) || null;
}
