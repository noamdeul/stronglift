import { describe, expect, it } from 'vitest';
import { upcomingWorkouts } from '../domain/schedule';

// Helper: weekday index of a YYYY-MM-DD date in local time.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

describe('upcomingWorkouts', () => {
  it('returns [] when no days are selected', () => {
    // 2026-06-28 is a Sunday.
    expect(upcomingWorkouts([], 'A', new Date(2026, 5, 28), 4)).toEqual([]);
  });

  it('returns [] when count is non-positive', () => {
    expect(upcomingWorkouts([1, 3, 5], 'A', new Date(2026, 5, 28), 0)).toEqual([]);
  });

  it('alternates the type across selected days, starting at nextType', () => {
    // Mon/Wed/Fri, starting from Sunday 2026-06-28.
    const result = upcomingWorkouts([1, 3, 5], 'A', new Date(2026, 5, 28), 4);
    expect(result.map((w) => w.type)).toEqual(['A', 'B', 'A', 'B']);
    // Mon 2026-06-29, Wed 07-01, Fri 07-03, Mon 07-06.
    expect(result.map((w) => iso(w.date))).toEqual([
      '2026-06-29',
      '2026-07-01',
      '2026-07-03',
      '2026-07-06',
    ]);
  });

  it('includes today when it is a selected workout day', () => {
    // 2026-06-29 is a Monday; Monday is selected, so today is the first entry.
    const result = upcomingWorkouts([1], 'B', new Date(2026, 5, 29), 2);
    expect(iso(result[0].date)).toBe('2026-06-29');
    expect(result[0].type).toBe('B');
    expect(iso(result[1].date)).toBe('2026-07-06');
    expect(result[1].type).toBe('A');
  });

  it('respects the requested count', () => {
    const result = upcomingWorkouts([0, 1, 2, 3, 4, 5, 6], 'A', new Date(2026, 5, 28), 3);
    expect(result).toHaveLength(3);
  });

  it('skips today when a workout was already completed today', () => {
    // 2026-06-29 is a Monday; Mon/Wed/Fri selected, workout done Monday morning.
    const result = upcomingWorkouts(
      [1, 3, 5],
      'B',
      new Date(2026, 5, 29, 18, 0),
      2,
      new Date(2026, 5, 29, 9, 30),
    );
    expect(iso(result[0].date)).toBe('2026-07-01'); // Wednesday, not today
    expect(result[0].type).toBe('B');
    expect(iso(result[1].date)).toBe('2026-07-03');
  });

  it('still includes today when the last workout was on an earlier day', () => {
    // Last workout Saturday 2026-06-27; Monday 06-29 stays scheduled.
    const result = upcomingWorkouts(
      [1],
      'B',
      new Date(2026, 5, 29),
      1,
      new Date(2026, 5, 27, 19, 0),
    );
    expect(iso(result[0].date)).toBe('2026-06-29');
  });
});
