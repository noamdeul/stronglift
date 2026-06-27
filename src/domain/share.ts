import { EXERCISES } from './exercises';
import { isExerciseSucceeded } from './progression';
import type { WorkoutSession } from './types';
import { formatWeight } from './units';

/** A single work set, reduced to what the share image needs to draw. */
export interface ShareSetView {
  reps: number;
  /** Whether the set was completed and hit its target reps. */
  hit: boolean;
}

export interface ShareExerciseView {
  name: string;
  /** Working weight, pre-formatted with the session's unit (e.g. "100 kg"). */
  weight: string;
  sets: ShareSetView[];
  succeeded: boolean;
}

/** A fully view-ready snapshot of a session for rendering a share image. */
export interface ShareModel {
  /** "Workout A" / "Workout B". */
  title: string;
  /** Localized date, e.g. "Saturday, Jun 27, 2026". */
  dateText: string;
  /** Localized time, e.g. "6:30 PM". */
  timeText: string;
  exercises: ShareExerciseView[];
  /** "3/3 exercises completed". */
  summaryText: string;
  /** Whether every exercise succeeded. */
  allSucceeded: boolean;
  /** Suggested download/share filename. */
  fileName: string;
}

function setView(reps: number, targetReps: number, done: boolean): ShareSetView {
  return { reps, hit: done && reps >= targetReps };
}

/**
 * Turn a (typically completed) session into a flat, locale-formatted model the
 * image renderer can draw without touching the domain types. Pure and testable;
 * no canvas/DOM here.
 */
export function buildShareModel(session: WorkoutSession): ShareModel {
  const date = new Date(session.date);

  const exercises: ShareExerciseView[] = session.exercises.map((ex) => ({
    name: EXERCISES[ex.exerciseId].name,
    weight: formatWeight(ex.weight, session.unit),
    sets: ex.workSets.map((s) => setView(s.reps, s.targetReps, s.done)),
    succeeded: isExerciseSucceeded(ex),
  }));

  const okCount = exercises.filter((e) => e.succeeded).length;
  const total = exercises.length;

  // Date slice is taken straight from the ISO string so the filename is stable
  // regardless of the runtime's locale/timezone.
  const isoDay = session.date.slice(0, 10);

  return {
    title: `Workout ${session.type}`,
    dateText: date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    timeText: date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
    exercises,
    summaryText: `${okCount}/${total} exercises completed`,
    allSucceeded: total > 0 && okCount === total,
    fileName: `fivebyfive-workout-${session.type}-${isoDay}.png`,
  };
}
