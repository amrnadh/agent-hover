import { describe, it, expect } from 'vitest';
import { joinTranscript } from '../features/voice.js';

describe('voice transcript', () => {
  it('adds what was said after what was typed, with one space', () => {
    expect(joinTranscript('', ' make the header  bigger ')).toBe('make the header bigger');
    expect(joinTranscript('Make it blue.', 'and bigger')).toBe('Make it blue. and bigger');
    expect(joinTranscript('Make it blue.   ', 'and bigger')).toBe('Make it blue. and bigger');
    expect(joinTranscript('Typed only', '   ')).toBe('Typed only');
  });
});
