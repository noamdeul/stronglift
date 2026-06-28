interface Props {
  /** Y-values in chronological order. */
  values: number[];
  /** Optional unit label shown on the min/max axis ticks. */
  unit?: string;
}

const W = 300;
const H = 100;
const PAD = 8;

/**
 * Minimal dependency-free inline-SVG line chart for a single series. Auto-scales
 * to the value range, draws a smooth polyline with point markers, and renders a
 * faint baseline. Falls back gracefully for empty or single-point series.
 */
export function LineChart({ values, unit }: Props) {
  if (values.length === 0) {
    return <div className="chart-empty muted">No data yet</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) =>
    values.length === 1 ? W / 2 : PAD + (i / (values.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);

  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="chart-axis" />
        {values.length > 1 && <polyline points={points} className="chart-line" />}
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={3} className="chart-dot" />
        ))}
      </svg>
      <div className="chart-range muted">
        <span>
          {min}
          {unit ? ` ${unit}` : ''}
        </span>
        <span>
          {max}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
    </div>
  );
}
