import { describe, it, expect } from 'vitest';
import { hexToRgb, DEFAULT_COLORS, DEFAULT_RGB } from '../../lib/color';

describe('hexToRgb', () => {
  it('converts standard hex colors', () => {
    expect(hexToRgb('#FF0000')).toBe('255 0 0');
    expect(hexToRgb('#00FF00')).toBe('0 255 0');
    expect(hexToRgb('#0000FF')).toBe('0 0 255');
  });

  it('handles hex without # prefix', () => {
    expect(hexToRgb('FF0000')).toBe('255 0 0');
  });

  it('converts the default primary color correctly', () => {
    expect(hexToRgb(DEFAULT_COLORS.primary)).toBe(DEFAULT_RGB.primary);
  });

  it('converts the default accent color correctly', () => {
    expect(hexToRgb(DEFAULT_COLORS.accent)).toBe(DEFAULT_RGB.accent);
  });

  it('converts the default background color correctly', () => {
    expect(hexToRgb(DEFAULT_COLORS.background)).toBe(DEFAULT_RGB.background);
  });

  it('returns fallback for invalid hex', () => {
    expect(hexToRgb('#ZZZZZZ')).toBe('96 165 250');
  });

  it('handles black and white', () => {
    expect(hexToRgb('#000000')).toBe('0 0 0');
    expect(hexToRgb('#FFFFFF')).toBe('255 255 255');
  });
});

describe('DEFAULT_COLORS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_COLORS.primary).toBe('#60A5FA');
    expect(DEFAULT_COLORS.accent).toBe('#3B82F6');
    expect(DEFAULT_COLORS.background).toBe('#0F172A');
  });
});
