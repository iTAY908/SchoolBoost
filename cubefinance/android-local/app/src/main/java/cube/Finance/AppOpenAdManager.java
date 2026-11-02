package cube.Finance;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ProcessLifecycleOwner;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.appopen.AppOpenAd;

/**
 * Loads and shows a full-screen App Open ad on cold start and on every
 * return to the foreground, per AdMob's App Open format guidelines
 * (https://developers.google.com/admob/android/app-open):
 *
 *  - preload ahead of time so showing never blocks on a network round trip;
 *  - never force an ad -- if none is ready when the app comes forward, the
 *    attempt is just skipped and a fresh one starts loading for next time;
 *  - treat an ad older than 4 hours as expired rather than showing stale
 *    content;
 *  - never show two full-screen ads at once, and never show over a sheet or
 *    the keyboard.
 *
 * This lives at the Application level rather than in MainActivity because
 * "the app came to the foreground" is a process-wide event, not an activity
 * one -- ProcessLifecycleOwner.onStart() is the one signal that fires exactly
 * once per foreground entry no matter which/how many activities exist.
 *
 * Gated by EntitlementManager (wired in CubeApp), like the interstitial: it
 * starts OFF and is switched on only once the signed-in account is known not
 * to own AI Premium — so a purchaser is never shown, and never even requests,
 * an App Open ad, including on the cold start before Play has answered.
 */
final class AppOpenAdManager implements Application.ActivityLifecycleCallbacks, DefaultLifecycleObserver {

    private static final String TAG = "AppOpenAdManager";

    /** Production App Open unit. */
    private static final String UNIT_PROD = "ca-app-pub-8901066122989701/1080619660";
    /** Google's official test unit — always used in debug builds. */
    private static final String UNIT_TEST = "ca-app-pub-3940256099942544/9257395921";

    /** AdMob's own guidance: treat an unshown App Open ad as stale after 4 hours. */
    private static final long EXPIRE_MS = 4 * 60 * 60 * 1000L;

    private final Application app;

    @Nullable private AppOpenAd ad;
    private boolean loading;
    private boolean showing;
    private long loadedAt;

    private boolean enabled = false;  // the ad gate — see class doc
    private boolean blocked;          // a sheet/keyboard is open — skip this opportunity

    @Nullable private Activity currentActivity;

    AppOpenAdManager(Application app) {
        this.app = app;
        app.registerActivityLifecycleCallbacks(this);
        ProcessLifecycleOwner.get().getLifecycle().addObserver(this);
    }

    private static String unitId() {
        return BuildConfig.DEBUG ? UNIT_TEST : UNIT_PROD;
    }

    // ------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------

    private void loadAd() {
        if (!enabled || loading || isAdAvailable()) return;
        loading = true;
        AdRequest request = new AdRequest.Builder().build();
        AppOpenAd.load(app, unitId(), request, new AppOpenAd.AppOpenAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull AppOpenAd loaded) {
                loading = false;
                if (!enabled) return;   // became a purchaser while this was loading
                ad = loaded;
                loadedAt = System.currentTimeMillis();
                Log.i(TAG, "app open ad loaded");
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                loading = false;
                Log.w(TAG, "app open ad failed to load: " + error.getMessage());
            }
        });
    }

    private boolean isAdAvailable() {
        return ad != null && (System.currentTimeMillis() - loadedAt) < EXPIRE_MS;
    }

    /** True while a full-screen App Open ad is on screen — other ad surfaces check this. */
    boolean isShowingAd() {
        return showing;
    }

    // ------------------------------------------------------------------
    // Showing
    // ------------------------------------------------------------------

    /**
     * Shows the ad if one is ready and nothing else is claiming the screen;
     * otherwise does nothing (never delays app usage waiting for a load) and
     * kicks off the next load so the next foreground entry has one ready.
     */
    private void showAdIfAvailable() {
        if (!enabled || blocked || showing || currentActivity == null) return;
        if (!isAdAvailable()) { loadAd(); return; }

        final AppOpenAd toShow = ad;
        toShow.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdShowedFullScreenContent() {
                showing = true;
            }

            @Override
            public void onAdDismissedFullScreenContent() {
                showing = false;
                ad = null;
                loadAd();   // warm up the next one immediately
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                Log.w(TAG, "app open ad show failed: " + error.getMessage());
                showing = false;
                ad = null;
                loadAd();
            }
        });
        toShow.show(currentActivity);
    }

    // ------------------------------------------------------------------
    // ProcessLifecycleOwner — fires once per app-wide foreground entry,
    // covering both cold start and every return from the background.
    // ------------------------------------------------------------------

    @Override
    public void onStart(@NonNull LifecycleOwner owner) {
        showAdIfAvailable();
    }

    // ------------------------------------------------------------------
    // Switches — mirrors AdController's premium/blocked handling so both ad
    // surfaces turn off together for a Premium user and pause together while
    // a sheet or the keyboard is up.
    // ------------------------------------------------------------------

    void setEnabled(boolean value) {
        if (enabled == value) return;
        enabled = value;
        if (enabled) loadAd(); else ad = null;
    }

    void setBlocked(boolean value) {
        blocked = value;
    }

    // ------------------------------------------------------------------
    // Application.ActivityLifecycleCallbacks — only tracked to know which
    // activity to show the ad over; every other callback is a no-op.
    // ------------------------------------------------------------------

    @Override public void onActivityCreated(@NonNull Activity activity, @Nullable Bundle savedInstanceState) { currentActivity = activity; }
    @Override public void onActivityStarted(@NonNull Activity activity) { currentActivity = activity; }
    @Override public void onActivityResumed(@NonNull Activity activity) { currentActivity = activity; }
    @Override public void onActivityPaused(@NonNull Activity activity) { }
    @Override public void onActivityStopped(@NonNull Activity activity) { }
    @Override public void onActivitySaveInstanceState(@NonNull Activity activity, @NonNull Bundle outState) { }

    @Override
    public void onActivityDestroyed(@NonNull Activity activity) {
        if (currentActivity == activity) currentActivity = null;
    }
}
