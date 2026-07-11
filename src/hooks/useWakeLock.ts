import { useEffect, useRef } from 'react';

/**
 * Hook to request and hold a Screen Wake Lock.
 * Prevents the device screen from dimming or locking during active workouts.
 *
 * Safe to call on any browser; will gracefully do nothing if the API is unsupported.
 * Automatically releases the lock when the component unmounts, the tab goes to background,
 * or when the `enabled` flag changes to false. Re-acquires it when tab returns to foreground.
 *
 * @param enabled - Whether the screen should be kept awake.
 */
export function useWakeLock(enabled: boolean = true) {
  const sentinelRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function requestWakeLock() {
      if (!('wakeLock' in navigator)) {
        return; // Wake Lock API is not supported in this browser
      }
      try {
        // Only request if we aren't already holding a sentinel
        if (!sentinelRef.current) {
          sentinelRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('🔒 [WakeLock] Screen Wake Lock acquired successfully.');
        }
      } catch (err: any) {
        console.warn(`⚠️ [WakeLock] Failed to acquire Screen Wake Lock: ${err.message}`);
      }
    }

    async function releaseWakeLock() {
      if (sentinelRef.current) {
        try {
          await sentinelRef.current.release();
          console.log('🔓 [WakeLock] Screen Wake Lock released successfully.');
        } catch (err: any) {
          console.error(`⚠️ [WakeLock] Error releasing Screen Wake Lock: ${err.message}`);
        } finally {
          sentinelRef.current = null;
        }
      }
    }

    // Attempt to acquire wake lock
    requestWakeLock();

    // Re-acquire lock if tab changes visibility (from background to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [enabled]);
}
