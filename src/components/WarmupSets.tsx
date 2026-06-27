import { useState } from 'react';
import type { LoggedSet, Unit } from '../domain/types';
import { formatWeight } from '../domain/units';

interface Props {
  sets: LoggedSet[];
  unit: Unit;
  rounding: number;
  onToggle: (index: number) => void;
  onWeightChange: (index: number, weight: number) => void;
  onRepsChange: (index: number, reps: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export function WarmupSets({
  sets,
  unit,
  rounding,
  onToggle,
  onWeightChange,
  onRepsChange,
  onAdd,
  onRemove,
}: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="warmups">
      <div className="warmup-head">
        <span className="section-label" style={{ margin: 0 }}>
          Warmup
        </span>
        <button className="link-btn" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {sets.length === 0 && !editing && <div className="muted">No warmup sets</div>}

      {!editing && sets.length > 0 && (
        <div className="set-grid warmup-grid">
          {sets.map((s, i) => (
            <button
              key={i}
              className={`set-cell warmup ${s.done ? 'done' : ''}`}
              onClick={() => onToggle(i)}
              aria-label={`Warmup ${i + 1}: ${formatWeight(s.weight ?? 0, unit)} × ${s.reps}${
                s.done ? ', done' : ''
              }`}
            >
              {s.reps}
              <span className="hint">{formatWeight(s.weight ?? 0, unit)}</span>
            </button>
          ))}
        </div>
      )}

      {editing &&
        sets.map((s, i) => (
          <div key={i} className="warmup-edit">
            <button
              className="rm-btn"
              onClick={() => onRemove(i)}
              aria-label="Remove warmup set"
            >
              ✕
            </button>
            <div className="stepper">
              <button onClick={() => onWeightChange(i, (s.weight ?? 0) - rounding)}>−</button>
              <input
                type="number"
                inputMode="decimal"
                step={rounding}
                value={s.weight ?? 0}
                onChange={(e) => onWeightChange(i, parseFloat(e.target.value))}
              />
              <span className="unit">{unit}</span>
              <button onClick={() => onWeightChange(i, (s.weight ?? 0) + rounding)}>+</button>
            </div>
            <div className="stepper">
              <button onClick={() => onRepsChange(i, s.reps - 1)}>−</button>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                value={s.reps}
                onChange={(e) => onRepsChange(i, parseInt(e.target.value, 10))}
              />
              <span className="unit">reps</span>
              <button onClick={() => onRepsChange(i, s.reps + 1)}>+</button>
            </div>
          </div>
        ))}

      {editing && (
        <button className="btn add-warmup" onClick={onAdd}>
          + Add warmup set
        </button>
      )}
    </div>
  );
}
