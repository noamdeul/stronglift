import { useState } from 'react';
import { getExercise } from '../domain/exercises';
import type { LoggedExercise, Settings } from '../domain/types';
import { computePlatesPerSide, formatPlateLoad, formatWeight } from '../domain/units';
import { useAppStore } from '../store/useAppStore';
import { SetTracker } from './SetTracker';
import { WarmupSets } from './WarmupSets';

interface Props {
  exercise: LoggedExercise;
  exerciseIndex: number;
  settings: Settings;
}

export function ExerciseCard({ exercise, exerciseIndex, settings }: Props) {
  const toggleSet = useAppStore((s) => s.toggleSet);
  const setReps = useAppStore((s) => s.setReps);
  const startRest = useAppStore((s) => s.startRest);
  const setWarmupWeight = useAppStore((s) => s.setWarmupWeight);
  const setWarmupReps = useAppStore((s) => s.setWarmupReps);
  const addWarmupSet = useAppStore((s) => s.addWarmupSet);
  const removeWarmupSet = useAppStore((s) => s.removeWarmupSet);
  const setExerciseWeight = useAppStore((s) => s.setExerciseWeight);
  const customExercises = useAppStore((s) => s.customExercises);

  const [editingWeight, setEditingWeight] = useState(false);

  const def = getExercise(exercise.exerciseId, customExercises);

  const restSecondsFor = () =>
    exercise.exerciseId === 'deadlift'
      ? settings.restSeconds.deadlift
      : settings.restSeconds.heavy;

  const cycleWorkSet = (i: number) => {
    const set = exercise.workSets[i];
    if (!set.done) {
      // not done -> done at target reps, and start the rest timer.
      setReps(exerciseIndex, i, false, set.targetReps);
      startRest(restSecondsFor());
    } else if (set.reps > 0) {
      setReps(exerciseIndex, i, false, set.reps - 1);
    } else {
      // reps already at 0 -> clear back to "not done".
      toggleSet(exerciseIndex, i, false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3>{def.name}</h3>
        <span className="target">
          {def.sets} × {def.reps}
        </span>
      </div>
      <div className="weight-row">
        {editingWeight ? (
          <div className="stepper">
            <button
              onClick={() =>
                setExerciseWeight(exerciseIndex, exercise.weight - settings.rounding)
              }
            >
              −
            </button>
            <input
              type="number"
              inputMode="decimal"
              step={settings.rounding}
              value={exercise.weight}
              onChange={(e) => setExerciseWeight(exerciseIndex, parseFloat(e.target.value))}
            />
            <span className="unit">{settings.unit}</span>
            <button
              onClick={() =>
                setExerciseWeight(exerciseIndex, exercise.weight + settings.rounding)
              }
            >
              +
            </button>
          </div>
        ) : (
          <div className="weight-big">{formatWeight(exercise.weight, settings.unit)}</div>
        )}
        <button
          className="link-btn"
          onClick={() => setEditingWeight((e) => !e)}
          aria-label={editingWeight ? 'Done editing weight' : 'Edit weight'}
        >
          {editingWeight ? 'Done' : 'Edit'}
        </button>
      </div>
      <div className="plate-load">
        {formatPlateLoad(
          computePlatesPerSide(exercise.weight, settings.unit, settings.barWeight, settings.plates),
          settings.unit,
        )}
      </div>

      <WarmupSets
        sets={exercise.warmupSets}
        unit={settings.unit}
        rounding={settings.rounding}
        onToggle={(i) => toggleSet(exerciseIndex, i, true)}
        onWeightChange={(i, w) => setWarmupWeight(exerciseIndex, i, w)}
        onRepsChange={(i, r) => setWarmupReps(exerciseIndex, i, r)}
        onAdd={() => addWarmupSet(exerciseIndex)}
        onRemove={(i) => removeWarmupSet(exerciseIndex, i)}
      />

      <div className="section-label">Work sets</div>
      <SetTracker sets={exercise.workSets} onCycle={cycleWorkSet} />
    </div>
  );
}
