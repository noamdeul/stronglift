import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_EXERCISE_IDS, WORKOUT_TEMPLATES } from '../domain/exercises';
import { computeNextState, resultFromLogged } from '../domain/progression';
import { buildSessionFromTemplate, flipWorkoutType } from '../domain/session';
import { defaultAppState, defaultSettings, SCHEMA_VERSION } from '../domain/defaults';
import { BAR_WEIGHT, DEFAULT_ROUNDING, convertWeight } from '../domain/units';
import type {
  AppState,
  ExerciseId,
  ExerciseState,
  LoggedSet,
  Settings,
  Unit,
  WorkoutSession,
} from '../domain/types';

export type Tab = 'today' | 'history' | 'settings';

interface RestTimer {
  /** Epoch ms when the current rest ends, or null when idle. */
  endsAt: number | null;
  /** Total duration of the active rest, for the progress ring. */
  durationSec: number;
}

interface Store extends AppState {
  // Transient UI state (not persisted).
  rest: RestTimer;

  // Session lifecycle.
  startWorkout: () => void;
  discardWorkout: () => void;
  finishWorkout: () => void;

  // Set logging.
  toggleSet: (exerciseIndex: number, setIndex: number, isWarmup: boolean) => void;
  setReps: (exerciseIndex: number, setIndex: number, isWarmup: boolean, reps: number) => void;

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
  importData: (state: AppState) => void;
  resetAll: () => void;
  exportData: () => AppState;
}

const PERSIST_KEY = 'stronglift-v1';

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

/** Extract only the persisted AppState slice from the full store. */
function pickAppState(s: Store): AppState {
  return {
    schemaVersion: s.schemaVersion,
    settings: s.settings,
    exerciseStates: s.exerciseStates,
    history: s.history,
    currentSession: s.currentSession,
    nextWorkoutType: s.nextWorkoutType,
  };
}

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...defaultAppState('kg'),
      rest: { endsAt: null, durationSec: 0 },

      startWorkout: () => {
        const { nextWorkoutType, exerciseStates, settings, currentSession } = get();
        if (currentSession) return; // already in progress
        const session = buildSessionFromTemplate(
          nextWorkoutType,
          exerciseStates,
          settings,
          newId(),
          new Date().toISOString(),
        );
        set({ currentSession: session });
      },

      discardWorkout: () => set({ currentSession: null, rest: { endsAt: null, durationSec: 0 } }),

      finishWorkout: () => {
        const { currentSession, exerciseStates, settings, history, nextWorkoutType } = get();
        if (!currentSession) return;

        const nextStates: Record<ExerciseId, ExerciseState> = { ...exerciseStates };
        for (const logged of currentSession.exercises) {
          const result = resultFromLogged(logged);
          nextStates[logged.exerciseId] = computeNextState(
            exerciseStates[logged.exerciseId],
            result,
            settings.config,
            settings.rounding,
          );
        }

        const completed = { ...currentSession, completed: true };
        set({
          history: [...history, completed],
          exerciseStates: nextStates,
          nextWorkoutType: flipWorkoutType(nextWorkoutType),
          currentSession: null,
          rest: { endsAt: null, durationSec: 0 },
        });
      },

      toggleSet: (exerciseIndex, setIndex, isWarmup) => {
        const { currentSession } = get();
        if (!currentSession) return;
        const exercises = currentSession.exercises.map((ex, ei) => {
          if (ei !== exerciseIndex) return ex;
          const key = isWarmup ? 'warmupSets' : 'workSets';
          const sets = ex[key].map((s, si) =>
            si === setIndex ? { ...s, done: !s.done } : s,
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
            si === setIndex ? { ...s, reps: clamped, done: true } : s,
          );
          return { ...ex, [key]: sets };
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

          const exerciseStates = { ...s.exerciseStates };
          for (const id of ALL_EXERCISE_IDS) {
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

          return {
            settings: {
              ...s.settings,
              unit,
              rounding,
              // Adopt the unit's natural increments when switching units.
              config: { ...s.settings.config, increments: defaults.config.increments },
            },
            exerciseStates,
          };
        }),

      importData: (state) =>
        set({
          schemaVersion: SCHEMA_VERSION,
          settings: state.settings,
          exerciseStates: state.exerciseStates,
          history: state.history,
          currentSession: state.currentSession,
          nextWorkoutType: state.nextWorkoutType,
          rest: { endsAt: null, durationSec: 0 },
        }),

      resetAll: () =>
        set({ ...defaultAppState(get().settings.unit), rest: { endsAt: null, durationSec: 0 } }),

      exportData: () => pickAppState(get()),
    }),
    {
      name: PERSIST_KEY,
      version: SCHEMA_VERSION,
      partialize: (s) => pickAppState(s as Store),
      migrate: (persisted, version) => {
        // No migrations yet; future schema bumps handle older `version`s here.
        if (version < SCHEMA_VERSION) {
          return persisted as AppState;
        }
        return persisted as AppState;
      },
    },
  ),
);

/** Convenience selectors for the workout template of an in-progress/next session. */
export function workoutTemplateFor(type: AppState['nextWorkoutType']) {
  return WORKOUT_TEMPLATES[type];
}
