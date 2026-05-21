import { describe, expect, it } from 'vitest';
import { formatDuration, formatPracticeTotalDuration } from './time';

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats exact minutes', () => {
    expect(formatDuration(120)).toBe('2m');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
  });

  it('floors fractional seconds', () => {
    expect(formatDuration(45.9)).toBe('45s');
  });

  it('treats negative values as zero', () => {
    expect(formatDuration(-10)).toBe('0s');
  });

  it('treats NaN as zero', () => {
    expect(formatDuration(NaN)).toBe('0s');
  });

  it('handles large values', () => {
    expect(formatDuration(3661)).toBe('61m 1s');
  });

  it('formats one minute exactly', () => {
    expect(formatDuration(60)).toBe('1m');
  });

  it('formats one minute and one second', () => {
    expect(formatDuration(61)).toBe('1m 1s');
  });
});

describe('formatPracticeTotalDuration', () => {
  it('shows seconds when under one minute', () => {
    expect(formatPracticeTotalDuration(45)).toBe('45s');
  });

  it('shows zero seconds for zero', () => {
    expect(formatPracticeTotalDuration(0)).toBe('0s');
  });

  it('shows minutes only at one minute', () => {
    expect(formatPracticeTotalDuration(60)).toBe('1m');
  });

  it('shows minutes only, dropping remaining seconds', () => {
    expect(formatPracticeTotalDuration(90)).toBe('1m');
  });

  it('floors fractional seconds', () => {
    expect(formatPracticeTotalDuration(119.9)).toBe('1m');
  });

  it('treats negative values as zero', () => {
    expect(formatPracticeTotalDuration(-5)).toBe('0s');
  });

  it('treats NaN as zero', () => {
    expect(formatPracticeTotalDuration(NaN)).toBe('0s');
  });
});
