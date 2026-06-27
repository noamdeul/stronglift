import type { LoggedSet, Unit } from './types';
import { BAR_WEIGHT, roundToIncrement } from './units';

/**
 * Generate FiveByFive-style warmup sets for a given working weight.
 *
 * Scheme: two sets with the empty bar, then a short ramp up toward the working
 * weight. Warmups are only meaningful once the working weight is meaningfully
 * above the bar; for very light loads we just do the bar a couple of times.
 */
export function computeWarmups(
  workingWeight: number,
  unit: Unit,
  rounding: number,
): { weight: number; reps: number }[] {
  const bar = BAR_WEIGHT[unit];

  if (workingWeight <= bar) {
    return [{ weight: bar, reps: 5 }];
  }

  const warmups: { weight: number; reps: number }[] = [
    { weight: bar, reps: 5 },
    { weight: bar, reps: 5 },
  ];

  // Ramp sets at ~50%, 70%, 90% of the working weight, never below the bar and
  // never duplicating a weight already used.
  const ramps: { pct: number; reps: number }[] = [
    { pct: 0.5, reps: 5 },
    { pct: 0.7, reps: 3 },
    { pct: 0.9, reps: 2 },
  ];

  let lastWeight = bar;
  for (const ramp of ramps) {
    const weight = roundToIncrement(workingWeight * ramp.pct, rounding);
    if (weight > lastWeight && weight < workingWeight) {
      warmups.push({ weight, reps: ramp.reps });
      lastWeight = weight;
    }
  }

  return warmups;
}

export function warmupsToLoggedSets(
  warmups: { weight: number; reps: number }[],
): LoggedSet[] {
  return warmups.map((w) => ({
    reps: w.reps,
    targetReps: w.reps,
    done: false,
    isWarmup: true,
    weight: w.weight,
  }));
}
