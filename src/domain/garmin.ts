import type { ExerciseId, LoggedExercise, LoggedSet, Settings, Unit, WorkoutSession } from './types';
import { lbToKg } from './units';

/**
 * Pure mapping from a {@link WorkoutSession} to an ordered list of FIT messages
 * for a strength-training activity. No SDK dependency lives here — the lib layer
 * (`src/lib/fitExport.ts`) feeds these to the `@garmin/fitsdk` Encoder, which is
 * the only place numeric enum values and binary encoding are resolved.
 *
 * Timing: when every work set carries a real `completedAt` (the done-tap
 * timestamp), the timeline mirrors the actual session — each set anchored to its
 * real completion time, with the rest before it filled in. Older sessions
 * without timestamps fall back to a synthesized timeline built from the
 * configured rest durations and an estimated lifting time per rep.
 */

/** Estimated active (lifting) seconds per rep — used to size the work portion of
 *  a set, both when synthesizing timing and when splitting a real interval into
 *  rest + active. */
export const SECONDS_PER_REP = 3;

/** Maps each lift to its FIT exercise `category` and the *name* of its category
 *  subtype. The subtype name is resolved to a numeric value at the encoder
 *  boundary against the installed SDK's profile, so this stays SDK-free. */
export const EXERCISE_FIT_MAP: Record<ExerciseId, { category: string; subtypeName: string }> = {
  squat: { category: 'squat', subtypeName: 'barbellBackSquat' },
  bench: { category: 'benchPress', subtypeName: 'barbellBenchPress' },
  row: { category: 'row', subtypeName: 'barbellRow' },
  ohp: { category: 'shoulderPress', subtypeName: 'barbellShoulderPress' },
  deadlift: { category: 'deadlift', subtypeName: 'barbellDeadlift' },
};

/** An abstract FIT message. `set` covers both active (lifting) and rest sets. */
export type FitMessage =
  | { kind: 'fileId'; timeCreated: Date }
  | {
      kind: 'set';
      messageIndex: number;
      setType: 'active' | 'rest';
      startTime: Date;
      timestamp: Date;
      durationSec: number;
      /** Active sets only. */
      repetitions?: number;
      weightKg?: number;
      category?: string;
      subtypeName?: string;
      weightDisplayUnit?: 'kilogram' | 'pound';
    }
  | { kind: 'lap'; messageIndex: number; startTime: Date; timestamp: Date; totalElapsedSec: number }
  | {
      kind: 'session';
      messageIndex: number;
      startTime: Date;
      timestamp: Date;
      totalElapsedSec: number;
      numLaps: number;
    }
  | { kind: 'activity'; timestamp: Date; totalTimerSec: number };

/** A work set flattened out of the session, with its weight already in kg. */
interface FlatWorkSet {
  exerciseId: ExerciseId;
  reps: number;
  weightKg: number;
  completedAt?: string;
}

function weightDisplayUnit(unit: Unit): 'kilogram' | 'pound' {
  return unit === 'lb' ? 'pound' : 'kilogram';
}

/** Rest after a set, mirroring the live timer's choice in ExerciseCard: the
 *  longer deadlift rest for deadlifts, the heavy-work rest otherwise. */
function restSecondsFor(exerciseId: ExerciseId, settings: Settings): number {
  return exerciseId === 'deadlift' ? settings.restSeconds.deadlift : settings.restSeconds.heavy;
}

/** Work sets in workout order, with the parent exercise's weight converted to
 *  kg (FIT stores weight in kilograms regardless of the display unit). */
function flattenWorkSets(session: WorkoutSession): FlatWorkSet[] {
  const flat: FlatWorkSet[] = [];
  for (const ex of session.exercises as LoggedExercise[]) {
    const weightKg = session.unit === 'lb' ? lbToKg(ex.weight) : ex.weight;
    for (const set of ex.workSets as LoggedSet[]) {
      flat.push({
        exerciseId: ex.exerciseId,
        reps: set.reps,
        weightKg,
        completedAt: set.completedAt,
      });
    }
  }
  return flat;
}

/** True when every work set has a real completion timestamp, so the export can
 *  use the actual session timeline rather than a synthesized one. */
export function hasRealTiming(session: WorkoutSession): boolean {
  const flat = flattenWorkSets(session);
  return flat.length > 0 && flat.every((s) => Boolean(s.completedAt));
}

function activeSetMessage(
  messageIndex: number,
  set: FlatWorkSet,
  startTime: Date,
  timestamp: Date,
  unit: Unit,
): FitMessage {
  const map = EXERCISE_FIT_MAP[set.exerciseId];
  return {
    kind: 'set',
    messageIndex,
    setType: 'active',
    startTime,
    timestamp,
    durationSec: Math.max(0, Math.round((timestamp.getTime() - startTime.getTime()) / 1000)),
    repetitions: set.reps,
    weightKg: set.weightKg,
    category: map.category,
    subtypeName: map.subtypeName,
    weightDisplayUnit: weightDisplayUnit(unit),
  };
}

function restSetMessage(messageIndex: number, startTime: Date, timestamp: Date): FitMessage {
  return {
    kind: 'set',
    messageIndex,
    setType: 'rest',
    startTime,
    timestamp,
    durationSec: Math.max(0, Math.round((timestamp.getTime() - startTime.getTime()) / 1000)),
  };
}

/** Real timeline: each set ends at its `completedAt`; the gap before it (rest +
 *  any warm-up wait) becomes a rest set, and the tail of that gap is the
 *  estimated lifting time for the work set. */
function buildSetsFromRealTiming(
  flat: FlatWorkSet[],
  sessionStart: Date,
  unit: Unit,
): FitMessage[] {
  const out: FitMessage[] = [];
  let prev = sessionStart;
  let index = 0;
  for (const set of flat) {
    const done = new Date(set.completedAt as string);
    const gapSec = Math.max(0, (done.getTime() - prev.getTime()) / 1000);
    const activeSec = Math.min(set.reps * SECONDS_PER_REP, gapSec);
    const activeStart = new Date(done.getTime() - activeSec * 1000);
    if (activeStart.getTime() - prev.getTime() >= 1000) {
      out.push(restSetMessage(index++, prev, activeStart));
    }
    out.push(activeSetMessage(index++, set, activeStart, done, unit));
    prev = done;
  }
  return out;
}

/** Synthesized timeline for sessions without per-set timestamps: lift for an
 *  estimated time, then rest the configured amount between sets. */
function buildSetsSynthesized(
  flat: FlatWorkSet[],
  sessionStart: Date,
  settings: Settings,
  unit: Unit,
): FitMessage[] {
  const out: FitMessage[] = [];
  let prev = sessionStart;
  let index = 0;
  flat.forEach((set, i) => {
    const activeEnd = new Date(prev.getTime() + set.reps * SECONDS_PER_REP * 1000);
    out.push(activeSetMessage(index++, set, prev, activeEnd, unit));
    prev = activeEnd;
    if (i < flat.length - 1) {
      const restEnd = new Date(prev.getTime() + restSecondsFor(set.exerciseId, settings) * 1000);
      out.push(restSetMessage(index++, prev, restEnd));
      prev = restEnd;
    }
  });
  return out;
}

/**
 * Build the ordered FIT messages for a completed session: file id, the set
 * messages (active + rest), then the lap, session, and activity summaries.
 */
export function buildFitMessages(session: WorkoutSession, settings: Settings): FitMessage[] {
  const sessionStart = new Date(session.date);
  const flat = flattenWorkSets(session);

  const setMessages = hasRealTiming(session)
    ? buildSetsFromRealTiming(flat, sessionStart, session.unit)
    : buildSetsSynthesized(flat, sessionStart, settings, session.unit);

  // Session ends at the last set's timestamp (or the start, if there are none).
  const last = setMessages[setMessages.length - 1];
  const sessionEnd = last && last.kind === 'set' ? last.timestamp : sessionStart;
  const totalElapsedSec = Math.max(0, Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 1000));

  return [
    { kind: 'fileId', timeCreated: sessionStart },
    ...setMessages,
    { kind: 'lap', messageIndex: 0, startTime: sessionStart, timestamp: sessionEnd, totalElapsedSec },
    {
      kind: 'session',
      messageIndex: 0,
      startTime: sessionStart,
      timestamp: sessionEnd,
      totalElapsedSec,
      numLaps: 1,
    },
    { kind: 'activity', timestamp: sessionEnd, totalTimerSec: totalElapsedSec },
  ];
}
