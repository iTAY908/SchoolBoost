package cube.Finance;

import android.util.Log;
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

    /** Same tag BillingManager and MainActivity use: `adb logcat -s CubeyBilling`. */
    private static final String TAG = "CubeyBilling";

    private final MainActivity activity;

    NativeBridge(MainActivity activity) {
        this.activity = activity;
    }

    /**
     * Kept for older pages; no longer controls ads. Ads follow
     * EntitlementManager, which checks the purchase itself — the page's flag
     * lives in localStorage and could be edited on the device.
     */
    @JavascriptInterface
    public void setPremium(boolean premium) {
        activity.setAdsEnabled(!premium);
    }

    /**
     * Who is signed in to the app (email null on logout). AI Premium belongs to
     * an app account: this is what keeps one account's purchase from unlocking
     * the chat or removing ads for another account on the same phone.
     */
    @JavascriptInterface
    public void setAppAccount(String email, boolean hadLocalPremium, boolean anyLocalPremium) {
        activity.setAppAccount(email, hadLocalPremium, anyLocalPremium);
    }

    /** "Restore purchase": re-query Play (and the server); answer in CubeyBilling.onRestoreResult. */
    @JavascriptInterface
    public void restorePremium() {
        activity.restorePremium();
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
        Log.d(TAG, "JS bridge: buyPremium() reached NativeBridge — product="
                + BillingManager.PRODUCT_PREMIUM);
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

    // ---- the guide book -----------------------------------------------------
    //
    // Deliberately named methods rather than one buyProduct(String): the web
    // layer never gets to name a Play product, so a tampered page cannot try to
    // launch a purchase flow for something we did not intend to sell.

    /** Open Google's purchase sheet for the guide book. */
    @JavascriptInterface
    public void buyBook() {
        Log.d(TAG, "JS bridge: buyBook() reached NativeBridge — product="
                + BillingManager.PRODUCT_BOOK);
        activity.startPurchase(BillingManager.PRODUCT_BOOK);
    }

    /** The real localized price from Play for the book (null until loaded). */
    @JavascriptInterface
    public String getBookPrice() {
        return activity.bookPrice();
    }

    /** True when this Google account owns the book. */
    @JavascriptInterface
    public boolean isBookOwned() {
        return activity.ownsBook();
    }

    // ---- Sign in with Google -------------------------------------------------

    /** Opens Google's account picker; the result reaches CubeyAuth.onGoogleSignInResult. */
    @JavascriptInterface
    public void signInWithGoogle() {
        activity.startGoogleSignIn();
    }

    /** "Continue with Google" (Credential Manager); the result reaches CubeyAuth.onGoogleResult. */
    @JavascriptInterface
    public void googleSignIn() {
        activity.startGoogleCredentialSignIn();
    }

    /** Clears the cached Google account and the Firebase session. */
    @JavascriptInterface
    public void signOutGoogle() {
        activity.signOutGoogle();
    }

    // ---- Remember me / saved credentials --------------------------------------

    /** Encrypts and stores email+password for later pre-fill / biometric login. */
    @JavascriptInterface
    public void saveCredentials(String email, String password) {
        activity.saveCredentials(email, password);
    }

    /** Low-sensitivity — just for pre-filling the email field. Null if nothing is saved. */
    @JavascriptInterface
    public String getSavedEmail() {
        return activity.getSavedEmail();
    }

    @JavascriptInterface
    public boolean hasSavedCredentials() {
        return activity.hasSavedCredentials();
    }

    /** Forgets any saved email/password (and implicitly turns biometric login off — see setBiometricLoginEnabled). */
    @JavascriptInterface
    public void clearSavedCredentials() {
        activity.clearSavedCredentials();
    }

    // ---- Biometric login -------------------------------------------------------

    /** True only when the device has biometric hardware AND the user enrolled at least one biometric. */
    @JavascriptInterface
    public boolean isBiometricAvailable() {
        return activity.isBiometricAvailable();
    }

    @JavascriptInterface
    public boolean isBiometricLoginEnabled() {
        return activity.isBiometricLoginEnabled();
    }

    @JavascriptInterface
    public void setBiometricLoginEnabled(boolean enabled) {
        activity.setBiometricLoginEnabled(enabled);
    }

    /** Opens the system biometric prompt; the result reaches CubeyBiometric.onBiometricResult. */
    @JavascriptInterface
    public void authenticateWithBiometric() {
        activity.authenticateWithBiometric();
    }

    // ---- Phone verification (post-Google Sign-In) ----------------------------

    /** phoneNumber must be E.164 (e.g. "+972501234567"); the JS side builds it. */
    @JavascriptInterface
    public void sendPhoneVerificationCode(String phoneNumber) {
        activity.sendPhoneVerificationCode(phoneNumber);
    }

    /** Re-sends to the same number as the last sendPhoneVerificationCode() call. */
    @JavascriptInterface
    public void resendPhoneVerificationCode() {
        activity.resendPhoneVerificationCode();
    }

    /** code is the 6 digits from the SMS. */
    @JavascriptInterface
    public void verifyPhoneCode(String code) {
        activity.verifyPhoneCode(code);
    }

    // ---- onboarding -----------------------------------------------------------

    /** Called right after registration/verification succeeds, before the onboarding survey. */
    @JavascriptInterface
    public void onRegistrationComplete() {
        activity.handleRegistrationComplete();
    }

    // ---- server push (AI chat replies, monthly income) -----------------------
    //
    // Results come back asynchronously through window.CubeyPush.* — see the
    // "Server push" section of index.html.

    /** False until the backend is deployed and the build enables it (BuildConfig.PUSH_ENABLED). */
    @JavascriptInterface
    public boolean pushIsAvailable() {
        return activity.pushAvailable();
    }

    /** Ties this install to the account; password may be null for a remembered session. */
    @JavascriptInterface
    public void pushLink(String email, String password) {
        activity.pushLink(email, password);
    }

    /** Logout: unregister this install and sign the server session out. */
    @JavascriptInterface
    public void pushUnlink() {
        activity.pushUnlink();
    }

    /** Calls one whitelisted backend function; answer in CubeyPush.onCallResult(reqId, ...). */
    @JavascriptInterface
    public void pushCall(String reqId, String name, String jsonArgs) {
        activity.pushCall(reqId, name, jsonArgs);
    }

    @JavascriptInterface
    public void pushSendServerPasswordReset(String email) {
        activity.pushSendServerPasswordReset(email);
    }

    /** The notification the user tapped (JSON), handed out once; null if none. */
    @JavascriptInterface
    public String pushConsumeTarget() {
        return activity.pushConsumeTarget();
    }

    /** Server account currently signed in on this phone, or null. */
    @JavascriptInterface
    public String pushUid() {
        return activity.pushUid();
    }

    /** The conversation on screen ("" when the chat is closed) — suppresses its notifications. */
    @JavascriptInterface
    public void pushSetActiveConversation(String conversationId) {
        activity.pushSetActiveConversation(conversationId);
    }

    /** Mirror of the notification settings, read by the push service when the app is closed. */
    @JavascriptInterface
    public void pushSetLocalPrefs(String json) {
        activity.pushSetLocalPrefs(json);
    }

    @JavascriptInterface
    public String pushPermissionState() {
        return activity.pushPermissionState();
    }

    @JavascriptInterface
    public void requestPushPermission() {
        activity.requestPushPermission();
    }

    @JavascriptInterface
    public void openNotificationSettings() {
        activity.openNotificationSettings();
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
