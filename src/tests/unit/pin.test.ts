import { describe, it, expect } from 'vitest';

/**
 * PIN validation logic
 * The admin-actions Edge Function requires PIN to be at least 4 digits.
 * The UI input uses inputMode="numeric" but doesn't enforce format client-side.
 * These tests validate the expected PIN rules.
 */

function validatePin(pin: string): { valid: boolean; error?: string } {
  if (!pin || pin.length === 0) {
    return { valid: false, error: 'PIN is required' };
  }
  if (!/^\d+$/.test(pin)) {
    return { valid: false, error: 'PIN must be numeric only' };
  }
  if (pin.length !== 4) {
    return { valid: false, error: 'PIN must be exactly 4 digits' };
  }
  return { valid: true };
}

describe('PIN Validation', () => {
  it('PIN must be exactly 4 digits', () => {
    expect(validatePin('1234')).toEqual({ valid: true });
  });

  it('PIN must be numeric only', () => {
    expect(validatePin('12ab')).toEqual({ valid: false, error: 'PIN must be numeric only' });
  });

  it('empty PIN is rejected', () => {
    expect(validatePin('')).toEqual({ valid: false, error: 'PIN is required' });
  });

  it('PIN with letters is rejected', () => {
    expect(validatePin('abcd')).toEqual({ valid: false, error: 'PIN must be numeric only' });
  });

  it('PIN too short is rejected', () => {
    expect(validatePin('123')).toEqual({ valid: false, error: 'PIN must be exactly 4 digits' });
  });

  it('PIN too long is rejected', () => {
    expect(validatePin('12345')).toEqual({ valid: false, error: 'PIN must be exactly 4 digits' });
  });

  it('PIN with special characters is rejected', () => {
    expect(validatePin('12!4')).toEqual({ valid: false, error: 'PIN must be numeric only' });
  });

  it('PIN with spaces is rejected', () => {
    expect(validatePin('12 4')).toEqual({ valid: false, error: 'PIN must be numeric only' });
  });

  it('all-zeros PIN is valid', () => {
    expect(validatePin('0000')).toEqual({ valid: true });
  });
});
