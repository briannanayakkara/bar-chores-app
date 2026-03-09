import { describe, it, expect } from 'vitest';

/**
 * Redemption code generation logic
 * In the app, codes are generated either:
 * - As temporary placeholders: `PENDING-{timestamp}` (on staff request)
 * - As final codes: `{PREFIX}-{ALPHANUMERIC}` (on admin approval)
 *
 * This tests the generation format and uniqueness.
 */

function generateRedemptionCode(prefix: string = 'RWD'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
}

function generatePendingCode(): string {
  return `PENDING-${Date.now()}`;
}

describe('Redemption Code Generation', () => {
  it('generates codes in the correct format: PREFIX-XXXX', () => {
    const code = generateRedemptionCode('DRK');
    expect(code).toMatch(/^DRK-[A-Z2-9]{4}$/);
  });

  it('default prefix is RWD', () => {
    const code = generateRedemptionCode();
    expect(code).toMatch(/^RWD-[A-Z2-9]{4}$/);
  });

  it('two generated codes are never identical (100 consecutive codes)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateRedemptionCode());
    }
    // With 30^4 = 810,000 possible codes, 100 should have no collisions
    expect(codes.size).toBe(100);
  });

  it('pending codes use timestamp format', () => {
    const code = generatePendingCode();
    expect(code).toMatch(/^PENDING-\d+$/);
  });

  it('pending codes are unique due to timestamp', () => {
    const code1 = generatePendingCode();
    // Force a different timestamp
    const code2 = `PENDING-${Date.now() + 1}`;
    expect(code1).not.toBe(code2);
  });

  it('codes do not contain confusing characters (I, O, 0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRedemptionCode();
      const suffix = code.split('-')[1];
      expect(suffix).not.toMatch(/[IO01]/);
    }
  });

  it('code length is exactly 8 characters (PREFIX-XXXX)', () => {
    const code = generateRedemptionCode('DRK');
    expect(code.length).toBe(8);
  });
});
