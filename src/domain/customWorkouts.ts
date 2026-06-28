import type { ValidationResult } from './customExercises';
import type { CustomWorkout, ExerciseId } from './types';

/** Raw form input for creating or editing a custom workout. */
export interface CustomWorkoutInput {
  name: string;
  /** Ordered exercise ids (built-in and/or custom). */
  exercises: ExerciseId[];
}

/** Validate user input for a custom workout. Pure. */
export function validateCustomWorkout(input: CustomWorkoutInput): ValidationResult {
  if (!input.name.trim()) return { ok: false, error: 'Name is required' };
  if (!input.exercises || input.exercises.length < 1) {
    return { ok: false, error: 'Pick at least one exercise' };
  }
  return { ok: true };
}

/** Build a {@link CustomWorkout} from validated input. The `id` is supplied by
 *  the caller (the store) so this stays pure. */
export function makeCustomWorkout(input: CustomWorkoutInput, id: string): CustomWorkout {
  return { id, name: input.name.trim(), exercises: [...input.exercises] };
}

/** Custom workouts that reference the given exercise — used to warn before
 *  deleting an exercise and to scrub it from those workouts. */
export function referencingWorkouts(
  exerciseId: ExerciseId,
  workouts: CustomWorkout[],
): CustomWorkout[] {
  return workouts.filter((w) => w.exercises.includes(exerciseId));
}
