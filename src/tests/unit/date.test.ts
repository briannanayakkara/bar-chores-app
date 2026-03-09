import { describe, it, expect } from 'vitest';
import { getLocalDate } from '../../lib/date';

describe('getLocalDate', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const result = getLocalDate(new Date(2026, 2, 9)); // March 9, 2026
    expect(result).toBe('2026-03-09');
  });

  it('pads single-digit months', () => {
    const result = getLocalDate(new Date(2026, 0, 15)); // January 15
    expect(result).toBe('2026-01-15');
  });

  it('pads single-digit days', () => {
    const result = getLocalDate(new Date(2026, 11, 5)); // December 5
    expect(result).toBe('2026-12-05');
  });

  it('handles end of year', () => {
    const result = getLocalDate(new Date(2026, 11, 31)); // December 31
    expect(result).toBe('2026-12-31');
  });

  it('handles start of year', () => {
    const result = getLocalDate(new Date(2026, 0, 1)); // January 1
    expect(result).toBe('2026-01-01');
  });

  it('defaults to current date when no argument provided', () => {
    const result = getLocalDate();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});
