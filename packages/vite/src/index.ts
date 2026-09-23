import type { Plugin } from 'vite';
import { BridgeServer } from './bridge-server.js';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

export interface ComponentPointerOptions {
  /** Port for the bridge server. Default: 9850 */
  port?: number;
  /** Whether to automatically open in editor on Alt+Shift+Click. Default: true */
  openInEditor?: boolean;
  /** Editor to open files in. Default: 'auto' */
  editor?: 'auto' | 'vscode' | 'cursor' | 'webstorm' | 'zed' | 'windsurf' | 'antigravity';
}

const UI_HTML = `
        <style>
          * { box-sizing: border-box; }
          :host {
            pointer-events: none;
          }
          #cp-dock-wrapper, #cp-flyout, #cp-text-editor {
            pointer-events: auto;
          }
          :host, #cp-dock-wrapper, #cp-dock, #cp-flyout, #cp-highlight {
            --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            --font-mono: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', Menlo, monospace;
            
            /* Dark mode (default) - Figma Design Studio Palette */
            --bg-dock: rgba(30, 30, 30, 0.92);
            --bg-dock-panel: rgba(30, 30, 30, 0.98);
            --bg-tile: rgba(44, 44, 44, 0.55);
            --bg-tile-hover: rgba(56, 56, 56, 0.65);
            --bg-tile-active: rgba(70, 70, 70, 0.70);
            --border-glass: rgba(56, 56, 56, 0.80);
            --border-highlight: rgba(58, 58, 58, 1);
            --border-accent: rgba(80, 80, 80, 0.60);
            --accent: #0d99ff;
            --accent-hover: #007be5;
            --accent-subtle: rgba(13, 153, 255, 0.10);
            --accent-solid: #2c2c2c;
            --accent-solid-text: #ffffff;
            --accent-solid-border: #444444;
            --accent-solid-hover: #383838;
            --accent-emerald: #14ae5c;
            --accent-rose: #f24822;
            --text-primary: #e0e0e0;
            --text-secondary: #999999;
            --text-muted: #777777;
            --blur: blur(20px) saturate(180%);
            --shadow-dock: 0 8px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(56, 56, 56, 0.50);
            --shadow-tile: 0 1px 3px rgba(0, 0, 0, 0.35);
            --frame-color: #0d99ff;
            --frame-raw: #5cb3ff;
            --measure-color: #5cb3ff;
            --bg-surface-raised: rgba(44, 44, 44, 0.60);
            --bg-surface-sunken: rgba(24, 24, 24, 0.70);
            --bg-surface-overlay: rgba(20, 20, 20, 0.75);
            --bg-surface-input: rgba(38, 38, 38, 0.70);
            --bg-surface-header: rgba(35, 35, 35, 0.50);
            --border-subtle: rgba(51, 51, 51, 0.60);
            --border-tile: rgba(56, 56, 56, 0.50);
            --border-tile-hover: rgba(58, 58, 58, 0.80);
            --scrollbar-thumb: rgba(100, 100, 100, 0.35);
            --handle-color: rgba(100, 100, 100, 0.50);
            --overlay-bg: rgba(20, 20, 20, 0.88);
          }
          
          /* Light mode - AAA Neutral Studio Palette */
          :host(.light-mode), :host(.light-mode) #cp-dock-wrapper, :host(.light-mode) #cp-dock, :host(.light-mode) #cp-flyout, :host(.light-mode) #cp-highlight {
            --bg-dock: rgba(252, 252, 253, 0.94);
            --bg-dock-panel: rgba(255, 255, 255, 0.98);
            --bg-tile: rgba(3, 0, 20, 0.04);
            --bg-tile-hover: rgba(3, 0, 20, 0.08);
            --bg-tile-active: rgba(3, 0, 20, 0.14);
            --border-glass: #d9d9dc;
            --border-highlight: #c0bfc4;
            --border-accent: #8e8c95;
            --accent: #171427;
            --accent-hover: #030014;
            --accent-subtle: rgba(23, 20, 39, 0.06);
            --accent-solid: #171427;
            --accent-solid-text: #ffffff;
            --accent-solid-border: #171427;
            --accent-solid-hover: #030014;
            --accent-emerald: #059669;
            --accent-rose: #e11d48;
            --text-primary: #030014;
            --text-secondary: #474553;
            --text-muted: #8e8c95;
            --blur: blur(20px) saturate(160%);
            --shadow-dock: 0 8px 32px rgba(3, 0, 20, 0.10), 0 0 0 1px rgba(3, 0, 20, 0.06);
            --shadow-tile: 0 1px 3px rgba(3, 0, 20, 0.08);
            --frame-color: #4f46e5;
            --frame-raw: #6366f1;
            --measure-color: #6366f1;
            --bg-surface-raised: #f5f5f6;
            --bg-surface-sunken: #f0f0f1;
            --bg-surface-overlay: rgba(3, 0, 20, 0.06);
            --bg-surface-input: #ffffff;
            --bg-surface-header: #fafafb;
            --border-subtle: #d9d9dc;
            --border-tile: rgba(3, 0, 20, 0.08);
            --border-tile-hover: rgba(3, 0, 20, 0.18);
            --scrollbar-thumb: rgba(142, 140, 149, 0.40);
            --handle-color: rgba(91, 89, 102, 0.40);
            --overlay-bg: rgba(255, 255, 255, 0.88);
          }

          /* --- Vertical Dock Container --- */
          #cp-dock-wrapper {
            position: fixed;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 999999;
            user-select: none;
            display: flex;
            align-items: center;
          }

          @keyframes cp-spin { to { transform: rotate(360deg); } }
          .cp-spin { animation: cp-spin 0.8s linear infinite; }

          #cp-dock {
            width: 54px;
            background: var(--bg-dock);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            border: 1px solid var(--border-glass);
            border-radius: 14px;
            padding: 7px 5px 6px 5px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            box-shadow: var(--shadow-dock);
            transition: border-color 0.25s ease, box-shadow 0.25s ease;
          }

          #cp-dock:hover {
            border-color: var(--border-highlight);
          }

          /* --- Dock Squircle Tiles --- */
          .cp-dock-tile {
            position: relative;
            width: 42px;
            border-radius: 8px;
            background: var(--bg-tile);
            border: 1px solid var(--border-tile);
            color: var(--text-secondary);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: var(--shadow-tile);
            transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
            overflow: visible;
            height: 42px;
          }

          .cp-dock-tile:hover {
            background: var(--bg-tile-hover);
            color: var(--text-primary);
            border-color: var(--border-tile-hover);
          }

          .cp-dock-tile:active {
            opacity: 0.85;
          }

          .cp-dock-tile.active {
            color: #ffffff;
            border-color: var(--accent);
            background: var(--accent);
            box-shadow: 0 1px 4px rgba(13, 153, 255, 0.4);
          }

          /* Bottom Drag & Snap Handle */
          .cp-dock-handle {
            width: 26px;
            height: 4px;
            background: var(--handle-color);
            border-radius: 999px;
            margin-top: 4px;
            cursor: grab;
            transition: all 0.2s ease;
          }

          .cp-dock-handle:hover {
            background: var(--accent);
            width: 32px;
          }

          .cp-badge-pill {
            position: absolute;
            top: -4px;
            right: -4px;
            background: var(--accent);
            color: #fff;
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
            min-width: 17px;
            height: 17px;
            padding: 0 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
            border: 1.5px solid var(--bg-dock);
            z-index: 10;
          }

          /* --- Reference Callout / Speech Bubble --- */
          #cp-dock-callout {
            position: absolute;
            left: 64px;
            top: 22px;
            opacity: 0;
            pointer-events: none;
            background: var(--bg-dock-panel);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            padding: 9px 16px;
            color: var(--text-primary);
            font-family: var(--font-sans);
            font-size: 13px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: var(--shadow-dock);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 999998;
            white-space: nowrap;
          }

          #cp-dock-callout.show {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(0);
          }

          /* Left Triangular Speech Bubble Tail */
          .cp-callout-tail {
            position: absolute;
            left: -7px;
            top: 50%;
            transform: translateY(-50%);
            width: 0;
            height: 0;
            border-top: 6px solid transparent;
            border-bottom: 6px solid transparent;
            border-right: 7px solid var(--bg-dock-panel);
          }

          .cp-callout-message {
            color: var(--text-primary);
            letter-spacing: -0.01em;
          }

          .cp-callout-time {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--accent);
            margin-left: 6px;
            background: var(--accent-subtle);
            padding: 2px 7px;
            border-radius: 6px;
            border: 1px solid var(--border-accent);
          }

          /* --- Full Context Lens Flyout --- */
          #cp-flyout {
            position: fixed;
            opacity: 0;
            pointer-events: none;
            width: 440px;
            max-width: calc(100vw - 32px);
            max-height: calc(100vh - 60px);
            background: var(--bg-dock-panel);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            color: var(--text-primary);
            font-family: var(--font-sans);
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45), 0 0 0 1px var(--border-glass);
            z-index: 999998;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }

          #cp-flyout.open {
            opacity: 1;
            pointer-events: auto;
          }

          /* Floating Detached Mode Styling */
          #cp-flyout:not(.is-sidebar) {
            top: 60px;
            right: 24px;
            height: min(760px, calc(100vh - 80px));
            border-radius: 16px;
          }

          #cp-flyout:not(.is-sidebar) #cp-flyout-header {
            cursor: grab;
            user-select: none;
          }

          #cp-flyout:not(.is-sidebar) #cp-flyout-header:active {
            cursor: grabbing;
          }

          /* Flyout Sidebar Mode (Right-Docked) */
          #cp-flyout.is-sidebar {
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            left: auto !important;
            width: 440px !important;
            height: 100vh !important;
            max-height: 100vh !important;
            border-radius: 16px 0 0 16px !important;
            border: none !important;
            border-left: 1px solid var(--border-glass) !important;
            box-shadow: -12px 0 36px rgba(0, 0, 0, 0.55) !important;
            transform: translateX(100%);
            transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease !important;
            z-index: 999998 !important;
          }

          #cp-flyout.is-sidebar.open {
            transform: translateX(0);
          }

          /* Shift dock slightly away from sidebar edge when open on right */
          #cp-dock-wrapper.sidebar-open.cp-dock-right {
            left: auto !important;
            right: 456px !important;
            transition: right 0.24s cubic-bezier(0.16, 1, 0.3, 1), left 0.24s cubic-bezier(0.16, 1, 0.3, 1);
          }

          /* Dynamic Dock Orientation: Flip to Left Side when on Right */
          #cp-dock-wrapper.cp-dock-right #cp-dock-callout {
            left: auto;
            right: 64px;
          }

          #cp-dock-wrapper.cp-dock-right .cp-callout-tail {
            left: auto;
            right: -7px;
            border-right: none;
            border-left: 7px solid var(--bg-dock-panel);
          }

          #cp-flyout-header {
            padding: 16px 20px;
            background: var(--bg-surface-header);
            border-bottom: 1px solid var(--border-glass);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          #cp-flyout-title-wrap {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          #cp-flyout-title {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: -0.01em;
            color: var(--text-primary);
          }

          #cp-flyout-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            font-size: 13px;
            line-height: 1.6;
          }

          #cp-flyout-content::-webkit-scrollbar { width: 5px; }
          #cp-flyout-content::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 999px; }

          .cp-flyout-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 14px 20px;
            background: var(--bg-surface-sunken);
            border-top: 1px solid var(--border-glass);
          }

          .cp-btn-bento {
            background: var(--bg-surface-raised);
            border: 1px solid var(--border-glass);
            color: var(--text-secondary);
            padding: 8px 13px;
            border-radius: 8px;
            font-family: var(--font-sans);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            transition: all 0.16s ease;
          }

          .cp-btn-bento:hover {
            background: #333333;
            border-color: #4a4a4a;
            color: #ffffff;
            transform: translateY(-1px);
          }

          .cp-btn-bento:active {
            opacity: 0.85;
            transform: translateY(0);
          }

          .cp-btn-bento.primary {
            background: #2c2c2c;
            border: 1px solid #4a4a4a;
            color: #ffffff;
            font-weight: 600;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.10);
          }

          .cp-btn-bento.primary:hover {
            background: #383838;
            border-color: #5c5c5c;
            color: #ffffff;
          }

          .cp-flyout-tool-btn {
            width: 30px;
            height: 30px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid transparent;
            color: #b3b3b3;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s ease;
            padding: 0;
          }
          .cp-flyout-tool-btn:hover {
            background: #2c2c2c;
            border-color: #383838;
            color: #ffffff;
          }

          :host(.light-mode) .cp-btn-bento {
            background: #f0f0f1;
            border: 1px solid #d9d9dc;
            color: #474553;
          }
          :host(.light-mode) .cp-btn-bento:hover {
            background: #e4e4e7;
            border-color: #c0bfc4;
            color: #030014;
          }
          :host(.light-mode) .cp-btn-bento.primary {
            background: #1e1e1e;
            border: 1px solid #1e1e1e;
            color: #ffffff;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
          }
          :host(.light-mode) .cp-btn-bento.primary:hover {
            background: #000000;
            border-color: #000000;
            color: #ffffff;
          }
          :host(.light-mode) .cp-flyout-tool-btn {
            color: #8e8c95;
          }
          :host(.light-mode) .cp-flyout-tool-btn:hover {
            background: #f0f0f1;
            border-color: #d9d9dc;
            color: #030014;
          }

          .cp-section { margin-bottom: 20px; }
          .cp-section-title {
            font-family: var(--font-mono);
            font-size: 11.5px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            margin-bottom: 10px;
            padding: 6px 0;
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            gap: 6px;
            border-bottom: 1px solid var(--border-subtle);
          }

          .cp-section-title:hover { color: var(--text-primary); }

          details.cp-section > summary { list-style: none; }
          details.cp-section > summary::-webkit-details-marker { display: none; }
          details.cp-section > summary::before {
            content: '';
            display: inline-block;
            width: 0;
            height: 0;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
            border-left: 5px solid var(--text-muted);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            margin-right: 3px;
            transform-origin: 2px 4px;
          }
          details.cp-section[open] > summary::before { transform: rotate(90deg); }

          .cp-code {
            background: var(--bg-surface-overlay);
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            padding: 14px 16px;
            font-family: var(--font-mono);
            font-size: 12px;
            overflow-x: auto;
            white-space: pre;
            max-height: 260px;
            overflow-y: auto;
            line-height: 1.6;
            margin-top: 8px;
            color: var(--text-primary);
          }

          #cp-source-code-editor {
            background: var(--bg-surface-overlay);
            border: 1px solid var(--border-accent);
            border-radius: 8px;
            color: var(--text-primary);
            font-family: var(--font-mono);
            font-size: 11.5px;
            line-height: 1.55;
            padding: 10px;
            box-sizing: border-box;
            width: 100%;
            min-height: 200px;
            max-height: 400px;
            resize: vertical;
            outline: none;
            tab-size: 2;
            transition: border-color 0.2s, box-shadow 0.2s;
          }
          #cp-source-code-editor:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-subtle);
          }

          .cp-props-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 8px;
          }
          .cp-props-table th {
            text-align: left; padding: 8px 10px; color: var(--text-muted);
            border-bottom: 1px solid var(--border-glass); font-weight: 600;
            font-family: var(--font-mono); font-size: 11px;
            background: var(--bg-surface-sunken);
          }
          .cp-props-table td {
            padding: 8px 10px; border-bottom: 1px solid var(--border-subtle);
            font-family: var(--font-mono); font-size: 11.5px;
            line-height: 1.4;
          }
          .cp-props-table tr:nth-child(even) td {
            background: var(--bg-surface-header);
          }
          .cp-props-table tr:hover td {
            background: var(--bg-surface-input);
          }

          .cp-badge {
            display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 999px;
            font-family: var(--font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.2px;
            min-height: 24px; line-height: 1;
          }
          .cp-badge-accent { background: #2c2c2c; color: #ffffff; border: 1px solid #444444; }
          :host(.light-mode) .cp-badge-accent { background: #f0f0f1; color: #030014; border: 1px solid #d9d9dc; }
          .cp-badge-emerald { background: rgba(20, 174, 92, 0.12); color: #14ae5c; border: 1px solid rgba(20, 174, 92, 0.3); }
          .cp-badge-muted { background: rgba(255, 255, 255, 0.05); color: #94a3b8; border: 1px solid var(--border-glass); }
          .cp-badge-rose { background: rgba(242, 72, 34, 0.12); color: #f24822; border: 1px solid rgba(242, 72, 34, 0.3); }

          .cp-box-model {
            background: var(--bg-surface-overlay);
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            padding: 12px;
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-secondary);
            text-align: center;
          }

          /* --- Highlight Box (Clean, Minimal, No Gradients) --- */
          #cp-highlight {
            position: fixed;
            pointer-events: none;
            z-index: 999991;
            border: 1.5px solid var(--frame-color);
            background: transparent;
            box-shadow: 0 0 0 1px rgba(13, 153, 255, 0.25), 0 0 12px rgba(13, 153, 255, 0.12);
            border-radius: 2px;
            display: none;
            transition: all 60ms ease-out;
            box-sizing: border-box;
          }
          #cp-highlight.selected {
            border-color: var(--frame-color);
            box-shadow: 0 0 0 1px rgba(13, 153, 255, 0.35), 0 0 16px rgba(13, 153, 255, 0.20);
          }
          #cp-highlight.is-raw {
            border-color: var(--frame-raw);
          }

          /* Box-model continuous frame bands (DevTools / Figma style) */
          #cp-margin-band {
            position: fixed;
            pointer-events: none;
            z-index: 999990;
            box-sizing: border-box;
            background: transparent;
            border-style: solid;
            border-color: rgba(244, 63, 94, 0.25);
            border-width: 0;
            display: none;
          }
          #cp-padding-band {
            position: fixed;
            pointer-events: none;
            z-index: 999990;
            box-sizing: border-box;
            background: transparent;
            border-style: solid;
            border-color: rgba(52, 211, 153, 0.28);
            border-width: 0;
            display: none;
          }
          #cp-axis-guides {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 999990;
          }
          .cp-axis-line {
            position: fixed;
            pointer-events: none;
          }
          .cp-axis-h {
            left: 0;
            width: 100vw;
            height: 0;
            border-top: 1px dashed var(--border-accent);
          }
          .cp-axis-v {
            top: 0;
            height: 100vh;
            width: 0;
            border-left: 1px dashed var(--border-accent);
          }
          .cp-layout-child-frame {
            position: fixed;
            pointer-events: none;
            box-sizing: border-box;
            border: 1px dashed var(--border-accent);
            background: var(--accent-subtle);
          }

          /* Clean, Single-Line Compact Pill (#cp-label) */
          #cp-label {
            position: absolute;
            top: -24px;
            left: -1px;
            background: var(--bg-dock-panel);
            border: 1px solid var(--frame-color);
            color: #ffffff;
            font-family: var(--font-mono);
            font-size: 10.5px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            white-space: nowrap;
            max-width: 360px;
            overflow: hidden;
            text-overflow: ellipsis;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
            display: inline-flex;
            align-items: center;
            gap: 6px;
            line-height: 1.4;
          }
          #cp-label.inside-top {
            top: 2px;
            left: 2px;
          }

          /* --- Persistent Selection Frame & Near-Component Action Pill --- */
          #cp-selection-frame {
            position: fixed;
            z-index: 999992;
            pointer-events: none;
            border: 2px solid var(--frame-color);
            box-shadow: 0 0 0 1px rgba(13, 153, 255, 0.30), 0 4px 20px rgba(0, 0, 0, 0.35), 0 0 16px rgba(13, 153, 255, 0.15);
            border-radius: 4px;
            box-sizing: border-box;
            display: none;
          }
          #cp-selection-chip {
            position: absolute;
            top: -32px;
            left: -2px;
            pointer-events: auto;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            background: var(--bg-dock-panel);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            border: 1px solid var(--border-glass);
            border-radius: 8px;
            box-shadow: var(--shadow-dock);
            color: var(--text-primary);
            font-family: var(--font-mono);
            font-size: 11px;
            white-space: nowrap;
            z-index: 10;
          }
          #cp-selection-chip.inside-top {
            top: calc(100% + 6px);
            left: 0;
          }
          #cp-sel-name {
            font-weight: 600;
            color: var(--text-primary);
          }
          #cp-sel-file {
            color: var(--text-muted);
            font-size: 10px;
            max-width: 140px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          #cp-sel-actions {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-left: 4px;
            padding-left: 6px;
            border-left: 1px solid var(--border-glass);
          }
          #cp-sel-actions button {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 7px;
            border-radius: 5px;
            border: 1px solid var(--border-glass);
            background: var(--bg-surface-input);
            color: var(--text-secondary);
            font-family: var(--font-mono);
            font-size: 10.5px;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          #cp-sel-actions button:hover {
            background: #383838;
            color: #ffffff;
            border-color: #555555;
          }
          :host(.light-mode) #cp-sel-actions button:hover {
            background: #e4e4e7;
            color: #030014;
            border-color: #c0bfc4;
          }
          #cp-sel-copy-btn {
            font-weight: 600;
            background: #2c2c2c !important;
            color: #ffffff !important;
            border: 1px solid #4a4a4a !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
          }
          #cp-sel-copy-btn:hover {
            background: #383838 !important;
            border-color: #5c5c5c !important;
            color: #ffffff !important;
            opacity: 1 !important;
          }
          :host(.light-mode) #cp-sel-copy-btn {
            background: #ffffff !important;
            color: #030014 !important;
            border: 1px solid #d9d9dc !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
          }
          :host(.light-mode) #cp-sel-copy-btn:hover {
            background: #f0f0f1 !important;
            border-color: #c0bfc4 !important;
            color: #030014 !important;
          }

          /* --- Inline Comment Pin Markers on Page --- */
          .cp-comment-marker {
            position: fixed;
            z-index: 999993;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 22px;
            height: 22px;
            padding: 0 7px;
            background: #1e1e1e;
            color: #ffffff;
            border: 1.5px solid #0d99ff;
            border-radius: 999px;
            font-family: var(--font-mono);
            font-size: 11px;
            font-weight: 600;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.6), 0 0 8px rgba(13, 153, 255, 0.35);
            cursor: pointer;
            pointer-events: auto;
            transform: translate(-50%, -50%);
            transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          }
          .cp-comment-marker:hover {
            transform: translate(-50%, -50%) scale(1.15);
            background: #2c2c2c;
            border-color: #ffffff;
            box-shadow: 0 5px 16px rgba(0, 0, 0, 0.8), 0 0 10px rgba(255, 255, 255, 0.4);
          }
          .cp-comment-marker.resolved {
            opacity: 0.5;
            background: #252525;
            border-color: #555555;
            color: #888888;
            box-shadow: none;
          }
          :host(.light-mode) .cp-comment-marker {
            background: #171427;
            color: #ffffff;
            border-color: #4f46e5;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2), 0 0 8px rgba(79, 70, 229, 0.3);
          }

          /* --- Pinned Stack Cards --- */
          .cp-pin-card {
            background: var(--bg-surface-raised);
            border: 1px solid var(--border-glass);
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 8px;
            transition: border-color 0.2s;
          }
          .cp-pin-card:hover {
            border-color: var(--border-highlight);
          }
          .cp-pin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
          }
          .cp-pin-title {
            font-weight: 600;
            font-size: 11.5px;
            color: var(--text-primary);
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .cp-pin-badge {
            background: #2c2c2c;
            color: #ffffff;
            border: 1px solid #444444;
            font-family: var(--font-mono);
            font-size: 9.5px;
            padding: 1px 5px;
            border-radius: 4px;
          }
          :host(.light-mode) .cp-pin-badge {
            background: #f0f0f1;
            color: #030014;
            border-color: #d9d9dc;
          }
          .cp-pin-file {
            font-family: var(--font-mono);
            font-size: 10px;
            color: var(--text-muted);
          }
          .cp-pin-textarea {
            width: 100%;
            box-sizing: border-box;
            background: var(--bg-surface-input);
            border: 1px solid var(--border-glass);
            border-radius: 6px;
            padding: 6px 8px;
            color: var(--text-primary);
            font-family: var(--font-sans);
            font-size: 11.5px;
            line-height: 1.4;
            resize: vertical;
            outline: none;
            margin-bottom: 6px;
          }
          .cp-pin-textarea:focus {
            border-color: var(--border-accent);
          }
          .cp-pin-actions {
            display: flex;
            justify-content: flex-end;
            gap: 6px;
          }

          /* --- Notes Items in Sidebar --- */
          .cp-note-item {
            background: var(--bg-surface-header);
            border: 1px solid var(--border-glass);
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 11px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            transition: border-color 0.2s;
          }
          .cp-note-item:hover {
            border-color: var(--border-highlight);
          }
          .cp-note-item.resolved {
            opacity: 0.55;
          }

          .cp-vibe-chip {
            padding: 4px 9px;
            background: #262626;
            border: 1px solid #383838;
            border-radius: 6px;
            color: #cccccc;
            font-family: var(--font-mono);
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 5px;
          }
          .cp-vibe-chip:hover {
            background: #383838;
            color: #ffffff;
            border-color: #555555;
          }
          :host(.light-mode) .cp-vibe-chip {
            background: #ffffff;
            border-color: #d9d9dc;
            color: #474553;
          }
          :host(.light-mode) .cp-vibe-chip:hover {
            background: #f5f5f6;
            color: #030014;
            border-color: #c0bfc4;
          }

          #cp-pin-bar {
            padding: 14px 20px;
            background: var(--bg-surface-sunken);
            border-top: 1px solid var(--border-glass);
            font-size: 12px;
          }
          .cp-pin-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 6px 10px; border-radius: 8px; color: var(--text-primary);
            font-family: var(--font-mono); font-size: 11px;
            background: var(--bg-surface-header);
            margin-bottom: 4px;
            border: 1px solid transparent;
          }
          .cp-pin-item:hover {
            background: var(--bg-surface-raised);
            border-color: var(--border-glass);
          }
          .cp-pin-remove {
            background: none; border: none; color: var(--accent-rose); cursor: pointer; padding: 3px; opacity: 0.7;
          }
          .cp-pin-remove:hover { opacity: 1; }

          /* --- Inline Text Editor Popover --- */
          #cp-text-editor {
            display: none;
            position: fixed;
            z-index: 999999;
            width: 340px;
            background: var(--bg-dock-panel);
            backdrop-filter: var(--blur);
            border: 1px solid var(--border-accent);
            border-radius: 14px;
            box-shadow: var(--shadow-dock);
            color: var(--text-primary);
            font-family: var(--font-sans);
            overflow: hidden;
            pointer-events: auto;
          }
          #cp-text-editor-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            border-bottom: 1px solid var(--border-glass);
            background: var(--bg-surface-sunken);
          }
          #cp-text-editor-header > span {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-primary);
            font-family: var(--font-mono);
          }
          #cp-text-editor-toolbar {
            display: flex;
            gap: 3px;
            align-items: center;
          }
          .cp-text-tb-btn {
            width: 26px; height: 26px;
            display: flex; align-items: center; justify-content: center;
            background: #262626;
            border: 1px solid #383838;
            border-radius: 5px;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
            font-family: var(--font-sans);
            transition: all 0.15s;
          }
          .cp-text-tb-btn:hover {
            background: #383838;
            color: #ffffff;
            border-color: #555555;
          }
          .cp-text-tb-btn.active {
            background: #ffffff;
            color: #1e1e1e;
            border-color: #ffffff;
          }
          #cp-text-editor-content {
            min-height: 60px;
            max-height: 180px;
            overflow-y: auto;
            padding: 12px 14px;
            font-size: 13px;
            font-family: var(--font-sans);
            line-height: 1.6;
            color: var(--text-primary);
            outline: none;
            word-break: break-word;
            border: none;
            background: transparent;
          }
          #cp-text-editor-content:focus {
            background: rgba(255, 255, 255, 0.03);
          }
          #cp-text-editor-footer {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border-top: 1px solid var(--border-glass);
            background: var(--bg-surface-sunken);
          }
          .cp-text-action-btn {
            padding: 5px 14px;
            border-radius: 7px;
            font-size: 11.5px;
            font-weight: 600;
            font-family: var(--font-mono);
            cursor: pointer;
            border: 1px solid var(--border-glass);
            transition: all 0.15s;
          }
          .cp-text-action-btn.apply {
            background: #ffffff;
            color: #1e1e1e;
            border-color: #ffffff;
          }
          .cp-text-action-btn.apply:hover {
            background: #f0f0f0;
          }
          .cp-text-action-btn.revert {
            background: #262626;
            border: 1px solid #383838;
            color: var(--text-secondary);
          }
          .cp-text-action-btn.revert:hover {
            background: #383838;
            color: #ffffff;
            border-color: #555555;
          }
          #cp-text-char-count {
            margin-left: auto;
            font-size: 10px;
            color: var(--text-muted);
            font-family: var(--font-mono);
          }
          #cp-text-editor-close {
            width: 24px; height: 24px;
            display: flex; align-items: center; justify-content: center;
            background: none; border: none;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 14px;
            border-radius: 4px;
            transition: all 0.15s;
          }
          #cp-text-editor-close:hover {
            color: #fb7185;
            background: rgba(244, 63, 94, 0.12);
          }

          /* --- Measurement Distance Guides --- */
          #cp-distance-layer {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 999991;
          }
          .cp-dist-line {
            position: absolute;
            background: var(--border-accent);
          }
          .cp-dist-line.horizontal {
            height: 1px;
            border-top: 1px dashed var(--border-accent);
            background: none;
          }
          .cp-dist-line.vertical {
            width: 1px;
            border-left: 1px dashed var(--border-accent);
            background: none;
          }
          .cp-dist-pill {
            position: absolute;
            background: var(--measure-color);
            color: #fff;
            font-size: 10px;
            font-family: var(--font-mono);
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 9999px;
            white-space: nowrap;
            transform: translate(-50%, -50%);
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
          }
          /* --- Settings View (Dedicated Page inside Sidebar) --- */
          #cp-view-settings {
            display: none;
            flex-direction: column;
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            gap: 16px;
          }
          .cp-settings-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .cp-settings-section-title {
            font-family: var(--font-mono);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
          }
          .cp-settings-card {
            background: var(--bg-surface-sunken);
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .cp-shortcut-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border-subtle);
          }
          .cp-shortcut-row:last-child {
            border-bottom: none;
          }

          #cp-dock-tiles {
            display: flex;
            flex-direction: column;
            gap: 6px;
            align-items: center;
          }

          /* --- Horizontal Dock Mode --- */
          #cp-dock-wrapper.cp-dock-horizontal #cp-dock {
            flex-direction: row;
            align-items: center;
            width: auto;
            height: 34px;
            padding: 3px 6px;
            gap: 4px;
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border-glass);
          }
          #cp-dock-wrapper.cp-dock-horizontal #cp-dock-tiles {
            flex-direction: row;
            gap: 4px;
            align-items: center;
          }
          #cp-dock-wrapper.cp-dock-horizontal .cp-dock-tile {
            width: 28px;
            height: 28px;
            border-radius: 6px;
          }
          #cp-dock-wrapper.cp-dock-horizontal .cp-dock-tile svg {
            width: 15px;
            height: 15px;
          }
          #cp-dock-wrapper.cp-dock-horizontal .cp-badge-pill {
            top: -3px;
            right: -3px;
            min-width: 14px;
            height: 14px;
            font-size: 9px;
            padding: 0 3px;
          }
          #cp-dock-wrapper.cp-dock-horizontal .cp-dock-handle {
            width: 4px;
            height: 16px;
            margin: 0 2px;
            border-radius: 999px;
            background: var(--handle-color);
            cursor: grab;
            transition: all 0.2s ease;
          }
          #cp-dock-wrapper.cp-dock-horizontal .cp-dock-handle:hover {
            background: var(--accent);
          }
          #cp-dock-wrapper.cp-dock-horizontal #cp-dock-callout {
            top: 40px;
            left: 50%;
            transform: translateX(-50%);
            right: auto;
          }
          #cp-dock-wrapper.cp-dock-horizontal .cp-callout-tail {
            left: 50%;
            top: -6px;
            bottom: auto;
            transform: translateX(-50%);
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 6px solid var(--bg-dock-panel);
            border-top: none;
          }
          #cp-dock-wrapper.cp-dock-horizontal.cp-dock-bottom #cp-dock-callout {
            top: -42px;
            bottom: auto;
          }
          #cp-dock-wrapper.cp-dock-horizontal.cp-dock-bottom .cp-callout-tail {
            top: auto;
            bottom: -6px;
            border-top: 6px solid var(--bg-dock-panel);
            border-bottom: none;
          }
        </style>

        <div id="cp-dock-wrapper">
          <div id="cp-dock">
            <div id="cp-dock-tiles">
              <div class="cp-dock-tile" id="cp-dock-toggle" title="Toggle Inspector Mode (Alt)">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>
              </div>

              <div class="cp-dock-tile" id="cp-dock-pins" title="Pinned Components Stack">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span class="cp-badge-pill" id="cp-dock-pin-badge" style="display:none;">0</span>
              </div>
            </div>

            <!-- Bottom Drag Handle -->
            <div class="cp-dock-handle" id="cp-dock-handle" title="Drag dock"></div>
          </div>

          <!-- Reference Callout / Speech Bubble -->
          <div id="cp-dock-callout">
            <div class="cp-callout-tail"></div>
            <span class="cp-callout-message" id="cp-callout-text">Ready to point</span>
            <span class="cp-callout-time" id="cp-callout-meta">Alt</span>
          </div>
        </div>

        <!-- Lens Flyout (Floating window / Attached sidebar) -->
        <div id="cp-flyout">
          <div id="cp-flyout-header">
            <div id="cp-flyout-title-wrap">
              <button class="cp-flyout-tool-btn" id="cp-settings-back" title="Back to Inspector" style="display:none;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <span class="cp-badge cp-badge-accent" id="cp-flyout-badge">LENS</span>
              <h3 id="cp-flyout-title">Component Inspector</h3>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <button class="cp-flyout-tool-btn" id="cp-flyout-theme" title="Toggle Light/Dark Mode">
                <svg id="cp-theme-icon-dark" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <svg id="cp-theme-icon-light" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              </button>
              <button class="cp-flyout-tool-btn" id="cp-flyout-settings" title="Settings">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="cp-flyout-tool-btn" id="cp-flyout-mode-toggle" title="Detach Sidebar (Float Window)">
                <svg id="cp-mode-sidebar-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><polyline points="10 9 7 12 10 15"/></svg>
                <svg id="cp-mode-float-icon" style="display:none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </button>
              <button class="cp-flyout-tool-btn" id="cp-flyout-snap-btn" title="Take Screenshot (Website UI)"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></button>
              <button class="cp-flyout-tool-btn" id="cp-flyout-close" title="Close (Esc)"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>

          <!-- Inspector View (Default) -->
          <div id="cp-view-inspector" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
            <div id="cp-flyout-breadcrumb" style="display:none; padding:10px 20px; background:var(--bg-surface-sunken); border-bottom:1px solid var(--border-glass); font-family:var(--font-mono); font-size:11.5px; overflow-x:auto; white-space:nowrap;">
            </div>

            <!-- Live Token Meter & Context Level Bar -->
            <div id="cp-token-meter" style="padding: 7px 18px; background: var(--bg-surface-sunken); border-bottom: 1px solid var(--border-glass); display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); font-size: 11px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--text-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> <span id="cp-token-count">0</span> tokens
                </span>
                <span id="cp-token-savings" class="cp-badge cp-badge-emerald" style="min-height: 18px; font-size: 10px; padding: 1px 6px;">
                  prompt-ready
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="color: var(--text-muted); font-size: 10px;">Context:</span>
                <select id="cp-context-level" style="background: var(--bg-surface-input); color: var(--text-primary); border: 1px solid var(--border-glass); border-radius: 4px; font-size: 10.5px; font-family: var(--font-mono); padding: 2px 6px; cursor: pointer;">
                  <option value="minimal">Compact (Prompt-Ready)</option>
                  <option value="standard" selected>Standard (+Source)</option>
                  <option value="full">Deep (+Styles)</option>
                </select>
              </div>
            </div>

            <div id="cp-flyout-content">
              <p style="color:var(--text-secondary); margin:0;">Point and click any element on the page, or press <kbd style="font-family:var(--font-mono); background:var(--bg-surface-raised); padding:2px 5px; border-radius:4px;">Alt</kbd> to inspect.</p>
            </div>

            <div class="cp-flyout-actions">
              <button class="cp-btn-bento primary" id="cp-copy-ai" style="grid-column: span 2; justify-content: center; font-weight: 600; font-size: 12px; padding: 9px 14px;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> Copy AI Context</button>
              <button class="cp-btn-bento" id="cp-editor-btn"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Open in IDE</button>
              <button class="cp-btn-bento" id="cp-pin-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg> Pin Component</button>
              <button class="cp-btn-bento" id="cp-toggle-spacing" style="grid-column: span 2;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Spacing Overlay</button>
            </div>

            <!-- Vibe Prompt Starters -->
            <div style="padding:10px 20px; border-top:1px solid var(--border-glass); background:var(--bg-surface-sunken);">
              <div style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <span style="display:inline-flex; align-items:center; gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Vibe Prompts</span>
                <span style="font-size:9.5px; color:var(--text-muted);">1-Click Copy</span>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:6px;" id="cp-vibe-prompts">
                <button class="cp-vibe-chip" data-vibe="redesign" title="Prompt AI to modernize and redesign this component"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Redesign</button>
                <button class="cp-vibe-chip" data-vibe="responsive" title="Prompt AI to make this responsive on mobile"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg> Mobile Polish</button>
                <button class="cp-vibe-chip" data-vibe="theme" title="Prompt AI to restyle colors, spacing, typography"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg> Style & Colors</button>
                <button class="cp-vibe-chip" data-vibe="refactor" title="Prompt AI to clean up code and add TypeScript safety"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Clean Code</button>
              </div>
            </div>

            <!-- Persistent Notes Section in Sidebar -->
            <div id="cp-notes-section" style="padding:10px 20px; border-top:1px solid var(--border-glass); background:var(--bg-surface-sunken);">
              <div style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <span style="display:inline-flex; align-items:center; gap:5px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Notes (<span id="cp-notes-count">0</span>)
                </span>
                <button id="cp-notes-copy-all" class="cp-vibe-chip" style="font-size:9.5px; padding:2px 6px;" title="Copy all notes as AI prompt">Copy All Notes</button>
              </div>
              <div id="cp-notes-list" style="display:flex; flex-direction:column; gap:6px; max-height:130px; overflow-y:auto;">
                <div style="font-size:11px; color:var(--text-muted); font-style:italic;">No notes yet. Click the note icon on any element to add persistent notes.</div>
              </div>
            </div>

            <div id="cp-pin-bar">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Pinned Stack (<span id="cp-pin-count">0</span>)</span>
              </div>
              <div id="cp-pin-list"></div>
              
              <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                <input type="text" id="cp-task-input" placeholder="Overall goal (optional, e.g. 'Align cards to dark theme')" style="width:100%; box-sizing:border-box; background:var(--bg-surface-input); border:1px solid var(--border-glass); border-radius:8px; padding:7px 10px; color:var(--text-primary); font-family:var(--font-sans); font-size:11.5px; outline:none; transition: border-color 0.2s;" />
                <button class="cp-btn-bento primary" id="cp-gen-task" style="width:100%; font-size:11.5px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> Copy All Tasks in Order</button>
              </div>
            </div>
            </div>

            <!-- Settings View (Dedicated Page inside Sidebar) -->
            <div id="cp-view-settings" style="display:none; flex-direction:column; flex:1; overflow-y:auto; padding:20px; gap:16px;">
              <div class="cp-settings-section">
                <div class="cp-settings-section-title">Theme</div>
                <div style="display:flex; gap:8px;">
                  <button class="cp-btn-bento" id="cp-theme-set-dark" style="flex:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark</button>
                  <button class="cp-btn-bento" id="cp-theme-set-light" style="flex:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light</button>
                </div>
              </div>

              <div class="cp-settings-section">
                <div class="cp-settings-section-title">Dock Layout</div>
                <div style="display:flex; gap:8px;">
                  <button class="cp-btn-bento primary" id="cp-dock-orient-vert" style="flex:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="18" x="8" y="3" rx="2"/></svg> Vertical</button>
                  <button class="cp-btn-bento" id="cp-dock-orient-horiz" style="flex:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="8" x="3" y="8" rx="2"/></svg> Horizontal</button>
                </div>
              </div>

              <div class="cp-settings-section">
                <div class="cp-settings-section-title">Preferred Editor</div>
                <div class="cp-settings-card">
                  <button class="cp-btn-bento" id="cp-pref-editor-cursor" style="justify-content:flex-start; width:100%;">Cursor (cursor://)</button>
                  <button class="cp-btn-bento" id="cp-pref-editor-vscode" style="justify-content:flex-start; width:100%;">VS Code (vscode://)</button>
                  <button class="cp-btn-bento" id="cp-pref-editor-windsurf" style="justify-content:flex-start; width:100%;">Windsurf (windsurf://)</button>
                </div>
              </div>

              <div class="cp-settings-section">
                <div class="cp-settings-section-title">Shortcuts</div>
                <div class="cp-settings-card">
                  <div class="cp-shortcut-row">
                    <span>Toggle Inspector</span>
                    <kbd style="background:var(--bg-surface-raised); padding:2px 6px; border-radius:4px; color:var(--text-primary); font-size:10px;">Alt</kbd>
                  </div>
                  <div class="cp-shortcut-row">
                    <span>Close Sidebar</span>
                    <kbd style="background:var(--bg-surface-raised); padding:2px 6px; border-radius:4px; color:var(--text-primary); font-size:10px;">Esc</kbd>
                  </div>
                  <div class="cp-shortcut-row">
                    <span>Text Edit (Bold / Italic)</span>
                    <kbd style="background:var(--bg-surface-raised); padding:2px 6px; border-radius:4px; color:var(--text-primary); font-size:10px;">Cmd+B / Cmd+I</kbd>
                  </div>
                </div>
              </div>

              <div class="cp-settings-section" style="margin-top:auto; padding-top:12px; border-top:1px solid var(--border-subtle); font-family:var(--font-mono); font-size:10.5px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                <span>Agent Hover v0.1.0</span>
                <span class="cp-badge cp-badge-emerald" style="min-height:18px; font-size:9.5px; padding:1px 6px;">Bridge Active</span>
              </div>
            </div>
          </div>

        <div id="cp-highlight">
          <div id="cp-label"></div>
        </div>

        <!-- Persistent Selection Frame (Locks on clicked component) -->
        <div id="cp-selection-frame" style="display:none;">
          <div id="cp-selection-chip">
            <span id="cp-sel-name">&lt;Component /&gt;</span>
            <span id="cp-sel-file"></span>
            <div id="cp-sel-actions">
              <button id="cp-sel-copy-btn" title="Copy AI Prompt (Click to copy)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
                <span id="cp-sel-copy-label">Copy Prompt</span>
              </button>
              <button id="cp-sel-note-btn" title="Add Note / Comment">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button id="cp-sel-pin-btn" title="Pin Component Task">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
              </button>
              <button id="cp-sel-snap-btn" title="Capture Clean Screenshot (Web UI only)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              </button>
              <button id="cp-sel-ide-btn" title="Open in IDE">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              </button>
              <button id="cp-sel-close-btn" title="Deselect">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div id="cp-margin-band"></div>
        <div id="cp-padding-band"></div>
        <div id="cp-axis-guides"></div>
        <div id="cp-distance-layer"></div>
        <div id="cp-comments-layer" style="position:fixed; inset:0; pointer-events:none; z-index:999996;"></div>

        <!-- Inline Note Popover -->
        <div id="cp-note-popover" style="display:none; position:fixed; z-index:999999; width:320px; background:var(--bg-dock-panel); backdrop-filter:var(--blur); border:1px solid var(--border-glass); border-radius:12px; box-shadow:var(--shadow-dock); color:var(--text-primary); padding:12px; pointer-events:auto;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <span style="font-weight:600; font-size:11.5px; display:inline-flex; align-items:center; gap:6px; color:var(--text-primary);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Element Note
            </span>
            <button id="cp-note-popover-close" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:2px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted); margin-bottom:6px;" id="cp-note-popover-target"></div>
          <textarea id="cp-note-input" placeholder="Add an inline note or task for this element... (persists across restarts)" style="width:100%; box-sizing:border-box; min-height:70px; background:var(--bg-surface-input); border:1px solid var(--border-glass); border-radius:6px; padding:8px; color:var(--text-primary); font-family:var(--font-sans); font-size:12px; resize:vertical; outline:none; margin-bottom:8px;"></textarea>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <button class="cp-btn-bento" id="cp-note-delete" style="display:none; padding:4px 8px; font-size:11px; color:var(--accent-rose); border-color:rgba(244,63,94,0.3);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete</button>
            <div style="display:flex; gap:6px; margin-left:auto;">
              <button class="cp-btn-bento" id="cp-note-cancel" style="padding:4px 10px; font-size:11px;">Cancel</button>
              <button class="cp-btn-bento primary" id="cp-note-save" style="padding:4px 12px; font-size:11px;">Save Note</button>
            </div>
          </div>
        </div>

        <!-- Pinned Task Dialog (Two-choice flow: Copy Now vs Add More) -->
        <div id="cp-pin-dialog" style="display:none; position:fixed; z-index:999999; width:340px; background:var(--bg-dock-panel); backdrop-filter:var(--blur); border:1px solid var(--border-glass); border-radius:14px; box-shadow:var(--shadow-dock); color:var(--text-primary); padding:14px; pointer-events:auto;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="cp-pin-badge" id="cp-pin-dialog-badge">Pin #1</span>
              <span style="font-weight:600; font-size:12px; color:var(--text-primary);" id="cp-pin-dialog-name">&lt;Component /&gt;</span>
            </div>
            <button id="cp-pin-dialog-close" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted); margin-bottom:8px;" id="cp-pin-dialog-file"></div>
          <textarea id="cp-pin-dialog-task" placeholder="Describe the change or task for this component..." style="width:100%; box-sizing:border-box; min-height:65px; background:var(--bg-surface-input); border:1px solid var(--border-glass); border-radius:6px; padding:8px; color:var(--text-primary); font-family:var(--font-sans); font-size:12px; resize:vertical; outline:none; margin-bottom:10px;"></textarea>
          <div style="display:flex; gap:8px;">
            <button class="cp-btn-bento" id="cp-pin-dialog-add-more" style="flex:1; justify-content:center; font-size:11px;" title="Save task and inspect another component">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add More Pins
            </button>
            <button class="cp-btn-bento primary" id="cp-pin-dialog-copy-now" style="flex:1; justify-content:center; font-size:11px;" title="Copy task prompt for AI immediately">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> Copy Task Prompt
            </button>
          </div>
        </div>

        <div id="cp-text-editor">
          <div id="cp-text-editor-header">
            <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; font-size:12px; color:var(--text-primary);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Edit Text
            </span>
            <span id="cp-text-target-badge" style="font-size:10px; font-family:var(--font-mono); color:var(--text-primary); background:#2c2c2c; padding:2px 6px; border-radius:4px; margin-left:6px; border:1px solid #444444; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>
            <div id="cp-text-editor-toolbar">
              <button class="cp-text-tb-btn" data-cmd="bold" title="Bold (Cmd+B)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H6v-8Zm0 0V4h8a4 4 0 0 1 0 8H6Z"/></svg></button>
              <button class="cp-text-tb-btn" data-cmd="italic" title="Italic (Cmd+I)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg></button>
              <button class="cp-text-tb-btn" data-cmd="underline" title="Underline (Cmd+U)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg></button>
            </div>
            <button id="cp-text-editor-close" title="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div id="cp-text-editor-content" contenteditable="true" spellcheck="false"></div>
          <div id="cp-text-editor-footer">
            <button class="cp-text-action-btn apply" id="cp-text-apply" style="display:inline-flex; align-items:center; gap:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save to Code</button>
            <button class="cp-text-action-btn revert" id="cp-text-revert" style="display:inline-flex; align-items:center; gap:6px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Revert</button>
            <span id="cp-text-char-count"></span>
          </div>
        </div>
`;

const ICONS = {
  clipboard: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
  crosshair: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  pin: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
  camera: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  lock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  comment: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
};

function generateOverlayBootstrap(port: number, editor: string): string {
  return `
    (() => {
      const BRIDGE = 'http://localhost:${port}';
      let ws;
      try {
        ws = new WebSocket('ws://localhost:${port}');
        ws.onopen = () => console.log('[agent-hover] Connected to bridge');
        ws.onerror = () => console.warn('[agent-hover] WebSocket connection failed');
      } catch(e) {
        console.warn('[agent-hover] Could not connect WebSocket');
      }

      let isPointerMode = false;
      let currentElement = null;
      let currentComponentInfo = null;
      let frozenEntries = [];

      const ICONS = ${JSON.stringify(ICONS)};

      // --- Shadow DOM UI Container ---
      const container = document.createElement('div');
      container.id = 'agent-hover-root';
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '999990';
      const shadow = container.attachShadow({ mode: 'open' });
      shadow.innerHTML = ${JSON.stringify(UI_HTML)};
      if (document.body) {
        document.body.appendChild(container);
      } else {
        window.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
      }

      // Elements
      const dockWrapper = shadow.getElementById('cp-dock-wrapper');
      const dockToggle = shadow.getElementById('cp-dock-toggle');
      const dockPins = shadow.getElementById('cp-dock-pins');
      const dockHandle = shadow.getElementById('cp-dock-handle');
      const dockPinBadge = shadow.getElementById('cp-dock-pin-badge');
      const callout = shadow.getElementById('cp-dock-callout');
      const calloutText = shadow.getElementById('cp-callout-text');
      const calloutMeta = shadow.getElementById('cp-callout-meta');

      const highlight = shadow.getElementById('cp-highlight');
      const label = shadow.getElementById('cp-label');
      const marginBand = shadow.getElementById('cp-margin-band');
      const paddingBand = shadow.getElementById('cp-padding-band');
      const axisGuides = shadow.getElementById('cp-axis-guides');
      const flyout = shadow.getElementById('cp-flyout');
      const flyoutTitle = shadow.getElementById('cp-flyout-title');
      const flyoutContent = shadow.getElementById('cp-flyout-content');
      const distanceLayer = shadow.getElementById('cp-distance-layer');
      const textEditor = shadow.getElementById('cp-text-editor');
      const textEditorContent = shadow.getElementById('cp-text-editor-content');
      const textCharCount = shadow.getElementById('cp-text-char-count');
      const textTargetBadge = shadow.getElementById('cp-text-target-badge');
      const flyoutThemeBtn = shadow.getElementById('cp-flyout-theme');
      const flyoutSettingsBtn = shadow.getElementById('cp-flyout-settings');
      const settingsBackBtn = shadow.getElementById('cp-settings-back');
      const viewInspector = shadow.getElementById('cp-view-inspector');
      const viewSettings = shadow.getElementById('cp-view-settings');
      const flyoutBadge = shadow.getElementById('cp-flyout-badge');
      const themeSetDark = shadow.getElementById('cp-theme-set-dark');
      const themeSetLight = shadow.getElementById('cp-theme-set-light');
      const prefEditorCursor = shadow.getElementById('cp-pref-editor-cursor');
      const prefEditorVscode = shadow.getElementById('cp-pref-editor-vscode');
      const prefEditorWindsurf = shadow.getElementById('cp-pref-editor-windsurf');
      const dockOrientVert = shadow.getElementById('cp-dock-orient-vert');
      const dockOrientHoriz = shadow.getElementById('cp-dock-orient-horiz');

      function updateDockOrientation() {
        const rect = dockWrapper.getBoundingClientRect();
        const isRight = (rect.left + rect.width / 2) > (window.innerWidth / 2);
        if (isRight) {
          dockWrapper.classList.add('cp-dock-right');
        } else {
          dockWrapper.classList.remove('cp-dock-right');
        }

        const isBottom = (rect.top + rect.height / 2) > (window.innerHeight / 2);
        if (isBottom) {
          dockWrapper.classList.add('cp-dock-bottom');
        } else {
          dockWrapper.classList.remove('cp-dock-bottom');
        }
      }

      // Settings View Switcher (Dedicated page inside sidebar)
      let inSettingsView = false;
      function toggleSettingsView(force) {
        inSettingsView = (typeof force === 'boolean') ? force : !inSettingsView;
        if (inSettingsView) {
          viewInspector.style.display = 'none';
          viewSettings.style.display = 'flex';
          flyoutBadge.style.display = 'none';
          if (settingsBackBtn) settingsBackBtn.style.display = 'inline-flex';
          flyoutTitle.textContent = 'Settings';
          flyoutSettingsBtn.classList.add('active');
          if (!flyout.classList.contains('open')) {
            flyout.classList.add('open');
            dockWrapper.classList.add('sidebar-open');
          }
        } else {
          viewInspector.style.display = 'flex';
          viewSettings.style.display = 'none';
          flyoutBadge.style.display = 'inline-flex';
          if (settingsBackBtn) settingsBackBtn.style.display = 'none';
          flyoutTitle.textContent = lastInfoName || 'Component Inspector';
          flyoutSettingsBtn.classList.remove('active');
        }
      }

      if (flyoutSettingsBtn) {
        flyoutSettingsBtn.onclick = () => toggleSettingsView();
      }
      if (settingsBackBtn) {
        settingsBackBtn.onclick = () => toggleSettingsView(false);
      }

      // Editor preference
      let currentEditorPref = 'cursor';
      try {
        currentEditorPref = localStorage.getItem('agent-hover-pref-editor') || '${editor}' || 'cursor';
      } catch(e) {}

      function updateEditorPrefUI() {
        [prefEditorCursor, prefEditorVscode, prefEditorWindsurf].forEach((b) => {
          if (b) b.classList.remove('primary');
        });
        if (currentEditorPref === 'cursor' && prefEditorCursor) prefEditorCursor.classList.add('primary');
        if (currentEditorPref === 'vscode' && prefEditorVscode) prefEditorVscode.classList.add('primary');
        if (currentEditorPref === 'windsurf' && prefEditorWindsurf) prefEditorWindsurf.classList.add('primary');
      }
      updateEditorPrefUI();

      if (prefEditorCursor) {
        prefEditorCursor.onclick = () => {
          currentEditorPref = 'cursor';
          try { localStorage.setItem('agent-hover-pref-editor', 'cursor'); } catch(e) {}
          updateEditorPrefUI();
          showCallout('Editor: Cursor', 'SET');
        };
      }
      if (prefEditorVscode) {
        prefEditorVscode.onclick = () => {
          currentEditorPref = 'vscode';
          try { localStorage.setItem('agent-hover-pref-editor', 'vscode'); } catch(e) {}
          updateEditorPrefUI();
          showCallout('Editor: VS Code', 'SET');
        };
      }
      if (prefEditorWindsurf) {
        prefEditorWindsurf.onclick = () => {
          currentEditorPref = 'windsurf';
          try { localStorage.setItem('agent-hover-pref-editor', 'windsurf'); } catch(e) {}
          updateEditorPrefUI();
          showCallout('Editor: Windsurf', 'SET');
        };
      }

      // Dock Orientation Controller
      let currentDockOrient = 'vertical';
      try {
        currentDockOrient = localStorage.getItem('agent-hover-dock-orient') || 'vertical';
      } catch(e) {}

      function applyDockOrientation(orient) {
        currentDockOrient = orient;
        try { localStorage.setItem('agent-hover-dock-orient', orient); } catch(e) {}
        if (orient === 'horizontal') {
          dockWrapper.classList.add('cp-dock-horizontal');
          if (dockOrientHoriz) dockOrientHoriz.classList.add('primary');
          if (dockOrientVert) dockOrientVert.classList.remove('primary');
        } else {
          dockWrapper.classList.remove('cp-dock-horizontal');
          if (dockOrientVert) dockOrientVert.classList.add('primary');
          if (dockOrientHoriz) dockOrientHoriz.classList.remove('primary');
        }
      }
      applyDockOrientation(currentDockOrient);

      if (dockOrientVert) {
        dockOrientVert.onclick = () => {
          applyDockOrientation('vertical');
          showCallout('Dock: Vertical', 'DOCK');
        };
      }
      if (dockOrientHoriz) {
        dockOrientHoriz.onclick = () => {
          applyDockOrientation('horizontal');
          showCallout('Dock: Horizontal', 'DOCK');
        };
      }

      // Persist & Drag Dock
      try {
        const savedPos = localStorage.getItem('agent_hover_dock_pos');
        if (savedPos) {
          const parsed = JSON.parse(savedPos);
          if (parsed.top && parsed.left) {
            dockWrapper.style.top = parsed.top;
            dockWrapper.style.left = parsed.left;
            dockWrapper.style.transform = 'none';
          }
        }
      } catch(e) {}
      updateDockOrientation();
      window.addEventListener('resize', updateDockOrientation);

      let isDragging = false;
      let dragStartY = 0;
      let dragStartX = 0;
      let initialTop = 0;
      let initialLeft = 0;

      dockHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = dockWrapper.getBoundingClientRect();
        initialTop = rect.top;
        initialLeft = rect.left;
        dockWrapper.style.transform = 'none';
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dockH = dockWrapper.offsetHeight || 90;
        const dockW = dockWrapper.offsetWidth || 50;
        const newTop = Math.max(10, Math.min(window.innerHeight - dockH - 10, initialTop + (e.clientY - dragStartY)));
        const newLeft = Math.max(10, Math.min(window.innerWidth - dockW - 10, initialLeft + (e.clientX - dragStartX)));
        dockWrapper.style.top = newTop + 'px';
        dockWrapper.style.left = newLeft + 'px';
        updateDockOrientation();
      });

      window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        updateDockOrientation();
        try {
          localStorage.setItem('agent_hover_dock_pos', JSON.stringify({
            top: dockWrapper.style.top,
            left: dockWrapper.style.left
          }));
        } catch(e) {}
      });

      let calloutTimer = null;
      function showCallout(text, meta, duration = 2000) {
        calloutText.textContent = text;
        calloutMeta.textContent = meta || '';
        callout.classList.add('show');
        if (calloutTimer) clearTimeout(calloutTimer);
        calloutTimer = setTimeout(() => {
          callout.classList.remove('show');
          calloutTimer = null;
        }, duration);
      }

      function updateInspectorCursor(active) {
        let cursorStyle = document.getElementById('cp-inspector-cursor');
        if (!cursorStyle) {
          cursorStyle = document.createElement('style');
          cursorStyle.id = 'cp-inspector-cursor';
          cursorStyle.textContent = 'html.cp-inspector-active, html.cp-inspector-active * { cursor: url("data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'24\\' height=\\'24\\' viewBox=\\'0 0 24 24\\' fill=\\'%231e1e1e\\' stroke=\\'%23ffffff\\' stroke-width=\\'1.5\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'%3E%3Cpath d=\\'M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z\\'/%3E%3C/svg%3E") 4 5, crosshair !important; } #agent-hover-root, #agent-hover-root * { cursor: auto; }';
          document.head.appendChild(cursorStyle);
        }
        if (active) {
          document.documentElement.classList.add('cp-inspector-active');
        } else {
          document.documentElement.classList.remove('cp-inspector-active');
        }
      }

      function togglePointerMode() {
        isPointerMode = !isPointerMode;
        if (isPointerMode) {
          dockToggle.classList.add('active');
          showCallout('Inspector Active', 'Alt', 2200);
          updateInspectorCursor(true);
          console.log('[agent-hover] Pointer mode ON');
        } else {
          dockToggle.classList.remove('active');
          showCallout('Inspector Paused', 'OFF', 1500);
          updateInspectorCursor(false);
          highlight.style.display = 'none';
          if (typeof clearSelection === 'function') clearSelection();
          hideBands();
          clearDistanceGuides();
          closeTextEditor();
          selectedRect = null;
          currentComponentInfo = null;
          currentElement = null;
          currentStack = [];
          currentStackIndex = -1;
          console.log('[agent-hover] Pointer mode OFF');
        }
      }

      dockToggle.onclick = togglePointerMode;

      // Hover labels for dock buttons
      dockToggle.addEventListener('mouseenter', () => {
        if (!calloutTimer) {
          calloutText.textContent = isPointerMode ? 'Inspector Mode' : 'Inspect Element';
          calloutMeta.textContent = 'Alt';
          callout.classList.add('show');
        }
      });
      dockToggle.addEventListener('mouseleave', () => {
        if (!calloutTimer) callout.classList.remove('show');
      });

      dockPins.addEventListener('mouseenter', () => {
        if (!calloutTimer) {
          const pinCount = shadow.getElementById('cp-pin-count')?.textContent || '0';
          calloutText.textContent = 'Pinned Stack';
          calloutMeta.textContent = pinCount + ' pinned';
          callout.classList.add('show');
        }
      });
      dockPins.addEventListener('mouseleave', () => {
        if (!calloutTimer) callout.classList.remove('show');
      });

      dockHandle.addEventListener('mouseenter', () => {
        if (!calloutTimer) {
          calloutText.textContent = 'Drag Dock';
          calloutMeta.textContent = 'Move';
          callout.classList.add('show');
        }
      });
      dockHandle.addEventListener('mouseleave', () => {
        if (!calloutTimer) callout.classList.remove('show');
      });

      dockPins.onclick = () => {
        flyout.classList.toggle('open');
        if (flyout.classList.contains('open') && flyout.classList.contains('is-sidebar')) {
          dockWrapper.classList.add('sidebar-open');
        } else {
          dockWrapper.classList.remove('sidebar-open');
        }
        const pinBar = shadow.getElementById('cp-pin-bar');
        pinBar.scrollIntoView({ behavior: 'smooth' });
      };


      // Theme toggle (dark/light mode)
      const themeToggle = shadow.getElementById('cp-flyout-theme');
      const themeIconDark = shadow.getElementById('cp-theme-icon-dark');
      const themeIconLight = shadow.getElementById('cp-theme-icon-light');
      let isLightMode = false;
      try { isLightMode = localStorage.getItem('agent-hover-theme') === 'light'; } catch(e) {}
      
      function applyTheme() {
        if (isLightMode) {
          shadow.host.classList.add('light-mode');
          if (themeIconDark) themeIconDark.style.display = 'none';
          if (themeIconLight) themeIconLight.style.display = 'block';
          if (themeSetDark) themeSetDark.classList.remove('primary');
          if (themeSetLight) themeSetLight.classList.add('primary');
        } else {
          shadow.host.classList.remove('light-mode');
          if (themeIconDark) themeIconDark.style.display = 'block';
          if (themeIconLight) themeIconLight.style.display = 'none';
          if (themeSetDark) themeSetDark.classList.add('primary');
          if (themeSetLight) themeSetLight.classList.remove('primary');
        }
      }
      applyTheme();

      if (themeToggle) {
        themeToggle.onclick = () => {
          isLightMode = !isLightMode;
          applyTheme();
          try { localStorage.setItem('agent-hover-theme', isLightMode ? 'light' : 'dark'); } catch(e) {}
          showCallout(isLightMode ? 'Light mode' : 'Dark mode', 'THEME');
        };
      }
      if (themeSetDark) {
        themeSetDark.onclick = () => {
          isLightMode = false;
          applyTheme();
          try { localStorage.setItem('agent-hover-theme', 'dark'); } catch(e) {}
          showCallout('Dark mode', 'THEME');
        };
      }
      if (themeSetLight) {
        themeSetLight.onclick = () => {
          isLightMode = true;
          applyTheme();
          try { localStorage.setItem('agent-hover-theme', 'light'); } catch(e) {}
          showCallout('Light mode', 'THEME');
        };
      }

      shadow.getElementById('cp-flyout-close').onclick = () => {
        flyout.classList.remove('open');
        dockWrapper.classList.remove('sidebar-open');
      };

      // Flyout Sidebar Mode Switcher & Draggable Floating Panel
      const flyoutModeToggle = shadow.getElementById('cp-flyout-mode-toggle');
      const modeSidebarIcon = shadow.getElementById('cp-mode-sidebar-icon');
      const modeFloatIcon = shadow.getElementById('cp-mode-float-icon');
      const flyoutHeader = shadow.getElementById('cp-flyout-header');

      // Requirement 4: The sidebar by default should be attached for now.
      let flyoutMode = 'sidebar';
      try {
        flyoutMode = localStorage.getItem('agent-hover-flyout-mode-v2') || 'sidebar';
      } catch(e) {}

      function applyFlyoutMode(mode) {
        flyoutMode = mode;
        try {
          localStorage.setItem('agent-hover-flyout-mode-v2', mode);
        } catch(e) {}

        if (mode === 'sidebar') {
          flyout.classList.add('is-sidebar');
          flyout.style.left = '';
          flyout.style.top = '';
          flyout.style.right = '';
          flyout.style.bottom = '';
          if (flyoutHeader) flyoutHeader.style.cursor = 'default';
          if (modeSidebarIcon) modeSidebarIcon.style.display = 'none';
          if (modeFloatIcon) modeFloatIcon.style.display = 'block';
          if (flyoutModeToggle) flyoutModeToggle.setAttribute('title', 'Detach Sidebar (Float Window)');
          if (flyout.classList.contains('open')) {
            dockWrapper.classList.add('sidebar-open');
          }
        } else {
          flyout.classList.remove('is-sidebar');
          if (flyoutHeader) flyoutHeader.style.cursor = 'grab';
          if (modeSidebarIcon) modeSidebarIcon.style.display = 'block';
          if (modeFloatIcon) modeFloatIcon.style.display = 'none';
          if (flyoutModeToggle) flyoutModeToggle.setAttribute('title', 'Attach Sidebar (Dock to Edge)');
          dockWrapper.classList.remove('sidebar-open');

          // Position screen-friendly within viewport
          try {
            const savedFlyoutPos = localStorage.getItem('agent_hover_flyout_pos');
            if (savedFlyoutPos) {
              const parsed = JSON.parse(savedFlyoutPos);
              const fW = 440;
              const fH = 600;
              const maxLeft = Math.max(12, window.innerWidth - fW - 12);
              const maxTop = Math.max(12, window.innerHeight - fH - 12);
              const clampedLeft = Math.max(12, Math.min(maxLeft, parseInt(parsed.left, 10) || maxLeft));
              const clampedTop = Math.max(12, Math.min(maxTop, parseInt(parsed.top, 10) || 60));
              flyout.style.left = clampedLeft + 'px';
              flyout.style.top = clampedTop + 'px';
              flyout.style.right = 'auto';
            } else {
              const defaultLeft = Math.max(12, window.innerWidth - 440 - 24);
              flyout.style.left = defaultLeft + 'px';
              flyout.style.top = '60px';
              flyout.style.right = 'auto';
            }
          } catch(e) {
            flyout.style.left = Math.max(12, window.innerWidth - 440 - 24) + 'px';
            flyout.style.top = '60px';
            flyout.style.right = 'auto';
          }
        }
      }

      applyFlyoutMode(flyoutMode);

      if (flyoutModeToggle) {
        flyoutModeToggle.onclick = () => {
          applyFlyoutMode(flyoutMode === 'sidebar' ? 'float' : 'sidebar');
          showCallout(flyoutMode === 'sidebar' ? 'Sidebar: Attached' : 'Sidebar: Detached & Draggable', 'MODE');
        };
      }

      // Detached Draggable Flyout Mechanics (Requirements 2 & 5)
      let isFlyoutDragging = false;
      let flyoutDragStartX = 0;
      let flyoutDragStartY = 0;
      let flyoutInitialTop = 0;
      let flyoutInitialLeft = 0;

      if (flyoutHeader) {
        flyoutHeader.addEventListener('mousedown', (e) => {
          if (flyout.classList.contains('is-sidebar')) return;
          if (e.target.closest('button') || e.target.closest('.cp-dock-tile') || e.target.closest('select') || e.target.closest('input')) return;

          isFlyoutDragging = true;
          flyoutDragStartX = e.clientX;
          flyoutDragStartY = e.clientY;
          const rect = flyout.getBoundingClientRect();
          flyoutInitialTop = rect.top;
          flyoutInitialLeft = rect.left;
          flyoutHeader.style.cursor = 'grabbing';
          e.preventDefault();
        });
      }

      window.addEventListener('mousemove', (e) => {
        if (!isFlyoutDragging || flyout.classList.contains('is-sidebar')) return;
        const fW = flyout.offsetWidth || 440;
        const fH = flyout.offsetHeight || 600;
        const newLeft = flyoutInitialLeft + (e.clientX - flyoutDragStartX);
        const newTop = flyoutInitialTop + (e.clientY - flyoutDragStartY);
        const maxLeft = Math.max(12, window.innerWidth - fW - 12);
        const maxTop = Math.max(12, window.innerHeight - fH - 12);
        const clampedLeft = Math.max(12, Math.min(maxLeft, newLeft));
        const clampedTop = Math.max(12, Math.min(maxTop, newTop));
        flyout.style.left = clampedLeft + 'px';
        flyout.style.top = clampedTop + 'px';
        flyout.style.right = 'auto';
        flyout.style.bottom = 'auto';
      });

      window.addEventListener('mouseup', () => {
        if (!isFlyoutDragging) return;
        isFlyoutDragging = false;
        if (flyoutHeader && !flyout.classList.contains('is-sidebar')) {
          flyoutHeader.style.cursor = 'grab';
        }
        try {
          localStorage.setItem('agent_hover_flyout_pos', JSON.stringify({
            left: flyout.style.left,
            top: flyout.style.top
          }));
        } catch(e) {}
      });

      // Window resize bounds keeper
      window.addEventListener('resize', () => {
        if (flyout.classList.contains('is-sidebar')) return;
        const rect = flyout.getBoundingClientRect();
        const fW = rect.width || 440;
        const fH = rect.height || 600;
        const maxLeft = Math.max(12, window.innerWidth - fW - 12);
        const maxTop = Math.max(12, window.innerHeight - fH - 12);
        if (rect.left > maxLeft || rect.top > maxTop) {
          flyout.style.left = Math.max(12, Math.min(maxLeft, rect.left)) + 'px';
          flyout.style.top = Math.max(12, Math.min(maxTop, rect.top)) + 'px';
          flyout.style.right = 'auto';
        }
      });

      // Spacing Overlay Toggle (Opt-in Box Model)
      let showSpacingOverlay = false;
      const toggleSpacingBtn = shadow.getElementById('cp-toggle-spacing');
      if (toggleSpacingBtn) {
        toggleSpacingBtn.onclick = () => {
          showSpacingOverlay = !showSpacingOverlay;
          if (showSpacingOverlay) {
            toggleSpacingBtn.classList.add('primary');
            toggleSpacingBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Spacing ON';
            if (currentElement) positionBands(currentElement);
          } else {
            toggleSpacingBtn.classList.remove('primary');
            toggleSpacingBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Spacing Overlay';
            hideBands();
          }
        };
      }

      let lastCopiedContext = null;
      let lastResolved = null;
      let lastInfoName = null;
      let lastComputedStyles = null;

      // Selection frame elements (Persistent selection & near-component chip)
      const selectionFrame = shadow.getElementById('cp-selection-frame');
      const selectionChip = shadow.getElementById('cp-selection-chip');
      const selName = shadow.getElementById('cp-sel-name');
      const selFile = shadow.getElementById('cp-sel-file');
      const selCopyBtn = shadow.getElementById('cp-sel-copy-btn');
      const selCopyLabel = shadow.getElementById('cp-sel-copy-label');
      const selNoteBtn = shadow.getElementById('cp-sel-note-btn');
      const selPinBtn = shadow.getElementById('cp-sel-pin-btn');
      const selSnapBtn = shadow.getElementById('cp-sel-snap-btn');
      const selIdeBtn = shadow.getElementById('cp-sel-ide-btn');
      const selCloseBtn = shadow.getElementById('cp-sel-close-btn');

      let selectedTarget = null;
      let selectedElement = null;
      let comments = [];
      let editingComment = null;
      let pendingPinTarget = null;
      let currentPins = [];

      function clearSelection() {
        selectedTarget = null;
        selectedElement = null;
        selectedRect = null;
        if (selectionFrame) selectionFrame.style.display = 'none';
        highlight.classList.remove('selected');
        clearDistanceGuides();
      }

      function updateSelectionFrame() {
        if (!selectedTarget || !selectionFrame) {
          if (selectionFrame) selectionFrame.style.display = 'none';
          return;
        }
        let rect = null;
        if (selectedTarget.isDomElement && selectedTarget.element) {
          rect = selectedTarget.element.getBoundingClientRect();
        } else if (selectedTarget.fiber) {
          rect = getComponentBoundingRect(selectedTarget.fiber);
        } else if (selectedElement) {
          rect = selectedElement.getBoundingClientRect();
        }
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          selectionFrame.style.display = 'none';
          return;
        }
        selectionFrame.style.display = 'block';
        selectionFrame.style.top = rect.top + 'px';
        selectionFrame.style.left = rect.left + 'px';
        selectionFrame.style.width = rect.width + 'px';
        selectionFrame.style.height = rect.height + 'px';

        if (rect.top < 36) {
          selectionChip.classList.add('inside-top');
        } else {
          selectionChip.classList.remove('inside-top');
        }

        const sidebarActive = flyout && flyout.classList.contains('open') && flyout.classList.contains('is-sidebar');
        const maxRight = sidebarActive ? (window.innerWidth - 440 - 12) : (window.innerWidth - 12);

        if (rect.left < 10) {
          selectionChip.style.left = '4px';
          selectionChip.style.right = 'auto';
        } else if (rect.left + 320 > maxRight) {
          selectionChip.style.left = 'auto';
          selectionChip.style.right = sidebarActive ? '452px' : '4px';
        } else {
          selectionChip.style.left = '-2px';
          selectionChip.style.right = 'auto';
        }
      }

      // --- Persistent Inline Comments Logic ---
      async function loadComments() {
        try {
          const res = await fetch(BRIDGE + '/api/comments');
          const data = await res.json();
          comments = data.comments || [];
          try { localStorage.setItem('agent-hover-comments', JSON.stringify(comments)); } catch(e) {}
          renderCommentMarkers();
          renderSidebarNotes();
        } catch(e) {
          try {
            comments = JSON.parse(localStorage.getItem('agent-hover-comments') || '[]');
            renderCommentMarkers();
            renderSidebarNotes();
          } catch(err) {}
        }
      }

      function renderCommentMarkers() {
        const layer = shadow.getElementById('cp-comments-layer');
        if (!layer) return;
        layer.innerHTML = '';

        comments.forEach((c, index) => {
          let el = null;
          if (c.selector) {
            try { el = document.querySelector(c.selector); } catch(e) {}
          }
          if (!el && c.component) {
            el = findComponentElement(c.component);
          }
          if (!el) return;

          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;

          const marker = document.createElement('div');
          marker.className = 'cp-comment-marker' + (c.resolved ? ' resolved' : '');
          marker.style.top = Math.max(8, rect.top) + 'px';
          marker.style.left = Math.min(window.innerWidth - 20, rect.right) + 'px';
          marker.title = (c.component ? '<' + c.component + ' />: ' : '') + c.text;
          marker.innerHTML = ICONS.comment + '<span style="margin-left:3px; font-size:10px;">' + (index + 1) + '</span>';
          marker.onclick = (e) => {
            e.stopPropagation();
            openNotePopover({ element: el, name: c.component || el.tagName.toLowerCase() }, c);
          };
          layer.appendChild(marker);
        });
      }

      function renderSidebarNotes() {
        const countEl = shadow.getElementById('cp-notes-count');
        const listEl = shadow.getElementById('cp-notes-list');
        if (!listEl) return;
        if (countEl) countEl.textContent = comments.length;

        if (comments.length === 0) {
          listEl.innerHTML = '<div style="font-size:11px; color:var(--text-muted); font-style:italic;">No notes yet. Click the note icon on any element to add persistent notes.</div>';
          return;
        }

        listEl.innerHTML = '';
        comments.forEach((c, idx) => {
          const item = document.createElement('div');
          item.className = 'cp-note-item' + (c.resolved ? ' resolved' : '');
          
          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'center';

          const titleWrap = document.createElement('div');
          titleWrap.style.display = 'flex';
          titleWrap.style.alignItems = 'center';
          titleWrap.style.gap = '5px';
          titleWrap.innerHTML = '<span class="cp-pin-badge">#' + (idx + 1) + '</span> <span style="font-weight:600; color:var(--text-primary); font-family:var(--font-mono); font-size:11px;">' + (c.component ? '&lt;' + escapeHtml(c.component) + ' /&gt;' : escapeHtml(c.selector || 'Element')) + '</span>';

          const actionsWrap = document.createElement('div');
          actionsWrap.style.display = 'flex';
          actionsWrap.style.alignItems = 'center';
          actionsWrap.style.gap = '4px';

          const resolveBtn = document.createElement('button');
          resolveBtn.style.cssText = 'background:none; border:none; cursor:pointer; padding:2px; color:' + (c.resolved ? 'var(--accent-emerald)' : 'var(--text-muted)');
          resolveBtn.title = c.resolved ? 'Mark unresolved' : 'Mark resolved';
          resolveBtn.innerHTML = ICONS.check;
          resolveBtn.onclick = async (e) => {
            e.stopPropagation();
            await fetch(BRIDGE + '/api/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'toggle-resolve', id: c.id })
            });
            loadComments();
          };

          const delBtn = document.createElement('button');
          delBtn.style.cssText = 'background:none; border:none; cursor:pointer; padding:2px; color:var(--accent-rose); opacity:0.7;';
          delBtn.title = 'Delete note';
          delBtn.innerHTML = ICONS.trash;
          delBtn.onclick = async (e) => {
            e.stopPropagation();
            await fetch(BRIDGE + '/api/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: c.id })
            });
            loadComments();
          };

          actionsWrap.appendChild(resolveBtn);
          actionsWrap.appendChild(delBtn);
          header.appendChild(titleWrap);
          header.appendChild(actionsWrap);

          const body = document.createElement('div');
          body.style.color = c.resolved ? 'var(--text-muted)' : 'var(--text-primary)';
          body.style.textDecoration = c.resolved ? 'line-through' : 'none';
          body.style.fontSize = '11.5px';
          body.style.lineHeight = '1.4';
          body.textContent = c.text;

          item.appendChild(header);
          item.appendChild(body);
          
          item.onclick = () => {
            let el = null;
            if (c.selector) {
              try { el = document.querySelector(c.selector); } catch(e) {}
            }
            if (!el && c.component) el = findComponentElement(c.component);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              selectedElement = el;
              selectedTarget = { name: c.component || el.tagName.toLowerCase(), element: el, isDomElement: true };
              updateSelectionFrame();
            }
          };

          listEl.appendChild(item);
        });
      }

      function openNotePopover(target, comment = null) {
        editingComment = comment;
        const popover = shadow.getElementById('cp-note-popover');
        const targetEl = shadow.getElementById('cp-note-popover-target');
        const inputEl = shadow.getElementById('cp-note-input');
        const delBtn = shadow.getElementById('cp-note-delete');
        if (!popover || !inputEl) return;

        const compName = comment?.component || target?.name || selectedTarget?.name || 'Element';
        const fileStr = comment?.file || lastResolved?.file || '';
        targetEl.textContent = (compName ? '<' + compName + ' />' : '') + (fileStr ? ' (' + fileStr.split('/').pop() + ')' : '');
        inputEl.value = comment?.text || '';

        if (comment) {
          delBtn.style.display = 'inline-flex';
          delBtn.onclick = async () => {
            await fetch(BRIDGE + '/api/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: comment.id })
            });
            popover.style.display = 'none';
            loadComments();
            showCallout('Note deleted', 'NOTE');
          };
        } else {
          delBtn.style.display = 'none';
        }

        if (selectedRect) {
          let top = selectedRect.bottom + 10;
          if (top + 190 > window.innerHeight) top = Math.max(20, selectedRect.top - 200);
          let left = Math.max(20, Math.min(window.innerWidth - 340, selectedRect.left));
          popover.style.top = top + 'px';
          popover.style.left = left + 'px';
          popover.style.transform = 'none';
        } else {
          popover.style.top = '25%';
          popover.style.left = '50%';
          popover.style.transform = 'translate(-50%, -50%)';
        }

        popover.style.display = 'block';
        setTimeout(() => inputEl.focus(), 50);
      }

      async function saveNote() {
        const inputEl = shadow.getElementById('cp-note-input');
        const text = inputEl ? inputEl.value.trim() : '';
        if (!text) {
          showCallout('Please enter a note first', 'TIP');
          return;
        }

        if (editingComment) {
          await fetch(BRIDGE + '/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', id: editingComment.id, text })
          });
          showCallout('Note updated (persists across restarts)', 'SAVED');
        } else {
          const compName = selectedTarget?.name || (lastCopiedContext ? lastCopiedContext.component.name : '');
          const file = lastResolved?.file || lastCopiedContext?.source?.file || '';
          const line = lastResolved?.line || lastCopiedContext?.source?.startLine || undefined;
          const selector = (selectedTarget?.element || selectedElement) ? buildCSSSelector(selectedTarget?.element || selectedElement) : '';

          await fetch(BRIDGE + '/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add',
              comment: { file, line, component: compName, selector, text }
            })
          });
          showCallout('Note saved (persists across restarts)', 'SAVED');
        }

        shadow.getElementById('cp-note-popover').style.display = 'none';
        loadComments();
      }

      shadow.getElementById('cp-note-save').onclick = saveNote;
      shadow.getElementById('cp-note-cancel').onclick = () => {
        shadow.getElementById('cp-note-popover').style.display = 'none';
      };
      shadow.getElementById('cp-note-popover-close').onclick = () => {
        shadow.getElementById('cp-note-popover').style.display = 'none';
      };

      const notesCopyAllBtn = shadow.getElementById('cp-notes-copy-all');
      if (notesCopyAllBtn) {
        notesCopyAllBtn.onclick = async () => {
          if (comments.length === 0) {
            showCallout('No notes to copy', 'TIP');
            return;
          }
          const bt = String.fromCharCode(96);
          const nl = String.fromCharCode(10);
          let md = '### Persistent Codebase Notes & Feedback' + nl + nl;
          comments.forEach((c, i) => {
            const num = i + 1;
            const target = c.component ? '<' + c.component + ' />' : (c.selector || 'Element');
            const loc = c.file ? ' (' + bt + c.file + (c.line ? ':' + c.line : '') + bt + ')' : '';
            const status = c.resolved ? ' [RESOLVED]' : '';
            md += num + '. **' + target + '**' + loc + status + ':' + nl;
            md += '   > ' + c.text + nl + nl;
          });
          await navigator.clipboard.writeText(md);
          const origText = notesCopyAllBtn.textContent;
          notesCopyAllBtn.textContent = 'Copied!';
          showCallout('All ' + comments.length + ' notes copied for AI', 'COPIED');
          setTimeout(() => { notesCopyAllBtn.textContent = origText; }, 1600);
        };
      }

      // --- Pinned Multi-Task Dialog Logic ---
      function openPinDialog(target, resolved) {
        pendingPinTarget = { target, resolved };
        const pinBadge = shadow.getElementById('cp-pin-dialog-badge');
        const pinName = shadow.getElementById('cp-pin-dialog-name');
        const pinFile = shadow.getElementById('cp-pin-dialog-file');
        const pinTask = shadow.getElementById('cp-pin-dialog-task');
        const pinDlg = shadow.getElementById('cp-pin-dialog');

        const currentPinsCount = currentPins.length;
        pinBadge.textContent = 'Pin #' + (currentPinsCount + 1);
        pinName.textContent = '<' + (target?.name || 'Component') + ' />';
        pinFile.textContent = resolved?.file ? (resolved.file.split('/').slice(-2).join('/') + (resolved.line ? ':' + resolved.line : '')) : '';
        
        const existingPin = currentPins.find(p => p.context?.source?.file === resolved?.file);
        pinTask.value = existingPin?.task || '';

        if (selectedRect) {
          let top = selectedRect.bottom + 10;
          if (top + 190 > window.innerHeight) top = Math.max(20, selectedRect.top - 200);
          let left = Math.max(20, Math.min(window.innerWidth - 360, selectedRect.left));
          pinDlg.style.top = top + 'px';
          pinDlg.style.left = left + 'px';
          pinDlg.style.transform = 'none';
        } else {
          pinDlg.style.top = '30%';
          pinDlg.style.left = '50%';
          pinDlg.style.transform = 'translate(-50%, -50%)';
        }

        pinDlg.style.display = 'block';
        setTimeout(() => pinTask.focus(), 50);
      }

      const pinDialogAddMore = shadow.getElementById('cp-pin-dialog-add-more');
      if (pinDialogAddMore) {
        pinDialogAddMore.onclick = async () => {
          if (!pendingPinTarget) return;
          const { target, resolved } = pendingPinTarget;
          const taskVal = shadow.getElementById('cp-pin-dialog-task')?.value.trim() || '';
          const pinId = 'pin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          
          await fetch(BRIDGE + '/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', id: pinId, file: resolved.file, line: resolved.line, task: taskVal })
          });
          shadow.getElementById('cp-pin-dialog').style.display = 'none';
          showCallout('Pin added. Click next element to add more', 'PIN');
          await refreshState();
          
          if (!isPointerMode) {
            togglePointerMode();
          }
        };
      }

      const pinDialogCopyNow = shadow.getElementById('cp-pin-dialog-copy-now');
      if (pinDialogCopyNow) {
        pinDialogCopyNow.onclick = async () => {
          if (!pendingPinTarget) return;
          const { target, resolved } = pendingPinTarget;
          const taskVal = shadow.getElementById('cp-pin-dialog-task')?.value.trim() || '';
          const pinId = 'pin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

          await fetch(BRIDGE + '/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', id: pinId, file: resolved.file, line: resolved.line, task: taskVal })
          });
          shadow.getElementById('cp-pin-dialog').style.display = 'none';
          await refreshState();

          const level = shadow.getElementById('cp-context-level')?.value || 'standard';
          try {
            const taskRes = await fetch(BRIDGE + '/api/task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instruction: taskVal, level })
            });
            const taskData = await taskRes.json();
            await navigator.clipboard.writeText(taskData.context);
            showCallout('Task prompt copied (' + (taskData.tokenCost || '?') + ' tok)', 'COPIED');
          } catch(e) {
            showCallout('Pinned ' + (target?.name || 'Component'), 'PIN');
          }
        };
      }

      const pinDialogClose = shadow.getElementById('cp-pin-dialog-close');
      if (pinDialogClose) {
        pinDialogClose.onclick = () => {
          shadow.getElementById('cp-pin-dialog').style.display = 'none';
        };
      }

      if (selCloseBtn) {
        selCloseBtn.onclick = (e) => {
          e.stopPropagation();
          clearSelection();
          flyout.classList.remove('open');
          dockWrapper.classList.remove('sidebar-open');
        };
      }

      if (selCopyBtn) {
        selCopyBtn.onclick = async (e) => {
          e.stopPropagation();
          if (lastCopiedContext) {
            const promptText = formatContextForAiPrompt(lastCopiedContext, currentStack);
            await navigator.clipboard.writeText(promptText);
            if (selCopyLabel) selCopyLabel.textContent = 'Copied!';
            showCallout('AI Prompt Copied (' + (lastCopiedContext.tokens?.current || '?') + ' tok)', 'COPIED');
            setTimeout(() => { if (selCopyLabel) selCopyLabel.textContent = 'Copy Prompt'; }, 1600);
          } else if (selectedTarget) {
            try {
              if (selCopyLabel) selCopyLabel.textContent = 'Copying...';
              const compToResolve = selectedTarget.isDomElement && currentStack.length > 1 ? currentStack[1] : selectedTarget;
              const res = await resolveComponent(compToResolve);
              if (res) {
                const fetchRes = await fetch(BRIDGE + '/api/context', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file: res.file, line: res.line, level: 'standard' })
                });
                const ctx = await fetchRes.json();
                lastCopiedContext = ctx;
                const promptText = formatContextForAiPrompt(ctx, currentStack);
                await navigator.clipboard.writeText(promptText);
                if (selCopyLabel) selCopyLabel.textContent = 'Copied!';
                showCallout('AI Prompt Copied', 'COPIED');
                setTimeout(() => { if (selCopyLabel) selCopyLabel.textContent = 'Copy Prompt'; }, 1600);
                return;
              }
            } catch(err) {
              console.error(err);
            }
            const promptText = formatDomElementPrompt(selectedTarget, lastComputedStyles || extractComputedStyles(selectedTarget.element || selectedElement), currentStack);
            await navigator.clipboard.writeText(promptText);
            if (selCopyLabel) selCopyLabel.textContent = 'Copied!';
            showCallout('Element Prompt Copied', 'COPIED');
            setTimeout(() => { if (selCopyLabel) selCopyLabel.textContent = 'Copy Prompt'; }, 1600);
          }
        };
      }

      if (selNoteBtn) {
        selNoteBtn.onclick = (e) => {
          e.stopPropagation();
          const compName = selectedTarget?.name || (lastCopiedContext ? lastCopiedContext.component.name : '');
          const file = lastResolved?.file || lastCopiedContext?.source?.file || '';
          const existing = comments.find(c => (compName && c.component === compName) || (file && c.file === file));
          openNotePopover(selectedTarget, existing || null);
        };
      }

      if (selSnapBtn) {
        selSnapBtn.onclick = async (e) => {
          e.stopPropagation();
          const targetEl = selectedTarget?.element || selectedElement || document.body;
          const targetName = selectedTarget?.name || 'component';
          await downloadCleanScreenshot(targetEl, targetName);
        };
      }

      if (selIdeBtn) {
        selIdeBtn.onclick = (e) => {
          e.stopPropagation();
          openInEditor();
        };
      }

      if (selPinBtn) {
        selPinBtn.onclick = async (e) => {
          e.stopPropagation();
          const targetToPin = selectedTarget?.isDomElement && currentStack.length > 1 ? currentStack[1] : selectedTarget;
          const resolved = lastResolved || (targetToPin ? await resolveComponent(targetToPin) : null);
          if (resolved) {
            openPinDialog(targetToPin, resolved);
          } else {
            showCallout('Could not resolve file', 'ERROR');
          }
        };
      }

      shadow.getElementById('cp-context-level').addEventListener('change', async () => {
        refreshState();
        if (flyout.classList.contains('open') && lastResolved && lastInfoName) {
          await loadComponentContext(lastInfoName, lastResolved, lastComputedStyles);
        }
      });

      // Dedicated Copy for AI Prompt Action
      const copyAiBtn = shadow.getElementById('cp-copy-ai');
      if (copyAiBtn) {
        copyAiBtn.onclick = async () => {
          if (lastCopiedContext) {
            const promptText = formatContextForAiPrompt(lastCopiedContext, currentStack);
            await navigator.clipboard.writeText(promptText);
            const originalHtml = copyAiBtn.innerHTML;
            copyAiBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
            showCallout('AI Prompt Copied (' + (lastCopiedContext.tokens?.current || '?') + ' tok)', 'COPIED');
            setTimeout(() => { copyAiBtn.innerHTML = originalHtml; }, 1600);
          } else if (selectedTarget) {
            const promptText = formatDomElementPrompt(selectedTarget, lastComputedStyles || extractComputedStyles(selectedTarget.element || selectedElement), currentStack);
            await navigator.clipboard.writeText(promptText);
            const originalHtml = copyAiBtn.innerHTML;
            copyAiBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
            showCallout('Element Prompt Copied', 'COPIED');
            setTimeout(() => { copyAiBtn.innerHTML = originalHtml; }, 1600);
          } else {
            showCallout('Select a component first', 'TIP');
          }
        };
      }

      // Vibe Prompt Starters Click Handler
      const vibePromptsContainer = shadow.getElementById('cp-vibe-prompts');
      if (vibePromptsContainer) {
        vibePromptsContainer.onclick = async (e) => {
          const btn = e.target.closest('.cp-vibe-chip');
          if (!btn) return;
          const vibeType = btn.getAttribute('data-vibe');

          let targetCtx = lastCopiedContext;
          if (!targetCtx && selectedTarget) {
            try {
              const compToResolve = selectedTarget.isDomElement && currentStack.length > 1 ? currentStack[1] : selectedTarget;
              const res = await resolveComponent(compToResolve);
              if (res) {
                const fetchRes = await fetch(BRIDGE + '/api/context', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file: res.file, line: res.line, level: 'standard' })
                });
                targetCtx = await fetchRes.json();
                lastCopiedContext = targetCtx;
              }
            } catch(err) {}
          }

          const compName = targetCtx?.component?.name || selectedTarget?.name || 'Component';
          const filePath = targetCtx?.source?.file || lastResolved?.file || '';
          const lineNum = targetCtx?.source?.startLine || lastResolved?.line || '';
          const locStr = filePath ? ' (' + filePath + (lineNum ? ':' + lineNum : '') + ')' : '';

          let taskDesc = '';
          if (vibeType === 'redesign') {
            taskDesc = 'Please modernize and redesign <' + compName + ' />' + locStr + ' with a sleek, premium UI aesthetic. Keep existing props and functionality intact while elevating spacing, typography, colors, and micro-interactions.';
          } else if (vibeType === 'responsive') {
            taskDesc = 'Please make <' + compName + ' />' + locStr + ' fully responsive across mobile, tablet, and desktop screens. Ensure flex and grid layouts wrap naturally and font sizes adapt seamlessly.';
          } else if (vibeType === 'theme') {
            taskDesc = 'Please restyle <' + compName + ' />' + locStr + ' to harmonize colors, contrast, and visual hierarchy. Refine backgrounds, borders, and text contrast.';
          } else if (vibeType === 'refactor') {
            taskDesc = 'Please refactor <' + compName + ' />' + locStr + ' for cleaner structure, optimal React rendering performance, and strict TypeScript types while preserving exact behavior.';
          }

          const nl = String.fromCharCode(10);
          let promptText = '### Vibe Task: ' + taskDesc + nl + nl;
          if (targetCtx) {
            promptText += formatContextForAiPrompt(targetCtx, currentStack, taskDesc);
          } else if (selectedTarget) {
            promptText += formatDomElementPrompt(selectedTarget, lastComputedStyles || extractComputedStyles(selectedTarget.element || selectedElement), currentStack, taskDesc);
          } else {
            promptText += '- Target: <' + compName + ' />' + locStr;
          }

          await navigator.clipboard.writeText(promptText);
          const origHtml = btn.innerHTML;
          btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
          showCallout('Prompt Copied for AI', 'COPIED');
          setTimeout(() => { btn.innerHTML = origHtml; }, 1600);
        };
      }

      async function openInEditor() {
        const targetSource = lastCopiedContext?.source || (lastResolved ? { absolutePath: lastResolved.file, startLine: lastResolved.line } : null);
        if (targetSource) {
          try {
            const btn = shadow.getElementById('cp-editor-btn');
            const originalContent = btn ? btn.innerHTML : '';
            if (btn) btn.innerHTML = 'Opening...';
            showCallout('Opening in IDE...', currentEditorPref || '${editor}');
            const res = await fetch(BRIDGE + '/api/open-editor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file: targetSource.absolutePath || targetSource.file,
                line: targetSource.startLine || targetSource.line || 1,
                editor: currentEditorPref || '${editor}'
              })
            });
            const data = await res.json();
            if (!res.ok || data.error) {
              showCallout('Failed to open editor', 'ERROR');
            } else {
              showCallout('Opened in IDE', 'IDE');
            }
            if (btn) btn.innerHTML = originalContent;
          } catch(e) {
            console.error('[agent-hover] Failed to open editor:', e);
            showCallout('Bridge server connection failed', 'ERROR');
            const btn = shadow.getElementById('cp-editor-btn');
            if (btn) btn.innerHTML = ICONS.code + ' Open in IDE';
          }
        } else if (selectedTarget) {
          const compToResolve = selectedTarget.isDomElement && currentStack.length > 1 ? currentStack[1] : selectedTarget;
          resolveComponent(compToResolve).then(res => {
            if (res) {
              lastResolved = res;
              openInEditor();
            } else {
              showCallout('Could not resolve file', 'ERROR');
            }
          });
        } else {
          showCallout('Select a component first', 'TIP');
        }
      }

      shadow.getElementById('cp-editor-btn').onclick = openInEditor;

      // Direct Screenshot of Website UI
      const flyoutSnapBtn = shadow.getElementById('cp-flyout-snap-btn');
      if (flyoutSnapBtn) {
        flyoutSnapBtn.onclick = async () => {
          const targetEl = selectedTarget?.element || selectedElement || currentElement || document.body;
          const targetName = selectedTarget?.name || (selectedElement ? 'component' : 'website');
          await downloadCleanScreenshot(targetEl, targetName);
        };
      }

      shadow.getElementById('cp-pin-btn').onclick = async () => {
        const targetToPin = selectedTarget?.isDomElement && currentStack.length > 1 ? currentStack[1] : selectedTarget;
        const resolved = lastResolved || (targetToPin ? await resolveComponent(targetToPin) : null);
        if (resolved) {
          openPinDialog(targetToPin, resolved);
        } else if (lastCopiedContext) {
          openPinDialog({ name: lastCopiedContext.component.name }, { file: lastCopiedContext.source.file, line: lastCopiedContext.source.startLine });
        } else {
          showCallout('Select a component to pin first', 'TIP');
        }
      };

      const taskInput = shadow.getElementById('cp-task-input');
      if (taskInput) {
        taskInput.addEventListener('focus', () => {
          taskInput.style.borderColor = 'var(--border-accent)';
        });
        taskInput.addEventListener('blur', () => {
          taskInput.style.borderColor = '';
        });
      }

      shadow.getElementById('cp-gen-task').onclick = async () => {
        if (!currentPins || currentPins.length === 0) {
          showCallout('Pin at least one component first', 'TIP');
          return;
        }
        const instruction = taskInput ? taskInput.value.trim() : '';
        const level = shadow.getElementById('cp-context-level')?.value || 'standard';
        const btn = shadow.getElementById('cp-gen-task');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<svg class="cp-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Generating...';
        btn.disabled = true;
        try {
          const res = await fetch(BRIDGE + '/api/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction, level })
          });
          const data = await res.json();
          await navigator.clipboard.writeText(data.context || JSON.stringify(data, null, 2));
          showCallout('All tasks copied in order (' + (data.tokenCost || '?') + ' tokens)', 'COPIED');
          btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
          setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 1600);
        } catch(e) {
          showCallout('Failed to generate task context', 'ERROR');
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      };

      // --- React 19 Fiber Detection ---
      function getFiberNode(el) {
        let curr = el;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          for (const key in curr) {
            if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
              return curr[key];
            }
          }
          curr = curr.parentElement;
        }
        return null;
      }

      // --- Element & Component Detection (Universal Selection) ---
      function describeElement(el) {
        if (!el) return '';
        let desc = el.tagName.toLowerCase();
        if (el.id) {
          desc += '#' + el.id;
        } else if (el.className && typeof el.className === 'string') {
          const cls = el.className.trim().split(/\\s+/).slice(0, 2);
          if (cls.length && cls[0]) desc += '.' + cls.join('.');
        }
        return desc;
      }

      function buildHierarchyStack(el) {
        if (!el) return [];
        const stack = [];

        // 1. The exact DOM element under the cursor is ALWAYS level 0 (direct selection)
        const desc = describeElement(el);
        const textSnippet = el.textContent ? el.textContent.trim().slice(0, 35) : '';
        stack.push({
          name: desc,
          isDomElement: true,
          element: el,
          tagName: el.tagName.toLowerCase(),
          textPreview: textSnippet
        });

        // 2. Walk fiber ancestry to find all React components containing this element
        const fiber = getFiberNode(el);
        if (fiber) {
          const seen = new Set();
          let curr = fiber;
          while (curr) {
            let name = null;
            let source = null;
            if (typeof curr.type === 'function') {
              name = curr.type.displayName || curr.type.name;
              source = curr._debugSource || null;
            } else if (curr.type && typeof curr.type === 'object') {
              const inner = curr.type.render || curr.type.type;
              if (typeof inner === 'function') {
                name = inner.displayName || inner.name;
                source = curr._debugSource || null;
              }
            }
            if (name && name !== 'Fragment' && !name.startsWith('_') && name !== 'Suspense' && name !== 'StrictMode') {
              const key = name + ':' + (source ? source.fileName + ':' + source.lineNumber : 'null');
              if (!seen.has(key)) {
                seen.add(key);
                stack.push({ name, source, fiber: curr, isDomElement: false, element: el });
              }
            }
            curr = curr.return;
          }
        }
        return stack; // [leaf DOM element, innermost React component, ..., outermost App]
      }

      function getComponentStack(el) {
        return buildHierarchyStack(el).filter(x => !x.isDomElement);
      }

      function getBestComponent(stack) {
        if (!stack || stack.length === 0) return null;
        return stack[0];
      }

      function getComponentInfo(el) {
        const stack = getComponentStack(el);
        return getBestComponent(stack);
      }

      // Collect all DOM nodes owned by a fiber
      function collectFiberDomNodes(fiber) {
        const nodes = [];
        function walkFiber(f) {
          if (!f) return;
          if (f.stateNode && f.stateNode instanceof HTMLElement && f.stateNode !== document.body) {
            nodes.push(f.stateNode);
          } else {
            let child = f.child;
            while (child) {
              walkFiber(child);
              child = child.sibling;
            }
          }
        }
        let child = fiber.child;
        while (child) {
          walkFiber(child);
          child = child.sibling;
        }
        if (fiber.stateNode && fiber.stateNode instanceof HTMLElement && fiber.stateNode !== document.body) {
          nodes.push(fiber.stateNode);
        }
        return nodes;
      }

      // Compute the union bounding rect of all DOM nodes in a fiber subtree
      function getComponentBoundingRect(fiber) {
        const nodes = collectFiberDomNodes(fiber);
        if (nodes.length === 0) return null;
        let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity;
        for (const node of nodes) {
          const r = node.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.top < top) top = r.top;
          if (r.left < left) left = r.left;
          if (r.bottom > bottom) bottom = r.bottom;
          if (r.right > right) right = r.right;
        }
        if (top === Infinity) return null;
        return { top, left, width: right - left, height: bottom - top };
      }

      // --- Hierarchy Navigation State ---
      let currentStack = [];
      let currentStackIndex = -1;

      // Position margin/padding bands and dashed axis guides (Design-Mode style)
      function positionBands(el) {
        if (!el) return;
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const px = (v) => parseFloat(v) || 0;
        const mt = px(cs.marginTop), mr = px(cs.marginRight), mb = px(cs.marginBottom), ml = px(cs.marginLeft);
        const pt = px(cs.paddingTop), pr = px(cs.paddingRight), pb = px(cs.paddingBottom), pl = px(cs.paddingLeft);
        const bt = px(cs.borderTopWidth), brw = px(cs.borderRightWidth), bb = px(cs.borderBottomWidth), blw = px(cs.borderLeftWidth);

        // 1. Draw full-canvas dashed Axis Projection Lines (Figma / Design-Mode style)
        if (axisGuides) {
          const lines = [
            '<div class="cp-axis-line cp-axis-h" style="top:' + Math.round(rect.top) + 'px;"></div>',
            '<div class="cp-axis-line cp-axis-h" style="top:' + Math.round(rect.bottom) + 'px;"></div>',
            '<div class="cp-axis-line cp-axis-v" style="left:' + Math.round(rect.left) + 'px;"></div>',
            '<div class="cp-axis-line cp-axis-v" style="left:' + Math.round(rect.right) + 'px;"></div>'
          ];

          // Flex / Grid direct child dashed frames
          if (cs.display.includes('flex') || cs.display.includes('grid')) {
            const children = Array.from(el.children);
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              if (!(child instanceof HTMLElement) || child.id === 'agent-hover-root') continue;
              const cr = child.getBoundingClientRect();
              if (cr.width > 0 && cr.height > 0) {
                lines.push('<div class="cp-layout-child-frame" style="top:' + Math.round(cr.top) + 'px; left:' + Math.round(cr.left) + 'px; width:' + Math.round(cr.width) + 'px; height:' + Math.round(cr.height) + 'px;"></div>');
              }
            }
          }

          axisGuides.innerHTML = lines.join('');
        }

        // 2. Margin Outer Dashed Frame
        if (marginBand) {
          if (mt || mr || mb || ml) {
            marginBand.style.display = 'block';
            marginBand.style.top = (rect.top - mt) + 'px';
            marginBand.style.left = (rect.left - ml) + 'px';
            marginBand.style.width = (rect.width + ml + mr) + 'px';
            marginBand.style.height = (rect.height + mt + mb) + 'px';
            marginBand.style.borderTopWidth = mt + 'px';
            marginBand.style.borderRightWidth = mr + 'px';
            marginBand.style.borderBottomWidth = mb + 'px';
            marginBand.style.borderLeftWidth = ml + 'px';
          } else {
            marginBand.style.display = 'none';
          }
        }

        // 3. Padding Inner Dashed Frame
        if (paddingBand) {
          if (pt || pr || pb || pl) {
            paddingBand.style.display = 'block';
            paddingBand.style.top = (rect.top + bt) + 'px';
            paddingBand.style.left = (rect.left + blw) + 'px';
            paddingBand.style.width = Math.max(0, rect.width - blw - brw) + 'px';
            paddingBand.style.height = Math.max(0, rect.height - bt - bb) + 'px';
            paddingBand.style.borderTopWidth = pt + 'px';
            paddingBand.style.borderRightWidth = pr + 'px';
            paddingBand.style.borderBottomWidth = pb + 'px';
            paddingBand.style.borderLeftWidth = pl + 'px';
          } else {
            paddingBand.style.display = 'none';
          }
        }
      }

      function hideBands() {
        if (marginBand) marginBand.style.display = 'none';
        if (paddingBand) paddingBand.style.display = 'none';
        if (axisGuides) axisGuides.innerHTML = '';
      }

      // --- Measurement Distance Guides ---
      let selectedRect = null; // Stores the rect of the currently selected (clicked) element

      function clearDistanceGuides() {
        if (distanceLayer) distanceLayer.innerHTML = '';
      }

      function renderDistanceGuides(selRect, hovRect) {
        clearDistanceGuides();
        if (!distanceLayer || !selRect || !hovRect) return;

        // Check if rects are the same element (skip)
        if (Math.abs(selRect.top - hovRect.top) < 2 && Math.abs(selRect.left - hovRect.left) < 2 &&
            Math.abs(selRect.width - hovRect.width) < 2 && Math.abs(selRect.height - hovRect.height) < 2) return;

        const selBottom = selRect.top + selRect.height;
        const selRight = selRect.left + selRect.width;
        const hovBottom = hovRect.top + hovRect.height;
        const hovRight = hovRect.left + hovRect.width;

        const overlapX = selRect.left < hovRight && selRight > hovRect.left;
        const overlapY = selRect.top < hovBottom && selBottom > hovRect.top;

        function addLine(cls, top, left, w, h) {
          const el = document.createElement('div');
          el.className = 'cp-dist-line ' + cls;
          el.style.top = top + 'px';
          el.style.left = left + 'px';
          if (w) el.style.width = w + 'px';
          if (h) el.style.height = h + 'px';
          distanceLayer.appendChild(el);
        }

        function addPill(text, top, left) {
          const el = document.createElement('div');
          el.className = 'cp-dist-pill';
          el.textContent = text;
          el.style.top = top + 'px';
          el.style.left = left + 'px';
          distanceLayer.appendChild(el);
        }

        // Vertical gap (elements don't overlap vertically)
        if (!overlapY) {
          const isAbove = selRect.top > hovBottom;
          const gapTop = isAbove ? hovBottom : selBottom;
          const gapBottom = isAbove ? selRect.top : hovRect.top;
          const gap = Math.round(gapBottom - gapTop);
          if (gap > 0) {
            const midX = Math.max(selRect.left + selRect.width / 2, hovRect.left + hovRect.width / 2);
            addLine('vertical', gapTop, midX, null, gap);
            addPill(gap + 'px', gapTop + gap / 2, midX);
          }
        }

        // Horizontal gap (elements don't overlap horizontally)
        if (!overlapX) {
          const isLeft = selRect.left > hovRight;
          const gapLeft = isLeft ? hovRight : selRight;
          const gapRight = isLeft ? selRect.left : hovRect.left;
          const gap = Math.round(gapRight - gapLeft);
          if (gap > 0) {
            const midY = Math.max(selRect.top + selRect.height / 2, hovRect.top + hovRect.height / 2);
            addLine('horizontal', midY, gapLeft, gap, null);
            addPill(gap + 'px', midY, gapLeft + gap / 2);
          }
        }

        // Both overlap (nested/containment) — show edge inset distances
        if (overlapX && overlapY) {
          const topGap = Math.round(Math.abs(hovRect.top - selRect.top));
          const leftGap = Math.round(Math.abs(hovRect.left - selRect.left));
          const bottomGap = Math.round(Math.abs(selBottom - hovBottom));
          const rightGap = Math.round(Math.abs(selRight - hovRight));

          const innerLeft = Math.max(selRect.left, hovRect.left);
          const innerRight = Math.min(selRight, hovRight);
          const innerTop = Math.max(selRect.top, hovRect.top);
          const innerBottom = Math.min(selBottom, hovBottom);
          const midX = (innerLeft + innerRight) / 2;
          const midY = (innerTop + innerBottom) / 2;

          if (topGap > 4) {
            const t = Math.min(selRect.top, hovRect.top);
            addLine('vertical', t, midX, null, topGap);
            addPill(topGap + 'px', t + topGap / 2, midX);
          }
          if (leftGap > 4) {
            const l = Math.min(selRect.left, hovRect.left);
            addLine('horizontal', midY, l, leftGap, null);
            addPill(leftGap + 'px', midY, l + leftGap / 2);
          }
          if (bottomGap > 4 && bottomGap !== topGap) {
            const bTop = Math.min(selBottom, hovBottom);
            addLine('vertical', bTop, midX, null, bottomGap);
            addPill(bottomGap + 'px', bTop + bottomGap / 2, midX);
          }
          if (rightGap > 4 && rightGap !== leftGap) {
            const rLeft = Math.min(selRight, hovRight);
            addLine('horizontal', midY, rLeft, rightGap, null);
            addPill(rightGap + 'px', midY, rLeft + rightGap / 2);
          }
        }
      }

      // --- Inline Text Editor (Writes directly to Source with DOM Fallback) ---
      let textEditTarget = null;
      let textEditOriginalHTML = '';
      let textEditOriginalText = '';
      let textEditTargetFile = null;
      let textEditTargetLine = null;
      let textEditTargetComponent = null;
      let textEdits = new Map(); // element -> { originalHTML, currentHTML }
      let textEditorVisible = false;

      // Managed stylesheet for edited element indicators
      let editedStyleEl = null;
      function getEditedStylesheet() {
        if (!editedStyleEl) {
          editedStyleEl = document.createElement('style');
          editedStyleEl.id = 'agent-hover-edits';
          document.head.appendChild(editedStyleEl);
        }
        return editedStyleEl;
      }

      function updateEditedIndicators() {
        const sheet = getEditedStylesheet();
        let css = '';
        let idx = 0;
        textEdits.forEach(function(val, el) {
          const attrVal = 'ah-edited-' + idx;
          el.setAttribute('data-ah-edited', attrVal);
          css += '[data-ah-edited="' + attrVal + '"] { outline: 1px dashed rgba(0, 240, 255, 0.35) !important; outline-offset: 2px !important; }\\n';
          idx++;
        });
        sheet.textContent = css;
      }

      function isLeafTextElement(el) {
        if (!el || !el.textContent || !el.textContent.trim()) return false;
        // Check that it has mostly text content (no complex children)
        const children = el.children;
        if (children.length === 0) return true;
        // Allow elements with only inline formatting children (b, i, u, em, strong, span, a, br)
        const inlineTags = new Set(['B', 'I', 'U', 'EM', 'STRONG', 'SPAN', 'A', 'BR', 'SMALL', 'SUB', 'SUP', 'MARK', 'CODE']);
        for (let i = 0; i < children.length; i++) {
          if (!inlineTags.has(children[i].tagName)) return false;
        }
        return true;
      }

      function isFormElement(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'OPTION';
      }

      function positionTextEditor(targetEl) {
        if (!textEditor || !targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const edW = 340;
        const edH = 240; // approximate
        const gap = 8;
        let top, left;

        // Prefer below the element
        if (rect.bottom + gap + edH < window.innerHeight) {
          top = rect.bottom + gap;
        } else if (rect.top - gap - edH > 0) {
          // Above the element
          top = rect.top - gap - edH;
        } else {
          // Fallback: center of viewport
          top = Math.max(12, (window.innerHeight - edH) / 2);
        }

        // Horizontally align with element left, clamped to viewport
        left = Math.max(12, Math.min(rect.left, window.innerWidth - edW - 12));

        textEditor.style.top = top + 'px';
        textEditor.style.left = left + 'px';
      }

      function openTextEditor(el) {
        if (!textEditor || !textEditorContent || !el) return;
        textEditTarget = el;
        textEditOriginalHTML = el.innerHTML;
        textEditOriginalText = (el.textContent || '').trim();
        textEditTargetFile = null;
        textEditTargetLine = null;
        textEditTargetComponent = null;

        // Find enclosing React component and source location
        const stack = buildHierarchyStack(el);
        const comp = stack.find(c => !c.isDomElement);
        if (comp) {
          textEditTargetComponent = comp.name;
          if (comp.source && comp.source.fileName) {
            const fn = comp.source.fileName.split('/').pop().replace(/\.[jt]sx?$/, '');
            if (fn.toLowerCase() === comp.name.toLowerCase()) {
              textEditTargetFile = comp.source.fileName;
              textEditTargetLine = comp.source.lineNumber;
            }
          }
        }

        // Target badge
        const targetBadge = shadow.getElementById('cp-text-target-badge');
        if (targetBadge) {
          if (textEditTargetFile) {
            const fileName = textEditTargetFile.split('/').pop();
            targetBadge.textContent = (textEditTargetComponent ? textEditTargetComponent + ' • ' : '') + fileName + (textEditTargetLine ? ':' + textEditTargetLine : '');
            targetBadge.title = textEditTargetFile + (textEditTargetLine ? ':' + textEditTargetLine : '');
          } else if (textEditTargetComponent) {
            targetBadge.textContent = textEditTargetComponent + ' • resolving...';
            resolveComponent({ name: textEditTargetComponent }).then(resolved => {
              if (resolved && resolved.file) {
                textEditTargetFile = resolved.file;
                textEditTargetLine = resolved.line;
                const fn = resolved.file.split('/').pop();
                targetBadge.textContent = textEditTargetComponent + ' • ' + fn + (resolved.line ? ':' + resolved.line : '');
                targetBadge.title = resolved.file + ':' + resolved.line;
              } else {
                targetBadge.textContent = textEditTargetComponent + ' (DOM only)';
              }
            });
          } else {
            targetBadge.textContent = 'DOM preview only';
            targetBadge.title = 'No component source resolved';
          }
        }

        // If this element was previously edited, show current content
        textEditorContent.innerHTML = el.innerHTML;

        positionTextEditor(el);
        textEditor.style.display = 'block';
        textEditorVisible = true;

        // Focus the editor and select all text
        setTimeout(function() {
          textEditorContent.focus();
          try {
            const range = document.createRange();
            range.selectNodeContents(textEditorContent);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
          } catch (e) {}
        }, 50);

        // Update char count
        updateCharCount();
        showCallout('Editing source text', 'EDIT');
      }

      function closeTextEditor() {
        if (textEditor) textEditor.style.display = 'none';
        textEditorVisible = false;
        textEditTarget = null;
        textEditTargetFile = null;
        textEditTargetLine = null;
        textEditTargetComponent = null;
        textEditOriginalText = '';
      }

      async function applyTextEdit() {
        if (!textEditTarget || !textEditorContent) return;
        const newText = (textEditorContent.textContent || textEditorContent.innerText || '').trim();
        const originalText = textEditOriginalText;
        const newHTML = textEditorContent.innerHTML;

        const applyBtn = shadow.getElementById('cp-text-apply');

        // If source file is known and text actually changed, write directly to source code!
        if (textEditTargetFile && originalText && newText !== originalText) {
          if (applyBtn) {
            applyBtn.textContent = 'Saving...';
            applyBtn.disabled = true;
          }
          try {
            const res = await fetch(BRIDGE + '/api/edit-source', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file: textEditTargetFile,
                component: textEditTargetComponent,
                originalText: originalText,
                newText: newText,
                line: textEditTargetLine,
              }),
            });
            const data = await res.json();
            if (applyBtn) {
              applyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save to Code';
              applyBtn.disabled = false;
            }
            if (data.success) {
              const fileBase = textEditTargetFile.split('/').pop();
              showCallout('Saved to ' + fileBase + ' (HMR reloaded)', 'SOURCE');
              textEditTarget.textContent = newText;
              closeTextEditor();
              return;
            } else {
              console.warn('[agent-hover] Source edit fallback:', data.error);
              showCallout('AST: text literal not found — applied to DOM', 'WARNING');
            }
          } catch (e) {
            if (applyBtn) {
              applyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save to Code';
              applyBtn.disabled = false;
            }
            console.error('[agent-hover] Error calling /api/edit-source:', e);
            showCallout('Server error — applied to DOM', 'WARNING');
          }
        }

        // Fallback to DOM update (ephemeral / dynamic expression)
        textEditTarget.innerHTML = newHTML;
        textEdits.set(textEditTarget, { originalHTML: textEditOriginalHTML, currentHTML: newHTML });
        updateEditedIndicators();
        saveTextEditsToSession();
        showCallout('DOM updated', 'EDIT');
        closeTextEditor();
      }

      async function revertTextEdit() {
        if (!textEditTarget) return;
        const revertBtn = shadow.getElementById('cp-text-revert');
        if (revertBtn) revertBtn.disabled = true;

        try {
          const res = await fetch(BRIDGE + '/api/source-undo', { method: 'POST' });
          const data = await res.json();
          if (revertBtn) revertBtn.disabled = false;
          if (data.success) {
            showCallout((data.description || 'Source change reverted'), 'UNDO');
            closeTextEditor();
            return;
          }
        } catch (e) {
          if (revertBtn) revertBtn.disabled = false;
        }

        // Fallback DOM revert
        textEditTarget.innerHTML = textEditOriginalHTML;
        textEdits.delete(textEditTarget);
        textEditTarget.removeAttribute('data-ah-edited');
        updateEditedIndicators();
        saveTextEditsToSession();
        showCallout('Text reverted', 'UNDO');
        closeTextEditor();
      }

      function updateCharCount() {
        if (!textCharCount || !textEditorContent) return;
        const len = textEditorContent.textContent ? textEditorContent.textContent.length : 0;
        textCharCount.textContent = len + ' chars';
      }

      // --- sessionStorage persistence for text edits ---
      function buildCSSSelector(el) {
        if (!el || el === document.body || el === document.documentElement) return '';
        const parts = [];
        let curr = el;
        while (curr && curr !== document.body && parts.length < 6) {
          let sel = curr.tagName.toLowerCase();
          if (curr.id) {
            sel += '#' + curr.id;
            parts.unshift(sel);
            break; // ID is unique enough
          }
          if (curr.parentElement) {
            const siblings = Array.from(curr.parentElement.children).filter(function(c) { return c.tagName === curr.tagName; });
            if (siblings.length > 1) {
              const idx = siblings.indexOf(curr) + 1;
              sel += ':nth-of-type(' + idx + ')';
            }
          }
          parts.unshift(sel);
          curr = curr.parentElement;
        }
        return parts.join(' > ');
      }

      function saveTextEditsToSession() {
        try {
          const data = [];
          textEdits.forEach(function(val, el) {
            const selector = buildCSSSelector(el);
            if (selector) {
              data.push({ selector: selector, originalHTML: val.originalHTML, currentHTML: val.currentHTML });
            }
          });
          sessionStorage.setItem('agent-hover-text-edits', JSON.stringify(data));
        } catch(e) { }
      }

      function restoreTextEditsFromSession() {
        try {
          const raw = sessionStorage.getItem('agent-hover-text-edits');
          if (!raw) return;
          const data = JSON.parse(raw);
          if (!Array.isArray(data)) return;
          data.forEach(function(item) {
            try {
              const el = document.querySelector(item.selector);
              if (el && el.innerHTML !== item.currentHTML) {
                el.innerHTML = item.currentHTML;
                textEdits.set(el, { originalHTML: item.originalHTML, currentHTML: item.currentHTML });
              }
            } catch(e) { }
          });
          if (textEdits.size > 0) {
            updateEditedIndicators();
            console.log('[agent-hover] Restored ' + textEdits.size + ' text edit(s) from session');
          }
        } catch(e) { }
      }

      // Restore edits after a short delay (let React render first)
      setTimeout(restoreTextEditsFromSession, 800);

      // --- Text Editor Event Handlers ---
      // Apply button
      shadow.getElementById('cp-text-apply').onclick = applyTextEdit;

      // Revert button
      shadow.getElementById('cp-text-revert').onclick = revertTextEdit;

      // Close button
      shadow.getElementById('cp-text-editor-close').onclick = closeTextEditor;

      // Toolbar buttons (bold, italic, underline)
      shadow.querySelectorAll('.cp-text-tb-btn').forEach(function(btn) {
        btn.onclick = function(e) {
          e.preventDefault();
          const cmd = btn.getAttribute('data-cmd');
          if (cmd && textEditorContent) {
            // Need to refocus the contenteditable before executing command
            textEditorContent.focus();
            document.execCommand(cmd, false, null);
          }
        };
      });

      // Update char count on input and keyboard shortcuts (Cmd+Enter to commit, Esc to close)
      if (textEditorContent) {
        textEditorContent.addEventListener('input', updateCharCount);
        textEditorContent.addEventListener('keydown', function(e) {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            applyTextEdit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            closeTextEditor();
          }
        });
      }

      // Double-click handler for text editing
      window.addEventListener('dblclick', function(e) {
        if (!isPointerMode) return;
        if (e.target && e.target.closest && e.target.closest('#agent-hover-root')) return;

        e.preventDefault();
        e.stopPropagation();

        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;
        if (el.closest && el.closest('#agent-hover-root')) return;
        if (isFormElement(el)) return;
        if (!isLeafTextElement(el)) {
          showCallout('Element has complex children — select a text element', 'TIP');
          return;
        }

        openTextEditor(el);
      }, true);

      // Close text editor on Escape (handled in keydown handler below)
      // Close text editor on click outside
      window.addEventListener('mousedown', function(e) {
        if (!textEditorVisible) return;
        // Check if click is inside the text editor (Shadow DOM)
        const path = e.composedPath ? e.composedPath() : [];
        let insideEditor = false;
        for (let i = 0; i < path.length; i++) {
          if (path[i] === textEditor) { insideEditor = true; break; }
        }
        if (!insideEditor) {
          closeTextEditor();
        }
      }, true);

      // Update highlight box to match a specific item in currentStack
      function highlightComponent(info, useUnionRect) {
        if (!info) return;
        currentComponentInfo = info;
        let rect = null;

        if (info.isDomElement && info.element) {
          rect = info.element.getBoundingClientRect();
          highlight.classList.add('is-raw');
        } else if (useUnionRect && info.fiber) {
          rect = getComponentBoundingRect(info.fiber);
          highlight.classList.remove('is-raw');
        } else if (currentElement) {
          rect = currentElement.getBoundingClientRect();
          highlight.classList.remove('is-raw');
        }

        if (!rect || (rect.width === 0 && rect.height === 0)) {
          highlight.style.display = 'none';
          hideBands();
          return;
        }

        highlight.style.display = 'block';
        highlight.style.top = rect.top + 'px';
        highlight.style.left = rect.left + 'px';
        highlight.style.width = rect.width + 'px';
        highlight.style.height = rect.height + 'px';

        const isFrozen = frozenEntries.some(f => (info.source && f.file === info.source.fileName) || f.component === info.name);
        const frameColor = isFrozen ? '#f43f5e' : (info.isDomElement ? '#38bdf8' : '#0ea5e9');
        highlight.style.border = '1.5px solid ' + frameColor;
        highlight.style.background = 'transparent';
        highlight.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.12)';

        // Position single-line chip cleanly above the frame, or inside if too close to viewport top
        if (rect.top < 26) {
          label.style.top = '2px';
          label.style.left = '2px';
          label.style.borderRadius = '3px';
        } else {
          label.style.top = '-23px';
          label.style.left = '-1px';
          label.style.borderRadius = '4px';
        }

        const lockHtml = isFrozen ? '<span style="color:#fb7185; margin-right:4px;">' + ICONS.lock + '</span>' : '';
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        const dimSpan = '<span style="color:var(--text-muted); font-size:9.5px; margin-left:4px; font-weight:normal;">' + w + ' × ' + h + '</span>';

        if (info.isDomElement) {
          label.innerHTML = lockHtml + '<span style="color:#38bdf8;">' + info.name + '</span>' + dimSpan;
          label.style.borderColor = '#38bdf8';
        } else {
          label.innerHTML = lockHtml + '<span style="color:#0ea5e9;">&lt;' + info.name + ' /&gt;</span>' + dimSpan;
          label.style.borderColor = isFrozen ? '#f43f5e' : '#0ea5e9';
        }

        if (showSpacingOverlay && (info.element || currentElement)) {
          positionBands(info.element || currentElement);
        } else {
          hideBands();
        }
      }

      // --- Keyboard Shortcuts ---
      window.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

        if (e.key === 'Alt') {
          if (isTyping) return;
          e.preventDefault();
          togglePointerMode();
          return;
        }

        if (e.key === 'Escape') {
          if (textEditorVisible) {
            closeTextEditor();
            return;
          }
          if (isTyping && activeEl && activeEl.blur) {
            activeEl.blur();
            return;
          }
          flyout.classList.remove('open');
          dockWrapper.classList.remove('sidebar-open');
          if (typeof clearSelection === 'function') clearSelection();
          return;
        }

        if (isTyping) return;

        // Ancestry navigation: ArrowUp goes to parent, ArrowDown goes to child
        if ((isPointerMode || flyout.classList.contains('open')) && currentStack && currentStack.length > 1) {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentStackIndex < currentStack.length - 1) {
              currentStackIndex++;
              if (flyout.classList.contains('open')) {
                renderFlyoutForStackIndex(currentStackIndex);
              } else {
                highlightComponent(currentStack[currentStackIndex], true);
              }
            }
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentStackIndex > 0) {
              currentStackIndex--;
              if (flyout.classList.contains('open')) {
                renderFlyoutForStackIndex(currentStackIndex);
              } else {
                highlightComponent(currentStack[currentStackIndex], currentStackIndex > 0);
              }
            }
          }
        }
      });

      // --- Hover Highlight (RAF-throttled, Universal Selection) ---
      let hoverRafPending = false;
      window.addEventListener('mousemove', (e) => {
        if (!isPointerMode || hoverRafPending) return;
        hoverRafPending = true;
        requestAnimationFrame(() => {
          hoverRafPending = false;

          // Check if cursor is over Agent Hover UI
          const path = e.composedPath ? e.composedPath() : [];
          const isOverHoverUi = path.some(node => node === container || (node.id === 'agent-hover-root') || (node.classList && node.classList.contains && node.classList.contains('agent-hover-panel')));
          if (isOverHoverUi || (e.target && e.target.closest && e.target.closest('#agent-hover-root'))) {
            highlight.style.display = 'none';
            hideBands();
            return;
          }

          const el = document.elementFromPoint(e.clientX, e.clientY);
          if (!el || (el.closest && el.closest('#agent-hover-root'))) {
            highlight.style.display = 'none';
            hideBands();
            return;
          }
          if (el === currentElement) return;
          currentElement = el;

          // Build full hierarchy stack (Level 0 = DOM element, Level 1..N = React components)
          currentStack = buildHierarchyStack(el);
          currentStackIndex = 0; // Default to exact element under cursor!

          // If a selection is active, show measurement guides between selected and hovered
          if (selectedRect) {
            const hoveredRect = el.getBoundingClientRect();
            renderDistanceGuides(selectedRect, hoveredRect);
          } else {
            clearDistanceGuides();
          }

          // If hovering over the selected element, hide the hover preview so borders don't double
          if (selectedTarget && ((selectedTarget.element && selectedTarget.element === el) || (selectedElement && selectedElement === el))) {
            highlight.style.display = 'none';
            hideBands();
          } else {
            highlightComponent(currentStack[0], false);
          }
        });
      });

      // Reposition highlight on scroll/resize
      function repositionHighlight() {
        if (typeof updateSelectionFrame === 'function') updateSelectionFrame();
        if (!currentComponentInfo || highlight.style.display === 'none') return;
        const target = currentStack[currentStackIndex] || currentComponentInfo;

        if (target.isDomElement && target.element) {
          const rect = target.element.getBoundingClientRect();
          highlight.style.top = rect.top + 'px';
          highlight.style.left = rect.left + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';
          if (showSpacingOverlay) positionBands(target.element);
        } else if (target.fiber) {
          const rect = getComponentBoundingRect(target.fiber);
          if (rect) {
            highlight.style.top = rect.top + 'px';
            highlight.style.left = rect.left + 'px';
            highlight.style.width = rect.width + 'px';
            highlight.style.height = rect.height + 'px';
            if (showSpacingOverlay && currentElement) positionBands(currentElement);
          }
        }
      }
      window.addEventListener('scroll', repositionHighlight, { capture: true, passive: true });
      window.addEventListener('resize', repositionHighlight);

      function extractComputedStyles(el) {
        const s = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          width: s.width, height: s.height, padding: s.padding, margin: s.margin, border: s.border,
          display: s.display, position: s.position, flexDirection: s.flexDirection,
          alignItems: s.alignItems, justifyContent: s.justifyContent, gridTemplateColumns: s.gridTemplateColumns,
          gap: s.gap, zIndex: s.zIndex, overflow: s.overflow, opacity: s.opacity, visibility: s.visibility,
          fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color, backgroundColor: s.backgroundColor,
          boundingBox: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        };
      }

      async function captureElement(element) {
        if (!window.domtoimage) {
          console.error('[agent-hover] dom-to-image-more not loaded');
          return null;
        }
        // Requirement 4: Completely hide Agent Hover UI (dock, sidebar, overlays, markers) so only website UI is captured
        const rootContainer = shadow.host || container;
        const prevDisplay = rootContainer.style.display;
        rootContainer.style.display = 'none';

        try {
          if (element.scrollIntoView) {
            element.scrollIntoView({ block: 'center', behavior: 'instant' });
          }
          await new Promise(r => setTimeout(r, 120));
          const isFullPage = element === document.body || element === document.documentElement;
          const captureWidth = isFullPage ? window.innerWidth : (element.offsetWidth || element.clientWidth);
          const captureHeight = isFullPage ? window.innerHeight : (element.offsetHeight || element.clientHeight);

          const dataUrl = await window.domtoimage.toPng(element, {
            width: captureWidth,
            height: captureHeight,
            style: { transform: 'none', animation: 'none' },
            filter: (node) => {
              if (node && node.id === 'agent-hover-root') return false;
              if (node && node.classList && node.classList.contains && node.classList.contains('agent-hover-ignore')) return false;
              return true;
            }
          });
          return dataUrl;
        } catch (err) {
          console.error('[agent-hover] Screenshot capture failed:', err);
          return null;
        } finally {
          rootContainer.style.display = prevDisplay || 'block';
        }
      }

      async function downloadCleanScreenshot(targetEl, name) {
        showCallout('Capturing clean screenshot...', 'SNAP', 800);
        const el = targetEl || document.body;
        const dataUrl = await captureElement(el);
        if (!dataUrl) {
          showCallout('Failed to capture screenshot', 'ERROR');
          return;
        }
        const a = document.createElement('a');
        const cleanName = (name || 'screenshot').replace(/[^a-zA-Z0-9_-]/g, '_');
        a.href = dataUrl;
        a.download = cleanName + '_' + Date.now() + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showCallout('Clean screenshot saved (Website UI only)', 'SAVED');
      }

      function findComponentElement(componentName) {
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          if (el.id === 'agent-hover-root') continue;
          const info = getComponentInfo(el);
          if (info && info.name === componentName) return el;
        }
        return null;
      }

      // --- Click to Inspect ---
      window.addEventListener('click', async (e) => {
        if (!isPointerMode) return;
        const path = e.composedPath ? e.composedPath() : [];
        const isOverHoverUi = path.some(node => node === container || (node.id === 'agent-hover-root') || (node.classList && node.classList.contains && node.classList.contains('agent-hover-panel')));
        if (isOverHoverUi || (e.target && e.target.closest && e.target.closest('#agent-hover-root'))) return;
        
        e.preventDefault();
        e.stopPropagation();

        const clickedEl = document.elementFromPoint(e.clientX, e.clientY) || e.target;
        if (clickedEl && clickedEl !== document.body && clickedEl !== container && (!clickedEl.closest || !clickedEl.closest('#agent-hover-root'))) {
          currentStack = buildHierarchyStack(clickedEl);
          currentStackIndex = 0;
          currentElement = clickedEl;
        }
        if (!currentStack || currentStack.length === 0) return;

        // Select exact leaf element clicked (index 0) so smaller elements and components are directly selectable
        const targetIndex = 0;
        const target = currentStack[targetIndex] || currentStack[0];

        // Raw elements can't be frozen/pinned
        if (!target.isDomElement) {
          if (e.ctrlKey || e.metaKey) {
            const resolved = await resolveComponent(target);
            if (resolved) {
              const isCurrentlyFrozen = frozenEntries.some(f => f.file === resolved.file && f.component === target.name);
              await fetch(BRIDGE + '/api/freeze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: isCurrentlyFrozen ? 'remove' : 'add', file: resolved.file, component: target.name, line: resolved.line })
              });
              showCallout(isCurrentlyFrozen ? 'Unfrozen ' + target.name : 'Frozen ' + target.name, 'LOCK');
              refreshState();
            }
            return;
          }

          if (e.shiftKey) {
            const resolved = await resolveComponent(target);
            if (resolved) {
              await fetch(BRIDGE + '/api/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', file: resolved.file, line: resolved.line })
              });
              showCallout('Pinned ' + target.name, 'PIN');
              refreshState();
            }
            return;
          }
        }

        await renderFlyoutForStackIndex(targetIndex);
      }, true);

      async function renderFlyoutForStackIndex(index) {
        if (!currentStack || currentStack.length === 0) return;
        currentStackIndex = index;
        const item = currentStack[index];
        currentComponentInfo = item;

        // Lock persistent selection frame on the selected element/component
        selectedTarget = item;
        selectedElement = item.element || currentElement;
        updateSelectionFrame();

        // Update selection chip text
        if (selName) {
          selName.textContent = item.isDomElement ? item.name : '<' + item.name + ' />';
        }
        if (selFile) {
          if (item.source) {
            const shortFile = item.source.fileName.split('/').slice(-2).join('/');
            selFile.textContent = shortFile + ':' + item.source.lineNumber;
          } else if (currentStack.length > 1 && currentStack[1].source) {
            const shortFile = currentStack[1].source.fileName.split('/').slice(-2).join('/');
            selFile.textContent = shortFile + ':' + currentStack[1].source.lineNumber;
          } else {
            selFile.textContent = '';
          }
        }

        // Hide hover highlight because selection frame is now displayed
        highlight.style.display = 'none';

        // Store the selected element's rect for measurement guides
        if (item.isDomElement && item.element) {
          selectedRect = item.element.getBoundingClientRect();
        } else if (item.fiber) {
          selectedRect = getComponentBoundingRect(item.fiber);
        } else if (currentElement) {
          selectedRect = currentElement.getBoundingClientRect();
        }
        clearDistanceGuides();

        flyout.classList.add('open');
        if (flyout.classList.contains('is-sidebar')) {
          dockWrapper.classList.add('sidebar-open');
        }

        // Render interactive breadcrumbs with proper HTML escaping
        const breadcrumbEl = shadow.getElementById('cp-flyout-breadcrumb');
        if (currentStack && currentStack.length > 0) {
          const crumbs = [];
          for (let i = currentStack.length - 1; i >= 0; i--) {
            const c = currentStack[i];
            const isActive = i === currentStackIndex;
            const style = isActive
              ? 'color:#ffffff; font-weight:600; cursor:pointer; padding:2px 8px; border-radius:4px; background:#2c2c2c; border:1px solid #444444; white-space:nowrap;'
              : 'color:var(--text-muted); cursor:pointer; padding:2px 6px; border-radius:4px; white-space:nowrap;';
            const label = c.isDomElement ? c.name : '<' + c.name + ' />';
            crumbs.push('<span style="' + style + '" data-bc-idx="' + i + '" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>');
          }
          breadcrumbEl.innerHTML = crumbs.join('<span style="color:var(--text-muted); margin:0 2px; font-size:10px;">›</span>');
          breadcrumbEl.style.display = 'flex';
          breadcrumbEl.style.alignItems = 'center';
          breadcrumbEl.style.overflowX = 'auto';

          breadcrumbEl.onclick = (evt) => {
            const targetEl = evt.target.closest('[data-bc-idx]');
            if (!targetEl) return;
            const idx = parseInt(targetEl.getAttribute('data-bc-idx'), 10);
            if (isNaN(idx) || idx < 0 || idx >= currentStack.length) return;
            renderFlyoutForStackIndex(idx);
          };
        } else {
          breadcrumbEl.style.display = 'none';
        }

        const computedStyles = currentElement ? extractComputedStyles(currentElement) : {};
        if (inSettingsView) toggleSettingsView(false);

        if (item.isDomElement) {
          flyoutTitle.textContent = item.name;
          const el = item.element;
          let html = '';

          html += '<div class="cp-section" style="margin-bottom:14px;">';
          html += '<span class="cp-badge cp-badge-accent">' + el.tagName.toLowerCase() + '</span> ';
          if (el.id) html += '<span class="cp-badge cp-badge-emerald">#' + el.id + '</span> ';
          if (el.className && typeof el.className === 'string') {
            const cls = el.className.trim().split(/\s+/).slice(0, 6);
            if (cls.length && cls[0]) {
              cls.forEach(function(c) {
                html += '<span class="cp-badge cp-badge-muted">.' + c + '</span> ';
              });
            }
          }
          html += '</div>';

          // If inside a React component, link to the parent component
          if (currentStack.length > 1) {
            const parentComp = currentStack[1];
            html += '<div class="cp-section" id="cp-parent-comp-card" style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); border-radius:8px; padding:10px 14px; margin-bottom:14px; cursor:pointer;" title="Click to view component">';
            html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
            html += '<span style="font-size:10.5px; color:var(--text-muted); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.5px;">Rendered In Component</span>';
            html += '<span style="font-size:10.5px; color:var(--text-secondary); font-weight:600;">Inspect Component ›</span>';
            html += '</div>';
            html += '<div style="font-size:13.5px; font-weight:700; color:var(--text-primary); margin-top:3px;">&lt;' + parentComp.name + ' /&gt;</div>';
            if (parentComp.source) {
              html += '<div style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted); margin-top:3px;">' + parentComp.source.fileName + ':' + parentComp.source.lineNumber + '</div>';
              lastResolved = { file: parentComp.source.fileName, line: parentComp.source.lineNumber };
            }
            html += '</div>';
          }

          // Text content preview (leaf or concise direct text only, avoid whole-page dump)
          let text = '';
          if (el.children.length === 0) {
            text = el.textContent ? el.textContent.trim() : '';
          } else {
            let directText = '';
            for (let i = 0; i < el.childNodes.length; i++) {
              if (el.childNodes[i].nodeType === 3) {
                directText += el.childNodes[i].textContent.trim() + ' ';
              }
            }
            text = directText.trim();
          }
          if (text) {
            if (text.length > 150) text = text.slice(0, 150) + '...';
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Text Content</summary>';
            html += '<div style="margin-top:6px; font-size:12px; color:var(--text-secondary); word-break:break-word; max-height:100px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:8px 10px; border-radius:6px; font-family:var(--font-mono);">' + escapeHtml(text) + '</div>';
            html += '</details>';
          } else if (el.children.length > 0) {
            html += '<div style="margin-bottom:12px; font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">' + el.children.length + ' child element' + (el.children.length > 1 ? 's' : '') + '</div>';
          }

          // Attributes
          const attrs = Array.from(el.attributes || []).filter(a => a.name !== 'class' && a.name !== 'id' && a.name !== 'style');
          if (attrs.length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Attributes (' + attrs.length + ')</summary>';
            html += '<table class="cp-props-table"><tr><th>Name</th><th>Value</th></tr>';
            attrs.forEach(function(a) {
              const val = a.value.length > 60 ? a.value.substring(0, 60) + '...' : a.value;
              html += '<tr><td style="color:var(--text-primary); font-weight:500;">' + a.name + '</td><td style="color:var(--text-secondary);">' + escapeHtml(val) + '</td></tr>';
            });
            html += '</table></details>';
          }

          // Compact visual layout metrics
          if (computedStyles && Object.keys(computedStyles).length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Layout & Dimensions</summary>';
            html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; font-family:var(--font-mono); background:var(--bg-surface-sunken); padding:10px; border-radius:8px; border:1px solid var(--border-subtle);">';
            html += '<div><span style="color:var(--text-muted);">size:</span> <strong style="color:var(--text-primary);">' + Math.round(parseFloat(computedStyles.width)) + ' × ' + Math.round(parseFloat(computedStyles.height)) + '</strong></div>';
            html += '<div><span style="color:var(--text-muted);">display:</span> ' + computedStyles.display + '</div>';
            html += '<div><span style="color:var(--text-muted);">padding:</span> ' + computedStyles.padding + '</div>';
            html += '<div><span style="color:var(--text-muted);">margin:</span> ' + computedStyles.margin + '</div>';
            if (computedStyles.display && computedStyles.display.includes('flex')) {
              html += '<div><span style="color:var(--text-muted);">flex-dir:</span> ' + computedStyles.flexDirection + '</div>';
              html += '<div><span style="color:var(--text-muted);">gap:</span> ' + computedStyles.gap + '</div>';
            }
            if (computedStyles.color) {
              html += '<div style="display:flex; align-items:center; gap:4px;"><span style="color:var(--text-muted);">color:</span> <span style="width:9px; height:9px; border-radius:2px; background:' + computedStyles.color + '; border:1px solid rgba(255,255,255,0.2);"></span>' + computedStyles.color + '</div>';
            }
            if (computedStyles.backgroundColor && computedStyles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
              html += '<div style="display:flex; align-items:center; gap:4px;"><span style="color:var(--text-muted);">bg:</span> <span style="width:9px; height:9px; border-radius:2px; background:' + computedStyles.backgroundColor + '; border:1px solid rgba(255,255,255,0.2);"></span>' + computedStyles.backgroundColor + '</div>';
            }
            html += '</div></details>';
          }

          flyoutContent.innerHTML = html;

          const parentCard = shadow.getElementById('cp-parent-comp-card');
          if (parentCard) {
            parentCard.onclick = () => renderFlyoutForStackIndex(1);
          }

          // Fetch parent component context in background so tokens and copy context are ready!
          if (currentStack.length > 1) {
            resolveComponent(currentStack[1]).then(async (resolved) => {
              if (resolved) {
                lastResolved = resolved;
                try {
                  const level = shadow.getElementById('cp-context-level')?.value || 'standard';
                  const res = await fetch(BRIDGE + '/api/context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file: resolved.file, line: resolved.line, level })
                  });
                  const ctx = await res.json();
                  lastCopiedContext = ctx;
                  const tokenCountEl = shadow.getElementById('cp-token-count');
                  const tokenSavingsEl = shadow.getElementById('cp-token-savings');
                  if (tokenCountEl && ctx.tokens) {
                    tokenCountEl.textContent = ctx.tokens.current || 0;
                  }
                  if (tokenSavingsEl && ctx.tokens) {
                    const fullTokens = ctx.tokens.full || 0;
                    const curTokens = ctx.tokens.current || 0;
                    if (fullTokens > curTokens && fullTokens > 0) {
                      const saved = Math.round((1 - curTokens / fullTokens) * 100);
                      tokenSavingsEl.textContent = saved + '% smaller than full';
                    } else {
                      tokenSavingsEl.textContent = 'prompt-ready';
                    }
                  }
                } catch(e) {}
              }
            });
          }
        } else {
          // React Component
          flyoutTitle.textContent = item.name;
          flyoutContent.innerHTML = '<p style="color:var(--text-secondary);">Loading context...</p>';
          try {
            const resolved = await resolveComponent(item);
            if (!resolved) {
              flyoutContent.innerHTML = '<p style="color:#fb7185;">Could not find source file for ' + item.name + '</p>';
              return;
            }
            fetch(BRIDGE + '/api/computed-styles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: resolved.file + ':' + item.name, styles: computedStyles })
            }).catch(e => console.error(e));

            await loadComponentContext(item.name, resolved, computedStyles);
          } catch(err) {
            flyoutContent.innerHTML = '<p style="color:#fb7185;">Failed to load context: ' + err.message + '</p>';
          }
        }
      }

      async function loadComponentContext(infoName, resolved, computedStyles) {
        flyoutContent.innerHTML = '<p style="color:var(--text-secondary);">Loading context...</p>';
        try {
          const level = shadow.getElementById('cp-context-level')?.value || 'standard';
          const res = await fetch(BRIDGE + '/api/context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: resolved.file, line: resolved.line, level })
          });
          const ctx = await res.json();
          lastCopiedContext = ctx;
          lastResolved = resolved;
          lastInfoName = infoName;
          lastComputedStyles = computedStyles;

          // Update Live Token Meter
          const tokenCountEl = shadow.getElementById('cp-token-count');
          const tokenSavingsEl = shadow.getElementById('cp-token-savings');
          if (tokenCountEl && ctx.tokens) {
            tokenCountEl.textContent = ctx.tokens.current || 0;
          }
          if (tokenSavingsEl && ctx.tokens) {
            const fullTokens = ctx.tokens.full || 0;
            const curTokens = ctx.tokens.current || 0;
            if (fullTokens > curTokens && fullTokens > 0) {
              const saved = Math.round((1 - curTokens / fullTokens) * 100);
              tokenSavingsEl.textContent = saved + '% smaller than full';
            } else {
              tokenSavingsEl.textContent = 'prompt-ready';
            }
          }

          let html = '';

          html += '<div class="cp-section" style="margin-bottom:14px;">';
          html += '<span class="cp-badge cp-badge-accent">' + ctx.component.type + '</span> ';
          html += '<span class="cp-badge cp-badge-emerald">' + ctx.component.exportType + ' export</span> ';
          html += '<span class="cp-badge cp-badge-muted">' + ctx.tokens.current + ' tokens</span>';
          html += '<div style="margin-top:8px; font-size:12px; font-family:var(--font-mono); color:var(--text-muted);">' + ctx.source.file + ':' + ctx.source.startLine + '-' + ctx.source.endLine + '</div>';
          html += '</div>';

          if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Props (' + ctx.interface.props.length + ')</summary>';
            html += '<table class="cp-props-table"><tr><th>Name</th><th>Type</th><th>Req</th></tr>';
            ctx.interface.props.forEach(function(p) {
              html += '<tr><td style="color:var(--text-primary); font-weight:500;">' + p.name + '</td><td style="color:var(--text-secondary);">' + p.type + '</td><td style="color:var(--accent-emerald);">' + (p.required ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '—') + '</td></tr>';
            });
            html += '</table></details>';
          }

          if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Hooks</summary>';
            html += '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary); margin-top:6px;">' + ctx.interface.hooks.join(', ') + '</div>';
            html += '</details>';
          }

          if (ctx.imports && ctx.imports.length > 0) {
            html += '<details class="cp-section">';
            html += '<summary class="cp-section-title">Imports (' + ctx.imports.length + ')</summary>';
            html += '<div style="margin-top:8px;">';
            ctx.imports.forEach(function(imp) {
              const badge = imp.isLocal ? '<span class="cp-badge cp-badge-emerald" style="font-size:9px; padding:2px 5px;">LOCAL</span>' : '<span class="cp-badge cp-badge-muted" style="font-size:9px; padding:2px 5px;">PKG</span>';
              html += '<div style="padding:4px 0; display:flex; align-items:center; gap:8px;">' + badge + ' <span style="font-family:var(--font-mono); font-size:11.5px;">' + imp.name + '</span></div>';
            });
            html += '</div></details>';
          }

          if (computedStyles && Object.keys(computedStyles).length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Computed Box Model</summary>';
            html += '<div class="cp-box-model">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">margin: ' + computedStyles.margin + '</div>';
            html += '<div style="border:1px dashed #475569; padding:8px; margin:4px; display:inline-block; border-radius:6px;">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">border: ' + computedStyles.border + '</div>';
            html += '<div style="border:1px solid var(--border-glass); padding:8px; margin:4px; display:inline-block; background:rgba(255,255,255,0.03); border-radius:4px;">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">padding: ' + computedStyles.padding + '</div>';
            html += '<div style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); padding:8px 12px; display:inline-block; color:var(--text-primary); border-radius:4px; font-weight:600;">';
            html += Math.round(parseFloat(computedStyles.width)) + ' × ' + Math.round(parseFloat(computedStyles.height));
            html += '</div></div></div></div>';
            
            html += '<div style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; font-family:var(--font-mono);">';
            html += '<div><span style="color:var(--text-muted);">display:</span> ' + computedStyles.display + '</div>';
            html += '<div><span style="color:var(--text-muted);">position:</span> ' + computedStyles.position + '</div>';
            if (computedStyles.display && computedStyles.display.includes('flex')) {
              html += '<div><span style="color:var(--text-muted);">flex-dir:</span> ' + computedStyles.flexDirection + '</div>';
              html += '<div><span style="color:var(--text-muted);">gap:</span> ' + computedStyles.gap + '</div>';
            }
            html += '<div><span style="color:var(--text-muted);">color:</span> <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + computedStyles.color + '; margin-right:4px;"></span>' + computedStyles.color + '</div>';
            html += '</div>';
            html += '</details>';
          }

          if (ctx.source && ctx.source.code) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title" style="display:flex; justify-content:space-between; align-items:center;">';
            html += '<span>Component Source</span>';
            html += '<button class="cp-btn-bento" id="cp-toggle-source-editor" style="font-size:10.5px; padding:2px 8px; border-radius:4px; margin-left:auto; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Source</button>';
            html += '</summary>';
            html += '<div id="cp-source-preview-box">';
            html += '<div class="cp-code" id="cp-source-code-display">' + escapeHtml(ctx.source.code) + '</div>';
            html += '</div>';
            html += '<div id="cp-source-editor-box" style="display:none; margin-top:8px;">';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:11px; font-family:var(--font-mono); color:var(--text-muted);">';
            html += '<span>' + ctx.source.file.split('/').pop() + ' (L' + ctx.source.startLine + '-L' + ctx.source.endLine + ')</span>';
            html += '<span style="color:var(--text-secondary); font-weight:500;">Direct Disk Edit</span>';
            html += '</div>';
            html += '<textarea id="cp-source-code-editor" spellcheck="false"></textarea>';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:8px;">';
            html += '<div style="display:flex; gap:6px;">';
            html += '<button class="cp-btn-bento primary" id="cp-source-save-btn" style="padding:5px 12px; font-size:11px; display:inline-flex; align-items:center; gap:5px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">Cmd+S</kbd></button>';
            html += '<button class="cp-btn-bento" id="cp-source-undo-btn" style="padding:5px 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Undo</button>';
            html += '</div>';
            html += '<button class="cp-btn-bento" id="cp-source-cancel-btn" style="padding:5px 8px; font-size:11px;">Close</button>';
            html += '</div>';
            html += '<div id="cp-source-save-status" style="font-size:11px; font-family:var(--font-mono); margin-top:6px; min-height:16px;"></div>';
            html += '</div>';
            html += '</details>';
          }

          flyoutContent.innerHTML = html;

          // Wire up in-flyout Component Source Editor
          const toggleEditorBtn = shadow.getElementById('cp-toggle-source-editor');
          const previewBox = shadow.getElementById('cp-source-preview-box');
          const editorBox = shadow.getElementById('cp-source-editor-box');
          const codeTextarea = shadow.getElementById('cp-source-code-editor');
          const saveSourceBtn = shadow.getElementById('cp-source-save-btn');
          const undoSourceBtn = shadow.getElementById('cp-source-undo-btn');
          const cancelSourceBtn = shadow.getElementById('cp-source-cancel-btn');
          const saveStatus = shadow.getElementById('cp-source-save-status');

          if (toggleEditorBtn && previewBox && editorBox && codeTextarea) {
            toggleEditorBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const isEditing = editorBox.style.display !== 'none';
              if (isEditing) {
                editorBox.style.display = 'none';
                previewBox.style.display = 'block';
                toggleEditorBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Source';
              } else {
                codeTextarea.value = ctx.source.code;
                editorBox.style.display = 'block';
                previewBox.style.display = 'none';
                toggleEditorBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview';
                if (saveStatus) saveStatus.textContent = '';
                setTimeout(() => codeTextarea.focus(), 50);
              }
            };

            if (cancelSourceBtn) {
              cancelSourceBtn.onclick = (e) => {
                e.preventDefault();
                editorBox.style.display = 'none';
                previewBox.style.display = 'block';
                toggleEditorBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Source';
              };
            }

            const handleSaveSource = async () => {
              if (!saveSourceBtn || saveSourceBtn.disabled) return;
              const newSource = codeTextarea.value;
              saveSourceBtn.disabled = true;
              saveSourceBtn.innerHTML = 'Saving...';
              if (saveStatus) {
                saveStatus.style.color = 'var(--text-primary)';
                saveStatus.textContent = 'Writing to disk & compiling...';
              }

              try {
                const res = await fetch(BRIDGE + '/api/save-source', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    file: ctx.source.file,
                    component: infoName,
                    newSource: newSource,
                    startLine: ctx.source.startLine,
                    endLine: ctx.source.endLine,
                  }),
                });
                const data = await res.json();
                saveSourceBtn.disabled = false;
                saveSourceBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">Cmd+S</kbd>';

                if (data.success) {
                  ctx.source.code = newSource;
                  const displayEl = shadow.getElementById('cp-source-code-display');
                  if (displayEl) displayEl.textContent = newSource;
                  if (saveStatus) {
                    saveStatus.style.color = '#34d399';
                    saveStatus.textContent = 'Saved to disk & HMR reloaded!';
                  }
                  showCallout(infoName + ' saved to disk — HMR reloaded', 'SOURCE');
                } else {
                  if (saveStatus) {
                    saveStatus.style.color = '#fb7185';
                    saveStatus.textContent = 'Syntax error: ' + (data.error || 'Failed to save');
                  }
                  showCallout('Save failed: ' + (data.error || 'Syntax error'), 'WARNING');
                }
              } catch (err) {
                saveSourceBtn.disabled = false;
                saveSourceBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">Cmd+S</kbd>';
                if (saveStatus) {
                  saveStatus.style.color = '#fb7185';
                  saveStatus.textContent = 'Error: ' + err.message;
                }
              }
            };

            if (saveSourceBtn) {
              saveSourceBtn.onclick = (e) => {
                e.preventDefault();
                handleSaveSource();
              };
            }

            // Keyboard shortcut Cmd+S / Ctrl+S inside textarea
            codeTextarea.addEventListener('keydown', (e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                e.stopPropagation();
                handleSaveSource();
              }
              // Tab key indents by 2 spaces
              if (e.key === 'Tab') {
                e.preventDefault();
                const start = codeTextarea.selectionStart;
                const end = codeTextarea.selectionEnd;
                codeTextarea.value = codeTextarea.value.substring(0, start) + '  ' + codeTextarea.value.substring(end);
                codeTextarea.selectionStart = codeTextarea.selectionEnd = start + 2;
              }
            });

            if (undoSourceBtn) {
              undoSourceBtn.onclick = async (e) => {
                e.preventDefault();
                undoSourceBtn.disabled = true;
                if (saveStatus) {
                  saveStatus.style.color = 'var(--text-primary)';
                  saveStatus.textContent = 'Reverting...';
                }
                try {
                  const res = await fetch(BRIDGE + '/api/source-undo', { method: 'POST' });
                  const data = await res.json();
                  undoSourceBtn.disabled = false;
                  if (data.success) {
                    if (saveStatus) {
                      saveStatus.style.color = '#34d399';
                      saveStatus.textContent = data.description || 'Reverted';
                    }
                    showCallout(data.description || 'Reverted change', 'UNDO');
                    // Reload component context to refresh source snippet
                    loadComponentContext(infoName, resolved, computedStyles);
                  } else {
                    if (saveStatus) {
                      saveStatus.style.color = '#fb7185';
                      saveStatus.textContent = data.error || 'Nothing to undo';
                    }
                  }
                } catch (err) {
                  undoSourceBtn.disabled = false;
                  if (saveStatus) {
                    saveStatus.style.color = '#fb7185';
                    saveStatus.textContent = 'Undo error: ' + err.message;
                  }
                }
              };
            }
          }
        } catch(err) {
          flyoutContent.innerHTML = '<p style="color:#fb7185;">Failed to load context: ' + err.message + '</p>';
        }
      }

      async function resolveComponent(info) {
        if (info.source && info.source.fileName) {
          const fn = info.source.fileName.split('/').pop().replace(/\.[jt]sx?$/, '');
          if (fn.toLowerCase() === info.name.toLowerCase()) {
            return { file: info.source.fileName, line: info.source.lineNumber };
          }
        }
        try {
          // Send ancestor names so bridge can prefer the right file
          const ancestorNames = currentStack.map(c => c.name).filter(n => n !== info.name);
          const res = await fetch(BRIDGE + '/api/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ componentName: info.name, ancestors: ancestorNames })
          });
          const data = await res.json();
          if (data.resolved) return { file: data.file, line: data.line };
        } catch(e) {}
        return null;
      }

      function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      function formatContextForAiPrompt(ctx, stack, customTask) {
        const bt = String.fromCharCode(96);
        const nl = String.fromCharCode(10);
        const compName = ctx.component && ctx.component.name ? '<' + ctx.component.name + ' />' : 'Target Component';
        let text = '### Component Task: ' + compName + nl;
        if (ctx.source && ctx.source.file) {
          text += '- **Location**: ' + bt + ctx.source.file + (ctx.source.startLine ? ':' + ctx.source.startLine + '-' + ctx.source.endLine : '') + bt + nl;
        }
        if (stack && stack.length > 0) {
          const pathStr = stack.map(function(s) { return s.name; }).reverse().join(' › ');
          text += '- **Hierarchy**: ' + pathStr + nl;
        }
        if (customTask && customTask.trim()) {
          text += nl + '#### Objective' + nl + '> ' + customTask.trim() + nl;
        }
        if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
          const propSummary = ctx.interface.props.map(function(p) { return p.name + ': ' + p.type + (p.required ? ' (req)' : ''); }).join(', ');
          text += '- **Props**: ' + propSummary + nl;
        }
        if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
          text += '- **Hooks**: ' + ctx.interface.hooks.join(', ') + nl;
        }
        if (typeof comments !== 'undefined' && comments && comments.length > 0) {
          const relComments = comments.filter(c => (ctx.component && c.component === ctx.component.name) || (ctx.source && c.file === ctx.source.file));
          if (relComments.length > 0) {
            text += nl + '#### Active Notes & Feedback' + nl;
            relComments.forEach(c => {
              text += '- ' + (c.resolved ? '[RESOLVED] ' : '') + c.text + nl;
            });
          }
        }
        if (ctx.source && ctx.source.code) {
          text += nl + '#### Source Code' + nl + bt+bt+bt + 'tsx' + nl + ctx.source.code + nl + bt+bt+bt + nl;
        }
        text += nl + '> Token Budget: ~' + (ctx.tokens && ctx.tokens.current ? ctx.tokens.current : '150') + ' tokens' + nl;
        return text;
      }

      function formatDomElementPrompt(target, computedStyles, stack, customTask) {
        const bt = String.fromCharCode(96);
        const nl = String.fromCharCode(10);
        const el = target?.element || selectedElement;
        const tag = el ? el.tagName.toLowerCase() : 'element';
        const classes = el && el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
        const selector = (typeof buildCSSSelector === 'function' && el) ? buildCSSSelector(el) : tag + classes;

        let text = '### UI Element Task: <' + tag + classes + ' />' + nl;
        text += '- **Selector**: ' + bt + selector + bt + nl;
        if (stack && stack.length > 0) {
          const pathStr = stack.map(function(s) { return s.name; }).reverse().join(' › ');
          text += '- **Hierarchy**: ' + pathStr + nl;
        }
        if (customTask && customTask.trim()) {
          text += nl + '#### Objective' + nl + '> ' + customTask.trim() + nl;
        }
        if (computedStyles) {
          text += nl + '#### Computed Styles & Box Model' + nl;
          if (computedStyles.boundingBox) {
            text += '- **Dimensions**: ' + Math.round(computedStyles.boundingBox.width) + 'px × ' + Math.round(computedStyles.boundingBox.height) + 'px (at x: ' + Math.round(computedStyles.boundingBox.left) + ', y: ' + Math.round(computedStyles.boundingBox.top) + ')' + nl;
          }
          text += '- **Layout**: display: ' + (computedStyles.display || 'block') + ' | position: ' + (computedStyles.position || 'static') + nl;
          text += '- **Colors**: color: ' + (computedStyles.color || 'inherit') + ' | bg: ' + (computedStyles.backgroundColor || 'transparent') + nl;
          text += '- **Typography**: ' + (computedStyles.fontSize || '14px') + ' line-height: ' + (computedStyles.lineHeight || 'normal') + nl;
        }
        if (typeof comments !== 'undefined' && comments && comments.length > 0) {
          const relComments = comments.filter(c => c.selector === selector || (c.component && target && c.component === target.name));
          if (relComments.length > 0) {
            text += nl + '#### Active Notes & Feedback' + nl;
            relComments.forEach(c => {
              text += '- ' + (c.resolved ? '[RESOLVED] ' : '') + c.text + nl;
            });
          }
        }
        return text;
      }

      function formatContextForClipboard(ctx) {
        const bt = String.fromCharCode(96);
        const nl = String.fromCharCode(10);
        let text = '## ' + ctx.component.name + nl;
        text += '**Source**: ' + bt + ctx.source.file + ':' + ctx.source.startLine + '-' + ctx.source.endLine + bt + nl + nl;
        if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
          text += '### Props' + nl;
          ctx.interface.props.forEach(function(p) { text += '- ' + p.name + ': ' + p.type + (p.required ? ' (required)' : '') + nl; });
          text += nl;
        }
        if (ctx.source.code) {
          text += '### Source Code' + nl + bt+bt+bt + 'tsx' + nl + ctx.source.code + nl + bt+bt+bt + nl;
        }
        if (ctx.imports) {
          text += '### Imports' + nl;
          ctx.imports.forEach(function(imp) { text += '- ' + imp.name + ' from ' + imp.source + nl; });
        }
        text += nl + '**Tokens**: ' + ctx.tokens.current + nl;
        return text;
      }

      async function refreshState() {
        try {
          const resPins = await fetch(BRIDGE + '/api/pins');
          const dataPins = await resPins.json();
          currentPins = dataPins.pins || [];
          const count = currentPins.length;
          shadow.getElementById('cp-pin-count').textContent = count;

          if (count > 0) {
            dockPinBadge.style.display = 'inline-flex';
            dockPinBadge.textContent = count;
          } else {
            dockPinBadge.style.display = 'none';
          }

          const list = shadow.getElementById('cp-pin-list');
          list.innerHTML = '';
          if (dataPins.pins && dataPins.pins.length > 0) {
            dataPins.pins.forEach(function(pin, index) {
              const card = document.createElement('div');
              card.className = 'cp-pin-card';
              const name = pin.context ? pin.context.component.name : pin.id;
              const file = pin.context ? pin.context.source.file.split('/').pop() : '';
              
              const isPinFrozen = frozenEntries.some(f => (pin.context && f.file === pin.context.source.file) || f.id === pin.id);
              const lockIcon = isPinFrozen ? '<span style="color:#fb7185; margin-right:4px;">' + ICONS.lock + '</span>' : '';
              
              card.innerHTML =
                '<div class="cp-pin-header">' +
                  '<div class="cp-pin-title">' +
                    '<span class="cp-pin-badge">#' + (index + 1) + '</span>' +
                    '<span>' + lockIcon + '&lt;' + name + ' /&gt;</span>' +
                    '<span class="cp-pin-file">' + file + '</span>' +
                  '</div>' +
                  '<button class="cp-pin-remove" data-id="' + pin.id + '" title="Remove pin">' + ICONS.x + '</button>' +
                '</div>' +
                '<textarea class="cp-pin-textarea" rows="2" placeholder="Task for this component..." data-id="' + pin.id + '">' + (pin.task || '') + '</textarea>';
              list.appendChild(card);
            });

            // Listen for changes/blur on task textareas to update-task
            const textareas = list.querySelectorAll('.cp-pin-textarea');
            textareas.forEach(ta => {
              const saveTask = async () => {
                const id = ta.getAttribute('data-id');
                const p = dataPins.pins.find(x => x.id === id);
                if (p && p.task !== ta.value) {
                  p.task = ta.value;
                  await fetch(BRIDGE + '/api/pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update-task', id, task: ta.value })
                  });
                }
              };
              ta.addEventListener('change', saveTask);
              ta.addEventListener('blur', saveTask);
            });

            const removeBtns = list.querySelectorAll('.cp-pin-remove');
            removeBtns.forEach(btn => {
              btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                const p = dataPins.pins.find(x => x.id === id);
                if (p) {
                  await fetch(BRIDGE + '/api/pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'remove', file: p.context.source.file, id })
                  });
                  refreshState();
                }
              };
            });
          } else {
            list.innerHTML = '<div style="font-size:11px; color:var(--text-muted); font-style:italic; padding:6px 0;">No pinned components. Click "Pin Component Task" on any component to stage changes.</div>';
          }

          const savingsDiv = shadow.getElementById('cp-token-savings');
          if (dataPins.pins && dataPins.pins.length > 0 && dataPins.totalTokens) {
            const levelSelect = shadow.getElementById('cp-context-level');
            const level = levelSelect.value;
            const cost = dataPins.totalTokens[level] || dataPins.totalTokens.current;
            
            savingsDiv.style.display = 'block';
            savingsDiv.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Stack: ' + cost.toLocaleString() + ' tokens (' + dataPins.pins.length + ' pinned)';
          } else {
            savingsDiv.style.display = 'none';
          }
        } catch(e) { }
      }

      function refreshPins() {
        refreshState();
      }

      if (ws) {
        ws.onmessage = (msg) => {
          try {
            const payload = JSON.parse(msg.data);
            if (payload.type === 'state-update') {
              frozenEntries = payload.data.frozenEntries || [];
              if (payload.data.comments) {
                comments = payload.data.comments;
                renderCommentMarkers();
                renderSidebarNotes();
              }
              refreshState();
            } else if (payload.type === 'pins-update') {
              refreshState();
            } else if (payload.type === 'source-updated') {
              showCallout('Source updated: ' + (payload.data.file ? payload.data.file.split('/').pop() : 'file'), 'HMR');
            } else if (payload.type === 'source-reverted') {
              showCallout('Source reverted: ' + (payload.data.description || 'change'), 'UNDO');
            } else if (payload.type === 'capture-screenshot') {
              const { requestId, file, component, label, componentId } = payload.data;
              const el = findComponentElement(component);
              if (!el) {
                fetch(BRIDGE + '/api/screenshot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: componentId, label: label, dataUrl: 'data:image/png;base64,', requestId: requestId })
                }).catch(e => console.error(e));
                return;
              }
              
              captureElement(el).then(async (dataUrl) => {
                if (!dataUrl) {
                  fetch(BRIDGE + '/api/screenshot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: componentId, label: label, dataUrl: 'data:image/png;base64,', requestId: requestId })
                  }).catch(e => console.error(e));
                  return;
                }
                
                const rect = el.getBoundingClientRect();
                const postBody = {
                  id: componentId,
                  label: label,
                  dataUrl: dataUrl,
                  boundingBox: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                  viewport: { width: window.innerWidth, height: window.innerHeight },
                  requestId: requestId
                };
                
                fetch(BRIDGE + '/api/screenshot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(postBody)
                }).catch(e => console.error(e));
              });
            }
          } catch(e) {}
        };
      }

      fetch(BRIDGE + '/api/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' })
      })
      .then(r => r.json())
      .then(d => {
        if (d.frozenEntries) frozenEntries = d.frozenEntries;
        refreshState();
      })
      .catch(e => refreshState());
      window.addEventListener('scroll', () => {
        if (typeof updateSelectionFrame === 'function') updateSelectionFrame();
        if (typeof renderCommentMarkers === 'function') renderCommentMarkers();
      }, { passive: true });
      window.addEventListener('resize', () => {
        if (typeof updateSelectionFrame === 'function') updateSelectionFrame();
        if (typeof renderCommentMarkers === 'function') renderCommentMarkers();
      }, { passive: true });

      loadComments();

      console.log('[agent-hover] Ready');
    })();
  `;
}

export default function componentPointer(options?: ComponentPointerOptions): Plugin {
  const port = options?.port ?? 9850;
  const editor = options?.editor ?? 'auto';
  let projectRoot: string;
  let bridgeServer: BridgeServer | null = null;

  return {
    name: 'agent-hover',
    apply: 'serve', // only in dev mode

    config() {
      return {
        server: {
          watch: {
            ignored: ['**/.agent-hover/**', '**/.agent-hover/comments.json'],
          },
        },
      };
    },

    configResolved(config) {
      projectRoot = config.root;
    },

    configureServer(server) {
      // If a bridge server was already running from a previous reload, stop it first
      if (bridgeServer) {
        try {
          bridgeServer.stop();
        } catch (e) { }
      }
      // Start bridge server when Vite dev server starts
      bridgeServer = new BridgeServer(projectRoot, port);
      bridgeServer.start();

      // Clean up on server close
      server.httpServer?.on('close', () => {
        if (bridgeServer) {
          bridgeServer.stop();
          bridgeServer = null;
        }
      });
    },

    transformIndexHtml() {
      // Inline dom-to-image-more library for screenshot capture
      const req = createRequire(import.meta.url);
      let domToImageSource = '';
      try {
        const domToImagePath = req.resolve('dom-to-image-more/dist/dom-to-image-more.min.js');
        domToImageSource = readFileSync(domToImagePath, 'utf-8');
      } catch (e) {
        console.warn('[agent-hover] Could not load dom-to-image-more, screenshot capture will be disabled');
      }

      const tags: any[] = [];
      if (domToImageSource) {
        tags.push({
          tag: 'script',
          children: domToImageSource,
          injectTo: 'body' as const,
        });
      }
      tags.push({
        tag: 'script',
        attrs: { type: 'module' },
        children: generateOverlayBootstrap(port, editor),
        injectTo: 'body' as const,
      });
      return tags;
    },
  };
}
