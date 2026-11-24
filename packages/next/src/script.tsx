import Script from 'next/script';
import { pageScripts } from './shared.js';

/**
 * Agent Hover's dock and overlay, for the App Router. Put it at the end of `<body>` in your root layout
 * (`app/layout.tsx`). Renders nothing outside `next dev`.
 *
 *   import { AgentHover } from '@agent-hover/next/script';
 *   …
 *   <body>
 *     {children}
 *     <AgentHover />
 *   </body>
 */
export function AgentHover() {
  const scripts = pageScripts();
  if (!scripts) return null;
  return (
    <>
      {scripts.screenshot ? (
        <Script id="agent-hover-screenshot" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: scripts.screenshot }} />
      ) : null}
      <Script id="agent-hover-overlay" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: scripts.overlay }} />
    </>
  );
}

export default AgentHover;
