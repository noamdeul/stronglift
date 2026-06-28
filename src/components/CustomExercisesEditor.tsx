import { useState } from 'react';
import { validateCustomExercise } from '../domain/customExercises';
import type { CustomExerciseInput } from '../domain/customExercises';
import { referencingWorkouts } from '../domain/customWorkouts';
import type { ExerciseDef } from '../domain/types';
import { useAppStore } from '../store/useAppStore';
import { ConfirmDialog } from './ConfirmDialog';

interface FormState {
  name: string;
  sets: string;
  reps: string;
  startingWeight: string;
  increment: string;
}

const EMPTY: FormState = { name: '', sets: '5', reps: '5', startingWeight: '', increment: '' };

function toInput(form: FormState): CustomExerciseInput {
  return {
    name: form.name,
    sets: parseInt(form.sets, 10),
    reps: parseInt(form.reps, 10),
    startingWeight: parseFloat(form.startingWeight),
    increment: parseFloat(form.increment),
  };
}

export function CustomExercisesEditor() {
  const unit = useAppStore((s) => s.settings.unit);
  const rounding = useAppStore((s) => s.settings.rounding);
  const customExercises = useAppStore((s) => s.customExercises);
  const customWorkouts = useAppStore((s) => s.customWorkouts);
  const addCustomExercise = useAppStore((s) => s.addCustomExercise);
  const editCustomExercise = useAppStore((s) => s.editCustomExercise);
  const deleteCustomExercise = useAppStore((s) => s.deleteCustomExercise);

  // `editingId === null` means the form adds a new exercise; otherwise it edits.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExerciseDef | null>(null);

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const startEdit = (def: ExerciseDef) => {
    setEditingId(def.id);
    setForm({
      name: def.name,
      sets: String(def.sets),
      reps: String(def.reps),
      startingWeight: '',
      increment: def.increment !== undefined ? String(def.increment) : '',
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  };

  const save = () => {
    const input = toInput(form);
    if (editingId) {
      // Editing keeps the current working weight; starting weight isn't required.
      const check = validateCustomExercise({ ...input, startingWeight: 0 });
      if (!check.ok) {
        setError(check.error);
        return;
      }
      editCustomExercise(editingId, {
        name: input.name.trim(),
        sets: Math.round(input.sets),
        reps: Math.round(input.reps),
        increment: input.increment,
      });
      cancelEdit();
      return;
    }
    const check = validateCustomExercise(input);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    addCustomExercise(input);
    cancelEdit();
  };

  const confirmDelete = (def: ExerciseDef) => {
    deleteCustomExercise(def.id);
    setPendingDelete(null);
  };

  return (
    <>
      {customExercises.length > 0 && (
        <div className="card">
          {customExercises.map((def) => (
            <div className="field" key={def.id}>
              <label>
                {def.name}
                <span className="muted" style={{ marginLeft: 8 }}>
                  {def.sets} × {def.reps}
                </span>
              </label>
              <div className="btn-row" style={{ width: 'auto' }}>
                <button className="btn" style={{ width: 'auto' }} onClick={() => startEdit(def)}>
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  style={{ width: 'auto' }}
                  onClick={() => setPendingDelete(def)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
          {editingId ? 'Edit exercise' : 'Add a custom exercise'}
        </div>
        <div className="field">
          <label>Name</label>
          <input
            type="text"
            value={form.name}
            placeholder="e.g. Pull-up"
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Work sets</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={form.sets}
            onChange={(e) => set('sets', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Target reps</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={form.reps}
            onChange={(e) => set('reps', e.target.value)}
          />
        </div>
        {!editingId && (
          <div className="field">
            <label>Starting weight ({unit})</label>
            <input
              type="number"
              inputMode="decimal"
              step={rounding}
              value={form.startingWeight}
              onChange={(e) => set('startingWeight', e.target.value)}
            />
          </div>
        )}
        <div className="field">
          <label>Increment ({unit})</label>
          <input
            type="number"
            inputMode="decimal"
            step={rounding}
            value={form.increment}
            onChange={(e) => set('increment', e.target.value)}
          />
        </div>
        {error && (
          <p className="muted" style={{ color: 'var(--danger)', marginBottom: 10 }}>
            {error}
          </p>
        )}
        <div className="btn-row">
          <button className="btn btn-primary" onClick={save}>
            {editingId ? 'Save changes' : 'Add exercise'}
          </button>
          {editingId && (
            <button className="btn" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          message={(() => {
            const refs = referencingWorkouts(pendingDelete.id, customWorkouts);
            const base =
              'This removes the exercise and its progression. Past history is kept.';
            return refs.length > 0
              ? `${base} It will also be removed from: ${refs.map((w) => w.name).join(', ')}.`
              : base;
          })()}
          confirmLabel="Delete"
          danger
          onConfirm={() => confirmDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
