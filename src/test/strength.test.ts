import { describe, expect, it } from 'vitest';
import {
  estimateOneRepMax,
  isSessionPR,
  personalBests,
  sessionBestE1RM,
} from '../domain/strength';
import type { ExerciseId, LoggedSet, WorkoutSession } from '../domain/types';

function set(reps: number): LoggedSet {
  return { reps, targetReps: 5, done: true, isWarmup: false };
}

function session(
  id: string,
  date: string,
  exercises: { id: ExerciseId; weight: number; reps: number[] }[],
): WorkoutSession {
  return {
    id,
    date,
    type: 'A',
    unit: 'kg',
    completed: true,
    exercises: exercises.map((e) => ({
      exerciseId: e.id,
      weight: e.weight,
      warmupSets: [],
      workSets: e.reps.map(set),
    })),
  };
}

describe('estimateOneRepMax', () => {
  it('uses the Epley formula', () => {
    // 100 * (1 + 5/30) = 116.67 -> 116.7
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
  });

  it('returns the weight itself for a single rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('returns 0 for zero reps or weight', () => {
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(0, 5)).toBe(0);
  });
});

describe('sessionBestE1RM', () => {
  it('takes the best e1RM across work sets', () => {
    const s = session('1', '2026-01-01T00:00:00Z', [{ id: 'squat', weight: 100, reps: [5, 5, 3] }]);
    // best comes from the 5-rep set: 116.7
    expect(sessionBestE1RM(s, 'squat')).toBe(116.7);
  });

  it('returns 0 for an absent exercise', () => {
    const s = session('1', '2026-01-01T00:00:00Z', [{ id: 'squat', weight: 100, reps: [5] }]);
    expect(sessionBestE1RM(s, 'bench')).toBe(0);
  });
});

describe('personalBests', () => {
  it('tracks the best e1RM per exercise across history', () => {
    const history = [
      session('1', '2026-01-01T00:00:00Z', [{ id: 'squat', weight: 100, reps: [5, 5, 5, 5, 5] }]),
      session('2', '2026-01-03T00:00:00Z', [{ id: 'squat', weight: 105, reps: [5, 5, 5, 5, 5] }]),
      session('3', '2026-01-05T00:00:00Z', [{ id: 'squat', weight: 102.5, reps: [5, 5, 5, 5, 5] }]),
    ];
    const best = personalBests(history);
    expect(best.squat!.weight).toBe(105);
    expect(best.squat!.e1RM).toBe(estimateOneRepMax(105, 5));
  });
});

describe('isSessionPR', () => {
  const first = session('1', '2026-01-01T00:00:00Z', [
    { id: 'squat', weight: 100, reps: [5, 5, 5, 5, 5] },
  ]);

  it('is a PR when it beats the prior best', () => {
    const second = session('2', '2026-01-03T00:00:00Z', [
      { id: 'squat', weight: 105, reps: [5, 5, 5, 5, 5] },
    ]);
    expect(isSessionPR(second, [first])).toBe(true);
  });

  it('is a PR for the very first session', () => {
    expect(isSessionPR(first, [])).toBe(true);
  });

  it('is not a PR when it does not beat the prior best', () => {
    const second = session('2', '2026-01-03T00:00:00Z', [
      { id: 'squat', weight: 95, reps: [5, 5, 5, 5, 5] },
    ]);
    expect(isSessionPR(second, [first])).toBe(false);
  });
});
