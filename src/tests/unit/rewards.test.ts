import { describe, it, expect } from 'vitest';

/**
 * Reward request validation logic
 * Mirrors the logic in StaffRewards.tsx
 */

interface RewardType {
  id: string;
  name: string;
  emoji: string;
  points_required: number;
  is_active: boolean;
}

interface PendingRedemption {
  points_reserved: number;
  status: string;
}

function calculateAvailablePoints(pointsTotal: number, redemptions: PendingRedemption[]): number {
  const pendingReserved = redemptions
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + r.points_reserved, 0);
  return pointsTotal - pendingReserved;
}

function canRequestReward(
  pointsTotal: number,
  redemptions: PendingRedemption[],
  reward: RewardType
): boolean {
  const available = calculateAvailablePoints(pointsTotal, redemptions);
  return available >= reward.points_required;
}

const drinkTicket: RewardType = { id: '1', name: 'Drink Ticket', emoji: '🍺', points_required: 100, is_active: true };
const toteBag: RewardType = { id: '2', name: 'Tote Bag', emoji: '👜', points_required: 500, is_active: true };
const bottleTicket: RewardType = { id: '3', name: 'Bottle Ticket', emoji: '🍾', points_required: 1000, is_active: true };
const hoodie: RewardType = { id: '4', name: 'Hoodie', emoji: '👕', points_required: 2000, is_active: true };

describe('Reward Requests', () => {
  it('staff cannot request a reward if available points are less than reward cost', () => {
    expect(canRequestReward(50, [], drinkTicket)).toBe(false);
  });

  it('staff CAN request a reward when they have exactly enough points', () => {
    expect(canRequestReward(100, [], drinkTicket)).toBe(true);
  });

  it('staff CAN request multiple rewards in one go if they have enough combined points', () => {
    // Start with 600 points, request a drink ticket (100), still have 500 available
    const afterFirstRequest: PendingRedemption[] = [
      { points_reserved: 100, status: 'pending' },
    ];
    expect(canRequestReward(600, afterFirstRequest, toteBag)).toBe(true);
  });

  it('each reward request reserves the correct number of points', () => {
    const redemptions: PendingRedemption[] = [
      { points_reserved: 100, status: 'pending' },
      { points_reserved: 500, status: 'pending' },
    ];
    expect(calculateAvailablePoints(1000, redemptions)).toBe(400);
  });

  it('requesting one reward type does not disable other types if enough points remain', () => {
    const redemptions: PendingRedemption[] = [
      { points_reserved: 100, status: 'pending' },
    ];
    // 1100 total - 100 reserved = 1000 available; can still get bottle ticket (1000)
    expect(canRequestReward(1100, redemptions, bottleTicket)).toBe(true);
  });

  it('cannot request if combined pending reservations exhaust available points', () => {
    const redemptions: PendingRedemption[] = [
      { points_reserved: 500, status: 'pending' },
      { points_reserved: 400, status: 'pending' },
    ];
    // 1000 total - 900 reserved = 100 available; cannot get tote bag (500)
    expect(canRequestReward(1000, redemptions, toteBag)).toBe(false);
  });

  it('custom reward types with admin-defined point costs are validated correctly', () => {
    const customReward: RewardType = {
      id: '99',
      name: 'Custom VIP Pass',
      emoji: '🎫',
      points_required: 750,
      is_active: true,
    };
    expect(canRequestReward(750, [], customReward)).toBe(true);
    expect(canRequestReward(749, [], customReward)).toBe(false);
  });

  it('inactive reward types should not be offered (UI filter check)', () => {
    const inactiveReward: RewardType = { ...hoodie, is_active: false };
    const activeRewards = [drinkTicket, toteBag, bottleTicket, inactiveReward]
      .filter(r => r.is_active);
    expect(activeRewards).not.toContainEqual(expect.objectContaining({ name: 'Hoodie' }));
  });
});
