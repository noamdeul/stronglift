import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataIO } from '../components/DataIO';
import { ALL_EXERCISE_IDS, EXERCISES } from '../domain/exercises';
import type { ExerciseId, Unit } from '../domain/types';
import { useAppStore } from '../store/useAppStore';

export function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const exerciseStates = useAppStore((s) => s.exerciseStates);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const editExerciseState = useAppStore((s) => s.editExerciseState);
  const changeUnit = useAppStore((s) => s.changeUnit);
  const resetAll = useAppStore((s) => s.resetAll);

  const [pendingUnit, setPendingUnit] = useState<Unit | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const setWeight = (id: ExerciseId, value: number) => {
    if (Number.isFinite(value) && value >= 0) {
      editExerciseState(id, { currentWeight: value });
    }
  };

  const setIncrement = (id: ExerciseId, value: number) => {
    if (Number.isFinite(value) && value >= 0) {
      updateSettings({
        config: {
          ...settings.config,
          increments: { ...settings.config.increments, [id]: value },
        },
      });
    }
  };

  const setRest = (key: 'normal' | 'heavy' | 'deadlift', value: number) => {
    if (Number.isFinite(value) && value >= 0) {
      updateSettings({ restSeconds: { ...settings.restSeconds, [key]: value } });
    }
  };

  const [newPlate, setNewPlate] = useState('');

  const setBarWeight = (value: number) => {
    if (Number.isFinite(value) && value > 0) {
      updateSettings({ barWeight: value });
    }
  };

  const addPlate = () => {
    const value = parseFloat(newPlate);
    setNewPlate('');
    if (!Number.isFinite(value) || value <= 0 || settings.plates.includes(value)) return;
    updateSettings({ plates: [...settings.plates, value].sort((a, b) => b - a) });
  };

  const removePlate = (value: number) => {
    updateSettings({ plates: settings.plates.filter((p) => p !== value) });
  };

  return (
    <>
      <div className="screen-header">
        <h1>Settings</h1>
      </div>
      <div className="screen">
        <div className="card">
          <div className="field">
            <label>Units</label>
            <div className="toggle">
              {(['kg', 'lb'] as Unit[]).map((u) => (
                <button
                  key={u}
                  className={settings.unit === u ? 'active' : ''}
                  onClick={() => u !== settings.unit && setPendingUnit(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="section-label">Current working weights ({settings.unit})</div>
        <div className="card">
          {ALL_EXERCISE_IDS.map((id) => (
            <div className="field" key={id}>
              <label>{EXERCISES[id].name}</label>
              <input
                type="number"
                inputMode="decimal"
                step={settings.rounding}
                value={exerciseStates[id].currentWeight}
                onChange={(e) => setWeight(id, parseFloat(e.target.value))}
              />
            </div>
          ))}
        </div>

        <div className="section-label">Weight increments ({settings.unit})</div>
        <div className="card">
          {ALL_EXERCISE_IDS.map((id) => (
            <div className="field" key={id}>
              <label>{EXERCISES[id].name}</label>
              <input
                type="number"
                inputMode="decimal"
                step={settings.rounding}
                value={settings.config.increments[id]}
                onChange={(e) => setIncrement(id, parseFloat(e.target.value))}
              />
            </div>
          ))}
        </div>

        <div className="section-label">Bar &amp; plates ({settings.unit})</div>
        <div className="card">
          <div className="field">
            <label>Bar weight</label>
            <input
              type="number"
              inputMode="decimal"
              step={settings.rounding}
              value={settings.barWeight}
              onChange={(e) => setBarWeight(parseFloat(e.target.value))}
            />
          </div>
          <div className="field" style={{ alignItems: 'flex-start' }}>
            <label>Available plates</label>
            <div className="plate-chips">
              {settings.plates.length === 0 && <span className="muted">No plates</span>}
              {[...settings.plates]
                .sort((a, b) => b - a)
                .map((p) => (
                  <button
                    key={p}
                    className="plate-chip"
                    onClick={() => removePlate(p)}
                    aria-label={`Remove ${p} ${settings.unit} plate`}
                  >
                    {p} ✕
                  </button>
                ))}
            </div>
          </div>
          <div className="plate-add">
            <input
              type="number"
              inputMode="decimal"
              step={settings.rounding}
              placeholder="Plate size"
              value={newPlate}
              onChange={(e) => setNewPlate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addPlate();
              }}
            />
            <button className="btn" onClick={addPlate}>
              Add plate
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Tap a plate to remove it. Sizes are per single plate; the calculator loads them on
            each side of the bar.
          </p>
        </div>

        <div className="section-label">Rest timer (seconds)</div>
        <div className="card">
          <div className="field">
            <label>Between work sets</label>
            <input
              type="number"
              inputMode="numeric"
              step={30}
              value={settings.restSeconds.heavy}
              onChange={(e) => setRest('heavy', parseInt(e.target.value, 10))}
            />
          </div>
          <div className="field">
            <label>Deadlift sets</label>
            <input
              type="number"
              inputMode="numeric"
              step={30}
              value={settings.restSeconds.deadlift}
              onChange={(e) => setRest('deadlift', parseInt(e.target.value, 10))}
            />
          </div>
          <div className="field">
            <label>Sound when done</label>
            <div className="toggle">
              {([['On', true], ['Off', false]] as [string, boolean][]).map(([label, value]) => (
                <button
                  key={label}
                  className={settings.sound === value ? 'active' : ''}
                  onClick={() => settings.sound !== value && updateSettings({ sound: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="section-label">Deload</div>
        <div className="card">
          <div className="field">
            <label>Failures before deload</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={settings.config.deloadFailThreshold}
              onChange={(e) =>
                updateSettings({
                  config: {
                    ...settings.config,
                    deloadFailThreshold: Math.max(1, parseInt(e.target.value, 10) || 1),
                  },
                })
              }
            />
          </div>
          <div className="field">
            <label>Deload amount (%)</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              step={1}
              value={Math.round(settings.config.deloadFactor * 100)}
              onChange={(e) =>
                updateSettings({
                  config: {
                    ...settings.config,
                    deloadFactor: Math.min(0.5, Math.max(0, (parseInt(e.target.value, 10) || 0) / 100)),
                  },
                })
              }
            />
          </div>
        </div>

        <div className="section-label">Backup</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            All data is stored only on this device. Export a backup regularly, or to move
            to another device.
          </p>
          <DataIO />
        </div>

        <div className="danger-zone">
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            Reset all data
          </button>
        </div>
      </div>

      {pendingUnit && (
        <ConfirmDialog
          title={`Switch to ${pendingUnit}?`}
          message={`All weights will be converted to ${pendingUnit} and rounded to the nearest loadable plate. This may shift weights slightly.`}
          confirmLabel="Switch"
          onConfirm={() => {
            changeUnit(pendingUnit);
            setPendingUnit(null);
          }}
          onCancel={() => setPendingUnit(null)}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Reset all data?"
          message="This deletes your history, progression, and settings. This cannot be undone. Consider exporting a backup first."
          confirmLabel="Reset everything"
          danger
          onConfirm={() => {
            resetAll();
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </>
  );
}
