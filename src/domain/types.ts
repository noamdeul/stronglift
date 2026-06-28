export type Unit = 'kg' | 'lb';

export type ExerciseId = 'squat' | 'bench' | 'row' | 'ohp' | 'deadlift';

export type WorkoutType = 'A' | 'B';

export interface ExerciseDef {
  id: ExerciseId;
  name: string;
  /** Number of work sets (5 for most lifts, 1 for the deadlift). */
  sets: number;
  /** Target reps per work set. */
  reps: number;
}

export interface WorkoutTemplate {
  type: WorkoutType;
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
  type: WorkoutType;
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
}

/** Per-exercise success/fail result derived from a completed session. */
export interface ExerciseResult {
  exerciseId: ExerciseId;
  succeeded: boolean;
}
