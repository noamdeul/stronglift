import { describe, expect, it } from 'vitest';
import {
  computePlatesPerSide,
  convertWeight,
  formatPlateLoad,
  formatWeight,
  kgToLb,
  lbToKg,
  roundToIncrement,
} from '../domain/units';

describe('units', () => {
  it('rounds to the nearest increment', () => {
    expect(roundToIncrement(47.3, 2.5)).toBe(47.5);
    expect(roundToIncrement(46.1, 2.5)).toBe(45);
    expect(roundToIncrement(100, 5)).toBe(100);
  });

  it('avoids floating point fuzz', () => {
    expect(roundToIncrement(42.5 + 2.5, 2.5)).toBe(45);
  });

  it('returns the weight unchanged for a non-positive increment', () => {
    expect(roundToIncrement(47.3, 0)).toBe(47.3);
    expect(roundToIncrement(47.3, -2.5)).toBe(47.3);
  });

  it('converts kg <-> lb', () => {
    expect(kgToLb(100)).toBeCloseTo(220.46, 1);
    expect(lbToKg(45)).toBeCloseTo(20.41, 1);
  });

  it('converts and snaps to target rounding', () => {
    // 20 kg ~= 44.09 lb -> snaps to 45 lb on a 5 lb grid.
    expect(convertWeight(20, 'kg', 'lb', 5)).toBe(45);
    // 100 lb ~= 45.36 kg -> snaps to 45 kg on a 2.5 kg grid.
    expect(convertWeight(100, 'lb', 'kg', 2.5)).toBe(45);
  });

  it('is a no-op when units match', () => {
    expect(convertWeight(60, 'kg', 'kg', 2.5)).toBe(60);
  });

  it('formats weights', () => {
    expect(formatWeight(60, 'kg')).toBe('60 kg');
    expect(formatWeight(42.5, 'kg')).toBe('42.5 kg');
    expect(formatWeight(45, 'lb')).toBe('45 lb');
  });

  describe('plate calculator', () => {
    it('loads a clean weight from the largest plates first', () => {
      // 60 kg on a 20 kg bar => 20 kg per side => one 20.
      expect(computePlatesPerSide(60, 'kg').perSide).toEqual([20]);
      // 100 kg => 40 per side => 25 + 15.
      expect(computePlatesPerSide(100, 'kg').perSide).toEqual([25, 15]);
    });

    it('uses small plates and reports no leftover for loadable weights', () => {
      // 62.5 kg => 21.25 per side => 20 + 1.25.
      const load = computePlatesPerSide(62.5, 'kg');
      expect(load.perSide).toEqual([20, 1.25]);
      expect(load.leftover).toBe(0);
    });

    it('treats bar-only weight as no plates', () => {
      const load = computePlatesPerSide(20, 'kg');
      expect(load.perSide).toEqual([]);
      expect(load.leftover).toBe(0);
    });

    it('flags weights below the bar', () => {
      const load = computePlatesPerSide(10, 'kg');
      expect(load.perSide).toEqual([]);
      expect(load.leftover).toBe(5);
    });

    it('reports leftover when the weight is not plate-divisible', () => {
      // 21 kg => 0.5 per side, smaller than the smallest 1.25 plate.
      const load = computePlatesPerSide(21, 'kg');
      expect(load.perSide).toEqual([]);
      expect(load.leftover).toBe(0.5);
    });

    it('honors a custom bar and plate set, regardless of plate order', () => {
      // 70 lb on a 45 lb bar => 12.5 per side from a [10, 2.5] set (given unsorted).
      const load = computePlatesPerSide(70, 'lb', 45, [2.5, 10, 5]);
      expect(load.perSide).toEqual([10, 2.5]);
      expect(load.leftover).toBe(0);
    });

    it('ignores non-positive plate sizes', () => {
      const load = computePlatesPerSide(60, 'kg', 20, [20, 0, -5]);
      expect(load.perSide).toEqual([20]);
    });

    it('formats the per-side breakdown', () => {
      expect(formatPlateLoad(computePlatesPerSide(100, 'kg'), 'kg')).toBe('Bar + 25 + 15 / side');
      expect(formatPlateLoad(computePlatesPerSide(20, 'kg'), 'kg')).toBe('Bar only');
      expect(formatPlateLoad(computePlatesPerSide(10, 'kg'), 'kg')).toBe('Below the bar');
    });
  });
});
