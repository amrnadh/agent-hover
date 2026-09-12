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
          #cp-dock-wrapper, #cp-flyout, #cp-tracker, #cp-slider-modal {
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
            width: 480px;
            max-height: calc(100vh - 60px);
            background: var(--bg-dock-panel);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            border: 1px solid var(--border-glass);
            border-radius: 24px;
            color: var(--text-primary);
            font-family: var(--font-sans);
            box-shadow: var(--shadow-dock);
            z-index: 1000000;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }

          #cp-flyout.open {
            opacity: 1;
            pointer-events: auto;
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

          #cp-dock-wrapper.cp-dock-right #cp-flyout {
            left: auto;
            right: 82px;
          }

          #cp-dock-wrapper.cp-dock-bottom #cp-flyout {
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

          .cp-section { margin-bottom: 18px; }
          .cp-section-title {
            font-family: var(--font-mono);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--text-muted);
            margin-bottom: 8px;
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            gap: 6px;
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
            padding: 12px 14px;
            font-family: var(--font-mono);
            font-size: 11.5px;
            overflow-x: auto;
            white-space: pre;
            max-height: 240px;
            overflow-y: auto;
            line-height: 1.5;
            margin-top: 8px;
            color: #cbd5e1;
          }

          .cp-props-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 8px;
          }
          .cp-props-table th {
            text-align: left; padding: 6px 8px; color: var(--text-muted);
            border-bottom: 1px solid var(--border-glass); font-weight: 500;
            font-family: var(--font-mono); font-size: 11px;
          }
          .cp-props-table td {
            padding: 6px 8px; border-bottom: 1px solid var(--border-glass);
            font-family: var(--font-mono); font-size: 11px;
          }

          .cp-badge {
            display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px;
            font-family: var(--font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.2px;
          }
          .cp-badge-cyan { background: rgba(0, 240, 255, 0.12); color: var(--accent-cyan); border: 1px solid rgba(0, 240, 255, 0.3); }
          .cp-badge-emerald { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
          .cp-badge-muted { background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border: 1px solid var(--border-glass); }
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

          /* --- Highlight Box --- */
          #cp-highlight {
            position: fixed;
            pointer-events: none;
            z-index: 999997;
            border: 2px solid var(--accent-cyan);
            background: rgba(0, 240, 255, 0.08);
            box-shadow: 0 0 20px var(--accent-cyan-glow), inset 0 0 12px rgba(0, 240, 255, 0.04);
            border-radius: 2px;
            display: none;
            transition: all 80ms ease-out;
            box-sizing: border-box;
          }
          #cp-highlight.selected {
            border-color: var(--accent-cyan);
            box-shadow: 0 0 24px var(--accent-cyan-glow), inset 0 0 16px rgba(0, 240, 255, 0.08);
          }
          #cp-highlight.is-raw {
            border-color: rgba(99, 179, 237, 0.85);
            background: rgba(99, 179, 237, 0.06);
            box-shadow: 0 0 16px rgba(99, 179, 237, 0.25);
          }

          /* 8 Selection Handles (Design Mode style) */
          .cp-handle {
            position: absolute;
            width: 7px;
            height: 7px;
            background: var(--accent-cyan);
            border: 1.5px solid #04070e;
            border-radius: 1px;
            box-shadow: 0 0 6px var(--accent-cyan-glow);
            pointer-events: none;
            transform: translate(-50%, -50%);
            display: none;
          }
          #cp-highlight.selected .cp-handle {
            display: block;
          }
          #cp-highlight.is-raw .cp-handle {
            background: #63b3ed;
            box-shadow: 0 0 6px rgba(99, 179, 237, 0.6);
          }
          .cp-handle-nw { top: 0; left: 0; }
          .cp-handle-n  { top: 0; left: 50%; }
          .cp-handle-ne { top: 0; left: 100%; }
          .cp-handle-e  { top: 50%; left: 100%; }
          .cp-handle-se { top: 100%; left: 100%; }
          .cp-handle-s  { top: 100%; left: 50%; }
          .cp-handle-sw { top: 100%; left: 0; }
          .cp-handle-w  { top: 50%; left: 0; }

          /* Box-model bands — asymmetric border-widths show real spacing */
          #cp-margin-band {
            position: fixed;
            pointer-events: none;
            z-index: 999996;
            box-sizing: border-box;
            background: transparent;
            border-style: solid;
            border-color: rgba(255, 99, 99, 0.28);
            border-width: 0;
            display: none;
            transition: all 80ms ease-out;
          }
          #cp-padding-band {
            position: fixed;
            pointer-events: none;
            z-index: 999998;
            box-sizing: border-box;
            background: transparent;
            border-style: solid;
            border-color: rgba(124, 200, 134, 0.30);
            border-width: 0;
            display: none;
            transition: all 80ms ease-out;
          }

          /* Dimension label chip */
          #cp-dim-label {
            position: fixed;
            pointer-events: none;
            z-index: 999999;
            background: var(--accent-cyan);
            color: #04070e;
            font-size: 10px;
            font-family: var(--font-mono);
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 3px;
            display: none;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
          }
          #cp-dim-label.is-raw {
            background: #63b3ed;
          }

          #cp-label {
            position: absolute;
            top: -30px;
            left: -2px;
            background: rgba(10, 16, 26, 0.95);
            backdrop-filter: blur(16px);
            border: 1px solid var(--accent-cyan);
            color: var(--accent-cyan);
            font-family: var(--font-mono);
            font-size: 11px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 6px;
            white-space: nowrap;
            max-width: 480px;
            overflow: hidden;
            text-overflow: ellipsis;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 12px var(--accent-cyan-glow);
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
                <span class="cp-badge cp-badge-cyan">LENS</span>
                <h3 id="cp-flyout-title">Component Inspector</h3>
              </div>
              <button class="cp-dock-tile" id="cp-flyout-close" style="width:30px; height:30px; border-radius:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div id="cp-flyout-breadcrumb" style="display:none; padding:8px 20px; background:rgba(0,0,0,0.15); border-bottom:1px solid var(--border-glass); font-family:var(--font-mono); font-size:11px; overflow-x:auto; white-space:nowrap;">
            </div>

            <div id="cp-flyout-content">
              <p style="color:var(--text-secondary); margin:0;">Point and click any element on the page, or press <kbd style="font-family:var(--font-mono); background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">Alt</kbd> to inspect.</p>
            </div>

            <div class="cp-flyout-actions">
              <button class="cp-btn-bento primary" id="cp-editor-btn"><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg> Open in IDE</button>
              <button class="cp-btn-bento" id="cp-copy"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy Context</button>
              <button class="cp-btn-bento" id="cp-pin-btn"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg> Pin Component</button>
              <button class="cp-btn-bento" id="cp-track-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg> Track Visuals</button>
            </div>

            <div id="cp-pin-bar">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Pinned Stack (<span id="cp-pin-count">0</span>)</span>
              </div>
              <div id="cp-pin-list"></div>
              
              <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); font-family:var(--font-mono);">
                  <span>Context Level:</span>
                  <select id="cp-context-level" style="background: rgba(0,0,0,0.4); color: var(--text-primary); border: 1px solid var(--border-glass); border-radius: 6px; padding: 3px 6px; font-size: 11px; font-family:var(--font-mono);">
                    <option value="minimal">Minimal (Name + Props)</option>
                    <option value="standard" selected>Standard (+ Source + Imports)</option>
                    <option value="full">Full (+ Relations + Styles)</option>
                  </select>
                </div>
                <div id="cp-token-savings" style="font-size: 11px; color: var(--accent-cyan); font-family:var(--font-mono); font-weight: 500; display: none;"></div>
                <button class="cp-btn-bento primary" id="cp-gen-task" style="width:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Generate Task Context</button>
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
        <div id="cp-dim-label"></div>

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
      const dimLabel = shadow.getElementById('cp-dim-label');
      const flyout = shadow.getElementById('cp-flyout');
      const flyoutTitle = shadow.getElementById('cp-flyout-title');
      const flyoutContent = shadow.getElementById('cp-flyout-content');



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
      };

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

      shadow.getElementById('cp-copy').onclick = async () => {
        if (lastCopiedContext) {
          const text = formatContextForClipboard(lastCopiedContext);
          await navigator.clipboard.writeText(text);
          const btn = shadow.getElementById('cp-copy');
          btn.innerHTML = '✓ Copied!';
          showCallout('Context Copied to Clipboard', '✓');
          setTimeout(() => btn.innerHTML = ICONS.copy + ' Copy Context', 1600);
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
      shadow.getElementById('cp-track-btn').onclick = async () => {
        if (!lastCopiedContext || !currentElement) return;
        const btn = shadow.getElementById('cp-track-btn');
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

      shadow.getElementById('cp-gen-task').onclick = async () => {
        const instruction = prompt('Describe the task for your AI agent:');
        if (!instruction) return;
        const level = shadow.getElementById('cp-context-level')?.value || 'standard';
        try {
          const res = await fetch(BRIDGE + '/api/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction, level })
          });
          const data = await res.json();
          await navigator.clipboard.writeText(data.context || JSON.stringify(data, null, 2));
          showCallout('Task context copied (' + (data.tokenCost || '?') + ' tokens)', '✓');
          alert('Task context copied to clipboard! (' + (data.tokenCost || '?') + ' tokens)');
        } catch(e) {
          alert('Failed to generate task context');
        }
      };

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

      // Position margin/padding bands around an element (design-mode style)
      function positionBands(el) {
        if (!el || !marginBand || !paddingBand) return;
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const px = (v) => parseFloat(v) || 0;
        const mt = px(cs.marginTop), mr = px(cs.marginRight), mb = px(cs.marginBottom), ml = px(cs.marginLeft);
        const pt = px(cs.paddingTop), pr = px(cs.paddingRight), pb = px(cs.paddingBottom), pl = px(cs.paddingLeft);
        const bt = px(cs.borderTopWidth), brw = px(cs.borderRightWidth), bb = px(cs.borderBottomWidth), blw = px(cs.borderLeftWidth);

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
      }

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
        if (isFrozen) {
          highlight.style.border = '2px solid rgba(244, 63, 94, 0.85)';
          highlight.style.backgroundColor = 'rgba(244, 63, 94, 0.1)';
          highlight.style.boxShadow = '0 0 20px rgba(244, 63, 94, 0.4)';
        } else if (info.isDomElement) {
          highlight.style.border = '2px solid rgba(99, 179, 237, 0.85)';
          highlight.style.backgroundColor = 'rgba(99, 179, 237, 0.06)';
          highlight.style.boxShadow = '0 0 16px rgba(99, 179, 237, 0.25)';
        } else {
          highlight.style.border = '2px solid var(--accent-cyan)';
          highlight.style.backgroundColor = 'rgba(0, 240, 255, 0.08)';
          highlight.style.boxShadow = '0 0 20px var(--accent-cyan-glow)';
        }

        if (rect.top < 36) {
          label.style.top = '4px';
          label.style.borderRadius = '0 0 8px 8px';
        } else {
          label.style.top = '-30px';
          label.style.borderRadius = '8px 8px 0 0';
        }

        const lockHtml = isFrozen ? '<span style="color:#fb7185; margin-right:4px;">' + ICONS.lock + '</span>' : '';

        // Build ancestry breadcrumbs
        let breadcrumb = '';
        if (currentStack.length > 1) {
          const crumbs = [];
          for (let i = currentStack.length - 1; i >= 0; i--) {
            const c = currentStack[i];
            const isActive = i === currentStackIndex;
            const style = isActive
              ? 'color:var(--accent-cyan); text-decoration:underline; text-underline-offset:3px; font-weight:600;'
              : 'color:var(--text-muted); cursor:pointer;';
            crumbs.push('<span style="' + style + ' font-size:10px;" data-stack-idx="' + i + '">' + c.name + '</span>');
          }
          breadcrumb = '<div style="display:flex; align-items:center; gap:2px; flex-wrap:wrap; margin-top:2px;">' + crumbs.join('<span style="color:var(--text-muted); font-size:9px; margin:0 1px;">›</span>') + '</div>';
        }

        if (info.isDomElement) {
          const textPreview = info.textPreview ? ' <span style="color:var(--text-muted); font-size:10px; opacity:0.8;">"' + info.textPreview + '"</span>' : '';
          const parentComp = currentStack.length > 1 ? '<span style="color:var(--accent-cyan); margin-right:4px;">' + currentStack[1].name + ' ›</span>' : '';
          label.innerHTML = lockHtml + parentComp + '<span style="color:#63b3ed;">' + info.name + '</span>' + textPreview + breadcrumb;
          label.style.borderColor = 'rgba(99, 179, 237, 0.6)';
          label.style.color = '#63b3ed';
          showCallout(info.name, Math.round(rect.width) + ' × ' + Math.round(rect.height));
          if (info.element) positionBands(info.element);
        } else if (info.source) {
          const fileName = info.source.fileName.split('/').pop();
          label.innerHTML = lockHtml + info.name + ' — ' + fileName + ':' + info.source.lineNumber + breadcrumb;
          label.style.borderColor = isFrozen ? '#f43f5e' : 'var(--accent-cyan)';
          label.style.color = isFrozen ? '#fb7185' : 'var(--accent-cyan)';
          showCallout('<' + info.name + ' />', fileName + ':' + info.source.lineNumber);
          if (currentElement) positionBands(currentElement);
        } else {
          label.innerHTML = lockHtml + info.name + breadcrumb;
          label.style.borderColor = isFrozen ? '#f43f5e' : 'var(--accent-cyan)';
          label.style.color = isFrozen ? '#fb7185' : 'var(--accent-cyan)';
          showCallout('<' + info.name + ' />', 'Component');
          if (currentElement) positionBands(currentElement);
        }

        showDimLabel(rect, info.isDomElement);
      }

      // --- Keyboard Shortcuts ---
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Alt' && !isPointerMode) {
          e.preventDefault();
          togglePointerMode();
        }
        if (e.key === 'Escape') {
          flyout.classList.remove('open');
          highlight.classList.remove('selected');
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
          positionBands(target.element);
          showDimLabel(rect, true);
        } else if (target.fiber) {
          const rect = getComponentBoundingRect(target.fiber);
          if (rect) {
            highlight.style.top = rect.top + 'px';
            highlight.style.left = rect.left + 'px';
            highlight.style.width = rect.width + 'px';
            highlight.style.height = rect.height + 'px';
            if (currentElement) positionBands(currentElement);
            showDimLabel(rect, false);
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

        flyout.classList.add('open');
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
            html += '<details class="cp-section">';
            html += '<summary class="cp-section-title">Source Preview</summary>';
            html += '<div class="cp-code">' + escapeHtml(ctx.source.code) + '</div>';
            html += '</details>';
          }

          flyoutContent.innerHTML = html;
        } catch(err) {
          flyoutContent.innerHTML = '<p style="color:#fb7185;">Failed to load context: ' + err.message + '</p>';
        }
      }

      async function resolveComponent(info) {
        if (info.source) {
          return { file: info.source.fileName, line: info.source.lineNumber };
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
          const count = dataPins.pins ? dataPins.pins.length : 0;
          shadow.getElementById('cp-pin-count').textContent = count;

          if (count > 0) {
            dockPinBadge.style.display = 'block';
            dockPinBadge.textContent = count;

          } else {
            dockPinBadge.style.display = 'none';

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
