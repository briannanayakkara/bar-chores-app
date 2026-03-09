import { describe, it, expect } from 'vitest';

/**
 * Points calculation business logic
 * Mirrors the logic in StaffRewards.tsx and the points_ledger trigger
 */

interface LedgerEntry {
  delta: number;
  reason: string;
}

interface PendingRedemption {
  points_reserved: number;
  points_spent: number;
  status: string;
}

function calculatePointsTotal(entries: LedgerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.delta, 0);
}

function calculatePendingReserved(redemptions: PendingRedemption[]): number {
  return redemptions
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + (r.points_reserved || r.points_spent), 0);
}

function calculateAvailablePoints(pointsTotal: number, redemptions: PendingRedemption[]): number {
  return pointsTotal - calculatePendingReserved(redemptions);
}

describe('Points Calculation', () => {
  it('calculates points correctly from ledger entries', () => {
    const entries: LedgerEntry[] = [
      { delta: 100, reason: 'Task: Open Bar Setup' },
      { delta: 75, reason: 'Task: Polish Glassware' },
      { delta: 200, reason: 'Task: End of Night Cash Up' },
    ];
    expect(calculatePointsTotal(entries)).toBe(375);
  });

  it('handles empty ledger', () => {
    expect(calculatePointsTotal([])).toBe(0);
  });

  it('handles mixed positive and negative deltas', () => {
    const entries: LedgerEntry[] = [
      { delta: 500, reason: 'Task: Deep Clean' },
      { delta: -100, reason: 'Reward: Drink Ticket' },
      { delta: 200, reason: 'Task: Mop Floor' },
    ];
    expect(calculatePointsTotal(entries)).toBe(600);
  });

  it('reserved points are subtracted from available balance immediately', () => {
    const pointsTotal = 500;
    const redemptions: PendingRedemption[] = [
      { points_reserved: 100, points_spent: 100, status: 'pending' },
    ];
    expect(calculateAvailablePoints(pointsTotal, redemptions)).toBe(400);
  });

  it('points are restored correctly when a reward is rejected', () => {
    const pointsTotal = 500;
    const redemptions: PendingRedemption[] = [
      { points_reserved: 100, points_spent: 100, status: 'rejected' },
    ];
    // Rejected redemptions are not counted as pending
    expect(calculateAvailablePoints(pointsTotal, redemptions)).toBe(500);
  });

  it('points are permanently deducted when a reward is approved', () => {
    // After approval, a negative ledger entry is inserted, so pointsTotal decreases
    const entries: LedgerEntry[] = [
      { delta: 500, reason: 'Task: Deep Clean' },
      { delta: -100, reason: 'Reward: Drink Ticket' },
    ];
    const pointsTotal = calculatePointsTotal(entries);
    const redemptions: PendingRedemption[] = [
      { points_reserved: 100, points_spent: 100, status: 'approved' },
    ];
    // Approved redemptions are not counted as pending reserved
    expect(calculateAvailablePoints(pointsTotal, redemptions)).toBe(400);
  });

  it('multiple pending reservations reduce available points cumulatively', () => {
    const pointsTotal = 1000;
    const redemptions: PendingRedemption[] = [
      { points_reserved: 100, points_spent: 100, status: 'pending' },
      { points_reserved: 500, points_spent: 500, status: 'pending' },
      { points_reserved: 100, points_spent: 100, status: 'approved' },
    ];
    expect(calculateAvailablePoints(pointsTotal, redemptions)).toBe(400);
  });
});
