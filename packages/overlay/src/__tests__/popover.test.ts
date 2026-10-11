import { describe, expect, it } from 'vitest';
import { calculatePopoverPosition } from '../lib/popover-position.js';
import { describeTaskStatus, prettyAgentName } from '../lib/task-status.js';

const vp = { width: 1280, height: 800 };
const size = { width: 360, height: 150 };
const overlaps = (a: { top: number; left: number }, t: { top: number; left: number; width: number; height: number }) =>
  a.left < t.left + t.width && a.left + size.width > t.left && a.top < t.top + t.height && a.top + size.height > t.top;

describe('calculatePopoverPosition', () => {
  it('prefers below the target, left-aligned', () => {
    const t = { top: 100, left: 200, width: 300, height: 60 };
    expect(calculatePopoverPosition(t, size, vp)).toEqual({ top: 168, left: 200, placement: 'bottom' });
  });

  it('flips above when there is no room below', () => {
    const t = { top: 600, left: 200, width: 300, height: 100 };
    const p = calculatePopoverPosition(t, size, vp);
    expect(p.placement).toBe('top');
    expect(p.top).toBe(600 - 8 - 150);
    expect(overlaps(p, t)).toBe(false);
  });

  it('goes beside a tall target, and never covers it', () => {
    const t = { top: 20, left: 100, width: 300, height: 760 };
    const p = calculatePopoverPosition(t, size, vp);
    expect(p.placement).toBe('right');
    expect(overlaps(p, t)).toBe(false);
  });

  it('uses the left side when the right is taken', () => {
    const t = { top: 20, left: 800, width: 460, height: 760 };
    const p = calculatePopoverPosition(t, size, vp);
    expect(p.placement).toBe('left');
    expect(overlaps(p, t)).toBe(false);
  });

  it('clamps horizontally inside the viewport and left of a docked sidebar', () => {
    const t = { top: 100, left: 1100, width: 120, height: 40 };
    const p = calculatePopoverPosition(t, size, { ...vp, rightInset: 440 });
    expect(p.left + size.width).toBeLessThanOrEqual(1280 - 440 - 12);
    expect(p.left).toBeGreaterThanOrEqual(12);
  });

  it('keeps clear of the dock at the bottom', () => {
    // Fits below without a dock (608 + 150 <= 788) but not with an 80px dock (<= 708).
    const t = { top: 560, left: 200, width: 300, height: 40 };
    expect(calculatePopoverPosition(t, size, vp).placement).toBe('bottom');
    const p = calculatePopoverPosition(t, size, { ...vp, bottomInset: 80 });
    expect(p.placement).toBe('top');
    expect(p.top + size.height).toBeLessThanOrEqual(t.top);
  });

  it('docks to the bottom edge when the target fills the screen', () => {
    const p = calculatePopoverPosition({ top: 0, left: 0, width: 1280, height: 800 }, size, vp);
    expect(p).toMatchObject({ placement: 'fallback', top: 800 - 12 - 150 });
  });
});

describe('task status text', () => {
  it('names known agents and title-cases unknown ones', () => {
    expect(prettyAgentName('claude-code')).toBe('Claude Code');
    expect(prettyAgentName('my-cool_agent')).toBe('My Cool Agent');
    expect(prettyAgentName(undefined)).toBe('your agent');
  });

  it('follows the §7.9 status mapping', () => {
    expect(describeTaskStatus({ status: 'queued' }, 'cursor').text).toBe('Sent to Cursor');
    expect(describeTaskStatus({ status: 'queued' }, null).text).toBe('Queued · no agent connected');
    expect(describeTaskStatus({ status: 'delivered' }, 'claude-code').text).toBe('Seen by Claude Code');
    expect(describeTaskStatus({ status: 'in_progress', claimedBy: 'codex' })).toEqual({ text: 'Codex is working…', tone: 'working' });
    expect(describeTaskStatus({ status: 'done', result: { filesChanged: ['a', 'b'], summary: 'Bigger CTA' } })).toEqual({
      text: 'Done · 2 files',
      tone: 'success',
      detail: 'Bigger CTA',
    });
    expect(describeTaskStatus({ status: 'done', result: { filesChanged: ['a'] } }).text).toBe('Done · 1 file');
    expect(describeTaskStatus({ status: 'failed', result: { error: 'Type error' } })).toMatchObject({ tone: 'error', detail: 'Type error' });
  });
});
