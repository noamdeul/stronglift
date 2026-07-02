import { flipWorkoutType } from './session';
import type { WorkoutType } from './types';

export interface ScheduledWorkout {
  date: Date;
  type: WorkoutType;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Project the next `count` training days from `from` (inclusive), alternating
 * the workout type starting at `nextType`. Each day whose weekday is listed in
 * `workoutDays` (0=Sun … 6=Sat) becomes one scheduled workout. A workout
 * already completed on `from`'s day (`lastWorkoutDate`) counts as that day's
 * session, so the projection starts the day after. Returns `[]` when no days
 * are selected.
 */
export function upcomingWorkouts(
  workoutDays: number[],
  nextType: WorkoutType,
  from: Date,
  count: number,
  lastWorkoutDate?: Date | null,
): ScheduledWorkout[] {
  if (workoutDays.length === 0 || count <= 0) return [];

  const result: ScheduledWorkout[] = [];
  let type = nextType;
  // Walk forward day by day from local midnight of `from`. The cap guarantees
  // termination even if `workoutDays` somehow holds no valid weekday.
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (lastWorkoutDate && isSameLocalDay(lastWorkoutDate, cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  const maxDays = count * 7 + 7;

  for (let i = 0; i < maxDays && result.length < count; i++) {
    if (workoutDays.includes(cursor.getDay())) {
      result.push({ date: new Date(cursor), type });
      type = flipWorkoutType(type);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}
