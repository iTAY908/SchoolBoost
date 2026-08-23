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

    // ---- Google Play Billing ------------------------------------------------

    /** Open Google's purchase sheet for the one-time Premium product. */
    @JavascriptInterface
    public void buyPremium() {
        activity.startPurchase();
    }

    /** The real localized price from Play, e.g. "₪10.00" (null until loaded). */
    @JavascriptInterface
    public String getPremiumPrice() {
        return activity.premiumPrice();
    }

    /** True when this Google account owns the Premium product. */
    @JavascriptInterface
    public boolean isPremiumOwned() {
        return activity.ownsPremium();
    }

    /** Re-check ownership with Play ("restore purchases"). */
    @JavascriptInterface
    public void restorePurchases() {
        activity.restorePurchases();
    }

    // ---- printing -----------------------------------------------------------

    /**
     * window.print() does nothing in a WebView, so the worksheet's
     * "save as PDF" button calls this and the activity drives PrintManager
     * (which offers "Save as PDF" alongside real printers).
     */
    @JavascriptInterface
    public void printPage(String jobName) {
        activity.printWebView(jobName);
    }
}
