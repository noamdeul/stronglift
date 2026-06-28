import { sessionBestE1RM } from './strength';
import type { ExerciseId, WorkoutSession } from './types';

export interface SeriesPoint {
  /** ISO date of the session. */
  date: string;
  /** Working weight used that session. */
  weight: number;
  /** Best estimated 1RM that session. */
  e1RM: number;
}

/**
 * One point per session that contains `exerciseId`, in chronological order.
 * `history` is treated as newest-last (the documented ordering), so the result
 * reads left-to-right oldest → newest for plotting.
 */
export function buildWeightSeries(
  history: WorkoutSession[],
  exerciseId: ExerciseId,
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const session of history) {
    const logged = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!logged) continue;
    points.push({
      date: session.date,
      weight: logged.weight,
      e1RM: sessionBestE1RM(session, exerciseId),
    });
  }
  return points;
}
