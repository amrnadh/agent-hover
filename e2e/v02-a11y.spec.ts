import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openDemo, selectHost } from './helpers/overlay';

/**
 * Accessibility (WCAG 2.1 A/AA) of Agent Hover's own UI, every surface, dark and light.
 * Only the overlay is scanned (#agent-hover-root); the demo app is not ours to judge.
 */
async function scan(page: Page, surface: string) {
  const { violations } = await new AxeBuilder({ page })
    .include('#agent-hover-root')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = serious.map((v) => `${surface}: ${v.id} (${v.impact}) ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' > ')).join('\n  ')}`);
  expect(report, report.join('\n')).toEqual([]);
}

for (const scheme of ['dark', 'light'] as const) {
  test(`overlay surfaces have no serious accessibility issues (${scheme})`, async ({ page }) => {
    test.setTimeout(90000);
    await page.emulateMedia({ colorScheme: scheme });
    await openDemo(page);
    await scan(page, 'dock');

    await page.locator('#ah-d-more').click();
    await scan(page, 'dock menu');
    await page.keyboard.press('Escape');

    await selectHost(page, '#hero-primary-cta');
    await scan(page, 'pill');
    await page.locator('#ah-pill-more').click();
    await scan(page, 'pill menu');
    await page.keyboard.press('Escape');

    await page.locator('#ah-pill-ask').click();
    await scan(page, 'composer');
    await page.keyboard.press('Escape');

    await page.keyboard.press('d');
    await expect(page.locator('#ah-side')).toBeVisible();
    await scan(page, 'sidebar: inspect');
    for (const tab of ['tasks', 'comments', 'batch']) {
      await page.locator(`#ah-tabs [data-tab=${tab}]`).click();
      await scan(page, `sidebar: ${tab}`);
    }
    await page.locator('#ah-s-gear').click();
    await expect(page.locator('#ah-set-agents')).toBeVisible();
    await scan(page, 'settings');
  });
}
