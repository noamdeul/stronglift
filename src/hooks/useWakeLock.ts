import { useEffect } from 'react';
import { KEEP_AWAKE_MP4 } from './keepAwakeVideo';

/**
 * Keeps the mobile screen awake while `enabled` is true (i.e. during an
 * active workout). Uses two mechanisms together, because no single one is
 * reliable across phones:
 *
 *  1. The Screen Wake Lock API — the right tool on modern Android Chrome and
 *     desktop. The browser releases the lock whenever the page is hidden, so
 *     we re-acquire it on `visibilitychange` and on the sentinel's `release`.
 *
 *  2. A muted, looping, inline `<video>` that is actively playing. iOS — and
 *     especially installed PWAs on iOS — does not honor the Wake Lock API
 *     reliably, but it will not dim/lock the screen while a video plays. This
 *     is the long-standing NoSleep.js technique. iOS may block autoplay until
 *     the first user gesture, so we (re)start playback on the first
 *     interaction and whenever the app becomes visible again.
 *
 * Both are cheap and harmless where redundant. Pass `enabled: false` to stop
 * everything and release any held lock.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    // --- 1. Screen Wake Lock API ---
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const supportsWakeLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

    const acquire = async () => {
      if (!supportsWakeLock || sentinel || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release();
          sentinel = null;
          return;
        }
        // The OS can drop the lock on its own; clear our handle so the next
        // visibility/gesture event re-acquires it.
        sentinel.addEventListener('release', () => {
          sentinel = null;
        });
      } catch {
        // Rejected (e.g. low battery, not visible, unsupported); the video
        // fallback below still covers us.
      }
    };

    // --- 2. Looping muted inline video fallback (iOS) ---
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.src = KEEP_AWAKE_MP4;
    // Present but invisible and non-interactive.
    Object.assign(video.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
    });
    document.body.appendChild(video);

    const playVideo = () => {
      // Rejection (autoplay policy) is expected until a user gesture; ignore.
      void video.play().catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
        playVideo();
      }
    };

    // iOS gates autoplay behind a user gesture, and the OS can silently drop
    // the wake lock while the page stays visible — retry both on any tap.
    const handleUserGesture = () => {
      void acquire();
      playVideo();
    };

    void acquire();
    playVideo();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pointerdown', handleUserGesture);
    window.addEventListener('touchend', handleUserGesture);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('touchend', handleUserGesture);
      void sentinel?.release();
      sentinel = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    };
  }, [enabled]);
}
