import { describe, it, expect } from 'vitest';
import { joinTranscript, mergeTranscript } from '../features/voice.js';

describe('Talk & point markers', () => {
  it('puts each marker where you were in the sentence when you clicked', () => {
    // Clicked before anything was heard, then after "make this", then at the end.
    expect(mergeTranscript(['make this match that'], [
      { n: 1, index: -1, offset: 0 },
      { n: 2, index: 0, offset: 9 },
      { n: 3, index: 0, offset: 20 },
    ])).toBe('[1] make this [2] match that [3]');
  });

  it('moves a marker to the end of the word it fell in, and copes with revised or shorter results', () => {
    // "mat" was being heard when you clicked; the browser later heard "match".
    expect(mergeTranscript(['make it match'], [{ n: 1, index: 0, offset: 11 }])).toBe('make it match [1]');
    expect(mergeTranscript(['make it', ' bigger'], [{ n: 1, index: 0, offset: 40 }])).toBe('make it [1] bigger');
    expect(mergeTranscript(['  make   this '], [{ n: 1, index: 0, offset: 7 }])).toBe('make [1] this');
  });

  it('keeps several markers at one spot in click order, and works with no speech at all', () => {
    expect(mergeTranscript(['swap these'], [{ n: 2, index: 0, offset: 10 }, { n: 1, index: 0, offset: 10 }])).toBe('swap these [1] [2]');
    expect(mergeTranscript([], [{ n: 1, index: -1, offset: 0 }])).toBe('[1]');
  });
});

describe('voice transcript', () => {
  it('adds what was said after what was typed, with one space', () => {
    expect(joinTranscript('', ' make the header  bigger ')).toBe('make the header bigger');
    expect(joinTranscript('Make it blue.', 'and bigger')).toBe('Make it blue. and bigger');
    expect(joinTranscript('Make it blue.   ', 'and bigger')).toBe('Make it blue. and bigger');
    expect(joinTranscript('Typed only', '   ')).toBe('Typed only');
  });
});
