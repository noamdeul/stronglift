import { describe, expect, it } from 'vitest';
import { Decoder, Stream } from '@garmin/fitsdk';
import { defaultSettings } from '../domain/defaults';
import { buildFitBytes, fitFileName } from '../lib/fitExport';
import type { LoggedSet, WorkoutSession } from '../domain/types';

function workSet(reps: number, completedAt?: string): LoggedSet {
  return { reps, targetReps: 5, done: true, isWarmup: false, completedAt };
}

const session: WorkoutSession = {
  id: 'test',
  date: '2026-06-27T10:00:00.000Z',
  type: 'A',
  unit: 'kg',
  completed: true,
  exercises: [
    {
      exerciseId: 'squat',
      weight: 100,
      warmupSets: [],
      workSets: [
        workSet(5, '2026-06-27T10:02:00.000Z'),
        workSet(5, '2026-06-27T10:05:00.000Z'),
      ],
    },
    { exerciseId: 'bench', weight: 60, warmupSets: [], workSets: [workSet(5, '2026-06-27T10:09:00.000Z')] },
  ],
};

describe('buildFitBytes (full encode → decode)', () => {
  it('produces a FIT file that passes integrity and decodes as a strength activity', async () => {
    const bytes = await buildFitBytes(session, defaultSettings('kg'));
    const decoder = new Decoder(Stream.fromByteArray(bytes));
    expect(decoder.isFIT()).toBe(true);
    expect(decoder.checkIntegrity()).toBe(true);

    const { messages, errors } = decoder.read();
    expect(errors).toHaveLength(0);

    const sess = messages.sessionMesgs?.[0];
    expect(sess?.sport).toBe('training');
    expect(sess?.subSport).toBe('strengthTraining');

    const setMesgs = messages.setMesgs ?? [];
    const active = setMesgs.filter((s) => s.setType === 'active');
    expect(active).toHaveLength(3);
    // Weight survives the round-trip in kg; category + numeric subtype resolved.
    const first = active[0]!;
    expect(first.weight).toBe(100);
    expect(first.repetitions).toBe(5);
    expect(first.category).toEqual(['squat']);
    const subtype = first.categorySubtype ?? [];
    expect(subtype).toHaveLength(1);
    expect(typeof subtype[0]).toBe('number');
    expect(first.weightDisplayUnit).toBe('kilogram');
  });

  it('names the file by date and workout type', () => {
    expect(fitFileName(session)).toBe('fivebyfive-2026-06-27-workout-A.fit');
  });
});
