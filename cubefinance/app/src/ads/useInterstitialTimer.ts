// ============================================================================
// useInterstitialTimer — mounts the ad engine for the lifetime of the screen
// tree that owns it. Mount it ONCE (in App), not per screen.
// ============================================================================
import { useEffect } from 'react';
import adManager from './AdManager';

interface Options {
  /** Turn the whole thing off — e.g. the user bought Premium. */
  enabled?: boolean;
  /**
   * Don't interrupt right now (onboarding wizard, an open sheet, a focused
   * text field). The countdown keeps running; the ad simply waits for a
   * natural break, which is also what AdMob's placement policy asks for.
   */
  blocked?: boolean;
}

export function useInterstitialTimer({ enabled = true, blocked = false }: Options = {}): void {
  // Boot the SDK + preload once.
  useEffect(() => {
    let cancelled = false;
    adManager.init().then(() => {
      if (cancelled) return;
      if (enabled) adManager.startTimer();
    });
    return () => {
      cancelled = true;
      adManager.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Premium on/off.
  useEffect(() => { adManager.setEnabled(enabled); }, [enabled]);

  // Temporary veto.
  useEffect(() => { adManager.setBlocked(blocked); }, [blocked]);
}

export default useInterstitialTimer;
