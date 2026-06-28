import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  defaultAppState,
  defaultExerciseStates,
  defaultSettings,
} from '../domain/defaults';
import { ALL_EXERCISE_IDS } from '../domain/exercises';
import { BAR_WEIGHT } from '../domain/units';

describe('defaultSettings', () => {
  it('uses kg increments and rounding for a kg setup', () => {
    const s = defaultSettings('kg');
    expect(s.unit).toBe('kg');
    expect(s.rounding).toBe(2.5);
    expect(s.config.increments).toEqual({
      squat: 2.5,
      bench: 2.5,
      row: 2.5,
      ohp: 2.5,
      deadlift: 5,
    });
    expect(s.config.deloadFactor).toBe(0.1);
    expect(s.config.deloadFailThreshold).toBe(3);
    expect(s.sound).toBe(true);
  });

  it('uses lb increments and rounding for a lb setup', () => {
    const s = defaultSettings('lb');
    expect(s.unit).toBe('lb');
    expect(s.rounding).toBe(5);
    expect(s.config.increments).toEqual({
      squat: 5,
      bench: 5,
      row: 5,
      ohp: 5,
      deadlift: 10,
    });
  });
});

describe('defaultExerciseStates', () => {
  it('starts the main presses at the bar, with zero failures, for kg', () => {
    const states = defaultExerciseStates('kg');
    expect(Object.keys(states).sort()).toEqual([...ALL_EXERCISE_IDS].sort());
    expect(states.squat.currentWeight).toBe(BAR_WEIGHT.kg);
    expect(states.bench.currentWeight).toBe(BAR_WEIGHT.kg);
    expect(states.ohp.currentWeight).toBe(BAR_WEIGHT.kg);
    expect(states.row.currentWeight).toBe(30);
    expect(states.deadlift.currentWeight).toBe(40);
    for (const id of ALL_EXERCISE_IDS) {
      expect(states[id].consecutiveFailures).toBe(0);
      expect(states[id].exerciseId).toBe(id);
    }
  });

  it('starts the main presses at the bar for lb', () => {
    const states = defaultExerciseStates('lb');
    expect(states.squat.currentWeight).toBe(BAR_WEIGHT.lb);
    expect(states.row.currentWeight).toBe(65);
    expect(states.deadlift.currentWeight).toBe(95);
  });
});

describe('defaultAppState', () => {
  it('defaults to kg, empty history, no session, workout A, current schema', () => {
    const state = defaultAppState();
    expect(state.settings.unit).toBe('kg');
    expect(state.history).toEqual([]);
    expect(state.currentSession).toBeNull();
    expect(state.nextWorkoutType).toBe('A');
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('honors the requested unit', () => {
    expect(defaultAppState('lb').settings.unit).toBe('lb');
  });
});
