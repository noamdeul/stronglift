import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export interface RestTimerView {
  active: boolean;
  remainingSec: number;
  durationSec: number;
  /** 0..1 fraction elapsed, for a progress ring. */
  progress: number;
}

/**
 * Derives a live countdown from the persisted `endsAt` timestamp. Because the
 * source of truth is a timestamp (not a ticking counter), the countdown stays
 * accurate after the screen sleeps or the app is backgrounded.
 */
/** Short WebAudio beep so the timer is noticeable without an audio asset. */
function playBeep() {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch {
    // Audio may be unavailable (e.g. autoplay policy); fail silently.
  }
}

export function useRestTimer(): RestTimerView {
  const rest = useAppStore((s) => s.rest);
  const stopRest = useAppStore((s) => s.stopRest);
  const sound = useAppStore((s) => s.settings.sound);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (rest.endsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest.endsAt]);

  // Fire vibration/notification once the timer crosses zero, then clear it.
  useEffect(() => {
    if (rest.endsAt == null) return;
    const msLeft = rest.endsAt - Date.now();
    if (msLeft <= 0) return;
    const id = setTimeout(() => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([200, 100, 200]);
      }
      if (sound) playBeep();
      stopRest();
    }, msLeft);
    return () => clearTimeout(id);
  }, [rest.endsAt, stopRest, sound]);

  if (rest.endsAt == null) {
    return { active: false, remainingSec: 0, durationSec: rest.durationSec, progress: 0 };
  }

  const remainingMs = Math.max(0, rest.endsAt - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const durationSec = rest.durationSec || 1;
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / (durationSec * 1000)));

  return { active: remainingMs > 0, remainingSec, durationSec, progress };
}
