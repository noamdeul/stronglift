import { LineChart } from '../components/LineChart';
import { ALL_EXERCISE_IDS, EXERCISES } from '../domain/exercises';
import { buildWeightSeries } from '../domain/progress';
import { personalBests } from '../domain/strength';
import { formatWeight } from '../domain/units';
import { useAppStore } from '../store/useAppStore';

export function ProgressScreen() {
  const history = useAppStore((s) => s.history);
  const unit = useAppStore((s) => s.settings.unit);
  const bests = personalBests(history);

  return (
    <>
      <div className="screen-header">
        <h1>Progress</h1>
        <div className="sub">Working weight over time</div>
      </div>
      <div className="screen">
        {history.length === 0 && (
          <div className="empty">
            <div className="big">📈</div>
            <div>No data yet.</div>
            <div className="muted">Finish a few workouts to see your progress.</div>
          </div>
        )}
        {history.length > 0 &&
          ALL_EXERCISE_IDS.map((id) => {
            const series = buildWeightSeries(history, id);
            if (series.length === 0) return null;
            const best = bests[id];
            return (
              <div key={id} className="card">
                <div className="card-head">
                  <h3>{EXERCISES[id].name}</h3>
                  {best && (
                    <span className="target">Best 1RM {formatWeight(best.e1RM, unit)}</span>
                  )}
                </div>
                <LineChart values={series.map((p) => p.weight)} unit={unit} />
              </div>
            );
          })}
      </div>
    </>
  );
}
