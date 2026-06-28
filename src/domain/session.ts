import { getExercise, WORKOUT_TEMPLATES } from './exercises';
import { resultFromLogged } from './progression';
import type {
  CustomWorkout,
  ExerciseDef,
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
  customExercises: ExerciseDef[],
): LoggedExercise {
  const def = getExercise(exerciseId, customExercises);
  const weight = state.currentWeight;
  const warmups = computeWarmups(weight, settings.unit, settings.rounding, settings.barWeight);
  return {
    exerciseId,
    weight,
    warmupSets: warmupsToLoggedSets(warmups),
    workSets: buildWorkSets(def.reps, def.sets),
  };
}

/** Seed an exercise state for an id that may not have one yet (defensive: a
 *  custom workout could reference an exercise whose state was somehow dropped).
 *  Falls back to the bar weight. */
function stateFor(
  exerciseId: ExerciseId,
  exerciseStates: Record<ExerciseId, ExerciseState>,
  settings: Settings,
): ExerciseState {
  return (
    exerciseStates[exerciseId] ?? {
      exerciseId,
      currentWeight: settings.barWeight,
      consecutiveFailures: 0,
    }
  );
}

/**
 * Assemble a fresh, unlogged session for the given built-in workout type using
 * the current per-exercise progression state.
 */
export function buildSessionFromTemplate(
  type: WorkoutType,
  exerciseStates: Record<ExerciseId, ExerciseState>,
  settings: Settings,
  id: string,
  date: string,
  customExercises: ExerciseDef[] = [],
): WorkoutSession {
  const template = WORKOUT_TEMPLATES[type];
  return {
    id,
    date,
    type,
    kind: 'builtin',
    unit: settings.unit,
    exercises: template.exercises.map((exId) =>
      buildLoggedExercise(exId, stateFor(exId, exerciseStates, settings), settings, customExercises),
    ),
    completed: false,
  };
}

/**
 * Assemble a fresh, unlogged session from a user-built custom workout. Stamps
 * `kind: 'custom'` plus the workout's name and id so it stays out of the A/B
 * rotation and displays its own name.
 */
export function buildSessionFromCustom(
  workout: CustomWorkout,
  exerciseStates: Record<ExerciseId, ExerciseState>,
  settings: Settings,
  customExercises: ExerciseDef[],
  id: string,
  date: string,
): WorkoutSession {
  return {
    id,
    date,
    kind: 'custom',
    name: workout.name,
    templateId: workout.id,
    unit: settings.unit,
    exercises: workout.exercises.map((exId) =>
      buildLoggedExercise(exId, stateFor(exId, exerciseStates, settings), settings, customExercises),
    ),
    completed: false,
  };
}

/** Per-exercise success/fail results for a (typically completed) session. */
export function sessionResults(session: WorkoutSession): ExerciseResult[] {
  return session.exercises.map(resultFromLogged);
}

/** Display title for a session: a custom workout's name, otherwise the built-in
 *  "Workout A"/"Workout B". Back-compatible with sessions logged before custom
 *  workouts (no `name`). */
export function sessionTitle(session: Pick<WorkoutSession, 'name' | 'type'>): string {
  return session.name ?? `Workout ${session.type ?? ''}`.trim();
}

/** A filename-safe slug for a session, used in share/export filenames. */
export function sessionSlug(session: Pick<WorkoutSession, 'name' | 'type'>): string {
  if (session.type) return session.type;
  const slug = (session.name ?? 'custom')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'custom';
}
