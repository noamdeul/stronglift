import { EXERCISES } from '../domain/exercises';
import type { LoggedExercise, Settings } from '../domain/types';
import { formatWeight } from '../domain/units';
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

  const def = EXERCISES[exercise.exerciseId];

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
      <div className="weight-big">{formatWeight(exercise.weight, settings.unit)}</div>

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
