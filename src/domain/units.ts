import type { Unit } from './types';

const LB_PER_KG = 2.2046226218;

/** Standard empty Olympic barbell weight, per unit. */
export const BAR_WEIGHT: Record<Unit, number> = {
  kg: 20,
  lb: 45,
};

/** Default smallest loadable increment (plate pair), per unit. */
export const DEFAULT_ROUNDING: Record<Unit, number> = {
  kg: 2.5,
  lb: 5,
};

/** Standard plate sizes available in a typical gym, largest first, per unit. */
export const PLATE_SIZES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

/** Plates to load on one side of the bar to reach `totalWeight`. */
export interface PlateLoad {
  /** Plate sizes for one side, largest first. */
  perSide: number[];
  /** Weight per side that couldn't be made from the available plates. */
  leftover: number;
}

/**
 * Greedily compute the plates to load on *each* side of the bar to reach
 * `totalWeight`. Returns an empty `perSide` with `leftover === 0` for a
 * bar-only weight, and a positive `leftover` when the target sits below the bar
 * or can't be made from the available plates.
 */
export function computePlatesPerSide(
  totalWeight: number,
  unit: Unit,
  bar: number = BAR_WEIGHT[unit],
  plates: number[] = PLATE_SIZES[unit],
): PlateLoad {
  let remaining = (totalWeight - bar) / 2;
  if (remaining <= 0) {
    // At or below the bar: nothing to load; flag any shortfall below the bar.
    return { perSide: [], leftover: Math.max(0, -remaining) };
  }
  const perSide: number[] = [];
  for (const plate of plates) {
    while (remaining + 1e-9 >= plate) {
      perSide.push(plate);
      remaining -= plate;
    }
  }
  return { perSide, leftover: Math.round(Math.max(0, remaining) * 100) / 100 };
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Snap a weight to the nearest multiple of `increment`. */
export function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return weight;
  const snapped = Math.round(weight / increment) * increment;
  // Avoid floating-point fuzz like 47.50000000001.
  return Math.round(snapped * 100) / 100;
}

/** Convert a weight from one unit to another, snapped to the target rounding. */
export function convertWeight(
  weight: number,
  from: Unit,
  to: Unit,
  rounding: number,
): number {
  if (from === to) return weight;
  const converted = from === 'kg' ? kgToLb(weight) : lbToKg(weight);
  return roundToIncrement(converted, rounding);
}

/** Human-readable per-side plate breakdown, e.g. "Bar + 20 + 5 / side". */
export function formatPlateLoad(load: PlateLoad, unit: Unit): string {
  if (load.perSide.length === 0) {
    return load.leftover > 0 ? 'Below the bar' : 'Bar only';
  }
  const plates = load.perSide.join(' + ');
  const note = load.leftover > 0 ? ` (+${load.leftover} ${unit} short)` : '';
  return `Bar + ${plates} / side${note}`;
}

export function formatWeight(weight: number, unit: Unit): string {
  const rounded = Math.round(weight * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${unit}`;
}
