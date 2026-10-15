import { describe, it, expect } from 'vitest';
import { lockedChanges, needsReview, reviewText, sameFile } from '../lib/review.js';

describe('review', () => {
  const done = (files: string[], review?: any) => ({ status: 'done', result: { filesChanged: files }, review });

  it('a finished change waits for review until you decide', () => {
    expect(needsReview(done(['src/a.tsx']))).toBe(true);
    expect(needsReview(done([]))).toBe(false); // nothing changed, nothing to review
    expect(needsReview({ status: 'failed', result: { filesChanged: ['src/a.tsx'] } })).toBe(false);
    expect(needsReview(done(['src/a.tsx'], { state: 'kept', at: '' }))).toBe(false);
    expect(reviewText(done(['src/a.tsx']))).toBe('Waiting for your review');
    expect(reviewText(done(['src/a.tsx'], { state: 'undone', at: '' }))).toBe('Undone');
    expect(reviewText(done(['src/a.tsx'], { state: 'followed-up', at: '' }))).toBe('Followed up');
  });

  it('matches files however each side writes the path', () => {
    expect(sameFile('src/components/Logo.tsx', '/Users/me/app/src/components/Logo.tsx')).toBe(true);
    expect(sameFile('./src/components/Logo.tsx', 'src/components/Logo.tsx')).toBe(true);
    expect(sameFile('src\\components\\Logo.tsx', 'src/components/Logo.tsx')).toBe(true);
    expect(sameFile('src/components/MyLogo.tsx', 'src/components/Logo.tsx')).toBe(false);
    expect(sameFile('', 'src/a.tsx')).toBe(false);
  });

  it('names the locked components a task changed anyway', () => {
    const locks = [{ component: 'Logo', file: 'src/components/Logo.tsx' }, { component: 'Footer', file: '/app/src/components/Footer.tsx' }, { component: 'NoFile' }];
    expect(lockedChanges(['src/components/Hero.tsx'], locks)).toEqual([]);
    expect(lockedChanges(['src/components/Logo.tsx', 'src/components/Footer.tsx'], locks)).toEqual(['Logo', 'Footer']);
    expect(lockedChanges(undefined, locks)).toEqual([]);
  });
});
