import { describe, expect, it } from 'vitest';
import { escapeTelegramHtml, getWordCount } from './utils';

describe('getWordCount', () => {
  it('counts words in a normal sentence', () => {
    expect(getWordCount('hello world')).toBe(2);
  });

  it('returns zero for empty string', () => {
    expect(getWordCount('')).toBe(0);
  });

  it('returns zero for whitespace-only string', () => {
    expect(getWordCount('   \n\t  ')).toBe(0);
  });

  it('handles multiple spaces between words', () => {
    expect(getWordCount('one   two   three')).toBe(3);
  });

  it('handles leading and trailing whitespace', () => {
    expect(getWordCount('  hello world  ')).toBe(2);
  });

  it('handles tabs and newlines as separators', () => {
    expect(getWordCount("word1\tword2\nword3")).toBe(3);
  });

  it('counts single word', () => {
    expect(getWordCount('hello')).toBe(1);
  });

  it('handles mixed whitespace', () => {
    expect(getWordCount(' \t hello \n world \t ')).toBe(2);
  });
});

describe('escapeTelegramHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeTelegramHtml('A & B')).toBe('A &amp; B');
  });

  it('escapes less-than signs', () => {
    expect(escapeTelegramHtml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than signs', () => {
    expect(escapeTelegramHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes all three in a single string', () => {
    expect(escapeTelegramHtml('<b>bold & "nice"</b>')).toBe('&lt;b&gt;bold &amp; "nice"&lt;/b&gt;');
  });

  it('returns empty string unchanged', () => {
    expect(escapeTelegramHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(escapeTelegramHtml('hello world')).toBe('hello world');
  });

  it('handles multiple consecutive special characters', () => {
    expect(escapeTelegramHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
  });
});
