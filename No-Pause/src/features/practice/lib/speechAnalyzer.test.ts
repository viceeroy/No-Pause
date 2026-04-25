import { describe, expect, it } from 'vitest';
import { AudioAnalyzer } from './speechAnalyzer';

describe('AudioAnalyzer filler detection', () => {
  it('counts filler words with real word boundaries', () => {
    const analyzer = new AudioAnalyzer() as unknown as {
      _processTranscriptForFillerWords: (rawTranscript: string) => { processedTranscript: string; count: number };
    };

    const result = analyzer._processTranscriptForFillerWords('Um, I think you know this is, like, useful.');

    expect(result.count).toBe(3);
    expect(result.processedTranscript).toContain('**Um**');
    expect(result.processedTranscript).toContain('**you know**');
    expect(result.processedTranscript).toContain('**like**');
  });

  it('does not match fillers inside larger words', () => {
    const analyzer = new AudioAnalyzer() as unknown as {
      _processTranscriptForFillerWords: (rawTranscript: string) => { processedTranscript: string; count: number };
    };

    const result = analyzer._processTranscriptForFillerWords('The lithium theorem is unlikely.');

    expect(result.count).toBe(0);
    expect(result.processedTranscript).toBe('The lithium theorem is unlikely.');
  });
});
