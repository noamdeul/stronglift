import { ShareButton } from '../components/ShareButton';
import { getExercise } from '../domain/exercises';
import { isExerciseSucceeded } from '../domain/progression';
import { sessionTitle } from '../domain/session';
import { personalBests, sessionBestE1RM } from '../domain/strength';
import type { WorkoutSession } from '../domain/types';
import { computePlatesPerSide, formatPlateLoad, formatWeight } from '../domain/units';
import { useAppStore } from '../store/useAppStore';

interface Props {
  session: WorkoutSession;
  onBack: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SessionDetail({ session, onBack }: Props) {
  const history = useAppStore((s) => s.history);
  const settings = useAppStore((s) => s.settings);
  const customExercises = useAppStore((s) => s.customExercises);
  // History before this session, so a lift that ties/beats every earlier best
  // can be flagged as a PR.
  const index = history.findIndex((s) => s.id === session.id);
  const priorHistory = index >= 0 ? history.slice(0, index) : history;
  const priorBests = personalBests(priorHistory);

  // Use the configured bar/plates only when they match the session's unit;
  // otherwise fall back to the unit defaults baked into computePlatesPerSide.
  const sameUnit = session.unit === settings.unit;
  const bar = sameUnit ? settings.barWeight : undefined;
  const plates = sameUnit ? settings.plates : undefined;

  return (
    <>
      <div className="screen-header">
        <button className="muted" onClick={onBack} style={{ marginBottom: 8 }}>
          ‹ Back to history
        </button>
        <h1>{sessionTitle(session)}</h1>
        <div className="sub">{formatDateTime(session.date)}</div>
      </div>
      <div className="screen">
        {session.exercises.map((ex) => {
          const ok = isExerciseSucceeded(ex);
          const e1RM = sessionBestE1RM(session, ex.exerciseId);
          const prevBest = priorBests[ex.exerciseId]?.e1RM ?? 0;
          const isPR = e1RM > 0 && e1RM > prevBest;
          return (
            <div key={ex.exerciseId} className="card">
              <div className="card-head">
                <h3>{getExercise(ex.exerciseId, customExercises).name}</h3>
                <div className="badge-row">
                  {isPR && <span className="badge pr">🏆 PR</span>}
                  <span className={`badge ${ok ? 'ok' : 'bad'}`}>{ok ? '✓' : 'Missed'}</span>
                </div>
              </div>
              <div className="weight-big">{formatWeight(ex.weight, session.unit)}</div>
              <div className="plate-load">
                {formatPlateLoad(
                  computePlatesPerSide(ex.weight, session.unit, bar, plates),
                  session.unit,
                )}
              </div>
              {e1RM > 0 && (
                <div className="muted" style={{ marginTop: 4 }}>
                  Est. 1RM {formatWeight(e1RM, session.unit)}
                </div>
              )}
              <div className="set-grid" style={{ marginTop: 12 }}>
                {ex.workSets.map((s, i) => {
                  const fail = s.reps < s.targetReps;
                  return (
                    <div key={i} className={`set-cell ${fail ? 'fail' : 'done'}`}>
                      {s.reps}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <ShareButton session={session} label="📤 Share this workout" />
      </div>
    </>
  );
}
