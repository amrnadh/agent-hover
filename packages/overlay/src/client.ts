import { createOverlayApp, type OverlayConfig } from './app/context.js';
import { setupBridgeConnection } from './bridge/connection.js';
import { setupTheme } from './ui/theme.js';
import { setupToast } from './ui/toast.js';
import { setupContextFormat } from './features/context-format.js';
import { setupSelector } from './features/selector.js';
import { setupPrompt } from './features/prompt.js';
import { setupAgentDispatch } from './bridge/dispatch.js';
import { setupOpenInEditor } from './features/open-in-editor.js';
import { setupScreenshots } from './features/screenshots.js';
import { setupActionPill } from './ui/action-pill.js';
import { setupComposer } from './ui/composer.js';
import { setupVoice } from './features/voice.js';
import { setupTasks } from './ui/tasks.js';
import { setupVerify } from './ui/verify.js';
import { setupComments } from './features/comments.js';
import { setupBatch } from './features/batch.js';
import { setupSidebar } from './ui/sidebar.js';
import { setupInspectPanel } from './ui/panels/inspect.js';
import { setupListPanels } from './ui/panels/lists.js';
import { setupSettingsPanel } from './ui/panels/settings.js';
import { setupDock } from './ui/dock.js';
import { setupKeyboard } from './features/keyboard.js';
import { setupStateSync } from './bridge/sync.js';
import { setupStartup } from './bridge/startup.js';

export type { OverlayConfig };

/**
 * Mount the overlay. Order matters only for setup-time calls: core services first (connection, theme,
 * toast, formatters, selector), then surfaces, then the dock (which renders state from all of them),
 * then message routing and the initial load.
 */
export function bootstrapOverlay(config: OverlayConfig) {
  const app = createOverlayApp(config);
  setupBridgeConnection(app);
  setupTheme(app);
  setupToast(app);
  setupContextFormat(app);
  setupSelector(app);
  setupPrompt(app);
  setupAgentDispatch(app);
  setupOpenInEditor(app);
  setupScreenshots(app);
  setupActionPill(app);
  setupComposer(app);
  setupVoice(app);
  setupTasks(app);
  setupVerify(app);
  setupComments(app);
  setupBatch(app);
  setupSidebar(app);
  setupInspectPanel(app);
  setupListPanels(app);
  setupSettingsPanel(app);
  setupDock(app);
  setupKeyboard(app);
  setupStateSync(app);
  setupStartup(app);
}

if (typeof window !== 'undefined') {
  (window as any).__AGENT_HOVER_BOOTSTRAP__ = (port: number, editor?: string, token?: string) => {
    bootstrapOverlay({ port, editor, token });
  };
}
