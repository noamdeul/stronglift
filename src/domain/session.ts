import { EXERCISES, WORKOUT_TEMPLATES } from './exercises';
import { resultFromLogged } from './progression';
import type {
  ExerciseId,
  ExerciseResult,
  ExerciseState,
  LoggedExercise,
  LoggedSet,
  Settings,
  WorkoutSession,
  WorkoutType,
} from './types';
import { computeWarmups, warmupsToLoggedSets } from './warmups';

export function flipWorkoutType(type: WorkoutType): WorkoutType {
  return type === 'A' ? 'B' : 'A';
}

function buildWorkSets(reps: number, count: number): LoggedSet[] {
  return Array.from({ length: count }, () => ({
    reps,
    targetReps: reps,
    done: false,
    isWarmup: false,
  }));
}

function buildLoggedExercise(
  exerciseId: ExerciseId,
  state: ExerciseState,
  settings: Settings,
): LoggedExercise {
  const def = EXERCISES[exerciseId];
  const weight = state.currentWeight;
  const warmups = computeWarmups(weight, settings.unit, settings.rounding, settings.barWeight);
  return {
    exerciseId,
    weight,
    warmupSets: warmupsToLoggedSets(warmups),
    workSets: buildWorkSets(def.reps, def.sets),
  };
}

/**
 * Assemble a fresh, unlogged session for the given workout type using the
 * current per-exercise progression state.
 */
export function buildSessionFromTemplate(
  type: WorkoutType,
  exerciseStates: Record<ExerciseId, ExerciseState>,
  settings: Settings,
  id: string,
  date: string,
): WorkoutSession {
  const template = WORKOUT_TEMPLATES[type];
  return {
    id,
    date,
    type,
    unit: settings.unit,
    exercises: template.exercises.map((exId) =>
      buildLoggedExercise(exId, exerciseStates[exId], settings),
    ),
    completed: false,
  };
}

/** Per-exercise success/fail results for a (typically completed) session. */
export function sessionResults(session: WorkoutSession): ExerciseResult[] {
  return session.exercises.map(resultFromLogged);
}
