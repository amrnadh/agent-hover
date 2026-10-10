import { createOverlayApp, type OverlayConfig } from './app/context.js';
import { setupBridgeConnection } from './bridge/connection.js';
import { setupDockLayout } from './ui/dock-layout.js';
import { setupSidebar } from './ui/sidebar.js';
import { setupEditorPreference } from './features/editor-preference.js';
import { setupMcpModal } from './ui/mcp-modal.js';
import { setupToast } from './ui/toast.js';
import { setupInspectMode } from './features/inspect-mode.js';
import { setupTheme } from './ui/theme.js';
import { setupSelection } from './ui/selection.js';
import { setupNotes } from './features/notes.js';
import { setupPins } from './features/pins.js';
import { setupSelectionActions } from './features/selection-actions.js';
import { setupAgentDispatch } from './bridge/dispatch.js';
import { setupOpenInEditor } from './features/open-in-editor.js';
import { setupScreenshots } from './features/screenshots.js';
import { setupMeasure } from './ui/measure.js';
import { setupTextEditor } from './features/text-editor.js';
import { setupInspector } from './features/inspector.js';
import { setupKeyboard } from './features/keyboard.js';
import { setupInspectorPanel } from './ui/inspector-panel.js';
import { setupContextFormat } from './features/context-format.js';
import { setupStateSync } from './bridge/sync.js';
import { setupStartup } from './bridge/startup.js';

export type { OverlayConfig };

/**
 * Mount the overlay. Modules are set up in their original source order so startup side effects
 * (listeners, initial fetches, initial renders) happen in the same sequence as before the split.
 */
export function bootstrapOverlay(config: OverlayConfig) {
  const app = createOverlayApp(config);
  setupBridgeConnection(app);
  setupDockLayout(app);
  setupSidebar(app);
  setupEditorPreference(app);
  setupMcpModal(app);
  setupToast(app);
  setupInspectMode(app);
  setupTheme(app);
  setupSelection(app);
  setupNotes(app);
  setupPins(app);
  setupSelectionActions(app);
  setupAgentDispatch(app);
  setupOpenInEditor(app);
  setupScreenshots(app);
  setupMeasure(app);
  setupTextEditor(app);
  setupInspector(app);
  setupKeyboard(app);
  setupInspectorPanel(app);
  setupContextFormat(app);
  setupStateSync(app);
  setupStartup(app);
}

if (typeof window !== 'undefined') {
  (window as any).__AGENT_HOVER_BOOTSTRAP__ = (port: number, editor?: string, token?: string) => {
    bootstrapOverlay({ port, editor, token });
  };
}
