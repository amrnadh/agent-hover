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

  it('knows shared UI building blocks, whose elements are described where the block is used', () => {
    expect(isSharedFile('src/components/ui/button.tsx')).toBe(true);
    expect(isSharedFile('ui/card.tsx')).toBe(true);
    expect(isSharedFile('src\\components\\ui\\button.tsx')).toBe(true);
    expect(isSharedFile('src/components/Hero.tsx')).toBe(false);
    expect(isSharedFile('src/build/guide.tsx')).toBe(false);
  });
});
