import { beforeEach, describe, expect, it } from 'vitest';
import { migratePersisted, useAppStore } from '../store/useAppStore';
import { defaultAppState } from '../domain/defaults';
import { BAR_WEIGHT } from '../domain/units';
import type { AppState } from '../domain/types';

/** Reset the singleton store to a clean default before each test. */
function reset(unit: 'kg' | 'lb' = 'kg') {
  useAppStore.setState({
    ...defaultAppState(unit),
    rest: { endsAt: null, durationSec: 0 },
    lastFinished: null,
    lastBackupAt: null,
    persistError: false,
  });
}

/** Mark every work set of an exercise in the current session as a clean success. */
function succeedExercise(exerciseIndex: number) {
  const { currentSession } = useAppStore.getState();
  const ex = currentSession!.exercises[exerciseIndex];
  ex.workSets.forEach((_, si) =>
    useAppStore.getState().setReps(exerciseIndex, si, false, 5),
  );
}

beforeEach(() => reset());

describe('startWorkout', () => {
  it('builds a session for the next workout type', () => {
    useAppStore.getState().startWorkout();
    const { currentSession } = useAppStore.getState();
    expect(currentSession).not.toBeNull();
    expect(currentSession!.type).toBe('A');
    expect(currentSession!.exercises.map((e) => e.exerciseId)).toEqual([
      'squat',
      'bench',
      'row',
    ]);
    expect(currentSession!.completed).toBe(false);
  });

  it('does nothing when a session is already in progress', () => {
    useAppStore.getState().startWorkout();
    const first = useAppStore.getState().currentSession;
    useAppStore.getState().startWorkout();
    expect(useAppStore.getState().currentSession).toBe(first);
  });
});

describe('finishWorkout', () => {
  it('archives the session, advances state, and flips the workout type', () => {
    useAppStore.getState().startWorkout();
    // Squat succeeds, the rest are left untouched (fail).
    succeedExercise(0);
    useAppStore.getState().finishWorkout();

    const s = useAppStore.getState();
    expect(s.history).toHaveLength(1);
    expect(s.history[0].completed).toBe(true);
    expect(s.currentSession).toBeNull();
    expect(s.lastFinished).not.toBeNull();
    expect(s.nextWorkoutType).toBe('B');

    // Squat progressed by its increment; bench (failed) banked a failure.
    expect(s.exerciseStates.squat.currentWeight).toBe(BAR_WEIGHT.kg + 2.5);
    expect(s.exerciseStates.squat.consecutiveFailures).toBe(0);
    expect(s.exerciseStates.bench.currentWeight).toBe(BAR_WEIGHT.kg);
    expect(s.exerciseStates.bench.consecutiveFailures).toBe(1);
  });

  it('does nothing when there is no session in progress', () => {
    useAppStore.getState().finishWorkout();
    expect(useAppStore.getState().history).toHaveLength(0);
  });
});

describe('discardWorkout', () => {
  it('drops the in-progress session without touching history', () => {
    useAppStore.getState().startWorkout();
    useAppStore.getState().discardWorkout();
    expect(useAppStore.getState().currentSession).toBeNull();
    expect(useAppStore.getState().history).toHaveLength(0);
  });
});

describe('setReps', () => {
  beforeEach(() => useAppStore.getState().startWorkout());

  it('records reps and marks the set done', () => {
    useAppStore.getState().setReps(0, 0, false, 4);
    const set = useAppStore.getState().currentSession!.exercises[0].workSets[0];
    expect(set.reps).toBe(4);
    expect(set.done).toBe(true);
  });

  it('clamps reps into the 0..20 range', () => {
    useAppStore.getState().setReps(0, 0, false, 99);
    expect(useAppStore.getState().currentSession!.exercises[0].workSets[0].reps).toBe(20);
    useAppStore.getState().setReps(0, 1, false, -5);
    expect(useAppStore.getState().currentSession!.exercises[0].workSets[1].reps).toBe(0);
  });

  it('stamps a completion time, preserved across later rep edits', () => {
    useAppStore.getState().setReps(0, 0, false, 5);
    const first = useAppStore.getState().currentSession!.exercises[0].workSets[0].completedAt;
    expect(first).toBeTruthy();
    useAppStore.getState().setReps(0, 0, false, 4);
    expect(useAppStore.getState().currentSession!.exercises[0].workSets[0].completedAt).toBe(first);
  });
});

describe('toggleSet', () => {
  it('flips a work set between done and not done', () => {
    useAppStore.getState().startWorkout();
    expect(useAppStore.getState().currentSession!.exercises[0].workSets[0].done).toBe(false);
    useAppStore.getState().toggleSet(0, 0, false);
    expect(useAppStore.getState().currentSession!.exercises[0].workSets[0].done).toBe(true);
    useAppStore.getState().toggleSet(0, 0, false);
    expect(useAppStore.getState().currentSession!.exercises[0].workSets[0].done).toBe(false);
  });

  it('stamps completedAt when marking done and clears it when undone', () => {
    useAppStore.getState().startWorkout();
    useAppStore.getState().toggleSet(0, 0, false);
    expect(useAppStore.getState().currentSession!.exercises[0].workSets[0].completedAt).toBeTruthy();
    useAppStore.getState().toggleSet(0, 0, false);
    expect(useAppStore.getState().currentSession!.exercises[0].workSets[0].completedAt).toBeUndefined();
  });
});

describe('warmup customization', () => {
  beforeEach(() => useAppStore.getState().startWorkout());

  it('appends and removes warmup sets', () => {
    const before = useAppStore.getState().currentSession!.exercises[0].warmupSets.length;
    useAppStore.getState().addWarmupSet(0);
    expect(useAppStore.getState().currentSession!.exercises[0].warmupSets).toHaveLength(
      before + 1,
    );
    useAppStore.getState().removeWarmupSet(0, 0);
    expect(useAppStore.getState().currentSession!.exercises[0].warmupSets).toHaveLength(before);
  });

  it('falls back to the bar weight when adding to an empty warmup list', () => {
    // Clear the generated warmups first.
    const session = useAppStore.getState().currentSession!;
    session.exercises[0].warmupSets = [];
    useAppStore.setState({ currentSession: { ...session } });
    useAppStore.getState().addWarmupSet(0);
    const added = useAppStore.getState().currentSession!.exercises[0].warmupSets[0];
    expect(added.weight).toBe(BAR_WEIGHT.kg);
    expect(added.isWarmup).toBe(true);
  });

  it('rejects a negative warmup weight', () => {
    const original = useAppStore.getState().currentSession!.exercises[0].warmupSets[0]?.weight;
    useAppStore.getState().setWarmupWeight(0, 0, -10);
    expect(useAppStore.getState().currentSession!.exercises[0].warmupSets[0]?.weight).toBe(
      original,
    );
  });
});

describe('changeUnit', () => {
  it('converts stored weights and adopts the new unit increments', () => {
    // squat starts at the 20 kg bar.
    useAppStore.getState().changeUnit('lb');
    const s = useAppStore.getState();
    expect(s.settings.unit).toBe('lb');
    expect(s.settings.rounding).toBe(5);
    // 20 kg ~= 44.09 lb -> snaps to 45 lb.
    expect(s.exerciseStates.squat.currentWeight).toBe(45);
    expect(s.settings.config.increments.deadlift).toBe(10);
  });

  it('is a no-op when the unit is unchanged', () => {
    const before = useAppStore.getState().exerciseStates.squat.currentWeight;
    useAppStore.getState().changeUnit('kg');
    expect(useAppStore.getState().exerciseStates.squat.currentWeight).toBe(before);
    expect(useAppStore.getState().settings.unit).toBe('kg');
  });
});

describe('importData / resetAll', () => {
  it('imports a foreign state and stamps it as backed up', () => {
    const incoming: AppState = {
      ...defaultAppState('lb'),
      nextWorkoutType: 'B',
      history: [
        {
          id: 'x',
          date: '2026-01-01T00:00:00Z',
          type: 'A',
          unit: 'lb',
          exercises: [],
          completed: true,
        },
      ],
    };
    useAppStore.getState().importData(incoming);
    const s = useAppStore.getState();
    expect(s.history).toHaveLength(1);
    expect(s.nextWorkoutType).toBe('B');
    expect(s.settings.unit).toBe('lb');
    expect(s.lastBackupAt).not.toBeNull();
  });

  it('resets everything back to defaults while keeping the active unit', () => {
    useAppStore.getState().changeUnit('lb');
    useAppStore.getState().startWorkout();
    useAppStore.getState().resetAll();
    const s = useAppStore.getState();
    expect(s.currentSession).toBeNull();
    expect(s.history).toHaveLength(0);
    expect(s.settings.unit).toBe('lb');
  });
});

describe('exportData', () => {
  it('returns only the persisted AppState slice', () => {
    const data = useAppStore.getState().exportData();
    expect(Object.keys(data).sort()).toEqual(
      [
        'schemaVersion',
        'settings',
        'exerciseStates',
        'history',
        'currentSession',
        'nextWorkoutType',
      ].sort(),
    );
  });
});

describe('rest timer actions', () => {
  it('sets and clears the rest window', () => {
    useAppStore.getState().startRest(90);
    const { rest } = useAppStore.getState();
    expect(rest.durationSec).toBe(90);
    expect(rest.endsAt).not.toBeNull();
    useAppStore.getState().stopRest();
    expect(useAppStore.getState().rest.endsAt).toBeNull();
  });
});

describe('migratePersisted', () => {
  it('backfills settings.sound for v2 state', () => {
    const v2 = defaultAppState('kg') as AppState;
    // Simulate older persisted state lacking the field.
    delete (v2.settings as Partial<AppState['settings']>).sound;
    const migrated = migratePersisted(v2, 2);
    expect(migrated.settings.sound).toBe(true);
  });

  it('leaves an explicit sound setting untouched', () => {
    const state = defaultAppState('kg') as AppState;
    state.settings.sound = false;
    const migrated = migratePersisted(state, 3);
    expect(migrated.settings.sound).toBe(false);
  });
});
