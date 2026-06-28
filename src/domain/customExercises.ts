import type { ExerciseDef, ExerciseId } from './types';

/** Raw form input for creating or editing a custom exercise. */
export interface CustomExerciseInput {
  name: string;
  /** Number of work sets. */
  sets: number;
  /** Target reps per work set. */
  reps: number;
  /** Initial working weight, in the active unit. Used to seed the exercise's
   *  progression state; not stored on the def itself. */
  startingWeight: number;
  /** Progression increment, in the active unit. */
  increment: number;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Validate user input for a custom exercise. Pure. */
export function validateCustomExercise(input: CustomExerciseInput): ValidationResult {
  if (!input.name.trim()) return { ok: false, error: 'Name is required' };
  if (!Number.isFinite(input.sets) || input.sets < 1) {
    return { ok: false, error: 'Sets must be at least 1' };
  }
  if (!Number.isFinite(input.reps) || input.reps < 1) {
    return { ok: false, error: 'Reps must be at least 1' };
  }
  if (!Number.isFinite(input.startingWeight) || input.startingWeight < 0) {
    return { ok: false, error: 'Starting weight must be 0 or more' };
  }
  if (!Number.isFinite(input.increment) || input.increment <= 0) {
    return { ok: false, error: 'Increment must be greater than 0' };
  }
  return { ok: true };
}

/**
 * Build a custom {@link ExerciseDef} from validated input. The `id` is supplied
 * by the caller (the store) so this stays pure. The starting weight lives on
 * the input only — the caller seeds the exercise state with it.
 */
export function makeCustomExercise(input: CustomExerciseInput, id: ExerciseId): ExerciseDef {
  return {
    id,
    name: input.name.trim(),
    sets: Math.round(input.sets),
    reps: Math.round(input.reps),
    custom: true,
    increment: input.increment,
  };
}
