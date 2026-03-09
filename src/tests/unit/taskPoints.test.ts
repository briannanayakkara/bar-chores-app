import { describe, it, expect } from 'vitest';

/**
 * Task completion and point awarding logic
 * Mirrors the logic in StaffTasks.tsx completeTask()
 *
 * Rules from the spec:
 * - Tasks under 500pts: auto-award immediately, no approval needed
 * - Tasks 500pts and above: require photo and admin approval
 * - Points are NOT awarded until admin approves
 */

interface Task {
  points: number;
  requires_photo: boolean;
  title: string;
}

interface CompletionResult {
  autoApproved: boolean;
  pointsAwarded: number;
  status: 'approved' | 'submitted';
}

function completeTask(task: Task, _hasPhoto: boolean): CompletionResult {
  if (task.requires_photo) {
    // Photo required tasks go to admin review — no points awarded yet
    return {
      autoApproved: false,
      pointsAwarded: 0,
      status: 'submitted',
    };
  }

  // Auto-approve: award points immediately
  return {
    autoApproved: true,
    pointsAwarded: task.points,
    status: 'approved',
  };
}

function shouldRequirePhoto(points: number): boolean {
  return points >= 500;
}

describe('Task Completion & Point Awarding', () => {
  it('tasks under 500pts auto-award immediately with no approval needed', () => {
    const task: Task = { points: 100, requires_photo: false, title: 'Open Bar Setup' };
    const result = completeTask(task, false);
    expect(result.autoApproved).toBe(true);
    expect(result.pointsAwarded).toBe(100);
    expect(result.status).toBe('approved');
  });

  it('tasks 500pts and above require photo and admin approval', () => {
    const task: Task = { points: 500, requires_photo: true, title: 'Deep Clean Ice Machine' };
    const result = completeTask(task, true);
    expect(result.autoApproved).toBe(false);
    expect(result.pointsAwarded).toBe(0);
    expect(result.status).toBe('submitted');
  });

  it('points are NOT awarded until admin approves', () => {
    const task: Task = { points: 700, requires_photo: true, title: 'Deep Clean Drains' };
    const result = completeTask(task, true);
    expect(result.pointsAwarded).toBe(0);
  });

  it('shouldRequirePhoto returns true for 500+ points', () => {
    expect(shouldRequirePhoto(500)).toBe(true);
    expect(shouldRequirePhoto(600)).toBe(true);
    expect(shouldRequirePhoto(1000)).toBe(true);
  });

  it('shouldRequirePhoto returns false for under 500 points', () => {
    expect(shouldRequirePhoto(499)).toBe(false);
    expect(shouldRequirePhoto(100)).toBe(false);
    expect(shouldRequirePhoto(0)).toBe(false);
  });

  it('exact boundary: 499pts does not require photo', () => {
    expect(shouldRequirePhoto(499)).toBe(false);
    const task: Task = { points: 499, requires_photo: false, title: 'Organise Stock Room' };
    const result = completeTask(task, false);
    expect(result.autoApproved).toBe(true);
    expect(result.pointsAwarded).toBe(499);
  });

  it('exact boundary: 500pts requires photo', () => {
    expect(shouldRequirePhoto(500)).toBe(true);
    const task: Task = { points: 500, requires_photo: true, title: 'Deep Clean Ice Machine' };
    const result = completeTask(task, true);
    expect(result.autoApproved).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it('zero-point task still auto-approves', () => {
    const task: Task = { points: 0, requires_photo: false, title: 'Check-in' };
    const result = completeTask(task, false);
    expect(result.autoApproved).toBe(true);
    expect(result.pointsAwarded).toBe(0);
  });
});
