import { describe, it, expect } from 'vitest';
import { estimateWordTimings } from '../word-timing.js';

describe('estimateWordTimings', () => {
  it('returns empty arrays for empty text', () => {
    const result = estimateWordTimings('', 1000);
    expect(result).toEqual({ words: [], wtimes: [], wdurations: [] });
  });

  it('returns empty arrays for whitespace-only text', () => {
    const result = estimateWordTimings('   ', 1000);
    expect(result).toEqual({ words: [], wtimes: [], wdurations: [] });
  });

  it('returns empty arrays when durationMs is zero or negative', () => {
    expect(estimateWordTimings('hello world', 0)).toEqual({
      words: [],
      wtimes: [],
      wdurations: [],
    });
    expect(estimateWordTimings('hello world', -100)).toEqual({
      words: [],
      wtimes: [],
      wdurations: [],
    });
  });

  it('assigns the full duration to a single word', () => {
    const result = estimateWordTimings('hello', 1000);
    expect(result.words).toEqual(['hello']);
    expect(result.wtimes).toEqual([0]);
    expect(result.wdurations).toEqual([1000]);
  });

  it('splits duration proportionally to word length', () => {
    // "hi" (2 chars) vs "world" (5 chars) -> roughly 2:5 split of 700ms
    const result = estimateWordTimings('hi world', 700);
    expect(result.words).toEqual(['hi', 'world']);
    expect(result.wtimes[0]).toBe(0);
    expect(result.wdurations[0]).toBeLessThan(result.wdurations[1]);
    // Second word starts right after the first ends.
    expect(result.wtimes[1]).toBe(result.wdurations[0]);
  });

  it('gives short words a minimum weight so they are not instantaneous', () => {
    const result = estimateWordTimings('a bb ccc', 900);
    for (const duration of result.wdurations) {
      expect(duration).toBeGreaterThan(0);
    }
  });

  it('collapses multiple whitespace characters between words', () => {
    const result = estimateWordTimings('hello   world\nagain', 900);
    expect(result.words).toEqual(['hello', 'world', 'again']);
  });

  it('produces cumulative, non-overlapping start times', () => {
    const result = estimateWordTimings('the quick brown fox jumps', 2500);
    for (let i = 1; i < result.wtimes.length; i++) {
      expect(result.wtimes[i]).toBe(result.wtimes[i - 1] + result.wdurations[i - 1]);
    }
  });
});
