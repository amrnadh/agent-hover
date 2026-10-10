// @ts-nocheck
import { ICONS } from '../icons.js';
import type { OverlayApp } from '../app/context.js';

/** MCP setup modal with per-client config snippets. */
export function setupMcpModal(app: OverlayApp) {
  const { shadow, api } = app;

  // --- MCP Setup Modal ---
  const MCP_CONFIGS = {
    claude: {
      title: 'Claude Code',
      cli: 'claude mcp add agent-hover -- npx -y @agent-hover/mcp',
      fileLabel: 'Or add to .mcp.json (project) or ~/.claude.json (global):',
      snippet: JSON.stringify({
        mcpServers: {
          'agent-hover': {
            command: 'npx',
            args: ['-y', '@agent-hover/mcp']
          }
        }
      }, null, 2),
      lang: 'json'
    },
    cursor: {
      title: 'Cursor',
      fileLabel: 'Add to .cursor/mcp.json (project) or ~/.cursor/mcp.json (global):',
      snippet: JSON.stringify({
        mcpServers: {
          'agent-hover': {
            command: 'npx',
            args: ['-y', '@agent-hover/mcp']
          }
        }
      }, null, 2),
      lang: 'json'
    },
    windsurf: {
      title: 'Windsurf',
      fileLabel: 'Add to ~/.codeium/windsurf/mcp_config.json:',
      snippet: JSON.stringify({
        mcpServers: {
          'agent-hover': {
            command: 'npx',
            args: ['-y', '@agent-hover/mcp']
          }
        }
      }, null, 2),
      lang: 'json'
    },
    codex: {
      title: 'Codex',
      cli: 'codex mcp add agent-hover -- npx -y @agent-hover/mcp',
      fileLabel: 'Or add to ~/.codex/config.toml (global) or .codex/config.toml (project):',
      snippet: ['[mcp_servers.agent-hover]', 'command = "npx"', 'args = ["-y", "@agent-hover/mcp"]'].join(String.fromCharCode(10)),
      lang: 'toml'
    },
    antigravity: {
      title: 'Antigravity',
      cli: 'agy mcp add agent-hover -- npx -y @agent-hover/mcp',
      fileLabel: 'Or add to ~/.gemini/config/mcp_config.json:',
      snippet: JSON.stringify({
        mcpServers: {
          'agent-hover': {
            command: 'npx',
            args: ['-y', '@agent-hover/mcp']
          }
        }
      }, null, 2),
      lang: 'json'
    }
  };

  function renderMcpTab(key) {
    const cfg = MCP_CONFIGS[key];
    if (!cfg) return;
    const content = shadow.getElementById('cp-mcp-tab-content');
    if (!content) return;

    let html = '';
    if (cfg.cli) {
      html += '<div style="margin-bottom:10px; font-size:11px; font-weight:500; color:var(--text-primary);">Run in terminal:</div>';
      html += '<div style="position:relative; background:var(--bg-surface-sunken); border:1px solid var(--border-glass); border-radius:8px; padding:10px 12px; font-family:var(--font-mono); font-size:11px; word-break:break-all; color:var(--text-secondary); margin-bottom:12px;" id="cp-mcp-cli-block">' + api.escapeHtml(cfg.cli) + '<button class="cp-btn-bento" id="cp-mcp-copy-cli" style="position:absolute; top:6px; right:6px; font-size:9px; padding:2px 6px;">' + ICONS.copy + '</button></div>';
    }
    html += '<div style="margin-bottom:6px; font-size:11px; color:var(--text-muted);">' + api.escapeHtml(cfg.fileLabel) + '</div>';
    html += '<div style="position:relative; background:var(--bg-surface-sunken); border:1px solid var(--border-glass); border-radius:8px; padding:10px 12px; font-family:var(--font-mono); font-size:10.5px; white-space:pre-wrap; color:var(--text-secondary); line-height:1.5;" id="cp-mcp-snippet-block">' + api.escapeHtml(cfg.snippet) + '<button class="cp-btn-bento" id="cp-mcp-copy-snippet" style="position:absolute; top:6px; right:6px; font-size:9px; padding:2px 6px;">' + ICONS.copy + '</button></div>';

    content.innerHTML = html;

    // Tab highlighting
    shadow.querySelectorAll('.cp-mcp-tab').forEach(t => {
      t.classList.toggle('primary', t.getAttribute('data-tab') === key);
    });

    // Copy handlers
    const copyCli = shadow.getElementById('cp-mcp-copy-cli');
    if (copyCli) {
      copyCli.onclick = async () => {
        try {
          await navigator.clipboard.writeText(cfg.cli);
          copyCli.innerHTML = ICONS.check;
          setTimeout(() => { copyCli.innerHTML = ICONS.copy; }, 1500);
        } catch (_) {}
      };
    }
    const copySnippet = shadow.getElementById('cp-mcp-copy-snippet');
    if (copySnippet) {
      copySnippet.onclick = async () => {
        try {
          await navigator.clipboard.writeText(cfg.snippet);
          copySnippet.innerHTML = ICONS.check;
          setTimeout(() => { copySnippet.innerHTML = ICONS.copy; }, 1500);
        } catch (_) {}
      };
    }
  }

  // Open/close modal
  const mcpSetupBtn = shadow.getElementById('cp-mcp-setup-btn');
  const mcpModal = shadow.getElementById('cp-mcp-modal');
  if (mcpSetupBtn && mcpModal) {
    mcpSetupBtn.onclick = () => {
      mcpModal.style.display = 'flex';
      renderMcpTab('claude');
    };
  }
  shadow.getElementById('cp-mcp-modal-close')?.addEventListener('click', () => {
    if (mcpModal) mcpModal.style.display = 'none';
  });
  mcpModal?.addEventListener('click', (e) => {
    if (e.target === mcpModal) mcpModal.style.display = 'none';
  });

  // Tab switching
  shadow.querySelectorAll('.cp-mcp-tab').forEach(tab => {
    tab.onclick = () => renderMcpTab(tab.getAttribute('data-tab'));
  });
}
