package cube.Finance;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

/**
 * Shows one interstitial per 10 minutes of FOREGROUND time.
 *
 * The countdown deliberately measures only the time the app is actually on
 * screen: going to the background banks the elapsed slice and cancels the
 * pending callback, coming back resumes with just the remainder. An ad is kept
 * preloaded at all times so it appears instantly, and a fresh one is requested
 * the moment the previous is dismissed.
 */
final class AdController {

    private static final String TAG = "AdController";

    /** Production interstitial unit. */
    private static final String UNIT_PROD = "ca-app-pub-8901066122989701/5402776546";
    /** Google's official test unit — always used in debug builds. */
    private static final String UNIT_TEST = "ca-app-pub-3940256099942544/1033173712";

    private static final long INTERVAL_MS = 10 * 60 * 1000L; // 10 minutes
    private static final long MIN_GAP_MS = 60 * 1000L;      // never burst
    private static final long RETRY_MS = 15 * 1000L;        // ad wasn't ready
    private static final long BLOCKED_RETRY_MS = 20 * 1000L;
    private static final long[] BACKOFF_MS = { 5_000, 15_000, 30_000, 60_000 };

    private final Activity activity;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private InterstitialAd ad;
    private boolean loading;
    private int failures;

    // Starts OFF: nothing is requested until EntitlementManager says this
    // account is not an AI Premium purchaser (MainActivity wires it). That is
    // what keeps a purchaser from seeing — or even loading — an ad while Play
    // is still being asked at startup.
    private boolean enabled = false;
    private boolean blocked;          // a sheet/keyboard is open
    private boolean deferredByBlock;
    private boolean running;
    private boolean showing;
    private boolean foreground = true;

    private long bankedMs;            // foreground time already counted
    private long segmentStartedAt;    // when the current foreground slice began
    private long lastShownAt;

    private final Runnable tick = this::onTimerFired;

    AdController(Activity activity) {
        this.activity = activity;
    }

    private static String unitId() {
        return BuildConfig.DEBUG ? UNIT_TEST : UNIT_PROD;
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    void start() {
        // The Mobile Ads SDK itself is initialized once, at the Application
        // level (see CubeApp), before this ever runs — AppOpenAd needs to
        // start preloading earlier than any Activity exists. Loading here is
        // safe regardless of whether that init has finished yet; the SDK
        // queues the request.
        preload();
        startTimer();
    }

    void destroy() {
        stopTimer();
        handler.removeCallbacksAndMessages(null);
        ad = null;
    }

    // ------------------------------------------------------------------
    // Preloading
    // ------------------------------------------------------------------

    private void preload() {
        if (!enabled || loading || ad != null) return;
        loading = true;
        AdRequest request = new AdRequest.Builder().build();
        InterstitialAd.load(activity, unitId(), request, new InterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull InterstitialAd loaded) {
                loading = false;
                failures = 0;
                if (!enabled) return;   // became a purchaser while this was loading
                ad = loaded;
                ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                    @Override
                    public void onAdShowedFullScreenContent() {
                        showing = true;
                    }

                    @Override
                    public void onAdDismissedFullScreenContent() {
                        showing = false;
                        lastShownAt = SystemClock.elapsedRealtime();
                        ad = null;
                        resetCountdown();   // a fresh 10 minutes starts now
                        preload();          // warm up the next one immediately
                    }

                    @Override
                    public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                        Log.w(TAG, "show failed: " + error.getMessage());
                        showing = false;
                        ad = null;
                        resetCountdown();
                        preload();
                    }
                });
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                loading = false;
                ad = null;
                if (!enabled) return;
                long delay = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
                failures++;
                Log.w(TAG, "load failed (" + error.getMessage() + "), retry in " + delay + "ms");
                handler.postDelayed(AdController.this::preload, delay);
            }
        });
    }

    private boolean isReady() {
        return enabled && ad != null;
    }

    // ------------------------------------------------------------------
    // Showing
    // ------------------------------------------------------------------

    private boolean showIfPossible() {
        if (!enabled || blocked || showing || !foreground) return false;
        if (SystemClock.elapsedRealtime() - lastShownAt < MIN_GAP_MS) return false;
        // Never stack a second full-screen ad on top of an App Open ad that
        // is already on screen (e.g. right as the app returns to foreground).
        AppOpenAdManager aom = ((CubeApp) activity.getApplication()).getAppOpenAdManager();
        if (aom != null && aom.isShowingAd()) return false;
        if (!isReady()) {
            preload();
            scheduleIn(RETRY_MS);   // don't burn the slot, just try again soon
            return false;
        }
        ad.show(activity);
        return true;
    }

    // ------------------------------------------------------------------
    // The 10-minute foreground countdown
    // ------------------------------------------------------------------

    private void startTimer() {
        if (!enabled) return;
        running = true;
        bankedMs = 0;
        segmentStartedAt = SystemClock.elapsedRealtime();
        scheduleIn(INTERVAL_MS);
    }

    private void stopTimer() {
        running = false;
        handler.removeCallbacks(tick);
    }

    private void resetCountdown() {
        bankedMs = 0;
        deferredByBlock = false;
        segmentStartedAt = SystemClock.elapsedRealtime();
        if (running) scheduleIn(INTERVAL_MS);
    }

    private void scheduleIn(long ms) {
        handler.removeCallbacks(tick);
        handler.postDelayed(tick, Math.max(0, ms));
    }

    private void onTimerFired() {
        if (!running || !enabled || !foreground) return;
        if (blocked) {
            deferredByBlock = true;         // take it as soon as the app is free
            scheduleIn(BLOCKED_RETRY_MS);
            return;
        }
        if (!showIfPossible() && isReady()) scheduleIn(RETRY_MS);
    }

    /** Milliseconds of foreground time left before the next ad. */
    long msUntilNextAd() {
        if (!running) return INTERVAL_MS;
        long live = foreground ? SystemClock.elapsedRealtime() - segmentStartedAt : 0;
        return Math.max(0, INTERVAL_MS - (bankedMs + live));
    }

    // ------------------------------------------------------------------
    // Foreground / background
    // ------------------------------------------------------------------

    void onBackground() {
        if (!foreground) return;
        foreground = false;
        // An interstitial itself pauses the activity — that isn't the user
        // leaving, and its dismiss callback owns the reset.
        if (showing) return;
        if (running) bankedMs += SystemClock.elapsedRealtime() - segmentStartedAt;
        handler.removeCallbacks(tick);
    }

    void onForeground() {
        if (foreground) return;
        foreground = true;
        if (showing) return;
        if (!enabled) return;
        if (ad == null) preload();
        if (!running) return;
        segmentStartedAt = SystemClock.elapsedRealtime();
        long remaining = INTERVAL_MS - bankedMs;
        // Give the UI a moment to settle rather than firing the instant we return.
        scheduleIn(remaining <= 0 ? 1_500 : remaining);
    }

    // ------------------------------------------------------------------
    // Switches
    // ------------------------------------------------------------------

    /**
     * The ad gate. Off: the countdown stops, retries are cancelled and the
     * preloaded ad is dropped, so nothing more is requested or shown. A load
     * already in flight may still complete — onAdLoaded then sees enabled=false
     * via isReady()/showIfPossible() and the ad is never shown.
     */
    void setEnabled(boolean value) {
        if (enabled == value) return;
        enabled = value;
        if (!enabled) {
            stopTimer();
            handler.removeCallbacksAndMessages(null);
            ad = null;
        } else {
            preload();
            startTimer();
        }
    }

    void setBlocked(boolean value) {
        boolean was = blocked;
        blocked = value;
        if (was && !value && deferredByBlock && running && foreground) {
            deferredByBlock = false;
            scheduleIn(2_000);   // the slot was due — take it now the app is free
        }
    }
}
