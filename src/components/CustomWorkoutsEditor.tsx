import { useState } from 'react';
import { ALL_EXERCISE_IDS, getExercise } from '../domain/exercises';
import { validateCustomWorkout } from '../domain/customWorkouts';
import type { CustomWorkout, ExerciseId } from '../domain/types';
import { useAppStore } from '../store/useAppStore';
import { ConfirmDialog } from './ConfirmDialog';

export function CustomWorkoutsEditor() {
  const customExercises = useAppStore((s) => s.customExercises);
  const customWorkouts = useAppStore((s) => s.customWorkouts);
  const addCustomWorkout = useAppStore((s) => s.addCustomWorkout);
  const editCustomWorkout = useAppStore((s) => s.editCustomWorkout);
  const deleteCustomWorkout = useAppStore((s) => s.deleteCustomWorkout);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  // Selected exercise ids, in the order the user picked them (= workout order).
  const [selected, setSelected] = useState<ExerciseId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomWorkout | null>(null);

  // All choices: the five built-ins plus every custom exercise.
  const available: ExerciseId[] = [...ALL_EXERCISE_IDS, ...customExercises.map((e) => e.id)];

  const reset = () => {
    setEditingId(null);
    setName('');
    setSelected([]);
    setError(null);
  };

  const toggle = (id: ExerciseId) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((e) => e !== id) : [...cur, id]));
  };

  const startEdit = (workout: CustomWorkout) => {
    setEditingId(workout.id);
    setName(workout.name);
    setSelected([...workout.exercises]);
    setError(null);
  };

  const save = () => {
    const input = { name, exercises: selected };
    const check = validateCustomWorkout(input);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    if (editingId) {
      editCustomWorkout(editingId, { name: name.trim(), exercises: selected });
    } else {
      addCustomWorkout(input);
    }
    reset();
  };

  const confirmDelete = (workout: CustomWorkout) => {
    deleteCustomWorkout(workout.id);
    setPendingDelete(null);
  };

  const order = (id: ExerciseId) => selected.indexOf(id) + 1;

  return (
    <>
      {customWorkouts.length > 0 && (
        <div className="card">
          {customWorkouts.map((workout) => (
            <div className="field" key={workout.id}>
              <label>
                {workout.name}
                <span className="muted" style={{ display: 'block', fontWeight: 400 }}>
                  {workout.exercises
                    .map((id) => getExercise(id, customExercises).name)
                    .join(' · ')}
                </span>
              </label>
              <div className="btn-row" style={{ width: 'auto' }}>
                <button
                  className="btn"
                  style={{ width: 'auto' }}
                  onClick={() => startEdit(workout)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  style={{ width: 'auto' }}
                  onClick={() => setPendingDelete(workout)}
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
          {editingId ? 'Edit workout' : 'Build a custom workout'}
        </div>
        <div className="field">
          <label>Name</label>
          <input
            type="text"
            value={name}
            placeholder="e.g. Upper body"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="section-label" style={{ marginTop: 4 }}>
          Exercises (tap to add, in order)
        </div>
        <div className="plate-chips exercise-picker">
          {available.map((id) => {
            const picked = selected.includes(id);
            return (
              <button
                key={id}
                className={`plate-chip ${picked ? 'active' : ''}`}
                aria-pressed={picked}
                onClick={() => toggle(id)}
              >
                {picked ? `${order(id)}. ` : ''}
                {getExercise(id, customExercises).name}
              </button>
            );
          })}
        </div>
        {error && (
          <p className="muted" style={{ color: 'var(--danger)', margin: '10px 0 0' }}>
            {error}
          </p>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={save}>
            {editingId ? 'Save changes' : 'Add workout'}
          </button>
          {editingId && (
            <button className="btn" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          message="This removes the workout. Past history and your exercises are kept."
          confirmLabel="Delete"
          danger
          onConfirm={() => confirmDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
