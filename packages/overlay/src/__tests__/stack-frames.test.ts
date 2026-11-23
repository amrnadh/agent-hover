import { describe, it, expect } from 'vitest';
import { firstAppFrame, isSharedFile, parseFrames } from '../lib/stack-frames.js';

// React 19's _debugStack for <span>INV-0148</span>, as each browser prints it.
const CHROME = `Error: react-stack-top-frame
    at exports.jsxDEV (http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=1a2b3c:250:30)
    at InvoiceSketch (http://localhost:5173/src/components/Features.tsx?t=1729000000000:27:9)
    at Object.react_stack_bottom_frame (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=1a2b3c:17424:20)`;
const FIREFOX = `exports.jsxDEV@http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=1a2b3c:250:30
InvoiceSketch@http://localhost:5173/src/components/Features.tsx:27:9
react_stack_bottom_frame@http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=1a2b3c:17424:20`;
const SAFARI = `jsxDEV@http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=1a2b3c:250:30
InvoiceSketch@http://localhost:5173/src/components/Features.tsx:27:9`;

describe('React creation stacks', () => {
  it('finds the first frame in the app code in Chrome, Firefox and Safari', () => {
    expect(firstAppFrame(CHROME)).toEqual({ url: 'http://localhost:5173/src/components/Features.tsx?t=1729000000000', line: 27, column: 9 });
    for (const stack of [FIREFOX, SAFARI]) {
      expect(firstAppFrame(stack)).toEqual({ url: 'http://localhost:5173/src/components/Features.tsx', line: 27, column: 9 });
    }
  });

  it('skips React, pre-bundled dependencies, Vite and inline page scripts', () => {
    expect(firstAppFrame(`at a (http://localhost:5173/@vite/client:1:1)
    at b (http://localhost:5173/:120:4)
    at c (http://localhost:5173/index.html:3:3)
    at d (http://localhost:5173/node_modules/some-lib/index.js:1:1)`)).toBeNull();
    expect(firstAppFrame('')).toBeNull();
    expect(firstAppFrame(undefined)).toBeNull();
  });

  it('reads every frame with a url, line and column', () => {
    expect(parseFrames(CHROME)).toHaveLength(3);
    expect(parseFrames('Error: no frames here')).toEqual([]);
  });

  it('finds the component in a Next.js Turbopack chunk, past the JSX runtime bundled into the same chunk', () => {
    const stack = `Error: react-stack-top-frame
    at exports.jsxDEV (http://localhost:3000/_next/static/chunks/_0zpqynofkyqlr._.js:314:33)
    at Card (http://localhost:3000/_next/static/chunks/_0zpqynofkyqlr._.js:21:215)
    at Object.react_stack_bottom_frame (http://localhost:3000/_next/static/chunks/1daa_next_dist_compiled_react-dom_cjs_react-dom-client_development_0mp0cp_t-ezj9.js:15013:24)`;
    expect(firstAppFrame(stack)).toEqual({ url: 'http://localhost:3000/_next/static/chunks/_0zpqynofkyqlr._.js', line: 21, column: 215 });
    expect(firstAppFrame(`Card@http://localhost:3000/_next/static/chunks/_0zpqynofkyqlr._.js:21:215`)).toEqual({ url: 'http://localhost:3000/_next/static/chunks/_0zpqynofkyqlr._.js', line: 21, column: 215 });
  });

  it("skips Next.js's own chunks (router, React)", () => {
    expect(firstAppFrame(`Error: react-stack-top-frame
    at exports.jsx (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_1amofcmz--cdp._.js:1150:33)
    at InnerLayoutRouter (http://localhost:3000/_next/static/chunks/node_modules_next_dist_20wefz_f1k6jn._.js:573:50)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:477:71)`)).toBeNull();
  });

  it('reads webpack module frames (next dev --webpack) in Chrome and Firefox', () => {
    const chrome = `Error: react-stack-top-frame
    at exports.jsxDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js:333:29)
    at Card (webpack-internal:///(app-pages-browser)/./components/Card.tsx:17:88)`;
    const firefox = `exports.jsxDEV@webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js:333:29
Card@webpack-internal:///(app-pages-browser)/./components/Card.tsx:17:88`;
    for (const stack of [chrome, firefox]) {
      expect(firstAppFrame(stack)).toEqual({ url: 'webpack-internal:///(app-pages-browser)/./components/Card.tsx', line: 17, column: 88 });
    }
  });

  it('reads Server Component frames without their React wrapper (route groups in paths too)', () => {
    const turbopack = `Error: react-stack-top-frame
    at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_164kp-67asdr9._.js:2093:21)
    at Page (about://React/Server/file:///Users/me/app/.next/dev/server/chunks/ssr/%5Broot-of-the-server%5D__04gwkqdqy_zxw._.js?3:24:264)`;
    expect(firstAppFrame(turbopack)).toEqual({ url: 'file:///Users/me/app/.next/dev/server/chunks/ssr/%5Broot-of-the-server%5D__04gwkqdqy_zxw._.js?3', line: 24, column: 264 });
    expect(firstAppFrame(`at Page (rsc://React/Server/webpack-internal:///(rsc)/./app/(shop)/page.tsx?2:13:87)`)).toEqual({ url: 'webpack-internal:///(rsc)/./app/(shop)/page.tsx?2', line: 13, column: 87 });
  });

  it('knows shared UI building blocks, whose elements are described where the block is used', () => {
    expect(isSharedFile('src/components/ui/button.tsx')).toBe(true);
    expect(isSharedFile('ui/card.tsx')).toBe(true);
    expect(isSharedFile('src\\components\\ui\\button.tsx')).toBe(true);
    expect(isSharedFile('src/components/Hero.tsx')).toBe(false);
    expect(isSharedFile('src/build/guide.tsx')).toBe(false);
  });
});
