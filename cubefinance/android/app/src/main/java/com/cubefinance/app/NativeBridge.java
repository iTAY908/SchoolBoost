package com.cubefinance.app;

import android.webkit.JavascriptInterface;

/**
 * The bridge the bundled web app can call:
 *
 *   if (window.CubeyNative) CubeyNative.setPremium(true);   // ads off forever
 *   if (window.CubeyNative) CubeyNative.setBusy(true);      // a sheet is open
 *
 * Every method is guarded so an older/newer HTML bundle can never crash the app.
 */
public final class NativeBridge {

    private final MainActivity activity;

    NativeBridge(MainActivity activity) {
        this.activity = activity;
    }

    /** Premium was verified — remove ads for good. */
    @JavascriptInterface
    public void setPremium(boolean premium) {
        activity.setAdsEnabled(!premium);
    }

    /** Suppress interstitials while a bottom sheet / keyboard is open. */
    @JavascriptInterface
    public void setBusy(boolean busy) {
        activity.setAdsBlocked(busy);
    }

    /** Lets the web layer detect that it is running inside the Android app. */
    @JavascriptInterface
    public String platform() {
        return "android";
    }
}
