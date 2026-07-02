import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { WORKOUT_TEMPLATES } from '../domain/exercises';
import { computeNextState, resultFromLogged } from '../domain/progression';
import { buildSessionFromCustom, buildSessionFromTemplate, flipWorkoutType } from '../domain/session';
import { makeCustomExercise, validateCustomExercise } from '../domain/customExercises';
import type { CustomExerciseInput } from '../domain/customExercises';
import { makeCustomWorkout, validateCustomWorkout } from '../domain/customWorkouts';
import type { CustomWorkoutInput } from '../domain/customWorkouts';
import { defaultAppState, defaultSettings, SCHEMA_VERSION } from '../domain/defaults';
import { BAR_WEIGHT, DEFAULT_ROUNDING, PLATE_SIZES, convertWeight } from '../domain/units';
import { computeWarmups, warmupsToLoggedSets } from '../domain/warmups';
import type {
  AppState,
  CustomWorkout,
  ExerciseDef,
  ExerciseId,
  ExerciseState,
  LoggedSet,
  ProgressionConfig,
  Settings,
  Unit,
  WorkoutSession,
  WorkoutType,
} from '../domain/types';

export type Tab = 'today' | 'history' | 'progress' | 'settings';

interface RestTimer {
  /** Epoch ms when the current rest ends, or null when idle. */
  endsAt: number | null;
  /** Total duration of the active rest, for the progress ring. */
  durationSec: number;
}

interface Store extends AppState {
  // Transient UI state (not persisted).
  rest: RestTimer;
  /** The session just completed, surfaced for the post-finish summary/share. */
  lastFinished: WorkoutSession | null;
  /** ISO timestamp of the last backup export on this device, or null. Persisted
   * device metadata — intentionally not part of AppState / the export payload. */
  lastBackupAt: string | null;
  /** True when a persist write failed because localStorage is full. The latest
   * changes are in memory but were not saved. Cleared on the next good write. */
  persistError: boolean;

  // Session lifecycle.
  startWorkout: (type?: WorkoutType) => void;
  startCustomWorkout: (workoutId: string) => void;
  discardWorkout: () => void;
  finishWorkout: () => void;
  dismissFinished: () => void;

  // Set logging.
  toggleSet: (exerciseIndex: number, setIndex: number, isWarmup: boolean) => void;
  setReps: (exerciseIndex: number, setIndex: number, isWarmup: boolean, reps: number) => void;

  /** Edit an exercise's working weight in the in-progress session. */
  setExerciseWeight: (exerciseIndex: number, weight: number) => void;

  // Warmup customization (per in-progress session).
  setWarmupWeight: (exerciseIndex: number, setIndex: number, weight: number) => void;
  setWarmupReps: (exerciseIndex: number, setIndex: number, reps: number) => void;
  addWarmupSet: (exerciseIndex: number) => void;
  removeWarmupSet: (exerciseIndex: number, setIndex: number) => void;

  // Rest timer.
  startRest: (seconds: number) => void;
  stopRest: () => void;

  // Settings & data.
  updateSettings: (partial: Partial<Settings>) => void;
  editExerciseState: (id: ExerciseId, partial: Partial<ExerciseState>) => void;
  changeUnit: (unit: Unit) => void;

  // Custom exercises & workouts. Add returns the new id (or null when input is
  // invalid) so callers can clear their form on success.
  addCustomExercise: (input: CustomExerciseInput) => string | null;
  editCustomExercise: (id: ExerciseId, partial: Partial<ExerciseDef>) => void;
  deleteCustomExercise: (id: ExerciseId) => void;
  addCustomWorkout: (input: CustomWorkoutInput) => string | null;
  editCustomWorkout: (id: string, partial: Partial<Omit<CustomWorkout, 'id'>>) => void;
  deleteCustomWorkout: (id: string) => void;
  importData: (state: AppState) => void;
  resetAll: () => void;
  exportData: () => AppState;
  /** Stamp the current time as the last successful backup. */
  markBackedUp: () => void;
  /** Dismiss the storage-full warning for this session. */
  dismissPersistError: () => void;
}

const PERSIST_KEY = 'fivebyfive-v1';

/** True for the various browser names/codes used for a storage-quota overflow. */
function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22)
  );
}

/**
 * localStorage-backed JSON storage that turns a quota overflow into a visible
 * `persistError` flag instead of an unhandled throw that would silently drop
 * the just-made changes. A subsequent successful write clears the flag.
 */
const guardedStorage = createJSONStorage(() => {
  if (typeof localStorage === 'undefined') {
    return undefined as unknown as Storage;
  }
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, value);
        if (useAppStore.getState().persistError) {
          useAppStore.setState({ persistError: false });
        }
      } catch (e) {
        if (isQuotaError(e)) {
          useAppStore.setState({ persistError: true });
        } else {
          throw e;
        }
      }
    },
    removeItem: (name) => localStorage.removeItem(name),
  };
});

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Apply an update to one exercise's warmup sets within a session. */
function mapWarmupSets(
  session: WorkoutSession,
  exerciseIndex: number,
  update: (sets: LoggedSet[]) => LoggedSet[],
): WorkoutSession {
  const exercises = session.exercises.map((ex, ei) =>
    ei === exerciseIndex ? { ...ex, warmupSets: update(ex.warmupSets) } : ex,
  );
  return { ...session, exercises };
}

/** A progression config whose `increments` also covers custom exercises (their
 *  increment lives on the def). Built-in increments win on id collision. */
function withCustomIncrements(
  config: ProgressionConfig,
  customExercises: ExerciseDef[],
): ProgressionConfig {
  const increments: Record<ExerciseId, number> = { ...config.increments };
  for (const def of customExercises) {
    if (def.increment !== undefined && increments[def.id] === undefined) {
      increments[def.id] = def.increment;
    }
  }
  return { ...config, increments };
}

/** Extract only the persisted AppState slice from the full store. */
function pickAppState(s: Store): AppState {
  return {
    schemaVersion: s.schemaVersion,
    settings: s.settings,
    exerciseStates: s.exerciseStates,
    history: s.history,
    currentSession: s.currentSession,
    nextWorkoutType: s.nextWorkoutType,
    customExercises: s.customExercises,
    customWorkouts: s.customWorkouts,
  };
}

/**
 * Migrate persisted state forward across schema versions.
 *  - v1 -> v2 added the optional `completedAt` on LoggedSet; old data is valid
 *    as-is (sets simply lack it and the export synthesizes timing).
 *  - v2 -> v3 added `settings.sound`; default it on for older state.
 *  - v3 -> v4 added `settings.barWeight`/`settings.plates`; backfill from the
 *    unit defaults for older state.
 *  - v4 -> v5 added `settings.keepScreenAwake`; default it on for older state.
 *  - v5 -> v6 added `settings.workoutDays`; default it to an empty array (no
 *    schedule) for older state.
 *  - v6 -> v7 added `customExercises`/`customWorkouts`; default both to empty
 *    arrays for older state. Existing sessions need no rewrite.
 */
export function migratePersisted(persisted: unknown, version: number): AppState {
  const state = persisted as AppState;
  if (version < 3 && state?.settings && state.settings.sound === undefined) {
    state.settings = { ...state.settings, sound: true };
  }
  if (version < 4 && state?.settings) {
    const unit = state.settings.unit;
    if (state.settings.barWeight === undefined) {
      state.settings = { ...state.settings, barWeight: BAR_WEIGHT[unit] };
    }
    if (state.settings.plates === undefined) {
      state.settings = { ...state.settings, plates: [...PLATE_SIZES[unit]] };
    }
  }
  if (version < 5 && state?.settings && state.settings.keepScreenAwake === undefined) {
    state.settings = { ...state.settings, keepScreenAwake: true };
  }
  if (version < 6 && state?.settings && state.settings.workoutDays === undefined) {
    state.settings = { ...state.settings, workoutDays: [] };
  }
  if (version < 7) {
    if (state?.customExercises === undefined) state.customExercises = [];
    if (state?.customWorkouts === undefined) state.customWorkouts = [];
  }
  return state;
}

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...defaultAppState('kg'),
      rest: { endsAt: null, durationSec: 0 },
      lastFinished: null,
      lastBackupAt: null,
      persistError: false,

      startWorkout: (type?: WorkoutType) => {
        const { nextWorkoutType, exerciseStates, settings, currentSession, customExercises } = get();
        if (currentSession) return; // already in progress
        const chosen = type ?? nextWorkoutType;
        const session = buildSessionFromTemplate(
          chosen,
          exerciseStates,
          settings,
          newId(),
          new Date().toISOString(),
          customExercises,
        );
        // Keep the stored "next" in sync with what's actually running, so the
        // Today screen highlights coherently if the session is discarded.
        set({ currentSession: session, nextWorkoutType: chosen, lastFinished: null });
      },

      startCustomWorkout: (workoutId) => {
        const { exerciseStates, settings, currentSession, customExercises, customWorkouts } = get();
        if (currentSession) return; // already in progress
        const workout = customWorkouts.find((w) => w.id === workoutId);
        if (!workout) return;
        const session = buildSessionFromCustom(
          workout,
          exerciseStates,
          settings,
          customExercises,
          newId(),
          new Date().toISOString(),
        );
        // Custom workouts are picked on demand and stay out of the A/B rotation,
        // so `nextWorkoutType` is intentionally left untouched.
        set({ currentSession: session, lastFinished: null });
      },

      discardWorkout: () =>
        set({ currentSession: null, lastFinished: null, rest: { endsAt: null, durationSec: 0 } }),

      finishWorkout: () => {
        const { currentSession, exerciseStates, settings, history, customExercises, nextWorkoutType } =
          get();
        if (!currentSession) return;

        // Merge custom exercises' per-def increments onto the built-in config so
        // the progression engine advances custom lifts too.
        const config = withCustomIncrements(settings.config, customExercises);

        const nextStates: Record<ExerciseId, ExerciseState> = { ...exerciseStates };
        for (const logged of currentSession.exercises) {
          const result = resultFromLogged(logged);
          // Progression advances from the weight actually lifted — the user may
          // have edited it mid-session. Converted in case the unit was switched
          // while the session was open (session weights stay in their own unit).
          const liftedWeight = convertWeight(
            logged.weight,
            currentSession.unit,
            settings.unit,
            settings.rounding,
          );
          const prev =
            exerciseStates[logged.exerciseId] ?? {
              exerciseId: logged.exerciseId,
              currentWeight: liftedWeight,
              consecutiveFailures: 0,
            };
          nextStates[logged.exerciseId] = computeNextState(
            { ...prev, currentWeight: liftedWeight },
            result,
            config,
            settings.rounding,
          );
        }

        const completed = { ...currentSession, completed: true };
        set({
          history: [...history, completed],
          exerciseStates: nextStates,
          // Built-in sessions flip the A/B rotation (finish B → next becomes A).
          // Custom sessions are off the rotation, so leave the pointer alone.
          nextWorkoutType:
            currentSession.kind === 'custom'
              ? nextWorkoutType
              : flipWorkoutType(currentSession.type ?? nextWorkoutType),
          currentSession: null,
          lastFinished: completed,
          rest: { endsAt: null, durationSec: 0 },
        });
      },

      dismissFinished: () => set({ lastFinished: null }),

      toggleSet: (exerciseIndex, setIndex, isWarmup) => {
        const { currentSession } = get();
        if (!currentSession) return;
        const exercises = currentSession.exercises.map((ex, ei) => {
          if (ei !== exerciseIndex) return ex;
          const key = isWarmup ? 'warmupSets' : 'workSets';
          const sets = ex[key].map((s, si) =>
            si === setIndex
              ? {
                  ...s,
                  done: !s.done,
                  // Stamp the real completion time when flipping to done; clear
                  // it when flipping back, so the Garmin export reflects reality.
                  completedAt: !s.done ? new Date().toISOString() : undefined,
                }
              : s,
          );
          return { ...ex, [key]: sets };
        });
        set({ currentSession: { ...currentSession, exercises } });
      },

      setReps: (exerciseIndex, setIndex, isWarmup, reps) => {
        const { currentSession } = get();
        if (!currentSession) return;
        const clamped = Math.max(0, Math.min(20, Math.round(reps)));
        const exercises = currentSession.exercises.map((ex, ei) => {
          if (ei !== exerciseIndex) return ex;
          const key = isWarmup ? 'warmupSets' : 'workSets';
          const sets = ex[key].map((s, si) =>
            si === setIndex
              ? {
                  ...s,
                  reps: clamped,
                  done: true,
                  // Keep the original completion time if the set was already
                  // done; only stamp it when this action first marks it done.
                  completedAt: s.completedAt ?? new Date().toISOString(),
                }
              : s,
          );
          return { ...ex, [key]: sets };
        });
        set({ currentSession: { ...currentSession, exercises } });
      },

      setExerciseWeight: (exerciseIndex, weight) => {
        const { currentSession, settings } = get();
        if (!currentSession || !Number.isFinite(weight) || weight < 0) return;
        const exercises = currentSession.exercises.map((ex, ei) => {
          if (ei !== exerciseIndex) return ex;
          // While the exercise is untouched, regenerate the warmup ramp toward
          // the new target; once any set is logged, leave the warmups alone.
          const untouched = ![...ex.warmupSets, ...ex.workSets].some((s) => s.done);
          const warmupSets = untouched
            ? warmupsToLoggedSets(
                computeWarmups(weight, settings.unit, settings.rounding, settings.barWeight),
              )
            : ex.warmupSets;
          return { ...ex, weight, warmupSets };
        });
        set({ currentSession: { ...currentSession, exercises } });
      },

      setWarmupWeight: (exerciseIndex, setIndex, weight) => {
        const { currentSession } = get();
        if (!currentSession || !Number.isFinite(weight) || weight < 0) return;
        set({ currentSession: mapWarmupSets(currentSession, exerciseIndex, (sets) =>
          sets.map((s, si) => (si === setIndex ? { ...s, weight } : s)),
        ) });
      },

      setWarmupReps: (exerciseIndex, setIndex, reps) => {
        const { currentSession } = get();
        if (!currentSession) return;
        const clamped = Math.max(0, Math.min(20, Math.round(reps)));
        set({ currentSession: mapWarmupSets(currentSession, exerciseIndex, (sets) =>
          sets.map((s, si) =>
            si === setIndex ? { ...s, reps: clamped, targetReps: clamped } : s,
          ),
        ) });
      },

      addWarmupSet: (exerciseIndex) => {
        const { currentSession, settings } = get();
        if (!currentSession) return;
        set({ currentSession: mapWarmupSets(currentSession, exerciseIndex, (sets) => {
          const last = sets[sets.length - 1];
          const weight = last?.weight ?? BAR_WEIGHT[settings.unit];
          const reps = last?.reps ?? 5;
          return [...sets, { reps, targetReps: reps, done: false, isWarmup: true, weight }];
        }) });
      },

      removeWarmupSet: (exerciseIndex, setIndex) => {
        const { currentSession } = get();
        if (!currentSession) return;
        set({ currentSession: mapWarmupSets(currentSession, exerciseIndex, (sets) =>
          sets.filter((_, si) => si !== setIndex),
        ) });
      },

      startRest: (seconds) =>
        set({ rest: { endsAt: Date.now() + seconds * 1000, durationSec: seconds } }),

      stopRest: () => set({ rest: { endsAt: null, durationSec: 0 } }),

      updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),

      editExerciseState: (id, partial) =>
        set((s) => ({
          exerciseStates: {
            ...s.exerciseStates,
            [id]: { ...s.exerciseStates[id], ...partial },
          },
        })),

      changeUnit: (unit) =>
        set((s) => {
          if (s.settings.unit === unit) return {};
          const from = s.settings.unit;
          const rounding = DEFAULT_ROUNDING[unit];
          const defaults = defaultSettings(unit);

          // Convert every stored weight (built-in and custom exercises alike).
          const exerciseStates = { ...s.exerciseStates };
          for (const id of Object.keys(exerciseStates)) {
            exerciseStates[id] = {
              ...exerciseStates[id],
              currentWeight: convertWeight(
                exerciseStates[id].currentWeight,
                from,
                unit,
                rounding,
              ),
            };
          }

          // Custom exercises carry their increment in the active unit, so convert
          // those too (built-in increments are reset to the unit defaults below).
          const customExercises = s.customExercises.map((def) =>
            def.increment === undefined
              ? def
              : { ...def, increment: convertWeight(def.increment, from, unit, rounding) },
          );

          return {
            settings: {
              ...s.settings,
              unit,
              rounding,
              // Adopt the unit's natural bar, plates, and increments when switching.
              barWeight: defaults.barWeight,
              plates: defaults.plates,
              config: { ...s.settings.config, increments: defaults.config.increments },
            },
            exerciseStates,
            customExercises,
          };
        }),

      addCustomExercise: (input) => {
        const validation = validateCustomExercise(input);
        if (!validation.ok) return null;
        const id = `custom-${newId()}`;
        const def = makeCustomExercise(input, id);
        set((s) => ({
          customExercises: [...s.customExercises, def],
          // Seed the progression state at the chosen starting weight.
          exerciseStates: {
            ...s.exerciseStates,
            [id]: { exerciseId: id, currentWeight: input.startingWeight, consecutiveFailures: 0 },
          },
        }));
        return id;
      },

      editCustomExercise: (id, partial) =>
        set((s) => ({
          customExercises: s.customExercises.map((def) =>
            def.id === id ? { ...def, ...partial, id, custom: true } : def,
          ),
        })),

      deleteCustomExercise: (id) =>
        set((s) => {
          const exerciseStates = { ...s.exerciseStates };
          delete exerciseStates[id];
          return {
            customExercises: s.customExercises.filter((def) => def.id !== id),
            exerciseStates,
            // Scrub the deleted exercise out of any custom workout that used it.
            customWorkouts: s.customWorkouts.map((w) =>
              w.exercises.includes(id)
                ? { ...w, exercises: w.exercises.filter((e) => e !== id) }
                : w,
            ),
          };
        }),

      addCustomWorkout: (input) => {
        const validation = validateCustomWorkout(input);
        if (!validation.ok) return null;
        const id = `workout-${newId()}`;
        const workout = makeCustomWorkout(input, id);
        set((s) => ({ customWorkouts: [...s.customWorkouts, workout] }));
        return id;
      },

      editCustomWorkout: (id, partial) =>
        set((s) => ({
          customWorkouts: s.customWorkouts.map((w) =>
            w.id === id ? { ...w, ...partial, id } : w,
          ),
        })),

      deleteCustomWorkout: (id) =>
        set((s) => ({ customWorkouts: s.customWorkouts.filter((w) => w.id !== id) })),

      importData: (state) =>
        set({
          schemaVersion: SCHEMA_VERSION,
          // Backfill fields added in later schema versions for older backups.
          settings: {
            ...state.settings,
            sound: state.settings.sound ?? true,
            keepScreenAwake: state.settings.keepScreenAwake ?? true,
            barWeight: state.settings.barWeight ?? BAR_WEIGHT[state.settings.unit],
            plates: state.settings.plates ?? [...PLATE_SIZES[state.settings.unit]],
          },
          exerciseStates: state.exerciseStates,
          history: state.history,
          currentSession: state.currentSession,
          nextWorkoutType: state.nextWorkoutType,
          customExercises: state.customExercises ?? [],
          customWorkouts: state.customWorkouts ?? [],
          lastFinished: null,
          rest: { endsAt: null, durationSec: 0 },
          // After an import the current data matches an external file the user
          // just handled, so treat it as backed up.
          lastBackupAt: new Date().toISOString(),
        }),

      resetAll: () =>
        set({
          ...defaultAppState(get().settings.unit),
          lastFinished: null,
          rest: { endsAt: null, durationSec: 0 },
        }),

      exportData: () => pickAppState(get()),

      markBackedUp: () => set({ lastBackupAt: new Date().toISOString() }),

      dismissPersistError: () => set({ persistError: false }),
    }),
    {
      name: PERSIST_KEY,
      version: SCHEMA_VERSION,
      storage: guardedStorage,
      partialize: (s) => ({ ...pickAppState(s as Store), lastBackupAt: (s as Store).lastBackupAt }),
      migrate: (persisted, version) => migratePersisted(persisted, version),
    },
  ),
);

/** Convenience selectors for the workout template of an in-progress/next session. */
export function workoutTemplateFor(type: AppState['nextWorkoutType']) {
  return WORKOUT_TEMPLATES[type];
}
