import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';
import { bridge, openDemo, selectHost } from './helpers/overlay';

/**
 * The full agent loop through the real MCP server (packages/mcp/dist) over stdio, as Claude Code, Cursor or
 * Codex would run it: listen → the user sends from the browser → claim → edit → complete → Done on the page.
 */
test.describe('0.2 agent loop over MCP', () => {
  const demoDir = path.resolve(process.env.AH_DEMO_DIR || 'demo');
  const heroFile = path.join(demoDir, 'src/components/Hero.tsx');
  let original = '';
  let client: Client | null = null;

  test.beforeAll(() => { original = fs.readFileSync(heroFile, 'utf8'); });
  test.afterAll(async () => {
    fs.writeFileSync(heroFile, original);
    await client?.close();
  });

  test('listen mode picks up a task sent from the page and reports back', async ({ page }) => {
    test.setTimeout(90000);
    await openDemo(page);

    client = new Client({ name: 'claude-code', version: '1.0.0' });
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve('packages/mcp/dist/index.js')],
      cwd: demoDir,
      env: { ...process.env as Record<string, string>, AGENT_HOVER_SESSION: path.join(demoDir, '.agent-hover/session.json') },
      stderr: 'ignore',
    }));
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(['wait_for_agent_task', 'claim_agent_task', 'complete_agent_task', 'get_component_context']));

    // The agent starts listening before anything is sent.
    const listening = client.callTool({ name: 'wait_for_agent_task', arguments: { timeoutSeconds: 60 } }, undefined, { timeout: 70000 });

    // The page sees the agent connect.
    await expect(page.locator('#ah-d-mark-dot')).toHaveClass(/ok/, { timeout: 15000 });
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    await expect(page.locator('#ah-comp-dest-label')).toHaveText('Claude Code');
    const instruction = `Make the demo button say Start now ${Date.now()}`;
    await page.locator('#ah-comp-input').fill(instruction);
    await page.keyboard.press('ControlOrMeta+Enter');

    const result: any = await listening;
    const text: string = result.content[0].text;
    expect(text).toMatch(/^Claimed task \S+ from the browser/);
    expect(text).toContain(instruction);
    expect(text).toContain('src/components/Hero.tsx');
    expect(text).toContain('button#hero-primary-cta');
    const id = /Claimed task (\S+) from/.exec(text)![1];

    const marker = page.locator('.ah-marker');
    await expect(marker.locator('.spin')).toBeVisible();

    // The "agent" edits the file; HMR updates the page.
    fs.writeFileSync(heroFile, original.replace('            Book a demo\n', '            Start now\n'));
    await expect(page.locator('#hero-primary-cta')).toHaveText('Start now', { timeout: 15000 });

    const done: any = await client.callTool({ name: 'complete_agent_task', arguments: { id, summary: 'Changed the hero button label to Start now.' } });
    expect(done.isError).toBeFalsy();

    await expect(marker).toHaveClass(/done/);
    await marker.click();
    const card = page.locator('#ah-task-card');
    await expect(card.locator('.ah-summary')).toHaveText('Changed the hero button label to Start now.');
    // No file list from the agent: the bridge reports what git saw change.
    await expect(card.locator('.ah-files')).toContainText('src/components/Hero.tsx');
  });

  /** An agent as its editor runs it: the real MCP server over stdio, named like the client. */
  async function connectAgent(name: string) {
    const agent = new Client({ name, version: '1.0.0' });
    await agent.connect(new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve('packages/mcp/dist/index.js')],
      cwd: demoDir,
      env: { ...process.env as Record<string, string>, AGENT_HOVER_SESSION: path.join(demoDir, '.agent-hover/session.json') },
      stderr: 'ignore',
    }));
    return agent;
  }

  test('an agent that closes leaves the page at once, not after the timeout', async ({ page, request }) => {
    const api = bridge(request);
    await openDemo(page);
    const cursor = await connectAgent('cursor');
    await expect.poll(async () => (await api.get('/agent/presence')).agents.some((a: any) => a.client === 'cursor'), { timeout: 10000 }).toBe(true);
    await page.locator('#ah-d-mark').click();
    await expect(page.locator('#ah-conn')).toContainText('Cursor');

    const closedAt = Date.now();
    await cursor.close();
    await expect.poll(async () => (await api.get('/agent/presence')).agents.some((a: any) => a.client === 'cursor'), { timeout: 5000 }).toBe(false);
    expect(Date.now() - closedAt).toBeLessThan(5000);
    await page.locator('#ah-d-mark').click();
    await page.locator('#ah-d-mark').click();
    await expect(page.locator('#ah-conn')).not.toContainText('Cursor');
  });

  test('a task sent to one agent goes only to that agent', async ({ page }) => {
    test.setTimeout(60000);
    await openDemo(page);
    const claude = await connectAgent('claude-code');
    const cursor = await connectAgent('cursor');
    try {
      await selectHost(page, '#hero-primary-cta');
      await page.locator('#ah-pill-ask').click();
      await page.locator('#ah-comp-dest').click();
      await page.locator('#ah-dest-menu [data-v="agent:cursor"]').click();
      await expect(page.locator('#ah-comp-dest-label')).toHaveText('Cursor');

      // Claude Code is listening first, but the task is for Cursor.
      const claudeWaits = claude.callTool({ name: 'wait_for_agent_task', arguments: { timeoutSeconds: 4 } }, undefined, { timeout: 15000 });
      const instruction = `Only for Cursor ${Date.now()}`;
      await page.locator('#ah-comp-input').fill(instruction);
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(page.locator('#ah-toast')).toContainText('Sent to Cursor');

      const missed: any = await claudeWaits;
      expect(missed.content[0].text).not.toContain(instruction);
      const got: any = await cursor.callTool({ name: 'wait_for_agent_task', arguments: { timeoutSeconds: 10 } }, undefined, { timeout: 20000 });
      expect(got.content[0].text).toContain(instruction);
      const id = /Claimed task (\S+) from/.exec(got.content[0].text)![1];
      await cursor.callTool({ name: 'complete_agent_task', arguments: { id, summary: 'Nothing to change.' } });
    } finally {
      await claude.close();
      await cursor.close();
    }
  });
});
