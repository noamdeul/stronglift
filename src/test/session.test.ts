import { describe, expect, it } from 'vitest';
import { defaultExerciseStates, defaultSettings } from '../domain/defaults';
import {
  buildSessionFromTemplate,
  flipWorkoutType,
  sessionResults,
} from '../domain/session';

describe('flipWorkoutType', () => {
  it('alternates A and B', () => {
    expect(flipWorkoutType('A')).toBe('B');
    expect(flipWorkoutType('B')).toBe('A');
  });
});

describe('buildSessionFromTemplate', () => {
  const settings = defaultSettings('kg');
  const states = defaultExerciseStates('kg');

  it('builds Workout A with squat, bench, row', () => {
    const session = buildSessionFromTemplate('A', states, settings, 'id-1', '2026-01-01T00:00:00Z');
    expect(session.type).toBe('A');
    expect(session.exercises.map((e) => e.exerciseId)).toEqual(['squat', 'bench', 'row']);
    expect(session.completed).toBe(false);
    expect(session.unit).toBe('kg');
  });

  it('builds Workout B with squat, ohp, deadlift', () => {
    const session = buildSessionFromTemplate('B', states, settings, 'id-2', '2026-01-01T00:00:00Z');
    expect(session.exercises.map((e) => e.exerciseId)).toEqual(['squat', 'ohp', 'deadlift']);
  });

  it('gives the deadlift a single work set and others five', () => {
    const session = buildSessionFromTemplate('B', states, settings, 'id-3', '2026-01-01T00:00:00Z');
    const squat = session.exercises.find((e) => e.exerciseId === 'squat')!;
    const deadlift = session.exercises.find((e) => e.exerciseId === 'deadlift')!;
    expect(squat.workSets).toHaveLength(5);
    expect(deadlift.workSets).toHaveLength(3);
  });

  it('uses each exercise current weight as the work-set weight', () => {
    const session = buildSessionFromTemplate('A', states, settings, 'id-4', '2026-01-01T00:00:00Z');
    const squat = session.exercises.find((e) => e.exerciseId === 'squat')!;
    expect(squat.weight).toBe(states.squat.currentWeight);
  });

  it('generates warmup sets that ramp below the working weight', () => {
    const heavy = defaultExerciseStates('kg');
    heavy.squat.currentWeight = 100;
    const session = buildSessionFromTemplate('A', heavy, settings, 'id-5', '2026-01-01T00:00:00Z');
    const squat = session.exercises.find((e) => e.exerciseId === 'squat')!;
    expect(squat.warmupSets.length).toBeGreaterThan(0);
    for (const w of squat.warmupSets) {
      expect(w.isWarmup).toBe(true);
      expect(w.weight!).toBeLessThan(100);
    }
  });
});

describe('sessionResults', () => {
  it('reports success and failure per exercise', () => {
    const settings = defaultSettings('kg');
    const states = defaultExerciseStates('kg');
    const session = buildSessionFromTemplate('A', states, settings, 'id-6', '2026-01-01T00:00:00Z');
    // Complete squat fully; leave bench failed.
    session.exercises[0].workSets.forEach((s) => {
      s.done = true;
      s.reps = 5;
    });
    session.exercises[1].workSets.forEach((s, i) => {
      s.done = true;
      s.reps = i === 4 ? 2 : 5;
    });
    const results = sessionResults(session);
    expect(results.find((r) => r.exerciseId === 'squat')!.succeeded).toBe(true);
    expect(results.find((r) => r.exerciseId === 'bench')!.succeeded).toBe(false);
  });
});
