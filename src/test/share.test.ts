import { describe, expect, it } from 'vitest';
import { buildShareModel } from '../domain/share';
import type { LoggedExercise, WorkoutSession } from '../domain/types';

function workSet(reps: number, targetReps = 5, done = true) {
  return { reps, targetReps, done, isWarmup: false };
}

function exercise(
  exerciseId: LoggedExercise['exerciseId'],
  weight: number,
  reps: number[],
): LoggedExercise {
  return {
    exerciseId,
    weight,
    warmupSets: [],
    workSets: reps.map((r) => workSet(r)),
  };
}

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'id-1',
    date: '2026-06-27T18:30:00.000Z',
    type: 'A',
    unit: 'kg',
    completed: true,
    exercises: [
      exercise('squat', 100, [5, 5, 5, 5, 5]),
      exercise('bench', 60, [5, 5, 5, 5, 5]),
      exercise('row', 50, [5, 5, 5, 5, 5]),
    ],
    ...overrides,
  };
}

describe('buildShareModel', () => {
  it('captures title, weights and reps for each exercise', () => {
    const model = buildShareModel(session());
    expect(model.title).toBe('Workout A');
    expect(model.exercises.map((e) => e.name)).toEqual([
      'Squat',
      'Bench Press',
      'Barbell Row',
    ]);
    expect(model.exercises[0].weight).toBe('100 kg');
    expect(model.exercises[0].sets.map((s) => s.reps)).toEqual([5, 5, 5, 5, 5]);
  });

  it('formats weight in the session unit', () => {
    const model = buildShareModel(session({ unit: 'lb' }));
    expect(model.exercises[0].weight).toBe('100 lb');
  });

  it('marks a set as hit only when done and at/over target reps', () => {
    const s = session({
      exercises: [exercise('squat', 100, [5, 5, 4, 5, 5])],
    });
    const model = buildShareModel(s);
    const hits = model.exercises[0].sets.map((x) => x.hit);
    expect(hits).toEqual([true, true, false, true, true]);
  });

  it('summarizes how many exercises succeeded', () => {
    const s = session({
      exercises: [
        exercise('squat', 100, [5, 5, 5, 5, 5]),
        exercise('bench', 60, [5, 5, 5, 5, 4]),
        exercise('row', 50, [5, 5, 5, 5, 5]),
      ],
    });
    const model = buildShareModel(s);
    expect(model.summaryText).toBe('2/3 exercises completed');
    expect(model.allSucceeded).toBe(false);
  });

  it('flags an all-success session', () => {
    const model = buildShareModel(session());
    expect(model.summaryText).toBe('3/3 exercises completed');
    expect(model.allSucceeded).toBe(true);
  });

  it('builds a stable, locale-independent filename from the ISO date', () => {
    const model = buildShareModel(session());
    expect(model.fileName).toBe('fivebyfive-workout-A-2026-06-27.png');
  });
});
