import { test, expect, type Locator, type Page } from '@playwright/test';
import { openDemo, startInspect } from './helpers/overlay';

/**
 * The demo app stages a moment for each feature the GitHub demo video shows (e2e/record-demo.spec.ts).
 * This keeps those moments in place, so a change to the demo can't quietly break the recording.
 */
async function hoverAt(page: Page, target: Locator, fx: number, fy: number) {
  const b = (await target.boundingBox())!;
  await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy, { steps: 3 });
}

test('the demo stages each moment the video shows', async ({ page }) => {
  await openDemo(page);
  await startInspect(page);
  const label = page.locator('#ah-hover-label');

  // Point instead of describe: an underline nobody knows the name of.
  await hoverAt(page, page.locator('#hero-headline svg'), 0.5, 0.2);
  await expect(label).toContainText('<Squiggle />');

  // Like this, not that: the 4th tile is a one-off, the others are <StatCard>.
  await page.evaluate(() => window.scrollTo(0, 330));
  const tiles = page.locator('#overview-stats > *');
  await hoverAt(page, tiles.nth(0), 0.04, 0.5);
  await expect(label).toContainText('<StatCard />');
  await hoverAt(page, tiles.nth(3), 0.05, 0.5);
  await expect(label).toContainText('div.rounded-md');

  // Notes where they belong: the Amount header sits left of right-aligned amounts; one date is ISO.
  await page.evaluate(() => document.getElementById('recent-invoices')!.scrollIntoView({ block: 'center' }));
  const align = (el: Element) => getComputedStyle(el).textAlign;
  expect(await page.locator('#recent-invoices th', { hasText: 'Amount' }).evaluate(align)).not.toBe('right');
  expect(await page.locator('#recent-invoices td', { hasText: '$7,200' }).evaluate(align)).toBe('right');
  await expect(page.locator('#recent-invoices td', { hasText: '2026-09-29' })).toHaveCount(1);

  // Add what's missing: the table header row has room for a button.
  await hoverAt(page, page.locator('#recent-invoices > div').first(), 0.6, 0.9);
  await expect(label).toContainText('div.flex');

  // Keep agents off it: the logo is its own component.
  await page.evaluate(() => window.scrollTo(0, 0));
  await hoverAt(page, page.locator('a[aria-label="Sorrel home"] > span'), 0.75, 0.5);
  await expect(label).toContainText('<Logo />');
});
