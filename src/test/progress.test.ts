import { describe, expect, it } from 'vitest';
import { buildWeightSeries } from '../domain/progress';
import { estimateOneRepMax } from '../domain/strength';
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

describe('buildWeightSeries', () => {
  const history = [
    session('1', '2026-01-01T00:00:00Z', [
      { id: 'squat', weight: 100, reps: [5, 5, 5, 5, 5] },
      { id: 'bench', weight: 60, reps: [5, 5, 5, 5, 5] },
    ]),
    session('2', '2026-01-03T00:00:00Z', [{ id: 'squat', weight: 102.5, reps: [5, 5, 5, 5, 5] }]),
  ];

  it('returns one point per session containing the exercise, in order', () => {
    const series = buildWeightSeries(history, 'squat');
    expect(series.map((p) => p.weight)).toEqual([100, 102.5]);
    expect(series.map((p) => p.date)).toEqual(['2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z']);
  });

  it('skips sessions without the exercise', () => {
    const series = buildWeightSeries(history, 'bench');
    expect(series).toHaveLength(1);
    expect(series[0].weight).toBe(60);
  });

  it('includes the best e1RM per point', () => {
    const series = buildWeightSeries(history, 'squat');
    expect(series[0].e1RM).toBe(estimateOneRepMax(100, 5));
  });

  it('returns an empty series for empty history', () => {
    expect(buildWeightSeries([], 'squat')).toEqual([]);
  });
});
