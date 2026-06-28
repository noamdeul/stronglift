import { ALL_EXERCISE_IDS } from './exercises';
import type { AppState, ExerciseId, ExerciseState, Settings, Unit } from './types';
import { BAR_WEIGHT, DEFAULT_ROUNDING } from './units';

// v2 added the optional `completedAt` timestamp to LoggedSet (for the Garmin
// .FIT export). It is optional, so v1 data is valid v2 data — see the store's
// `migrate` passthrough.
// v3 added `settings.sound` (rest-timer completion sound); the store's `migrate`
// backfills it to `true` for older persisted state.
export const SCHEMA_VERSION = 3;

/** Default per-exercise weight increments, per unit. */
const INCREMENTS: Record<Unit, Record<ExerciseId, number>> = {
  kg: { squat: 2.5, bench: 2.5, row: 2.5, ohp: 2.5, deadlift: 5 },
  lb: { squat: 5, bench: 5, row: 5, ohp: 5, deadlift: 10 },
};

/**
 * Sensible beginner starting weights, per unit. The bar for the main presses,
 * a little more for rows and deadlifts.
 */
function startingWeights(unit: Unit): Record<ExerciseId, number> {
  const bar = BAR_WEIGHT[unit];
  return unit === 'kg'
    ? { squat: bar, bench: bar, ohp: bar, row: 30, deadlift: 40 }
    : { squat: bar, bench: bar, ohp: bar, row: 65, deadlift: 95 };
}

export function defaultSettings(unit: Unit): Settings {
  return {
    unit,
    restSeconds: { normal: 90, heavy: 180, deadlift: 300 },
    rounding: DEFAULT_ROUNDING[unit],
    sound: true,
    config: {
      increments: INCREMENTS[unit],
      deloadFactor: 0.1,
      deloadFailThreshold: 3,
    },
  };
}

export function defaultExerciseStates(unit: Unit): Record<ExerciseId, ExerciseState> {
  const weights = startingWeights(unit);
  const states = {} as Record<ExerciseId, ExerciseState>;
  for (const id of ALL_EXERCISE_IDS) {
    states[id] = { exerciseId: id, currentWeight: weights[id], consecutiveFailures: 0 };
  }
  return states;
}

export function defaultAppState(unit: Unit = 'kg'): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(unit),
    exerciseStates: defaultExerciseStates(unit),
    history: [],
    currentSession: null,
    nextWorkoutType: 'A',
  };
}
