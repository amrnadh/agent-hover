import { pageScripts } from './shared.js';

/**
 * Agent Hover's dock and overlay, for the Pages Router. Put it after `<NextScript />` in `pages/_document.tsx`
 * (the document only renders on the server, where the bridge is). Renders nothing outside `next dev`.
 *
 *   import { AgentHover } from '@agent-hover/next/document';
 *   …
 *   <body>
 *     <Main />
 *     <NextScript />
 *     <AgentHover />
 *   </body>
 */
export function AgentHover() {
  const scripts = pageScripts();
  if (!scripts) return null;
  return (
    <>
      {scripts.screenshot ? <script id="agent-hover-screenshot" dangerouslySetInnerHTML={{ __html: scripts.screenshot }} /> : null}
      {/* A module script waits for the page to finish parsing, like the Vite plugin's. */}
      <script id="agent-hover-overlay" type="module" dangerouslySetInnerHTML={{ __html: scripts.overlay }} />
    </>
  );
}

export default AgentHover;
