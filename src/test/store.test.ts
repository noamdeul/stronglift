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
        'customExercises',
        'customWorkouts',
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

  it('backfills barWeight and plates from the unit defaults for v3 state', () => {
    const v3 = defaultAppState('lb') as AppState;
    delete (v3.settings as Partial<AppState['settings']>).barWeight;
    delete (v3.settings as Partial<AppState['settings']>).plates;
    const migrated = migratePersisted(v3, 3);
    expect(migrated.settings.barWeight).toBe(BAR_WEIGHT.lb);
    expect(migrated.settings.plates).toEqual([45, 35, 25, 10, 5, 2.5]);
  });

  it('leaves an explicit bar and plate set untouched', () => {
    const state = defaultAppState('kg') as AppState;
    state.settings.barWeight = 15;
    state.settings.plates = [20, 10];
    const migrated = migratePersisted(state, 4);
    expect(migrated.settings.barWeight).toBe(15);
    expect(migrated.settings.plates).toEqual([20, 10]);
  });

  it('backfills settings.keepScreenAwake for v4 state', () => {
    const v4 = defaultAppState('kg') as AppState;
    delete (v4.settings as Partial<AppState['settings']>).keepScreenAwake;
    const migrated = migratePersisted(v4, 4);
    expect(migrated.settings.keepScreenAwake).toBe(true);
  });

  it('leaves an explicit keepScreenAwake setting untouched', () => {
    const state = defaultAppState('kg') as AppState;
    state.settings.keepScreenAwake = false;
    const migrated = migratePersisted(state, 5);
    expect(migrated.settings.keepScreenAwake).toBe(false);
  });

  it('backfills customExercises/customWorkouts for v6 state', () => {
    const v6 = defaultAppState('kg') as AppState;
    delete (v6 as Partial<AppState>).customExercises;
    delete (v6 as Partial<AppState>).customWorkouts;
    const migrated = migratePersisted(v6, 6);
    expect(migrated.customExercises).toEqual([]);
    expect(migrated.customWorkouts).toEqual([]);
  });
});

describe('custom exercises', () => {
  it('adds an exercise, seeds its state, and returns its id', () => {
    const id = useAppStore.getState().addCustomExercise({
      name: 'Pull-up',
      sets: 3,
      reps: 8,
      startingWeight: 30,
      increment: 2.5,
    });
    expect(id).not.toBeNull();
    const s = useAppStore.getState();
    expect(s.customExercises).toHaveLength(1);
    expect(s.exerciseStates[id!].currentWeight).toBe(30);
    expect(s.exerciseStates[id!].consecutiveFailures).toBe(0);
  });

  it('rejects invalid input without mutating state', () => {
    const id = useAppStore.getState().addCustomExercise({
      name: '',
      sets: 3,
      reps: 8,
      startingWeight: 30,
      increment: 2.5,
    });
    expect(id).toBeNull();
    expect(useAppStore.getState().customExercises).toHaveLength(0);
  });

  it('deletes an exercise, dropping its state and scrubbing it from workouts', () => {
    const exId = useAppStore.getState().addCustomExercise({
      name: 'Pull-up',
      sets: 3,
      reps: 8,
      startingWeight: 30,
      increment: 2.5,
    })!;
    const wId = useAppStore.getState().addCustomWorkout({
      name: 'Upper',
      exercises: ['bench', exId],
    })!;
    useAppStore.getState().deleteCustomExercise(exId);
    const s = useAppStore.getState();
    expect(s.customExercises).toHaveLength(0);
    expect(s.exerciseStates[exId]).toBeUndefined();
    expect(s.customWorkouts.find((w) => w.id === wId)!.exercises).toEqual(['bench']);
  });

  it('converts custom weights and increments when switching units', () => {
    const exId = useAppStore.getState().addCustomExercise({
      name: 'Pull-up',
      sets: 3,
      reps: 8,
      startingWeight: 40,
      increment: 2.5,
    })!;
    useAppStore.getState().changeUnit('lb');
    const s = useAppStore.getState();
    // 40 kg ~= 88.2 lb -> snaps to 90 lb (rounding 5); 2.5 kg ~= 5.5 lb -> 5 lb.
    expect(s.exerciseStates[exId].currentWeight).toBe(90);
    expect(s.customExercises[0].increment).toBe(5);
  });
});

describe('custom workouts', () => {
  it('starts a custom workout without touching the A/B rotation pointer', () => {
    const exId = useAppStore.getState().addCustomExercise({
      name: 'Pull-up',
      sets: 3,
      reps: 8,
      startingWeight: 30,
      increment: 2.5,
    })!;
    const wId = useAppStore.getState().addCustomWorkout({
      name: 'Upper',
      exercises: ['bench', exId],
    })!;
    const nextBefore = useAppStore.getState().nextWorkoutType;
    useAppStore.getState().startCustomWorkout(wId);
    const session = useAppStore.getState().currentSession!;
    expect(session.kind).toBe('custom');
    expect(session.name).toBe('Upper');
    expect(useAppStore.getState().nextWorkoutType).toBe(nextBefore);
  });

  it('progresses a custom exercise on success and leaves the rotation alone', () => {
    const exId = useAppStore.getState().addCustomExercise({
      name: 'Pull-up',
      sets: 1,
      reps: 5,
      startingWeight: 30,
      increment: 2.5,
    })!;
    const wId = useAppStore.getState().addCustomWorkout({
      name: 'Solo',
      exercises: [exId],
    })!;
    const nextBefore = useAppStore.getState().nextWorkoutType;
    useAppStore.getState().startCustomWorkout(wId);
    useAppStore.getState().setReps(0, 0, false, 5); // succeed the only set
    useAppStore.getState().finishWorkout();
    const s = useAppStore.getState();
    expect(s.exerciseStates[exId].currentWeight).toBe(32.5);
    expect(s.nextWorkoutType).toBe(nextBefore);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].kind).toBe('custom');
  });
});
