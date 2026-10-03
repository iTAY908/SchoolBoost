// ============================================================================
// AdManager — a single interstitial that is always kept warm, shown every
// 6 minutes of FOREGROUND time.
//
// Design notes
// ------------
// * The countdown measures foreground time only. Going to the background
//   pauses it (we bank the elapsed slice); coming back resumes it, and if the
//   full interval already passed while away, the ad fires on return.
// * We use timestamps + a single setTimeout instead of a 1-second tick, so the
//   schedule never drifts and nothing runs while the app is backgrounded.
// * An ad is preloaded immediately and re-loaded the moment the previous one
//   is closed, so showing is instant.
// * Callers can veto a display (`setBlocked`) — used to avoid interrupting
//   onboarding, text entry or an open modal, which is also what AdMob's
//   policies require.
// * Premium users never see ads: `setEnabled(false)` shuts the whole thing off.
// ============================================================================
import { AppState, AppStateStatus } from 'react-native';
import mobileAds, {
  AdEventType,
  InterstitialAd,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';
import {
  AD_INTERVAL_MS,
  AD_REQUEST_OPTIONS,
  INTERSTITIAL_AD_UNIT_ID,
  MIN_GAP_BETWEEN_ADS_MS,
  RELOAD_BACKOFF_MS,
} from './adConfig';

type Unsubscribe = () => void;

class AdManager {
  private ad: InterstitialAd | null = null;
  private unsubscribers: Unsubscribe[] = [];

  private initialised = false;
  private enabled = true;          // false → premium user, ads disabled
  private blocked = false;         // temporary veto (onboarding, modal, typing…)

  private loaded = false;
  private loading = false;
  private failureCount = 0;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- countdown state -----------------------------------------------------
  private timer: ReturnType<typeof setTimeout> | null = null;
  private bankedMs = 0;            // foreground time accumulated so far
  private segmentStartedAt = 0;    // when the current foreground slice began
  private running = false;
  private lastShownAt = 0;
  private showing = false;
  private deferredByBlock = false; // the slot came up while we were vetoed

  private appState: AppStateStatus = AppState.currentState;
  private appStateSub: { remove: () => void } | null = null;

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /** Call once, as early as possible (App mount). Safe to call repeatedly. */
  async init(): Promise<void> {
    if (this.initialised) return;
    this.initialised = true;

    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();

    this.appStateSub = AppState.addEventListener('change', this.handleAppStateChange);
    this.preload();
  }

  /** Tear everything down (logout, unmount, tests). */
  destroy(): void {
    this.stopTimer();
    this.clearReloadTimer();
    this.disposeAd();
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.initialised = false;
  }

  // =========================================================================
  // Preloading
  // =========================================================================

  private disposeAd(): void {
    this.unsubscribers.forEach((u) => {
      try { u(); } catch { /* noop */ }
    });
    this.unsubscribers = [];
    this.ad = null;
    this.loaded = false;
    this.loading = false;
  }

  private clearReloadTimer(): void {
    if (this.reloadTimer) { clearTimeout(this.reloadTimer); this.reloadTimer = null; }
  }

  /** Build a fresh interstitial and start loading it. */
  preload(): void {
    if (!this.enabled || this.loading || this.loaded) return;

    this.clearReloadTimer();
    this.disposeAd();
    this.loading = true;

    const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, AD_REQUEST_OPTIONS);
    this.ad = ad;

    this.unsubscribers.push(
      ad.addAdEventListener(AdEventType.LOADED, () => {
        this.loading = false;
        this.loaded = true;
        this.failureCount = 0;
      }),
    );

    this.unsubscribers.push(
      ad.addAdEventListener(AdEventType.ERROR, (error) => {
        this.loading = false;
        this.loaded = false;
        // No fill / offline / etc. Back off, then try again.
        const delay =
          RELOAD_BACKOFF_MS[Math.min(this.failureCount, RELOAD_BACKOFF_MS.length - 1)];
        this.failureCount += 1;
        if (__DEV__) console.warn('[AdManager] load failed, retrying in', delay, 'ms', error?.message);
        this.clearReloadTimer();
        this.reloadTimer = setTimeout(() => this.preload(), delay);
      }),
    );

    this.unsubscribers.push(
      ad.addAdEventListener(AdEventType.OPENED, () => { this.showing = true; }),
    );

    // Ad dismissed → restart the countdown and warm up the next one immediately.
    this.unsubscribers.push(
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.showing = false;
        this.lastShownAt = Date.now();
        this.resetCountdown();
        this.disposeAd();
        this.preload();
      }),
    );

    try {
      ad.load();
    } catch (e) {
      this.loading = false;
      if (__DEV__) console.warn('[AdManager] load threw', e);
    }
  }

  isReady(): boolean {
    return this.enabled && this.loaded && !!this.ad;
  }

  // =========================================================================
  // Showing
  // =========================================================================

  /**
   * Show the interstitial if everything lines up.
   * Returns true when an ad was actually presented.
   */
  showIfPossible(): boolean {
    if (!this.enabled || this.blocked || this.showing) return false;
    if (this.appState !== 'active') return false;
    if (Date.now() - this.lastShownAt < MIN_GAP_BETWEEN_ADS_MS) return false;

    if (!this.isReady()) {
      // Not loaded in time — don't make the user wait. Try to fill for next time
      // and give the countdown a short retry window instead of skipping 6 min.
      this.preload();
      this.scheduleIn(15_000);
      return false;
    }

    try {
      this.ad!.show();
      return true;
    } catch (e) {
      if (__DEV__) console.warn('[AdManager] show failed', e);
      this.disposeAd();
      this.preload();
      this.resetCountdown();
      return false;
    }
  }

  // =========================================================================
  // The 6-minute foreground countdown
  // =========================================================================

  /** Start (or restart) counting. Called when the app becomes usable. */
  startTimer(): void {
    if (!this.enabled) return;
    this.running = true;
    this.bankedMs = 0;
    this.segmentStartedAt = Date.now();
    this.scheduleIn(AD_INTERVAL_MS);
  }

  stopTimer(): void {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  private resetCountdown(): void {
    this.bankedMs = 0;
    this.deferredByBlock = false;
    this.segmentStartedAt = Date.now();
    if (this.running) this.scheduleIn(AD_INTERVAL_MS);
  }

  private scheduleIn(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.handleTimerFired, Math.max(0, ms));
  }

  private handleTimerFired = (): void => {
    this.timer = null;
    if (!this.running || !this.enabled) return;
    if (this.appState !== 'active') return; // paused; foreground handler will re-check

    if (this.blocked) {
      // Busy right now (typing, modal, onboarding) — remember that the slot is
      // due and look again shortly, rather than dropping it entirely.
      // setBlocked(false) will also pick it up as soon as the app is free.
      this.deferredByBlock = true;
      this.scheduleIn(20_000);
      return;
    }

    const shown = this.showIfPossible();
    if (!shown && this.isReady() === false) {
      // showIfPossible already scheduled a retry
      return;
    }
    if (!shown) this.scheduleIn(20_000);
    // when shown, the CLOSED listener resets the countdown
  };

  /** Remaining foreground milliseconds — handy for debugging/UI. */
  msUntilNextAd(): number {
    if (!this.running) return AD_INTERVAL_MS;
    const live = this.appState === 'active' ? Date.now() - this.segmentStartedAt : 0;
    return Math.max(0, AD_INTERVAL_MS - (this.bankedMs + live));
  }

  // =========================================================================
  // Foreground / background
  // =========================================================================

  private handleAppStateChange = (next: AppStateStatus): void => {
    const prev = this.appState;
    this.appState = next;

    // --- going to the background: bank the elapsed slice and pause ---
    if (prev === 'active' && next !== 'active') {
      if (this.running && !this.showing) {
        this.bankedMs += Date.now() - this.segmentStartedAt;
      }
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      return;
    }

    // --- returning to the foreground: resume, or fire if the time already passed ---
    if (prev !== 'active' && next === 'active') {
      // An interstitial itself backgrounds the app; its CLOSED handler owns the reset.
      if (this.showing) return;

      if (!this.loaded) this.preload();
      if (!this.running) return;

      this.segmentStartedAt = Date.now();
      const remaining = AD_INTERVAL_MS - this.bankedMs;
      if (remaining <= 0) {
        // Don't slam an ad into the user's face the instant they return —
        // give the UI a moment to settle first.
        this.scheduleIn(1_500);
      } else {
        this.scheduleIn(remaining);
      }
    }
  };

  // =========================================================================
  // External switches
  // =========================================================================

  /** Premium users: setEnabled(false) removes ads entirely. */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.stopTimer();
      this.clearReloadTimer();
      this.disposeAd();
    } else {
      this.preload();
      this.startTimer();
    }
  }

  /** Temporarily forbid interstitials (onboarding, modals, text input…). */
  setBlocked(blocked: boolean): void {
    const was = this.blocked;
    this.blocked = blocked;
    // If the 6-minute slot came due while we were vetoed, take it as soon as
    // the app is free again — after a short beat so the UI can settle — rather
    // than making the user wait for the next retry window.
    if (was && !blocked && this.deferredByBlock && this.running && this.appState === 'active') {
      this.deferredByBlock = false;
      this.scheduleIn(2_000);
    }
  }

  isEnabled(): boolean { return this.enabled; }
}

export const adManager = new AdManager();
export default adManager;
