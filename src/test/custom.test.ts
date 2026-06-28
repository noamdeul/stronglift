import { describe, expect, it } from 'vitest';
import {
  makeCustomExercise,
  validateCustomExercise,
} from '../domain/customExercises';
import type { CustomExerciseInput } from '../domain/customExercises';
import { referencingWorkouts, validateCustomWorkout } from '../domain/customWorkouts';
import { getExercise } from '../domain/exercises';
import { buildSessionFromCustom } from '../domain/session';
import { defaultExerciseStates, defaultSettings } from '../domain/defaults';
import type { CustomWorkout, ExerciseState } from '../domain/types';

const validExercise: CustomExerciseInput = {
  name: 'Pull-up',
  sets: 3,
  reps: 8,
  startingWeight: 0,
  increment: 2.5,
};

describe('validateCustomExercise', () => {
  it('accepts well-formed input', () => {
    expect(validateCustomExercise(validExercise).ok).toBe(true);
  });

  it('rejects a blank name', () => {
    const r = validateCustomExercise({ ...validExercise, name: '   ' });
    expect(r.ok).toBe(false);
  });

  it('rejects fewer than one set or rep', () => {
    expect(validateCustomExercise({ ...validExercise, sets: 0 }).ok).toBe(false);
    expect(validateCustomExercise({ ...validExercise, reps: 0 }).ok).toBe(false);
  });

  it('rejects a non-positive increment and a negative starting weight', () => {
    expect(validateCustomExercise({ ...validExercise, increment: 0 }).ok).toBe(false);
    expect(validateCustomExercise({ ...validExercise, startingWeight: -5 }).ok).toBe(false);
  });
});

describe('makeCustomExercise', () => {
  it('builds a custom def, rounding sets/reps and stamping custom + increment', () => {
    const def = makeCustomExercise({ ...validExercise, sets: 3.6, reps: 8.2 }, 'custom-1');
    expect(def).toMatchObject({
      id: 'custom-1',
      name: 'Pull-up',
      sets: 4,
      reps: 8,
      custom: true,
      increment: 2.5,
    });
  });

  it('does not store the starting weight on the def', () => {
    const def = makeCustomExercise(validExercise, 'custom-1') as unknown as Record<string, unknown>;
    expect(def.startingWeight).toBeUndefined();
  });
});

describe('getExercise', () => {
  it('resolves built-ins, then custom, then a safe fallback', () => {
    const custom = [makeCustomExercise(validExercise, 'custom-1')];
    expect(getExercise('squat').name).toBe('Squat');
    expect(getExercise('custom-1', custom).name).toBe('Pull-up');
    expect(getExercise('deleted-id', custom).name).toBe('Unknown exercise');
  });
});

describe('validateCustomWorkout', () => {
  it('accepts a named workout with at least one exercise', () => {
    expect(validateCustomWorkout({ name: 'Upper', exercises: ['bench'] }).ok).toBe(true);
  });

  it('rejects a blank name or an empty exercise list', () => {
    expect(validateCustomWorkout({ name: '', exercises: ['bench'] }).ok).toBe(false);
    expect(validateCustomWorkout({ name: 'Upper', exercises: [] }).ok).toBe(false);
  });
});

describe('referencingWorkouts', () => {
  it('finds workouts that include the exercise', () => {
    const workouts: CustomWorkout[] = [
      { id: 'w1', name: 'A', exercises: ['squat', 'custom-1'] },
      { id: 'w2', name: 'B', exercises: ['bench'] },
    ];
    expect(referencingWorkouts('custom-1', workouts).map((w) => w.id)).toEqual(['w1']);
    expect(referencingWorkouts('deadlift', workouts)).toEqual([]);
  });
});

describe('buildSessionFromCustom', () => {
  const settings = defaultSettings('kg');
  const states: Record<string, ExerciseState> = {
    ...defaultExerciseStates('kg'),
    'custom-1': { exerciseId: 'custom-1', currentWeight: 30, consecutiveFailures: 0 },
  };
  const customExercises = [makeCustomExercise(validExercise, 'custom-1')];
  const workout: CustomWorkout = {
    id: 'w1',
    name: 'Upper body',
    exercises: ['bench', 'custom-1'],
  };

  it('stamps kind/name/templateId and omits the A/B type', () => {
    const session = buildSessionFromCustom(
      workout,
      states,
      settings,
      customExercises,
      'id-1',
      '2026-01-01T00:00:00Z',
    );
    expect(session.kind).toBe('custom');
    expect(session.name).toBe('Upper body');
    expect(session.templateId).toBe('w1');
    expect(session.type).toBeUndefined();
    expect(session.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'custom-1']);
  });

  it('uses the custom exercise def sets/reps and its current weight', () => {
    const session = buildSessionFromCustom(
      workout,
      states,
      settings,
      customExercises,
      'id-2',
      '2026-01-01T00:00:00Z',
    );
    const pullup = session.exercises.find((e) => e.exerciseId === 'custom-1')!;
    expect(pullup.workSets).toHaveLength(3);
    expect(pullup.workSets[0].targetReps).toBe(8);
    expect(pullup.weight).toBe(30);
  });
});
