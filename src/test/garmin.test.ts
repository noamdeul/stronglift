import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../domain/defaults';
import {
  buildFitMessages,
  EXERCISE_FIT_MAP,
  hasRealTiming,
  SECONDS_PER_REP,
  type FitMessage,
} from '../domain/garmin';
import { lbToKg } from '../domain/units';
import type { LoggedSet, Unit, WorkoutSession } from '../domain/types';

function workSet(reps: number, completedAt?: string): LoggedSet {
  return { reps, targetReps: 5, done: true, isWarmup: false, completedAt };
}

/** A Workout-A session (squat/bench/row) with one work set per exercise so the
 *  set list is small and easy to assert over. */
function session(opts: {
  unit?: Unit;
  date?: string;
  completedAt?: [string, string, string];
} = {}): WorkoutSession {
  const { unit = 'kg', date = '2026-06-27T10:00:00.000Z', completedAt } = opts;
  return {
    id: 'test',
    date,
    type: 'A',
    unit,
    completed: true,
    exercises: [
      { exerciseId: 'squat', weight: 100, warmupSets: [], workSets: [workSet(5, completedAt?.[0])] },
      { exerciseId: 'bench', weight: 60, warmupSets: [], workSets: [workSet(5, completedAt?.[1])] },
      { exerciseId: 'row', weight: 50, warmupSets: [], workSets: [workSet(5, completedAt?.[2])] },
    ],
  };
}

const settings = defaultSettings('kg');

function activeSets(messages: FitMessage[]) {
  return messages.filter((m): m is Extract<FitMessage, { kind: 'set' }> => m.kind === 'set' && m.setType === 'active');
}

describe('EXERCISE_FIT_MAP', () => {
  it('maps every lift to a barbell category and subtype', () => {
    expect(EXERCISE_FIT_MAP.squat).toEqual({ category: 'squat', subtypeName: 'barbellBackSquat' });
    expect(EXERCISE_FIT_MAP.bench).toEqual({ category: 'benchPress', subtypeName: 'barbellBenchPress' });
    expect(EXERCISE_FIT_MAP.row).toEqual({ category: 'row', subtypeName: 'barbellRow' });
    expect(EXERCISE_FIT_MAP.ohp).toEqual({ category: 'shoulderPress', subtypeName: 'barbellShoulderPress' });
    expect(EXERCISE_FIT_MAP.deadlift).toEqual({ category: 'deadlift', subtypeName: 'barbellDeadlift' });
  });
});

describe('hasRealTiming', () => {
  it('is true only when every work set has a completedAt', () => {
    expect(hasRealTiming(session())).toBe(false);
    expect(
      hasRealTiming(
        session({
          completedAt: [
            '2026-06-27T10:01:00.000Z',
            '2026-06-27T10:05:00.000Z',
            '2026-06-27T10:09:00.000Z',
          ],
        }),
      ),
    ).toBe(true);
  });
});

describe('buildFitMessages', () => {
  it('opens with file_id and ends with activity, with one session and lap', () => {
    const m = buildFitMessages(session(), settings);
    expect(m[0].kind).toBe('fileId');
    expect(m[m.length - 1].kind).toBe('activity');
    expect(m.filter((x) => x.kind === 'session')).toHaveLength(1);
    expect(m.filter((x) => x.kind === 'lap')).toHaveLength(1);
  });

  it('emits one active set per work set carrying reps, category and subtype', () => {
    const m = buildFitMessages(session(), settings);
    const active = activeSets(m);
    expect(active).toHaveLength(3);
    expect(active.map((s) => s.repetitions)).toEqual([5, 5, 5]);
    expect(active.map((s) => s.category)).toEqual(['squat', 'benchPress', 'row']);
    expect(active.map((s) => s.subtypeName)).toEqual([
      'barbellBackSquat',
      'barbellBenchPress',
      'barbellRow',
    ]);
  });

  it('stores weight in kg and converts lb sessions', () => {
    const kg = activeSets(buildFitMessages(session({ unit: 'kg' }), settings));
    expect(kg[0].weightKg).toBe(100);
    expect(kg[0].weightDisplayUnit).toBe('kilogram');

    const lb = activeSets(buildFitMessages(session({ unit: 'lb' }), settings));
    expect(lb[0].weightKg).toBeCloseTo(lbToKg(100), 5);
    expect(lb[0].weightDisplayUnit).toBe('pound');
  });

  it('uses real completion timestamps when present', () => {
    const completedAt: [string, string, string] = [
      '2026-06-27T10:01:00.000Z',
      '2026-06-27T10:05:00.000Z',
      '2026-06-27T10:09:00.000Z',
    ];
    const m = buildFitMessages(session({ completedAt }), settings);
    const active = activeSets(m);
    // Each active set ends exactly at its real completion time.
    expect(active.map((s) => s.timestamp.toISOString())).toEqual(completedAt);

    // Active duration is the per-rep estimate (the rest of the gap is a rest set).
    expect(active[0].durationSec).toBe(5 * SECONDS_PER_REP);

    const sess = m.find((x) => x.kind === 'session') as Extract<FitMessage, { kind: 'session' }>;
    // 10:00 start -> 10:09 last set = 540s.
    expect(sess.totalElapsedSec).toBe(540);
  });

  it('produces a monotonic non-overlapping timeline', () => {
    const m = buildFitMessages(
      session({
        completedAt: [
          '2026-06-27T10:01:00.000Z',
          '2026-06-27T10:05:00.000Z',
          '2026-06-27T10:09:00.000Z',
        ],
      }),
      settings,
    );
    const sets = m.filter((x): x is Extract<FitMessage, { kind: 'set' }> => x.kind === 'set');
    for (const s of sets) {
      expect(s.timestamp.getTime()).toBeGreaterThanOrEqual(s.startTime.getTime());
    }
    for (let i = 1; i < sets.length; i++) {
      expect(sets[i].startTime.getTime()).toBeGreaterThanOrEqual(sets[i - 1].timestamp.getTime());
    }
  });

  it('synthesizes timing from rest settings when timestamps are absent', () => {
    const m = buildFitMessages(session(), settings);
    const sets = m.filter((x): x is Extract<FitMessage, { kind: 'set' }> => x.kind === 'set');
    // 3 active sets + 2 rest sets between them (no trailing rest).
    expect(sets.filter((s) => s.setType === 'active')).toHaveLength(3);
    expect(sets.filter((s) => s.setType === 'rest')).toHaveLength(2);
    // The synthesized rest uses the heavy-work duration for non-deadlift lifts.
    const rest = sets.find((s) => s.setType === 'rest')!;
    expect(rest.durationSec).toBe(settings.restSeconds.heavy);
  });

  it('handles an empty session without throwing', () => {
    const empty = { ...session(), exercises: [] };
    const m = buildFitMessages(empty, settings);
    expect(activeSets(m)).toHaveLength(0);
    const sess = m.find((x) => x.kind === 'session') as Extract<FitMessage, { kind: 'session' }>;
    expect(sess.totalElapsedSec).toBe(0);
  });
});
