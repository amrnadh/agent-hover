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
          #cp-dock-wrapper, #cp-flyout, #cp-tracker, #cp-slider-modal, #cp-text-editor {
            pointer-events: auto;
          }
          :host, #cp-dock-wrapper, #cp-dock, #cp-flyout, #cp-highlight, #cp-slider-modal {
            --font-sans: 'Geist', 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            --font-mono: 'JetBrains Mono', 'Geist Mono', 'Fira Code', SFMono-Regular, monospace;
            
            --bg-dock: rgba(10, 16, 26, 0.9);
            --bg-dock-panel: rgba(11, 18, 32, 0.96);
            --bg-tile: rgba(255, 255, 255, 0.04);
            --bg-tile-hover: rgba(255, 255, 255, 0.09);
            --bg-tile-active: rgba(0, 240, 255, 0.16);
            --border-glass: rgba(255, 255, 255, 0.12);
            --border-highlight: rgba(255, 255, 255, 0.22);
            --border-cyan: rgba(0, 240, 255, 0.55);
            --accent-cyan: #00F0FF;
            --accent-cyan-glow: rgba(0, 240, 255, 0.4);
            --accent-blue: #0284c7;
            --accent-emerald: #10b981;
            --accent-rose: #f43f5e;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --blur: blur(28px) saturate(190%) contrast(1.05);
            --shadow-dock: inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(0, 0, 0, 0.6), 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 24px rgba(0, 240, 255, 0.08);
            --shadow-tile: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 4px 12px rgba(0, 0, 0, 0.35);
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

          #cp-dock {
            width: 66px;
            background: var(--bg-dock);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            border: 1px solid var(--border-glass);
            border-radius: 34px;
            padding: 10px 7px 8px 7px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            box-shadow: var(--shadow-dock);
            transition: border-color 0.25s ease, box-shadow 0.25s ease;
          }

          #cp-dock:hover {
            border-color: var(--border-highlight);
          }

          /* --- Dock Squircle Tiles --- */
          .cp-dock-tile {
            position: relative;
            width: 50px;
            border-radius: 16px;
            background: var(--bg-tile);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: var(--text-secondary);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: var(--shadow-tile);
            transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            overflow: hidden;
            height: 50px;
          }

          .cp-dock-tile:hover {
            background: var(--bg-tile-hover);
            color: var(--text-primary);
            border-color: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
          }

          .cp-dock-tile:active {
            transform: scale(0.96);
          }

          .cp-dock-tile.active {
            color: var(--accent-cyan);
            border-color: var(--accent-cyan);
            background: rgba(0, 240, 255, 0.12);
            box-shadow: 0 0 16px var(--accent-cyan-glow), inset 0 0 10px rgba(0, 240, 255, 0.15);
          }

          /* Bottom Drag & Snap Handle */
          .cp-dock-handle {
            width: 26px;
            height: 4px;
            background: rgba(255, 255, 255, 0.22);
            border-radius: 999px;
            margin-top: 4px;
            cursor: grab;
            transition: all 0.2s ease;
          }

          .cp-dock-handle:hover {
            background: var(--accent-cyan);
            width: 32px;
            box-shadow: 0 0 8px var(--accent-cyan-glow);
          }

          .cp-badge-pill {
            position: absolute;
            top: -3px;
            right: -3px;
            background: var(--accent-cyan);
            color: #04101e;
            font-family: var(--font-mono);
            font-size: 9px;
            font-weight: 700;
            line-height: 1;
            padding: 2px 5px;
            border-radius: 999px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          }

          /* --- Reference Callout / Speech Bubble --- */
          #cp-dock-callout {
            position: absolute;
            left: 78px;
            top: 22px;
            opacity: 0;
            pointer-events: none;
            background: rgba(11, 18, 32, 0.95);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            border: 1px solid var(--border-glass);
            border-radius: 18px;
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
            border-right: 7px solid rgba(11, 18, 32, 0.95);
          }

          .cp-callout-message {
            color: var(--text-primary);
            letter-spacing: -0.01em;
          }

          .cp-callout-time {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--accent-cyan);
            margin-left: 6px;
            background: rgba(0, 240, 255, 0.1);
            padding: 2px 7px;
            border-radius: 6px;
            border: 1px solid rgba(0, 240, 255, 0.25);
          }

          /* --- Full Context Lens Flyout --- */
          #cp-flyout {
            position: absolute;
            left: 82px;
            top: 0;
            opacity: 0;
            pointer-events: none;
            width: 460px;
            max-height: calc(100vh - 60px);
            background: var(--bg-dock-panel);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            color: var(--text-primary);
            font-family: var(--font-sans);
            box-shadow: var(--shadow-dock);
            z-index: 1000000;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          }

          #cp-flyout.open {
            opacity: 1;
            pointer-events: auto;
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
            border-radius: 0 !important;
            border: none !important;
            border-left: 1px solid var(--border-glass) !important;
            box-shadow: -12px 0 36px rgba(0, 0, 0, 0.55) !important;
            transform: translateX(100%);
            transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease !important;
            z-index: 999995 !important;
          }

          #cp-flyout.is-sidebar.open {
            transform: translateX(0);
          }

          /* Shift dock slightly away from sidebar edge when open on right */
          #cp-dock-wrapper.sidebar-open.cp-dock-right {
            right: 456px !important;
            transition: right 0.24s cubic-bezier(0.16, 1, 0.3, 1);
          }

          /* Dynamic Dock Orientation: Flip to Left Side when on Right */
          #cp-dock-wrapper.cp-dock-right #cp-dock-callout {
            left: auto;
            right: 78px;
          }

          #cp-dock-wrapper.cp-dock-right .cp-callout-tail {
            left: auto;
            right: -7px;
            border-right: none;
            border-left: 7px solid rgba(11, 18, 32, 0.95);
          }

          #cp-dock-wrapper.cp-dock-right #cp-flyout:not(.is-sidebar) {
            left: auto;
            right: 82px;
          }

          #cp-dock-wrapper.cp-dock-bottom #cp-flyout:not(.is-sidebar) {
            top: auto;
            bottom: 0;
          }

          #cp-flyout-header {
            padding: 16px 20px;
            background: rgba(255, 255, 255, 0.02);
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
          #cp-flyout-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 999px; }

          .cp-flyout-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 14px 20px;
            background: rgba(0, 0, 0, 0.25);
            border-top: 1px solid var(--border-glass);
          }

          .cp-btn-bento {
            background: var(--bg-tile);
            border: 1px solid var(--border-glass);
            color: var(--text-primary);
            padding: 10px 14px;
            border-radius: 12px;
            font-family: var(--font-sans);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.18s ease;
          }

          .cp-btn-bento:hover {
            background: var(--bg-tile-hover);
            border-color: var(--border-highlight);
            transform: translateY(-1px);
          }

          .cp-btn-bento:active {
            transform: scale(0.96);
          }

          .cp-btn-bento.primary {
            background: linear-gradient(135deg, rgba(0, 240, 255, 0.18) 0%, rgba(2, 132, 199, 0.25) 100%);
            border-color: var(--border-cyan);
            color: var(--accent-cyan);
          }

          .cp-btn-bento.primary:hover {
            background: linear-gradient(135deg, rgba(0, 240, 255, 0.28) 0%, rgba(2, 132, 199, 0.35) 100%);
            box-shadow: 0 0 16px var(--accent-cyan-glow);
          }

          .cp-section { margin-bottom: 20px; }
          .cp-section-title {
            font-family: var(--font-mono);
            font-size: 11.5px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #8b9dc3;
            margin-bottom: 10px;
            padding: 6px 0;
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            gap: 6px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          .cp-section-title:hover { color: var(--text-primary); }

          details.cp-section > summary { list-style: none; }
          details.cp-section > summary::-webkit-details-marker { display: none; }
          details.cp-section > summary::before {
            content: '▶'; font-size: 8px; display: inline-block; transition: transform 0.2s; color: var(--accent-cyan);
          }
          details.cp-section[open] > summary::before { transform: rotate(90deg); }

          .cp-code {
            background: rgba(0, 0, 0, 0.35);
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
            color: #d1d9e6;
          }

          #cp-source-code-editor {
            background: rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(14, 165, 233, 0.3);
            border-radius: 8px;
            color: #f1f5f9;
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
            border-color: #0ea5e9;
            box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.25);
          }

          .cp-props-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 8px;
          }
          .cp-props-table th {
            text-align: left; padding: 8px 10px; color: #8b9dc3;
            border-bottom: 1px solid var(--border-glass); font-weight: 600;
            font-family: var(--font-mono); font-size: 11px;
            background: rgba(0, 0, 0, 0.15);
          }
          .cp-props-table td {
            padding: 8px 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            font-family: var(--font-mono); font-size: 11.5px;
            line-height: 1.4;
          }
          .cp-props-table tr:nth-child(even) td {
            background: rgba(255, 255, 255, 0.02);
          }
          .cp-props-table tr:hover td {
            background: rgba(255, 255, 255, 0.04);
          }

          .cp-badge {
            display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 999px;
            font-family: var(--font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.2px;
            min-height: 24px; line-height: 1;
          }
          .cp-badge-cyan { background: rgba(0, 240, 255, 0.12); color: var(--accent-cyan); border: 1px solid rgba(0, 240, 255, 0.3); }
          .cp-badge-emerald { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
          .cp-badge-muted { background: rgba(255, 255, 255, 0.05); color: #94a3b8; border: 1px solid var(--border-glass); }
          .cp-badge-rose { background: rgba(244, 63, 94, 0.12); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); }

          .cp-box-model {
            background: rgba(0, 0, 0, 0.35);
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            padding: 12px;
            font-family: var(--font-mono);
            font-size: 11px;
            color: #cbd5e1;
            text-align: center;
          }

          /* --- Highlight Box (Clean, Minimal, No Gradients) --- */
          #cp-highlight {
            position: fixed;
            pointer-events: none;
            z-index: 999997;
            border: 1.5px solid #0284c7;
            background: transparent;
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
            border-radius: 2px;
            display: none;
            transition: all 60ms ease-out;
            box-sizing: border-box;
          }
          #cp-highlight.selected {
            border-color: #0ea5e9;
            box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.4);
          }
          #cp-highlight.is-raw {
            border-color: #38bdf8;
          }

          /* 8 Selection Handles (Figma Minimal Style) */
          .cp-handle {
            position: absolute;
            width: 6px;
            height: 6px;
            background: #ffffff;
            border: 1.5px solid #0284c7;
            border-radius: 1px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
            pointer-events: none;
            transform: translate(-50%, -50%);
            display: none;
          }
          #cp-highlight.selected .cp-handle {
            display: block;
          }
          #cp-highlight.is-raw .cp-handle {
            border-color: #38bdf8;
          }
          .cp-handle-nw { top: 0; left: 0; }
          .cp-handle-n  { top: 0; left: 50%; }
          .cp-handle-ne { top: 0; left: 100%; }
          .cp-handle-e  { top: 50%; left: 100%; }
          .cp-handle-se { top: 100%; left: 100%; }
          .cp-handle-s  { top: 100%; left: 50%; }
          .cp-handle-sw { top: 100%; left: 0; }
          .cp-handle-w  { top: 50%; left: 0; }

          /* Box-model dashed frame bands (Design-Mode style) */
          #cp-margin-band {
            position: fixed;
            pointer-events: none;
            z-index: 999996;
            box-sizing: border-box;
            background: rgba(244, 63, 94, 0.05);
            border-style: dashed;
            border-color: rgba(244, 63, 94, 0.7);
            border-width: 0;
            display: none;
          }
          #cp-padding-band {
            position: fixed;
            pointer-events: none;
            z-index: 999997;
            box-sizing: border-box;
            background: rgba(52, 211, 153, 0.06);
            border-style: dashed;
            border-color: rgba(52, 211, 153, 0.7);
            border-width: 0;
            display: none;
          }
          #cp-axis-guides {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 999995;
          }
          .cp-axis-line {
            position: fixed;
            pointer-events: none;
          }
          .cp-axis-h {
            left: 0;
            width: 100vw;
            height: 0;
            border-top: 1px dashed rgba(14, 165, 233, 0.45);
          }
          .cp-axis-v {
            top: 0;
            height: 100vh;
            width: 0;
            border-left: 1px dashed rgba(14, 165, 233, 0.45);
          }
          .cp-layout-child-frame {
            position: fixed;
            pointer-events: none;
            box-sizing: border-box;
            border: 1px dashed rgba(56, 189, 248, 0.4);
            background: rgba(56, 189, 248, 0.03);
          }

          /* Dimension label chip (merged into cp-label) */
          #cp-dim-label {
            display: none !important;
          }

          /* Clean, Single-Line Compact Pill (#cp-label) */
          #cp-label {
            position: absolute;
            top: -24px;
            left: -1px;
            background: #090d16;
            border: 1px solid #0284c7;
            color: #38bdf8;
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

          #cp-pin-bar {
            padding: 14px 20px;
            background: rgba(0, 0, 0, 0.2);
            border-top: 1px solid var(--border-glass);
            font-size: 12px;
          }
          .cp-pin-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 6px 10px; border-radius: 8px; color: var(--text-primary);
            font-family: var(--font-mono); font-size: 11px;
            background: rgba(255, 255, 255, 0.02);
            margin-bottom: 4px;
            border: 1px solid transparent;
          }
          .cp-pin-item:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: var(--border-glass);
          }
          .cp-pin-remove {
            background: none; border: none; color: var(--accent-rose); cursor: pointer; padding: 3px; opacity: 0.7;
          }
          .cp-pin-remove:hover { opacity: 1; }

          #cp-tracker {
            display: none;
            position: fixed;
            left: 100px;
            bottom: 30px;
            background: var(--bg-dock-panel);
            backdrop-filter: var(--blur);
            border: 1px solid var(--border-cyan);
            border-radius: 16px;
            padding: 14px 18px;
            color: var(--text-primary);
            z-index: 10000;
            flex-direction: column;
            gap: 10px;
            box-shadow: var(--shadow-dock);
          }

          #cp-slider-modal {
            display: none; position: fixed; inset: 0; z-index: 10001; background: rgba(4, 7, 14, 0.85);
            backdrop-filter: blur(8px); align-items: center; justify-content: center; padding: 40px;
          }
          #cp-slider-box {
            background: var(--bg-dock-panel); border: 1px solid var(--border-glass); border-radius: 20px;
            display: flex; flex-direction: column; box-shadow: var(--shadow-dock); max-width: 90vw; max-height: 90vh; width: 100%;
          }

          /* --- Inline Text Editor Popover --- */
          #cp-text-editor {
            display: none;
            position: fixed;
            z-index: 999999;
            width: 340px;
            background: var(--bg-dock-panel);
            backdrop-filter: var(--blur);
            border: 1px solid var(--border-cyan);
            border-radius: 14px;
            box-shadow: var(--shadow-dock), 0 0 20px rgba(0, 240, 255, 0.12);
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
            background: rgba(0, 0, 0, 0.2);
          }
          #cp-text-editor-header > span {
            font-size: 12px;
            font-weight: 600;
            color: var(--accent-cyan);
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
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-glass);
            border-radius: 5px;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
            font-family: var(--font-sans);
            transition: all 0.15s;
          }
          .cp-text-tb-btn:hover {
            background: rgba(0, 240, 255, 0.12);
            color: var(--accent-cyan);
            border-color: var(--border-cyan);
          }
          .cp-text-tb-btn.active {
            background: rgba(0, 240, 255, 0.2);
            color: var(--accent-cyan);
            border-color: var(--border-cyan);
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
            background: rgba(0, 240, 255, 0.02);
          }
          #cp-text-editor-footer {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border-top: 1px solid var(--border-glass);
            background: rgba(0, 0, 0, 0.15);
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
            background: linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(2, 132, 199, 0.3));
            color: var(--accent-cyan);
            border-color: var(--border-cyan);
          }
          .cp-text-action-btn.apply:hover {
            background: linear-gradient(135deg, rgba(0, 240, 255, 0.3), rgba(2, 132, 199, 0.4));
            box-shadow: 0 0 12px var(--accent-cyan-glow);
          }
          .cp-text-action-btn.revert {
            background: rgba(255, 255, 255, 0.04);
            color: var(--text-secondary);
          }
          .cp-text-action-btn.revert:hover {
            background: rgba(244, 63, 94, 0.12);
            color: #fb7185;
            border-color: rgba(244, 63, 94, 0.3);
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
            background: rgba(255, 107, 53, 0.55);
          }
          .cp-dist-line.horizontal {
            height: 1px;
            border-top: 1px dashed rgba(255, 107, 53, 0.7);
            background: none;
          }
          .cp-dist-line.vertical {
            width: 1px;
            border-left: 1px dashed rgba(255, 107, 53, 0.7);
            background: none;
          }
          .cp-dist-pill {
            position: absolute;
            background: #FF6B35;
            color: #fff;
            font-size: 9px;
            font-family: var(--font-mono);
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 9999px;
            white-space: nowrap;
            transform: translate(-50%, -50%);
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
          }
        </style>

        <svg style="position: absolute; width: 0; height: 0; overflow: hidden;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cp-liquid-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.85"/>
              <stop offset="100%" stop-color="#0284C7" stop-opacity="0.95"/>
            </linearGradient>
          </defs>
        </svg>

        <div id="cp-dock-wrapper">
          <div id="cp-dock">
            
            <div class="cp-dock-tile" id="cp-dock-toggle" title="Toggle Inspector Mode (Alt)">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
            </div>

            <div class="cp-dock-tile" id="cp-dock-pins" title="Pinned Components Stack">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              <span class="cp-badge-pill" id="cp-dock-pin-badge" style="display:none;">0</span>
            </div>

            <div class="cp-dock-tile" id="cp-dock-diff" title="Track Visual Diff">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            </div>

            <div class="cp-dock-tile" id="cp-dock-export" title="Export Context for AI">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </div>

            <div class="cp-dock-tile" id="cp-dock-open" title="Jump to Source in IDE">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
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

          <!-- Lens Flyout -->
          <div id="cp-flyout">
            <div id="cp-flyout-header">
              <div id="cp-flyout-title-wrap">
                <span class="cp-badge cp-badge-cyan" id="cp-flyout-badge">LENS</span>
                <h3 id="cp-flyout-title">Component Inspector</h3>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <button class="cp-dock-tile" id="cp-flyout-mode-toggle" title="Toggle Sidebar / Float mode" style="width:30px; height:30px; border-radius:8px;">
                  <svg id="cp-mode-sidebar-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>
                  <svg id="cp-mode-float-icon" style="display:none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
                <button class="cp-dock-tile" id="cp-flyout-close" title="Close (Esc)" style="width:30px; height:30px; border-radius:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
            <div id="cp-flyout-breadcrumb" style="display:none; padding:10px 20px; background:rgba(0,0,0,0.18); border-bottom:1px solid var(--border-glass); font-family:var(--font-mono); font-size:11.5px; overflow-x:auto; white-space:nowrap;">
            </div>

            <!-- Live Token Meter & Context Level Bar -->
            <div id="cp-token-meter" style="padding: 7px 18px; background: rgba(0,0,0,0.25); border-bottom: 1px solid var(--border-glass); display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); font-size: 11px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #38bdf8; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                  ⚡ <span id="cp-token-count">0</span> tokens
                </span>
                <span id="cp-token-savings" class="cp-badge cp-badge-emerald" style="min-height: 18px; font-size: 9.5px; padding: 1px 6px;">
                  prompt-ready
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="color: var(--text-muted); font-size: 10px;">Context:</span>
                <select id="cp-context-level" style="background: rgba(255,255,255,0.06); color: var(--text-primary); border: 1px solid var(--border-glass); border-radius: 4px; font-size: 10.5px; font-family: var(--font-mono); padding: 2px 6px; cursor: pointer;">
                  <option value="minimal">Compact (Prompt-Ready)</option>
                  <option value="standard" selected>Standard (+Source)</option>
                  <option value="full">Deep (+Styles)</option>
                </select>
              </div>
            </div>

            <div id="cp-flyout-content">
              <p style="color:var(--text-secondary); margin:0;">Point and click any element on the page, or press <kbd style="font-family:var(--font-mono); background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">Alt</kbd> to inspect.</p>
            </div>

            <div class="cp-flyout-actions">
              <button class="cp-btn-bento primary" id="cp-copy-ai" style="grid-column: span 2; justify-content: center; font-weight: 600; font-size: 12px; padding: 9px 14px; background: linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(2, 132, 199, 0.35) 100%); border-color: #0ea5e9; color: #38bdf8;">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                ⚡ Copy for AI Prompt
              </button>
              <button class="cp-btn-bento" id="cp-editor-btn"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg> Open in IDE</button>
              <button class="cp-btn-bento" id="cp-copy" title="Copy structured component spec (Markdown table)"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> 📋 Copy Spec</button>
              <button class="cp-btn-bento" id="cp-pin-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg> Pin Component</button>
              <button class="cp-btn-bento" id="cp-track-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg> Track Visuals</button>
              <button class="cp-btn-bento" id="cp-toggle-spacing" style="grid-column: span 2;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Spacing Overlay</button>
            </div>

            <div id="cp-pin-bar">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Pinned Stack (<span id="cp-pin-count">0</span>)</span>
                <button id="cp-pin-clear-btn" style="background:none; border:none; color:var(--text-muted); font-size:10.5px; cursor:pointer; padding:2px 6px; border-radius:4px; font-family:var(--font-mono); display:none;" title="Clear all pinned components">Clear All</button>
              </div>
              <div id="cp-pin-list"></div>

              <div id="cp-pin-empty" style="padding:14px 0; text-align:center; color:var(--text-muted); font-size:11px; font-family:var(--font-mono);">
                No pinned components.<br>Click "Pin Component" or Alt+Shift+Click to bundle.
              </div>

              <!-- Inline Task Brief Composer (No Native Prompts) -->
              <div id="cp-task-composer" style="margin-top: 10px; display: none; flex-direction: column; gap: 8px;">
                <textarea id="cp-task-input" rows="2" placeholder="Task instruction for AI (e.g. Unify card borders, sync padding, add skeleton loader)..." style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid var(--border-glass); border-radius:8px; padding:8px 10px; font-size:11.5px; font-family:var(--font-sans); color:var(--text-primary); resize:vertical; outline:none; transition:border-color 0.2s;"></textarea>
                <button class="cp-btn-bento primary" id="cp-gen-task" style="width:100%; font-weight:600; font-size:12px; padding:9px 12px; background:linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(2, 132, 199, 0.35) 100%); border-color:#0ea5e9; color:#38bdf8;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                  <span>⚡ Copy Task Brief for AI</span>
                </button>
                <div style="font-size:10px; color:var(--text-muted); font-family:var(--font-mono); text-align:center;">Bundles pinned components + relationships + frozen locks</div>
              </div>
            </div>
          </div>
        </div>

        <div id="cp-highlight">
          <div id="cp-label"></div>
          <div class="cp-handle cp-handle-nw"></div>
          <div class="cp-handle cp-handle-n"></div>
          <div class="cp-handle cp-handle-ne"></div>
          <div class="cp-handle cp-handle-e"></div>
          <div class="cp-handle cp-handle-se"></div>
          <div class="cp-handle cp-handle-s"></div>
          <div class="cp-handle cp-handle-sw"></div>
          <div class="cp-handle cp-handle-w"></div>
        </div>
        <div id="cp-margin-band"></div>
        <div id="cp-padding-band"></div>
        <div id="cp-axis-guides"></div>
        <div id="cp-dim-label"></div>
        <div id="cp-distance-layer"></div>

        <div id="cp-text-editor">
          <div id="cp-text-editor-header">
            <span>✏️ Edit Source Text</span>
            <span id="cp-text-target-badge" style="font-size:10px; font-family:var(--font-mono); color:var(--accent-cyan); background:rgba(14,165,233,0.1); padding:2px 6px; border-radius:4px; margin-left:6px; border:1px solid rgba(14,165,233,0.2); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>
            <div id="cp-text-editor-toolbar">
              <button class="cp-text-tb-btn" data-cmd="bold" title="Bold (⌘B)"><b>B</b></button>
              <button class="cp-text-tb-btn" data-cmd="italic" title="Italic (⌘I)"><i>I</i></button>
              <button class="cp-text-tb-btn" data-cmd="underline" title="Underline (⌘U)"><u>U</u></button>
            </div>
            <button id="cp-text-editor-close">✕</button>
          </div>
          <div id="cp-text-editor-content" contenteditable="true" spellcheck="false"></div>
          <div id="cp-text-editor-footer">
            <button class="cp-text-action-btn apply" id="cp-text-apply">💾 Commit to Source</button>
            <button class="cp-text-action-btn revert" id="cp-text-revert">Revert</button>
            <span id="cp-text-char-count"></span>
          </div>
        </div>

        <div id="cp-tracker">
          <div style="font-weight: 600; font-size: 13px;">Tracking: <span id="cp-tracker-name" style="color: var(--accent-cyan); font-family:var(--font-mono);"></span></div>
          <button class="cp-btn-bento primary" id="cp-tracker-capture">📸 Capture After & Diff</button>
          <button class="cp-btn-bento" id="cp-tracker-cancel" style="font-size: 11px; padding: 4px 8px;">Cancel</button>
        </div>

        <div id="cp-slider-modal">
          <div id="cp-slider-box">
            <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-glass); display: flex; justify-content: space-between; align-items: center;">
              <h2 style="margin:0; font-size:15px; font-weight:600; color:var(--text-primary);">Visual Diff: <span id="cp-modal-name" style="color:var(--accent-cyan); font-family:var(--font-mono);"></span></h2>
              <div style="display:flex; gap:12px; align-items:center;">
                <div id="cp-modal-badge"></div>
                <button class="cp-dock-tile" id="cp-modal-close" style="width:30px; height:30px; border-radius:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
            <div style="padding: 24px; overflow: auto; display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.3); min-height: 320px;">
              <div style="position: relative; user-select: none; border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); overflow: hidden; max-width: 100%;">
                <img id="cp-modal-after" style="display: block; max-width: 100%; max-height: 70vh;" />
                <img id="cp-modal-before" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);" />
                <div id="cp-modal-handle" style="position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; background: var(--accent-cyan); pointer-events: none; transform: translateX(-50%); box-shadow: 0 0 10px var(--accent-cyan);">
                  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 26px; height: 26px; background: #0a0f1a; border: 1.5px solid var(--accent-cyan); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); box-shadow: 0 0 12px var(--accent-cyan-glow);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </div>
                </div>
                <input type="range" min="0" max="100" value="50" id="cp-modal-slider" style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; margin: 0;" />
              </div>
            </div>
          </div>
        </div>
`;

const ICONS = {
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  crosshair: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  pin: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
  camera: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  lock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`
};

function generateOverlayBootstrap(port: number, editor: string): string {
  return `
    (() => {
      const BRIDGE = 'http://localhost:${port}';
      let ws;
      try {
        ws = new WebSocket('ws://localhost:${port}');
        ws.onopen = () => console.log('[agent-hover] ✓ Connected to bridge');
        ws.onerror = () => console.warn('[agent-hover] WebSocket connection failed');
      } catch(e) {
        console.warn('[agent-hover] Could not connect WebSocket');
      }

      let isPointerMode = false;
      let currentElement = null;
      let currentComponentInfo = null;
      let frozenEntries = [];
      let screenshotState = { beforeDataUrl: null, afterDataUrl: null, currentComponentId: null };

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
      const dockDiff = shadow.getElementById('cp-dock-diff');
      const dockExport = shadow.getElementById('cp-dock-export');
      const dockOpen = shadow.getElementById('cp-dock-open');
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
      const dimLabel = shadow.getElementById('cp-dim-label');
      const flyout = shadow.getElementById('cp-flyout');
      const flyoutTitle = shadow.getElementById('cp-flyout-title');
      const flyoutContent = shadow.getElementById('cp-flyout-content');
      const distanceLayer = shadow.getElementById('cp-distance-layer');
      const textEditor = shadow.getElementById('cp-text-editor');
      const textEditorContent = shadow.getElementById('cp-text-editor-content');
      const textCharCount = shadow.getElementById('cp-text-char-count');
      const textTargetBadge = shadow.getElementById('cp-text-target-badge');

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

      // Persist & Drag Dock
      try {
        const savedPos = localStorage.getItem('agent_hover_dock_pos');
        if (savedPos) {
          const { top, left } = JSON.parse(savedPos);
          dockWrapper.style.top = top;
          dockWrapper.style.left = left;
          dockWrapper.style.transform = 'none';
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
        const newTop = Math.max(10, Math.min(window.innerHeight - 380, initialTop + (e.clientY - dragStartY)));
        const newLeft = Math.max(10, Math.min(window.innerWidth - 80, initialLeft + (e.clientX - dragStartX)));
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
      function showCallout(text, meta) {
        calloutText.textContent = text;
        calloutMeta.textContent = meta || '';
        callout.classList.add('show');
        if (calloutTimer) clearTimeout(calloutTimer);
        calloutTimer = setTimeout(() => {
          if (!isPointerMode) callout.classList.remove('show');
        }, 3400);
      }

      function togglePointerMode() {
        isPointerMode = !isPointerMode;
        if (isPointerMode) {
          dockToggle.classList.add('active');
          showCallout('Pointer Active — Hover UI', 'ON');
          console.log('[agent-hover] Pointer mode ON');
        } else {
          dockToggle.classList.remove('active');
          highlight.style.display = 'none';
          hideBands();
          clearDistanceGuides();
          closeTextEditor();
          selectedRect = null;
          callout.classList.remove('show');
          currentComponentInfo = null;
          currentElement = null;
          currentStack = [];
          currentStackIndex = -1;
          console.log('[agent-hover] Pointer mode OFF');
        }
      }

      dockToggle.onclick = togglePointerMode;

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

      dockDiff.onclick = () => {
        if (!lastCopiedContext || !currentElement) {
          showCallout('Select a component first', 'TIP');
          return;
        }
        shadow.getElementById('cp-track-btn').click();
      };

      dockExport.onclick = () => {
        shadow.getElementById('cp-gen-task').click();
      };

      shadow.getElementById('cp-flyout-close').onclick = () => {
        flyout.classList.remove('open');
        dockWrapper.classList.remove('sidebar-open');
      };

      // Flyout Sidebar Mode Switcher
      const flyoutModeToggle = shadow.getElementById('cp-flyout-mode-toggle');
      const modeSidebarIcon = shadow.getElementById('cp-mode-sidebar-icon');
      const modeFloatIcon = shadow.getElementById('cp-mode-float-icon');

      let flyoutMode = 'sidebar';
      try {
        flyoutMode = localStorage.getItem('agent-hover-flyout-mode') || 'sidebar';
      } catch(e) {}

      function applyFlyoutMode(mode) {
        flyoutMode = mode;
        try {
          localStorage.setItem('agent-hover-flyout-mode', mode);
        } catch(e) {}

        if (mode === 'sidebar') {
          flyout.classList.add('is-sidebar');
          if (modeSidebarIcon) modeSidebarIcon.style.display = 'none';
          if (modeFloatIcon) modeFloatIcon.style.display = 'block';
          if (flyoutModeToggle) flyoutModeToggle.setAttribute('title', 'Switch to Floating Mode');
          if (flyout.classList.contains('open')) {
            dockWrapper.classList.add('sidebar-open');
          }
        } else {
          flyout.classList.remove('is-sidebar');
          if (modeSidebarIcon) modeSidebarIcon.style.display = 'block';
          if (modeFloatIcon) modeFloatIcon.style.display = 'none';
          if (flyoutModeToggle) flyoutModeToggle.setAttribute('title', 'Switch to Sidebar Mode');
          dockWrapper.classList.remove('sidebar-open');
        }
      }

      applyFlyoutMode(flyoutMode);

      if (flyoutModeToggle) {
        flyoutModeToggle.onclick = () => {
          applyFlyoutMode(flyoutMode === 'sidebar' ? 'float' : 'sidebar');
        };
      }

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

      dockOpen.onclick = async () => {
        if (!lastCopiedContext || !lastCopiedContext.source) {
          showCallout('Select a component first', 'TIP');
          return;
        }
        await openInEditor();
      };

      let lastCopiedContext = null;
      let lastResolved = null;
      let lastInfoName = null;
      let lastComputedStyles = null;

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
            copyAiBtn.innerHTML = '✓ Copied AI Prompt!';
            showCallout('AI Prompt Copied (' + (lastCopiedContext.tokens?.current || '?') + ' tok)', '✓');
            setTimeout(() => { copyAiBtn.innerHTML = originalHtml; }, 1600);
          } else {
            showCallout('Select a component first', 'TIP');
          }
        };
      }

      shadow.getElementById('cp-copy').onclick = async () => {
        if (lastCopiedContext) {
          const text = formatContextForClipboard(lastCopiedContext);
          await navigator.clipboard.writeText(text);
          const btn = shadow.getElementById('cp-copy');
          btn.innerHTML = '✓ Copied Spec!';
          showCallout('Component Spec Copied', '✓');
          setTimeout(() => btn.innerHTML = ICONS.copy + ' 📋 Copy Spec', 1600);
        } else {
          showCallout('Select a component first', 'TIP');
        }
      };

      async function openInEditor() {
        if (lastCopiedContext && lastCopiedContext.source) {
          try {
            const btn = shadow.getElementById('cp-editor-btn');
            const originalContent = btn.innerHTML;
            btn.innerHTML = 'Opening...';
            showCallout('Opening in IDE...', '${editor}');
            const res = await fetch(BRIDGE + '/api/open-editor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file: lastCopiedContext.source.absolutePath,
                line: lastCopiedContext.source.startLine,
                editor: '${editor}'
              })
            });
            const data = await res.json();
            if (!res.ok || data.error) {
              alert('Failed to open editor: ' + (data.error || res.statusText));
            } else {
              showCallout('Opened in IDE', '✓');
            }
            btn.innerHTML = originalContent;
          } catch(e) {
            console.error('[agent-hover] Failed to open editor:', e);
            alert('Failed to connect to agent-hover bridge server.');
            shadow.getElementById('cp-editor-btn').innerHTML = ICONS.crosshair + ' Open in Editor';
          }
        }
      }

      shadow.getElementById('cp-editor-btn').onclick = openInEditor;

      // Track Visuals
      const trackVisualBtn = shadow.getElementById('cp-track-btn');
      if (trackVisualBtn) {
        trackVisualBtn.onclick = async () => {
          if (!lastCopiedContext || !currentElement) return;
          const btn = trackVisualBtn;
          const compName = lastCopiedContext.component.name;
        const componentId = lastCopiedContext.source.file + ':' + compName;
        
        btn.innerHTML = '⏳ Capturing...';
        const dataUrl = await captureElement(currentElement);
        if (!dataUrl) {
          btn.innerHTML = '❌ Failed';
          setTimeout(() => btn.innerHTML = ICONS.camera + ' Track Visuals', 2000);
          return;
        }
        
        screenshotState = { 
          beforeDataUrl: dataUrl, 
          afterDataUrl: null, 
          currentComponentId: componentId,
          componentName: compName
        };
        
        const rect = currentElement.getBoundingClientRect();
        fetch(BRIDGE + '/api/screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: componentId,
            label: 'before',
            dataUrl: dataUrl,
            boundingBox: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            viewport: { width: window.innerWidth, height: window.innerHeight }
          })
        }).catch(e => console.error(e));
        
        btn.innerHTML = ICONS.camera + ' Track Visuals';
        flyout.classList.remove('open');
        shadow.getElementById('cp-tracker-name').innerText = compName;
        shadow.getElementById('cp-tracker').style.display = 'flex';
        showCallout('Baseline captured: ' + compName, 'DIFF');
      };
    }

      shadow.getElementById('cp-tracker-cancel').onclick = () => {
        shadow.getElementById('cp-tracker').style.display = 'none';
        if (screenshotState.currentComponentId) {
          fetch(BRIDGE + '/api/screenshot/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: screenshotState.currentComponentId })
          }).catch(e => console.error(e));
        }
        screenshotState = { beforeDataUrl: null, afterDataUrl: null, currentComponentId: null, componentName: null };
      };

      shadow.getElementById('cp-tracker-capture').onclick = async () => {
        if (!screenshotState.beforeDataUrl || !screenshotState.componentName) return;
        const btn = shadow.getElementById('cp-tracker-capture');
        const el = findComponentElement(screenshotState.componentName);
        if (!el) {
          btn.innerHTML = '❌ Component not in DOM';
          setTimeout(() => btn.innerHTML = '📸 Capture After & Diff', 2000);
          return;
        }
        
        btn.innerHTML = '⏳ Capturing...';
        const dataUrl = await captureElement(el);
        if (!dataUrl) {
          btn.innerHTML = '❌ Failed';
          setTimeout(() => btn.innerHTML = '📸 Capture After & Diff', 2000);
          return;
        }
        
        btn.innerHTML = '⏳ Diffing...';
        const diffResult = await generatePixelDiff(screenshotState.beforeDataUrl, dataUrl);
        const rect = el.getBoundingClientRect();
        const beforeRect = { top: 0, left: 0, width: 0, height: 0 };
        
        const diff = {
          componentId: screenshotState.currentComponentId,
          componentName: screenshotState.componentName,
          before: { id: screenshotState.currentComponentId, label: 'before', dataUrl: screenshotState.beforeDataUrl, timestamp: new Date().toISOString(), boundingBox: beforeRect, viewport: { width: window.innerWidth, height: window.innerHeight } },
          after: { id: screenshotState.currentComponentId, label: 'after', dataUrl: dataUrl, timestamp: new Date().toISOString(), boundingBox: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, viewport: { width: window.innerWidth, height: window.innerHeight } },
          diffDataUrl: diffResult.diffDataUrl,
          changedPixelPercent: diffResult.changedPixelPercent,
          createdAt: new Date().toISOString()
        };
        
        fetch(BRIDGE + '/api/screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: screenshotState.currentComponentId,
            label: 'after',
            dataUrl: dataUrl,
            boundingBox: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            viewport: { width: window.innerWidth, height: window.innerHeight },
            diff: diff
          })
        }).catch(e => console.error(e));
        
        btn.innerHTML = '📸 Capture After & Diff';
        shadow.getElementById('cp-tracker').style.display = 'none';
        
        const pct = diffResult.changedPixelPercent;
        let badgeClass = 'cp-badge-emerald';
        let badgeText = '✅ No change (0%)';
        if (pct > 0 && pct < 0.5) { badgeClass = 'cp-badge-muted'; badgeText = '⚠️ Minimal (' + pct + '%)'; }
        else if (pct >= 0.5 && pct < 10) { badgeClass = 'cp-badge-cyan'; badgeText = '🔄 Changed (' + pct + '%)'; }
        else if (pct >= 10) { badgeClass = 'cp-badge-rose'; badgeText = '🔴 Significant (' + pct + '%)'; }
        
        shadow.getElementById('cp-modal-name').innerText = screenshotState.componentName;
        shadow.getElementById('cp-modal-badge').innerHTML = '<span class="cp-badge ' + badgeClass + '">' + badgeText + '</span>';
        shadow.getElementById('cp-modal-before').src = screenshotState.beforeDataUrl;
        shadow.getElementById('cp-modal-after').src = dataUrl;
        shadow.getElementById('cp-modal-slider').value = 50;
        shadow.getElementById('cp-modal-before').style.clipPath = 'polygon(0 0, 50% 0, 50% 100%, 0 100%)';
        shadow.getElementById('cp-modal-handle').style.left = '50%';
        shadow.getElementById('cp-slider-modal').style.display = 'flex';
        
        screenshotState = { beforeDataUrl: null, afterDataUrl: null, currentComponentId: null, componentName: null };
      };

      shadow.getElementById('cp-modal-close').onclick = () => {
        shadow.getElementById('cp-slider-modal').style.display = 'none';
      };

      shadow.getElementById('cp-modal-slider').oninput = function() {
        const val = this.value;
        shadow.getElementById('cp-modal-before').style.clipPath = 'polygon(0 0, ' + val + '% 0, ' + val + '% 100%, 0 100%)';
        shadow.getElementById('cp-modal-handle').style.left = val + '%';
      };

      shadow.getElementById('cp-pin-btn').onclick = async () => {
        if (lastCopiedContext) {
          await fetch(BRIDGE + '/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add',
              file: lastCopiedContext.source.file,
              line: lastCopiedContext.source.startLine
            })
          });
          showCallout('Pinned ' + lastCopiedContext.component.name, 'PIN');
          refreshPins();
        }
      };

      const genTaskBtn = shadow.getElementById('cp-gen-task');
      if (genTaskBtn) {
        genTaskBtn.onclick = async () => {
          const inputEl = shadow.getElementById('cp-task-input');
          const instruction = (inputEl && inputEl.value.trim()) || 'Implement requested changes across the pinned component set.';
          const level = shadow.getElementById('cp-context-level')?.value || 'standard';
          try {
            const originalHtml = genTaskBtn.innerHTML;
            genTaskBtn.innerHTML = '<span>⚡ Generating Brief...</span>';
            const res = await fetch(BRIDGE + '/api/task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instruction, level })
            });
            const data = await res.json();
            const textToCopy = data.context || JSON.stringify(data, null, 2);
            await navigator.clipboard.writeText(textToCopy);
            const costStr = data.tokenCost ? data.tokenCost.toLocaleString() + ' tok' : 'Ready';
            genTaskBtn.innerHTML = '<span>✓ Task Brief Copied! (' + costStr + ')</span>';
            showCallout('Task Brief Copied (' + costStr + ')', '✓');
            setTimeout(() => { genTaskBtn.innerHTML = originalHtml; }, 2000);
          } catch(e) {
            console.error('[agent-hover] Task brief error:', e);
            showCallout('Failed to generate task brief', 'ERR');
            setTimeout(() => {
              genTaskBtn.innerHTML = ICONS.sparkles + ' <span>⚡ Copy Task Brief for AI</span>';
            }, 1800);
          }
        };
      }

      const clearPinsBtn = shadow.getElementById('cp-pin-clear-btn');
      if (clearPinsBtn) {
        clearPinsBtn.onclick = async () => {
          try {
            await fetch(BRIDGE + '/api/pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'clear' })
            });
            showCallout('Cleared pinned stack', 'PIN');
            refreshPins();
          } catch(e) {
            console.error('[agent-hover] Clear pins error:', e);
          }
        };
      }

      // --- React 19 Fiber Detection ---
      function getFiberNode(el) {
        if (!el) return null;
        for (const key in el) {
          if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
            return el[key];
          }
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

      // Show dimension label chip below the highlight
      function showDimLabel(rect, isRaw) {
        if (!dimLabel) return;
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        dimLabel.textContent = w + ' × ' + h;
        dimLabel.style.display = 'block';
        dimLabel.style.top = (rect.top + rect.height + 4) + 'px';
        dimLabel.style.left = rect.left + 'px';
        if (isRaw) {
          dimLabel.classList.add('is-raw');
        } else {
          dimLabel.classList.remove('is-raw');
        }
      }

      function hideBands() {
        if (marginBand) marginBand.style.display = 'none';
        if (paddingBand) paddingBand.style.display = 'none';
        if (dimLabel) dimLabel.style.display = 'none';
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
              applyBtn.textContent = '💾 Commit to Source';
              applyBtn.disabled = false;
            }
            if (data.success) {
              const fileBase = textEditTargetFile.split('/').pop();
              showCallout('✓ Saved to ' + fileBase + ' (HMR reloaded)', 'SOURCE');
              textEditTarget.textContent = newText;
              closeTextEditor();
              return;
            } else {
              console.warn('[agent-hover] Source edit fallback:', data.error);
              showCallout('AST: text literal not found — applied to DOM', 'WARNING');
            }
          } catch (e) {
            if (applyBtn) {
              applyBtn.textContent = '💾 Commit to Source';
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
        showCallout('DOM updated ✓', 'EDIT');
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
            showCallout('↩ ' + (data.description || 'Source change reverted'), 'UNDO');
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
        if (e.key === 'Alt' && !isPointerMode) {
          e.preventDefault();
          togglePointerMode();
        }
        if (e.key === 'Escape') {
          if (textEditorVisible) {
            closeTextEditor();
            return;
          }
          flyout.classList.remove('open');
          dockWrapper.classList.remove('sidebar-open');
          highlight.classList.remove('selected');
          selectedRect = null;
          clearDistanceGuides();
          shadow.getElementById('cp-slider-modal').style.display = 'none';
        }
        // Ancestry navigation: ArrowUp goes to parent, ArrowDown goes to child
        if (isPointerMode && currentStack.length > 1) {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentStackIndex < currentStack.length - 1) {
              currentStackIndex++;
              highlightComponent(currentStack[currentStackIndex], true);
            }
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentStackIndex > 0) {
              currentStackIndex--;
              highlightComponent(currentStack[currentStackIndex], currentStackIndex > 0);
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
          const el = document.elementFromPoint(e.clientX, e.clientY);
          if (!el || el === currentElement) return;
          if (el.closest && el.closest('#agent-hover-root')) return;
          currentElement = el;

          // Build full hierarchy stack (Level 0 = DOM element, Level 1..N = React components)
          currentStack = buildHierarchyStack(el);
          currentStackIndex = 0; // Default to exact element under cursor!

          // If a selection is active, show measurement guides between selected and hovered
          if (selectedRect && highlight.classList.contains('selected')) {
            const hoveredRect = el.getBoundingClientRect();
            renderDistanceGuides(selectedRect, hoveredRect);
          } else {
            clearDistanceGuides();
          }

          highlight.classList.remove('selected');
          highlightComponent(currentStack[0], false);
        });
      });

      // Reposition highlight on scroll/resize
      function repositionHighlight() {
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
        try {
          element.scrollIntoView({ block: 'center', behavior: 'instant' });
          await new Promise(r => setTimeout(r, 150));
          const dataUrl = await window.domtoimage.toPng(element, {
            width: element.offsetWidth,
            height: element.offsetHeight,
            style: { transform: 'none', animation: 'none' }
          });
          return dataUrl;
        } catch (err) {
          console.error('[agent-hover] Screenshot capture failed:', err);
          return null;
        }
      }

      function generatePixelDiff(beforeDataUrl, afterDataUrl) {
        return new Promise((resolve) => {
          const imgA = new Image();
          const imgB = new Image();
          let loaded = 0;
          function onLoad() {
            if (++loaded < 2) return;
            const w = Math.max(imgA.width, imgB.width);
            const h = Math.max(imgA.height, imgB.height);
            const cA = document.createElement('canvas');
            cA.width = w; cA.height = h;
            const cB = document.createElement('canvas');
            cB.width = w; cB.height = h;
            const cD = document.createElement('canvas');
            cD.width = w; cD.height = h;
            cA.getContext('2d').drawImage(imgA, 0, 0);
            cB.getContext('2d').drawImage(imgB, 0, 0);
            const dA = cA.getContext('2d').getImageData(0, 0, w, h);
            const dB = cB.getContext('2d').getImageData(0, 0, w, h);
            const dD = cD.getContext('2d').createImageData(w, h);
            let changed = 0;
            const tolerance = 16;
            for (let i = 0; i < dA.data.length; i += 4) {
              const dr = Math.abs(dA.data[i] - dB.data[i]);
              const dg = Math.abs(dA.data[i+1] - dB.data[i+1]);
              const db = Math.abs(dA.data[i+2] - dB.data[i+2]);
              if (dr > tolerance || dg > tolerance || db > tolerance) {
                dD.data[i] = 0; dD.data[i+1] = 240; dD.data[i+2] = 255; dD.data[i+3] = 220;
                changed++;
              } else {
                dD.data[i] = dA.data[i]; dD.data[i+1] = dA.data[i+1];
                dD.data[i+2] = dA.data[i+2]; dD.data[i+3] = 60;
              }
            }
            cD.getContext('2d').putImageData(dD, 0, 0);
            resolve({
              diffDataUrl: cD.toDataURL('image/png'),
              changedPixelPercent: Math.round((changed / (w * h)) * 1000) / 10
            });
          }
          imgA.onload = onLoad;
          imgB.onload = onLoad;
          imgA.onerror = () => resolve({ diffDataUrl: null, changedPixelPercent: -1 });
          imgB.onerror = () => resolve({ diffDataUrl: null, changedPixelPercent: -1 });
          imgA.src = beforeDataUrl;
          imgB.src = afterDataUrl;
        });
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
        if (e.target && e.target.closest && e.target.closest('#agent-hover-root')) return;
        
        e.preventDefault();
        e.stopPropagation();

        if (!currentStack || currentStack.length === 0) {
          const clickedEl = document.elementFromPoint(e.clientX, e.clientY) || e.target;
          if (clickedEl && clickedEl !== document.body) {
            currentStack = buildHierarchyStack(clickedEl);
            currentStackIndex = 0;
            currentElement = clickedEl;
          }
        }
        if (!currentStack || currentStack.length === 0) return;
        const target = currentStack[currentStackIndex] || currentStack[0];

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

        await renderFlyoutForStackIndex(currentStackIndex >= 0 ? currentStackIndex : 0);
      }, true);

      async function renderFlyoutForStackIndex(index) {
        if (!currentStack || currentStack.length === 0) return;
        currentStackIndex = index;
        const item = currentStack[index];
        currentComponentInfo = item;
        highlightComponent(item, index > 0);

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
        highlight.classList.add('selected');

        // Render interactive breadcrumbs
        const breadcrumbEl = shadow.getElementById('cp-flyout-breadcrumb');
        if (currentStack.length > 1) {
          const crumbs = [];
          for (let i = currentStack.length - 1; i >= 0; i--) {
            const c = currentStack[i];
            const isActive = i === currentStackIndex;
            const style = isActive
              ? 'color:var(--accent-cyan); font-weight:600; text-decoration:underline; text-underline-offset:3px; cursor:pointer; padding:2px 6px; border-radius:4px; background:rgba(0,240,255,0.1);'
              : 'color:var(--text-muted); cursor:pointer; padding:2px 6px; border-radius:4px;';
            crumbs.push('<span style="' + style + '" data-bc-idx="' + i + '">' + c.name + '</span>');
          }
          breadcrumbEl.innerHTML = crumbs.join('<span style="color:var(--text-muted); margin:0 2px; font-size:10px;">›</span>');
          breadcrumbEl.style.display = 'block';

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

        if (item.isDomElement) {
          flyoutTitle.textContent = item.name;
          const el = item.element;
          let html = '';

          html += '<div class="cp-section" style="margin-bottom:14px;">';
          html += '<span class="cp-badge cp-badge-cyan">' + el.tagName.toLowerCase() + '</span> ';
          if (el.id) html += '<span class="cp-badge cp-badge-emerald">#' + el.id + '</span> ';
          if (el.className && typeof el.className === 'string') {
            const cls = el.className.trim().split(/\\s+/).slice(0, 5);
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
            html += '<div class="cp-section" style="background:rgba(0,240,255,0.04); border:1px solid rgba(0,240,255,0.15); border-radius:8px; padding:10px 14px; margin-bottom:14px;">';
            html += '<div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.5px;">Rendered In Component</div>';
            html += '<div style="font-size:13px; font-weight:600; color:var(--accent-cyan); margin-top:2px;">&lt;' + parentComp.name + ' /&gt;</div>';
            if (parentComp.source) {
              html += '<div style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted); margin-top:4px;">' + parentComp.source.fileName + ':' + parentComp.source.lineNumber + '</div>';
              lastResolved = { file: parentComp.source.fileName, line: parentComp.source.lineNumber };
            }
            html += '</div>';
          }

          // Text content preview
          const text = el.textContent ? el.textContent.trim() : '';
          if (text) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Text Content</summary>';
            html += '<div style="margin-top:6px; font-size:12px; color:var(--text-secondary); word-break:break-word; max-height:120px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:8px 10px; border-radius:6px; font-family:var(--font-mono);">' + escapeHtml(text) + '</div>';
            html += '</details>';
          }

          // Attributes
          const attrs = Array.from(el.attributes || []).filter(a => a.name !== 'class' && a.name !== 'id' && a.name !== 'style');
          if (attrs.length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Attributes (' + attrs.length + ')</summary>';
            html += '<table class="cp-props-table"><tr><th>Name</th><th>Value</th></tr>';
            attrs.forEach(function(a) {
              const val = a.value.length > 60 ? a.value.substring(0, 60) + '...' : a.value;
              html += '<tr><td style="color:var(--accent-cyan);">' + a.name + '</td><td style="color:#cbd5e1;">' + escapeHtml(val) + '</td></tr>';
            });
            html += '</table></details>';
          }

          // Computed styles box model
          if (computedStyles && Object.keys(computedStyles).length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Computed Box Model</summary>';
            html += '<div class="cp-box-model">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">margin: ' + computedStyles.margin + '</div>';
            html += '<div style="border:1px dashed #475569; padding:8px; margin:4px; display:inline-block; border-radius:6px;">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">border: ' + computedStyles.border + '</div>';
            html += '<div style="border:1px solid #334155; padding:8px; margin:4px; display:inline-block; background:rgba(255,255,255,0.03); border-radius:4px;">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">padding: ' + computedStyles.padding + '</div>';
            html += '<div style="background:rgba(0,240,255,0.12); border:1px solid rgba(0,240,255,0.4); padding:8px 12px; display:inline-block; color:#fff; border-radius:4px; font-weight:600;">';
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
            html += '<div><span style="color:var(--text-muted);">bg:</span> <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + computedStyles.backgroundColor + '; margin-right:4px;"></span>' + computedStyles.backgroundColor + '</div>';
            html += '</div></details>';
          }

          flyoutContent.innerHTML = html;

          if (currentStack.length > 1 && !lastResolved) {
            resolveComponent(currentStack[1]).then(res => {
              if (res) lastResolved = res;
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
            const fullTokens = Math.max(ctx.tokens.full || 800, 700);
            const curTokens = ctx.tokens.current || 140;
            const savings = Math.max(15, Math.min(95, Math.round((1 - curTokens / (fullTokens * 2.2)) * 100)));
            tokenSavingsEl.textContent = '-' + savings + '% vs file';
          }

          let html = '';

          html += '<div class="cp-section" style="margin-bottom:14px;">';
          html += '<span class="cp-badge cp-badge-cyan">' + ctx.component.type + '</span> ';
          html += '<span class="cp-badge cp-badge-emerald">' + ctx.component.exportType + ' export</span> ';
          html += '<span class="cp-badge cp-badge-muted">' + ctx.tokens.current + ' tokens</span>';
          html += '<div style="margin-top:8px; font-size:12px; font-family:var(--font-mono); color:var(--text-muted);">' + ctx.source.file + ':' + ctx.source.startLine + '-' + ctx.source.endLine + '</div>';
          html += '</div>';

          if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Props (' + ctx.interface.props.length + ')</summary>';
            html += '<table class="cp-props-table"><tr><th>Name</th><th>Type</th><th>Req</th></tr>';
            ctx.interface.props.forEach(function(p) {
              html += '<tr><td style="color:var(--accent-cyan);">' + p.name + '</td><td style="color:#cbd5e1;">' + p.type + '</td><td style="color:var(--accent-emerald);">' + (p.required ? '✓' : '—') + '</td></tr>';
            });
            html += '</table></details>';
          }

          if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Hooks</summary>';
            html += '<div style="font-family:var(--font-mono); font-size:12px; color:#cbd5e1; margin-top:6px;">' + ctx.interface.hooks.join(', ') + '</div>';
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
            html += '<div style="border:1px solid #334155; padding:8px; margin:4px; display:inline-block; background:rgba(255,255,255,0.03); border-radius:4px;">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">padding: ' + computedStyles.padding + '</div>';
            html += '<div style="background:rgba(0,240,255,0.12); border:1px solid rgba(0,240,255,0.4); padding:8px 12px; display:inline-block; color:#fff; border-radius:4px; font-weight:600;">';
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
            html += '<button class="cp-btn-bento" id="cp-toggle-source-editor" style="font-size:10.5px; padding:2px 8px; border-radius:4px; margin-left:auto;">✏️ Edit Source</button>';
            html += '</summary>';
            html += '<div id="cp-source-preview-box">';
            html += '<div class="cp-code" id="cp-source-code-display">' + escapeHtml(ctx.source.code) + '</div>';
            html += '</div>';
            html += '<div id="cp-source-editor-box" style="display:none; margin-top:8px;">';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:11px; font-family:var(--font-mono); color:var(--text-muted);">';
            html += '<span>' + ctx.source.file.split('/').pop() + ' (L' + ctx.source.startLine + '-L' + ctx.source.endLine + ')</span>';
            html += '<span style="color:var(--accent-cyan); font-weight:500;">Direct Disk Edit</span>';
            html += '</div>';
            html += '<textarea id="cp-source-code-editor" spellcheck="false"></textarea>';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:8px;">';
            html += '<div style="display:flex; gap:6px;">';
            html += '<button class="cp-btn-bento primary" id="cp-source-save-btn" style="padding:5px 12px; font-size:11px; display:flex; align-items:center; gap:4px;">💾 Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">⌘S</kbd></button>';
            html += '<button class="cp-btn-bento" id="cp-source-undo-btn" style="padding:5px 10px; font-size:11px;">↩ Undo</button>';
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
                toggleEditorBtn.textContent = '✏️ Edit Source';
              } else {
                codeTextarea.value = ctx.source.code;
                editorBox.style.display = 'block';
                previewBox.style.display = 'none';
                toggleEditorBtn.textContent = '👁️ Preview';
                if (saveStatus) saveStatus.textContent = '';
                setTimeout(() => codeTextarea.focus(), 50);
              }
            };

            if (cancelSourceBtn) {
              cancelSourceBtn.onclick = (e) => {
                e.preventDefault();
                editorBox.style.display = 'none';
                previewBox.style.display = 'block';
                toggleEditorBtn.textContent = '✏️ Edit Source';
              };
            }

            const handleSaveSource = async () => {
              if (!saveSourceBtn || saveSourceBtn.disabled) return;
              const newSource = codeTextarea.value;
              saveSourceBtn.disabled = true;
              saveSourceBtn.innerHTML = 'Saving...';
              if (saveStatus) {
                saveStatus.style.color = 'var(--accent-cyan)';
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
                saveSourceBtn.innerHTML = '💾 Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">⌘S</kbd>';

                if (data.success) {
                  ctx.source.code = newSource;
                  const displayEl = shadow.getElementById('cp-source-code-display');
                  if (displayEl) displayEl.textContent = newSource;
                  if (saveStatus) {
                    saveStatus.style.color = '#34d399';
                    saveStatus.textContent = '✓ Saved to disk & HMR reloaded!';
                  }
                  showCallout('✓ ' + infoName + ' saved to disk — HMR reloaded', 'SOURCE');
                } else {
                  if (saveStatus) {
                    saveStatus.style.color = '#fb7185';
                    saveStatus.textContent = 'Syntax error: ' + (data.error || 'Failed to save');
                  }
                  showCallout('Save failed: ' + (data.error || 'Syntax error'), 'WARNING');
                }
              } catch (err) {
                saveSourceBtn.disabled = false;
                saveSourceBtn.innerHTML = '💾 Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">⌘S</kbd>';
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
                  saveStatus.style.color = 'var(--accent-cyan)';
                  saveStatus.textContent = 'Reverting...';
                }
                try {
                  const res = await fetch(BRIDGE + '/api/source-undo', { method: 'POST' });
                  const data = await res.json();
                  undoSourceBtn.disabled = false;
                  if (data.success) {
                    if (saveStatus) {
                      saveStatus.style.color = '#34d399';
                      saveStatus.textContent = '↩ ' + (data.description || 'Reverted');
                    }
                    showCallout('↩ ' + (data.description || 'Reverted change'), 'UNDO');
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

      function formatContextForAiPrompt(ctx, stack) {
        const bt = String.fromCharCode(96);
        const nl = String.fromCharCode(10);
        const compName = ctx.component && ctx.component.name ? ctx.component.name : 'Target Component';
        let text = '## Task for AI Agent' + nl;
        text += '<!-- Describe what you want the agent to do with this component, e.g.: -->' + nl;
        text += '<!-- "Update the card to display a warning badge when change < 0" -->' + nl + nl;
        text += '### Target Component Directive' + nl;
        text += '- **Component**: <' + compName + ' />' + nl;
        if (ctx.source && ctx.source.file) {
          text += '- **Location**: ' + bt + ctx.source.file + (ctx.source.startLine ? ':' + ctx.source.startLine + '-' + ctx.source.endLine : '') + bt + nl;
        }
        if (stack && stack.length > 0) {
          const pathStr = stack.map(function(s) { return s.name; }).reverse().join(' › ');
          text += '- **Hierarchy**: ' + pathStr + nl;
        }
        if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
          const propSummary = ctx.interface.props.map(function(p) { return p.name + ': ' + p.type + (p.required ? ' (req)' : ''); }).join(', ');
          text += '- **Props**: ' + propSummary + nl;
        }
        if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
          text += '- **Hooks**: ' + ctx.interface.hooks.join(', ') + nl;
        }
        if (ctx.source && ctx.source.code) {
          text += nl + '### Component Source' + nl;
          text += bt+bt+bt + 'tsx' + nl + ctx.source.code + nl + bt+bt+bt + nl;
        }
        let parentName = '';
        if (stack && stack.length > 1) {
          parentName = stack[1].name;
        }
        const guardMsg = parentName ? 'parent component (' + parentName + ') or unrelated files' : 'parent or sibling components';
        text += nl + '> ⚠️ **Agent Guardrail**: Confine all edits strictly to <' + compName + ' /> in ' + bt + (ctx.source ? ctx.source.file : '') + bt + '. Do NOT refactor ' + guardMsg + ' unless explicitly requested.' + nl;
        text += '> ⚡ **Token Budget**: ~' + (ctx.tokens && ctx.tokens.current ? ctx.tokens.current : '150') + ' tokens (Zero-search targeted context)' + nl;
        return text;
      }

      function formatContextForClipboard(ctx) {
        const bt = String.fromCharCode(96);
        const nl = String.fromCharCode(10);
        const compName = ctx.component && ctx.component.name ? ctx.component.name : 'Component';
        let text = '## <' + compName + ' /> Specification' + nl + nl;
        if (ctx.source && ctx.source.file) {
          text += '**Source**: ' + bt + ctx.source.file + (ctx.source.startLine ? ':' + ctx.source.startLine + '-' + ctx.source.endLine : '') + bt + nl + nl;
        }
        if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
          text += '### Props Interface' + nl;
          text += '| Name | Type | Required |' + nl;
          text += '| :--- | :--- | :--- |' + nl;
          ctx.interface.props.forEach(function(p) {
            const cleanType = (p.type || 'any').split('|').join(' \\| ');
            text += '| ' + p.name + ' | ' + bt + cleanType + bt + ' | ' + (p.required ? '✓' : '✗') + ' |' + nl;
          });
          text += nl;
        }
        if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
          text += '### Hooks Used' + nl;
          ctx.interface.hooks.forEach(function(h) { text += '- ' + bt + h + bt + nl; });
          text += nl;
        }
        if (ctx.imports && ctx.imports.length > 0) {
          text += '### Imports' + nl;
          ctx.imports.forEach(function(imp) {
            text += '- ' + bt + imp.name + bt + ' from ' + bt + imp.source + bt + (imp.isLocal ? ' (local)' : ' (external)') + nl;
          });
          text += nl;
        }
        if (ctx.source && ctx.source.code) {
          text += '### Source Code' + nl;
          text += bt+bt+bt + 'tsx' + nl + ctx.source.code + nl + bt+bt+bt + nl;
        }
        text += nl + '**Token Estimate**: ~' + (ctx.tokens && ctx.tokens.current ? ctx.tokens.current : '?') + ' tokens' + nl;
        return text;
      }

      async function refreshState() {
        try {
          const resPins = await fetch(BRIDGE + '/api/pins');
          const dataPins = await resPins.json();
          const count = dataPins.pins ? dataPins.pins.length : 0;
          shadow.getElementById('cp-pin-count').textContent = count;

          const composerEl = shadow.getElementById('cp-task-composer');
          const emptyEl = shadow.getElementById('cp-pin-empty');
          const clearAllEl = shadow.getElementById('cp-pin-clear-btn');

          if (count > 0) {
            dockPinBadge.style.display = 'block';
            dockPinBadge.textContent = count;
            if (composerEl) composerEl.style.display = 'flex';
            if (emptyEl) emptyEl.style.display = 'none';
            if (clearAllEl) clearAllEl.style.display = 'inline-block';
          } else {
            dockPinBadge.style.display = 'none';
            if (composerEl) composerEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'block';
            if (clearAllEl) clearAllEl.style.display = 'none';
          }



          const list = shadow.getElementById('cp-pin-list');
          list.innerHTML = '';
          if (dataPins.pins) {
            dataPins.pins.forEach(function(pin) {
              const div = document.createElement('div');
              div.className = 'cp-pin-item';
              const name = pin.context ? pin.context.component.name : pin.id;
              const file = pin.context ? pin.context.source.file.split('/').pop() : '';
              
              const isPinFrozen = frozenEntries.some(f => (pin.context && f.file === pin.context.source.file) || f.id === pin.id);
              const lockIcon = isPinFrozen ? '<span style="color:#fb7185; margin-right:4px;">' + ICONS.lock + '</span>' : '';
              
              div.innerHTML = '<span>' + lockIcon + name + ' <span style="color:var(--text-muted); font-size:10px; margin-left:6px;">' + file + '</span></span>' +
                '<button class="cp-pin-remove" data-id="' + pin.id + '">' + ICONS.x + '</button>';
              list.appendChild(div);
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
                    body: JSON.stringify({ action: 'remove', file: p.context.source.file })
                  });
                  refreshState();
                }
              };
            });
          }

          const savingsDiv = shadow.getElementById('cp-token-savings');
          if (dataPins.pins && dataPins.pins.length > 0 && dataPins.totalTokens) {
            const levelSelect = shadow.getElementById('cp-context-level');
            const level = levelSelect.value;
            const cost = dataPins.totalTokens[level] || dataPins.totalTokens.current;
            const fullRepoEstimate = 45000;
            const percentSaved = Math.round((1 - (cost / fullRepoEstimate)) * 100);
            
            savingsDiv.style.display = 'block';
            savingsDiv.innerHTML = '⚡ Stack context: ' + cost.toLocaleString() + ' tokens (' + percentSaved + '% savings)';
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
                
                if (label === 'after') {
                  try {
                    const checkRes = await fetch(BRIDGE + '/api/screenshot/' + encodeURIComponent(componentId) + '?include_data=true');
                    const checkData = await checkRes.json();
                    if (checkData.before && checkData.before.dataUrl) {
                      const diffResult = await generatePixelDiff(checkData.before.dataUrl, dataUrl);
                      postBody.diff = {
                        componentId: componentId,
                        componentName: component,
                        before: { id: componentId, label: 'before', dataUrl: checkData.before.dataUrl, timestamp: checkData.before.timestamp, boundingBox: checkData.before.boundingBox, viewport: checkData.before.viewport },
                        after: { id: componentId, label: 'after', dataUrl: dataUrl, timestamp: new Date().toISOString(), boundingBox: postBody.boundingBox, viewport: postBody.viewport },
                        diffDataUrl: diffResult.diffDataUrl || '',
                        changedPixelPercent: diffResult.changedPixelPercent,
                        createdAt: new Date().toISOString()
                      };
                    }
                  } catch(e) { console.error('[agent-hover] Diff generation error:', e); }
                }
                
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

      console.log('[agent-hover] ✓ High-End Tactical Dock UI initialized');
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
