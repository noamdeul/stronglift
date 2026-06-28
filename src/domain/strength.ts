import type { ExerciseId, WorkoutSession } from './types';

/**
 * Estimated one-rep max via the Epley formula: `weight * (1 + reps / 30)`.
 * A single rep returns the weight itself; zero/invalid reps return 0.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/**
 * Best estimated 1RM achieved for an exercise within a single session, taken
 * across its work sets (each at the session weight, with its logged reps).
 * Returns 0 if the exercise isn't in the session or had no reps.
 */
export function sessionBestE1RM(session: WorkoutSession, exerciseId: ExerciseId): number {
  const logged = session.exercises.find((e) => e.exerciseId === exerciseId);
  if (!logged) return 0;
  let best = 0;
  for (const set of logged.workSets) {
    best = Math.max(best, estimateOneRepMax(logged.weight, set.reps));
  }
  return best;
}

export interface PersonalBest {
  e1RM: number;
  weight: number;
  reps: number;
  date: string;
}

/**
 * The best estimated 1RM per exercise across the whole history. `history` is
 * treated as newest-last (the documented ordering); the most recent session
 * wins ties so a fresh equal-effort lift still reads as the current best.
 */
export function personalBests(
  history: WorkoutSession[],
): Partial<Record<ExerciseId, PersonalBest>> {
  const bests: Partial<Record<ExerciseId, PersonalBest>> = {};
  for (const session of history) {
    for (const logged of session.exercises) {
      for (const set of logged.workSets) {
        const e1RM = estimateOneRepMax(logged.weight, set.reps);
        if (e1RM <= 0) continue;
        const current = bests[logged.exerciseId];
        if (!current || e1RM >= current.e1RM) {
          bests[logged.exerciseId] = {
            e1RM,
            weight: logged.weight,
            reps: set.reps,
            date: session.date,
          };
        }
      }
    }
  }
  return bests;
}

/**
 * Whether `session` set a new estimated-1RM personal best for any of its lifts,
 * compared against everything logged before it. `priorHistory` must exclude the
 * session being tested.
 */
export function isSessionPR(
  session: WorkoutSession,
  priorHistory: WorkoutSession[],
): boolean {
  const prior = personalBests(priorHistory);
  for (const logged of session.exercises) {
    const best = sessionBestE1RM(session, logged.exerciseId);
    if (best <= 0) continue;
    const previous = prior[logged.exerciseId]?.e1RM ?? 0;
    if (best > previous) return true;
  }
  return false;
}
