import type { ExerciseDef, ExerciseId, WorkoutTemplate, WorkoutType } from './types';

export const EXERCISES: Record<ExerciseId, ExerciseDef> = {
  squat: { id: 'squat', name: 'Squat', sets: 5, reps: 5 },
  bench: { id: 'bench', name: 'Bench Press', sets: 5, reps: 5 },
  row: { id: 'row', name: 'Barbell Row', sets: 5, reps: 5 },
  ohp: { id: 'ohp', name: 'Overhead Press', sets: 5, reps: 5 },
  deadlift: { id: 'deadlift', name: 'Deadlift', sets: 3, reps: 5 },
};

export const ALL_EXERCISE_IDS: ExerciseId[] = ['squat', 'bench', 'row', 'ohp', 'deadlift'];

export const WORKOUT_TEMPLATES: Record<WorkoutType, WorkoutTemplate> = {
  A: { type: 'A', exercises: ['squat', 'bench', 'row'] },
  B: { type: 'B', exercises: ['squat', 'ohp', 'deadlift'] },
};

/**
 * Resolve an exercise definition by id, checking the built-in lifts first, then
 * the user's custom exercises. Falls back to a placeholder so history that
 * references a since-deleted custom exercise still renders instead of crashing.
 */
export function getExercise(id: ExerciseId, custom: ExerciseDef[] = []): ExerciseDef {
  return (
    EXERCISES[id] ??
    custom.find((e) => e.id === id) ?? {
      id,
      name: 'Unknown exercise',
      sets: 5,
      reps: 5,
    }
  );
}
