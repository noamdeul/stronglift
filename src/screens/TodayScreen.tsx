import { useState } from 'react';
import { ExerciseCard } from '../components/ExerciseCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ShareButton } from '../components/ShareButton';
import { GarminExportButton } from '../components/GarminExportButton';
import { EXERCISES } from '../domain/exercises';
import { isExerciseSucceeded } from '../domain/progression';
import { upcomingWorkouts } from '../domain/schedule';
import { formatWeight } from '../domain/units';
import type { WorkoutType } from '../domain/types';
import { useAppStore } from '../store/useAppStore';

const WORKOUT_SUMMARY: Record<WorkoutType, string> = {
  A: 'Squat · Bench Press · Barbell Row',
  B: 'Squat · Overhead Press · Deadlift',
};

function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TodayScreen() {
  const session = useAppStore((s) => s.currentSession);
  const lastFinished = useAppStore((s) => s.lastFinished);
  const nextType = useAppStore((s) => s.nextWorkoutType);
  const settings = useAppStore((s) => s.settings);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const finishWorkout = useAppStore((s) => s.finishWorkout);
  const discardWorkout = useAppStore((s) => s.discardWorkout);
  const dismissFinished = useAppStore((s) => s.dismissFinished);

  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // After finishing, celebrate and offer to share an image of the session.
  if (!session && lastFinished) {
    const okCount = lastFinished.exercises.filter(isExerciseSucceeded).length;
    const total = lastFinished.exercises.length;
    const allOk = okCount === total;
    return (
      <>
        <div className="screen-header">
          <h1>Workout Complete 🎉</h1>
          <div className="sub">{formatDateTime(lastFinished.date)}</div>
        </div>
        <div className="screen">
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="muted">Workout {lastFinished.type}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '6px 0' }}>
              {okCount}/{total} exercises hit
            </div>
            <div className={`badge ${allOk ? 'ok' : 'bad'}`} style={{ marginBottom: 4 }}>
              {allOk ? '✓ All sets' : `${okCount}/${total}`}
            </div>
          </div>

          <div className="card">
            {lastFinished.exercises.map((ex) => {
              const ok = isExerciseSucceeded(ex);
              return (
                <div key={ex.exerciseId} className="summary-row">
                  <span>{EXERCISES[ex.exerciseId].name}</span>
                  <span className="muted">
                    {formatWeight(ex.weight, lastFinished.unit)} ·{' '}
                    {ex.workSets.map((s) => s.reps).join('/')}
                    {ok ? ' ✓' : ' ✕'}
                  </span>
                </div>
              );
            })}
          </div>

          <ShareButton
            session={lastFinished}
            className="btn btn-primary"
            label="📤 Share workout image"
          />
          <div className="spacer" />
          <GarminExportButton session={lastFinished} />
          <div className="spacer" />
          <button className="btn" onClick={dismissFinished}>
            Done
          </button>
        </div>
      </>
    );
  }

  if (!session) {
    const upcoming =
      settings.workoutDays.length > 0
        ? upcomingWorkouts(settings.workoutDays, nextType, new Date(), 4)
        : [];
    return (
      <>
        <div className="screen-header">
          <h1>Today</h1>
          <div className="sub">Ready when you are</div>
        </div>
        <div className="screen">
          <div className="card">
            <div className="muted" style={{ marginBottom: 10 }}>
              Choose a workout
            </div>
            {(['A', 'B'] as WorkoutType[]).map((type) => {
              const isNext = type === nextType;
              return (
                <button
                  key={type}
                  className={`btn workout-choice ${isNext ? 'btn-primary' : ''}`}
                  onClick={() => startWorkout(type)}
                >
                  <span className="workout-choice-main">
                    <span className="workout-choice-title">
                      Workout {type}
                      {isNext && <span className="badge ok">Next</span>}
                    </span>
                    <span className="workout-choice-sub">{WORKOUT_SUMMARY[type]}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {upcoming.length > 0 && (
            <>
              <div className="section-label">Upcoming</div>
              <div className="card">
                {upcoming.map((w, i) => (
                  <div key={i} className="summary-row">
                    <span>{formatDay(w.date)}</span>
                    <span className="muted">Workout {w.type}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  const anyLogged = session.exercises.some((ex) =>
    ex.workSets.some((s) => s.done),
  );
  const summary = session.exercises.map((ex) => ({
    id: ex.exerciseId,
    ok: isExerciseSucceeded(ex),
  }));
  const okCount = summary.filter((s) => s.ok).length;

  return (
    <>
      <div className="screen-header">
        <h1>
          Workout {session.type} <span className="pill">In progress</span>
        </h1>
        <div className="sub">{formatDate(session.date)}</div>
      </div>
      <div className="screen">
        {session.exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.exerciseId}
            exercise={ex}
            exerciseIndex={i}
            settings={settings}
          />
        ))}

        <div className="muted" style={{ margin: '4px 0 14px' }}>
          {okCount}/{summary.length} exercises completed
        </div>

        <button className="btn btn-success" onClick={() => setConfirmFinish(true)}>
          Finish Workout
        </button>
        <div className="spacer" />
        <button className="btn btn-danger" onClick={() => setConfirmDiscard(true)}>
          Discard
        </button>
      </div>

      {confirmFinish && (
        <ConfirmDialog
          title="Finish workout?"
          message={
            anyLogged
              ? `${okCount} of ${summary.length} exercises hit all reps. Weights for next time will update accordingly.`
              : 'No sets are logged yet. Finishing now counts every exercise as a failure.'
          }
          confirmLabel="Finish"
          onConfirm={() => {
            finishWorkout();
            setConfirmFinish(false);
          }}
          onCancel={() => setConfirmFinish(false)}
        />
      )}
      {confirmDiscard && (
        <ConfirmDialog
          title="Discard workout?"
          message="This in-progress workout will be deleted. Your progression weights won't change."
          confirmLabel="Discard"
          danger
          onConfirm={() => {
            discardWorkout();
            setConfirmDiscard(false);
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </>
  );
}
