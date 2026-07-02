export type Unit = 'kg' | 'lb';

/**
 * An exercise identifier. The five built-in lifts use stable string ids
 * (`'squat'`, `'bench'`, …); user-created exercises get generated ids. Kept as a
 * plain `string` so custom exercises are first-class without changing the type.
 */
export type ExerciseId = string;

export type WorkoutType = 'A' | 'B';

export interface ExerciseDef {
  id: ExerciseId;
  name: string;
  /** Number of work sets (5 for most lifts, 1 for the deadlift). */
  sets: number;
  /** Target reps per work set. */
  reps: number;
  /** True for user-created exercises (built-in lifts omit this). */
  custom?: boolean;
  /** Progression increment in the active unit. Only set on custom exercises;
   *  built-in increments live in `Settings.config.increments`. */
  increment?: number;
}

export interface WorkoutTemplate {
  type: WorkoutType;
  exercises: ExerciseId[];
}

/** A user-built workout: a named, ordered list of exercises (built-in and/or
 *  custom). Chosen on demand from the Today screen; not part of the A/B
 *  rotation. */
export interface CustomWorkout {
  id: string;
  name: string;
  exercises: ExerciseId[];
}

export interface LoggedSet {
  /** Reps actually completed. */
  reps: number;
  targetReps: number;
  done: boolean;
  isWarmup: boolean;
  /** Weight for this set. Set on warmup sets, which ramp; work sets use the
   * parent LoggedExercise weight, so this is omitted there. */
  weight?: number;
  /** ISO wall-clock time this set was marked done. Stamped when the set flips
   * to done and cleared when it flips back; absent on sessions logged before
   * set-timing was added. Used to give the Garmin (.FIT) export real timing. */
  completedAt?: string;
}

export interface LoggedExercise {
  exerciseId: ExerciseId;
  /** Working-set weight, expressed in the session's unit. */
  weight: number;
  warmupSets: LoggedSet[];
  workSets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  /** ISO timestamp. */
  date: string;
  /** The A/B rotation type for built-in workouts. Absent on custom-workout
   *  sessions, which carry `name`/`templateId` instead. */
  type?: WorkoutType;
  /** Distinguishes a built-in A/B session from a custom-workout one. Absent on
   *  sessions logged before custom workouts existed (treated as built-in). */
  kind?: 'builtin' | 'custom';
  /** Display name for the session, e.g. a custom workout's name. When absent,
   *  the UI derives "Workout {type}". */
  name?: string;
  /** Id of the custom workout this session was built from, if any. */
  templateId?: string;
  /** Unit captured at the time the session was logged. */
  unit: Unit;
  exercises: LoggedExercise[];
  completed: boolean;
}

/** The progression "memory" the engine reads and writes for each exercise. */
export interface ExerciseState {
  exerciseId: ExerciseId;
  /** Next working weight to attempt, in the active unit. */
  currentWeight: number;
  consecutiveFailures: number;
}

export interface ProgressionConfig {
  increments: Record<ExerciseId, number>;
  /** Fraction to drop on deload, e.g. 0.1 for 10%. */
  deloadFactor: number;
  /** Consecutive failures before a deload triggers. */
  deloadFailThreshold: number;
}

export interface RestSeconds {
  normal: number;
  heavy: number;
  deadlift: number;
}

export interface Settings {
  unit: Unit;
  restSeconds: RestSeconds;
  /** Smallest loadable increment (plate pair), e.g. 2.5 kg / 5 lb. */
  rounding: number;
  /** Play a sound when the rest timer finishes (in addition to vibration). */
  sound: boolean;
  /** Keep the screen awake (Screen Wake Lock) while a workout is in progress. */
  keepScreenAwake: boolean;
  /** Weight of the empty barbell, in the active unit. */
  barWeight: number;
  /** Available plate sizes (per single plate), largest first, in the active unit. */
  plates: number[];
  /** Weekdays the user plans to train (0=Sun … 6=Sat). Empty = no schedule. */
  workoutDays: number[];
  config: ProgressionConfig;
}

export interface AppState {
  schemaVersion: number;
  settings: Settings;
  exerciseStates: Record<ExerciseId, ExerciseState>;
  /** Completed sessions, newest last. */
  history: WorkoutSession[];
  /** In-progress session; persisted so it survives a reload. */
  currentSession: WorkoutSession | null;
  nextWorkoutType: WorkoutType;
  /** User-created exercise definitions. */
  customExercises: ExerciseDef[];
  /** User-created workout templates. */
  customWorkouts: CustomWorkout[];
}

/** Per-exercise success/fail result derived from a completed session. */
export interface ExerciseResult {
  exerciseId: ExerciseId;
  succeeded: boolean;
}
