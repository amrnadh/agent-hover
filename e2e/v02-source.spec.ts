import { test, expect } from '@playwright/test';
import { bridge, clickHost, openDemo, startInspect } from './helpers/overlay';

/**
 * React 19 has no _debugSource. The element's own creation stack, mapped through the dev server's source maps,
 * gives the exact file and line, even for a component that isn't in a file of its own name (InvoiceSketch lives
 * in Features.tsx, so searching for InvoiceSketch.tsx finds nothing).
 */
test('the exact file and line of an element on React 19, for a component without its own file', async ({ page, request }) => {
  const api = bridge(request);
  await openDemo(page);
  await api.post('/agent/presence', { client: 'claude-code' });
  const target = page.locator('#features').getByText('INV-0148');
  await target.scrollIntoViewIfNeeded();
  await startInspect(page);
  await clickHost(page, '#features span:text-is("INV-0148")');
  await expect(page.locator('#ah-pill-file')).toHaveText('Features.tsx:13');

  await page.locator('#ah-pill-ask').click();
  const instruction = `Make the invoice number bolder ${Date.now()}`;
  await page.locator('#ah-comp-input').fill(instruction);
  await page.keyboard.press('ControlOrMeta+Enter');
  let prompt = '';
  await expect.poll(async () => {
    const t = (await api.get('/agent/tasks?limit=20')).tasks.find((x: any) => x.instruction === instruction);
    prompt = t?.payload?.prompt || '';
    return prompt;
  }).toContain('## Where');
  expect(prompt).toContain('`<InvoiceSketch />` in `src/components/Features.tsx`');
  expect(prompt).toContain('the element is at line 13');
});

test('an element drawn by a shared UI block points to where the block is used', async ({ page, request }) => {
  const api = bridge(request);
  await openDemo(page);
  await api.post('/agent/presence', { client: 'claude-code' });
  // "Book a demo" is a <button> written inside ui/button.tsx; what you want to change is the <Button> in Hero.tsx.
  await startInspect(page);
  await clickHost(page, '#hero-primary-cta');
  await expect(page.locator('#ah-pill-file')).toHaveText('Hero.tsx:54');
  await page.locator('#ah-pill-ask').click();
  const instruction = `Make the main button larger ${Date.now()}`;
  await page.locator('#ah-comp-input').fill(instruction);
  await page.keyboard.press('ControlOrMeta+Enter');
  let prompt = '';
  await expect.poll(async () => {
    const t = (await api.get('/agent/tasks?limit=20')).tasks.find((x: any) => x.instruction === instruction);
    prompt = t?.payload?.prompt || '';
    return prompt;
  }).toContain('## Where');
  expect(prompt).toContain('in `src/components/Hero.tsx`');
  expect(prompt).toContain('the element is at line 54');
  expect(prompt).toContain('rendered through `<Button>`');
});
