import { useEffect } from 'react';

/**
 * Keeps the mobile screen awake while the app is open, using the Screen Wake
 * Lock API. Without this, phones dim and lock during a workout (e.g. while the
 * rest timer counts down between sets).
 *
 * A wake lock is automatically released by the browser whenever the page
 * becomes hidden (backgrounded, screen turned off manually, tab switch), so we
 * re-acquire it on `visibilitychange` once the page is visible again.
 *
 * Gracefully no-ops where the API is unavailable (older browsers, insecure
 * contexts) or where the request is rejected (e.g. low battery).
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          // Effect was cleaned up while the request was in flight.
          void sentinel.release();
          sentinel = null;
        }
      } catch {
        // Request can reject (e.g. low battery, permissions); ignore.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sentinel == null) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void sentinel?.release();
      sentinel = null;
    };
  }, []);
}
