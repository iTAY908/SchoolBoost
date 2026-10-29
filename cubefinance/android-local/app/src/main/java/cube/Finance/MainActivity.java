package cube.Finance;

import android.Manifest;
import android.annotation.SuppressLint;
import android.graphics.Color;
import android.net.Uri;
import android.util.Log;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.widget.Toast;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import android.content.Intent;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * CubeFinance runs as a single self-contained web app bundled in assets/.
 * This activity hosts it in a WebView and adds the two things a web page
 * cannot do on its own: AdMob interstitials and true audio autoplay.
 */
public class MainActivity extends AppCompatActivity
        implements BillingManager.Listener, GoogleAuthManager.Listener, PhoneAuthManager.Listener,
        BiometricAuthManager.Listener {

    private WebView webView;
    private AdController ads;
    private BillingManager billing;
    private AppOpenAdManager appOpenAdManager;
    private GoogleAuthManager googleAuth;
    private PhoneAuthManager phoneAuth;
    private CredentialStore credentialStore;
    private BiometricAuthManager biometricAuth;
    private EntitlementManager entitlements;
    /** A Premium purchase completed in this session — the next "entitled" is announced as a purchase. */
    private boolean premiumJustBought;
    private final EntitlementManager.AdsListener adsGate = allowed ->
            runOnUiThread(() -> { if (ads != null) ads.setEnabled(allowed); });

    /** Same tag BillingManager uses: `adb logcat -s CubeyBilling`. */
    private static final String BILL_TAG = "CubeyBilling";
    private static final String AUTH_TAG = "GoogleAuthManager";
    private static final String PHONE_TAG = "PhoneAuthManager";
    private static final String BIO_TAG = "BiometricAuthManager";

    private final ActivityResultLauncher<String> notificationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                // Scheduling already happened regardless of the outcome; a denial just
                // means the eventual reminder silently won't be shown.
            });

    private final ActivityResultLauncher<String> registrationNotificationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (granted) sendWelcomeNotificationOnce();
                // Denied: per spec the welcome notification only fires once the
                // permission is approved, so a denial here just means no notification.
            });

    /** Asked from the notification settings page; the answer goes back to it. */
    private final ActivityResultLauncher<String> pushPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted ->
                    callJs("window.CubeyPush && CubeyPush.onPermission(" + JSONObject.quote(pushPermissionState()) + ");"));

    private final ActivityResultLauncher<Intent> googleSignInLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (googleAuth != null) googleAuth.handleResult(result.getData());
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Reserve space for the system bars rather than drawing under them.
        // Targeting API 35+ makes this call a no-op on API 35+ devices --
        // Android forces edge-to-edge regardless -- so the inset listener
        // below re-creates the same reserved-space layout by hand via
        // padding, on every API level this app supports (minSdk 24).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        getWindow().setStatusBarColor(Color.parseColor("#070A12"));
        getWindow().setNavigationBarColor(Color.parseColor("#070A12"));
        setTheme(R.style.Theme_CubeFinance); // drop the splash theme

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#070A12"));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#070A12"));
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Pad the WebView's container by the system bars' size so its content
        // (the HTML/CSS layer) never renders under the status bar or the
        // gesture/nav area on a forced-edge-to-edge (API 35+) device. A no-op
        // on API < 35, where setDecorFitsSystemWindows(true) above already
        // reserved this space and the bars report zero inset here.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        // localStorage — this is where ALL user data lives (accounts, cubes,
        // balances). Without it the app would forget everything on close.
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        // Let the intro soundtrack play by itself: inside a WebView we can lift
        // the browser's autoplay restriction, so no "tap for sound" is needed.
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100); // ignore the system font scale so the layout can't break
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(true);
        }

        webView.setWebViewClient(new WebViewClient() {
            /**
             * Prove the JS bridge actually survived the build.
             *
             * A release build strips anything R8 is not told to keep, and a
             * bridge method without its @JavascriptInterface annotation is
             * silently invisible to the page — window.CubeyNative exists, but
             * every method on it is undefined, so the app quietly behaves as
             * though it were running in a browser and never reaches Google.
             * That failure is invisible from the Java side, so ask the page.
             */
            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(
                        "(function(){var n=window.CubeyNative;if(!n)return 'MISSING';"
                      + "return ['buyPremium','buyBook','getPremiumPrice','isPremiumOwned',"
                      + "'restorePurchases','setPremium','printPage']"
                      + ".map(function(k){return k+'='+(typeof n[k]);}).join(' ');})()",
                        value -> {
                            Log.i(BILL_TAG, "JS bridge check: " + value);
                            if (value == null || value.contains("MISSING")
                                    || value.contains("buyPremium=undefined")) {
                                Log.e(BILL_TAG, "JS BRIDGE IS NOT REACHABLE — purchases cannot "
                                        + "work. In a release build this means R8 stripped the "
                                        + "@JavascriptInterface annotations; check "
                                        + "app/proguard-rules.pro.");
                                toast("גשר ה-JS אינו זמין — רכישות לא יעבדו");
                            }
                        });
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                // Keep the bundled app inside the WebView; send real links out
                // to the browser so we never trap the user on a web page.
                if ("file".equals(scheme)) return false;
                if ("http".equals(scheme) || "https".equals(scheme) || "mailto".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (Exception ignored) { }
                    return true;
                }
                return true;
            }
        });

        // Route the page's console.log/warn/error into the same Logcat tag as
        // the rest of billing, so `adb logcat -s CubeyBilling` shows both sides
        // of the coins_100_v2 / premium_access trace in one place. Without this,
        // console.log calls from index.html never reach Logcat at all.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                if (cm.message() != null && cm.message().contains("[CubeyBilling]")) {
                    Log.d(BILL_TAG, "JS: " + cm.message()
                            + " (" + cm.sourceId() + ":" + cm.lineNumber() + ")");
                }
                return true; // handled — also keeps default noisy WebView logging quiet
            }
        });

        // Bridge: billing, account, push and the rest of the native features.
        webView.addJavascriptInterface(new NativeBridge(this), "CubeyNative");

        // AI Premium (AI chat + no ads) is decided in one place. The
        // interstitial starts off and follows its gate, exactly like the App
        // Open ad that CubeApp already wired to it.
        entitlements = ((CubeApp) getApplication()).getEntitlements();
        ads = new AdController(this);
        entitlements.addAdsListener(adsGate);
        ads.start();
        // Owned by CubeApp — created at Application.onCreate() so it can
        // start preloading before this Activity even exists.
        appOpenAdManager = ((CubeApp) getApplication()).getAppOpenAdManager();

        // Real Google Play Billing for the one-time Premium unlock.
        billing = new BillingManager(this, this);
        entitlements.setRecheckHook(() -> { if (billing != null) billing.restorePurchases(); });
        entitlements.setServerVerifier((token, email, done) ->
                PushManager.verifyPurchase(this, BillingManager.PRODUCT_PREMIUM, token, email, done));
        entitlements.setListener(this::onEntitlement);
        billing.start();

        // Sign in with Google, exchanged for a Firebase credential.
        googleAuth = new GoogleAuthManager(this, googleSignInLauncher, this);

        // Post-Google phone verification -- links onto the same FirebaseUser.
        phoneAuth = new PhoneAuthManager(this, this);

        // "Remember me" credential storage + fingerprint/face unlock gating it.
        credentialStore = new CredentialStore(this);
        biometricAuth = new BiometricAuthManager(this, credentialStore, this);

        // Android back button → in-app back, then leave.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
        // Opened by tapping a chat/income notification (cold start): park the
        // target; the page picks it up once it has loaded and the user is in.
        handlePushIntent(getIntent());

        requestNotificationPermissionIfNeeded();
        // Triggers/refreshes every local reminder (inactivity, weekly
        // summary, weekly tip) on each launch — see NotificationScheduler.
        NotificationScheduler.scheduleAll(this);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (!NotificationScheduler.hasNotificationPermission(this)) {
            PushManager.markPermissionAsked(this);
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
        }
    }

    // ---- server push (chat replies, monthly income) -------------------------

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handlePushIntent(intent);   // app already running: route right away
    }

    private void handlePushIntent(Intent intent) {
        if (intent == null || intent.getStringExtra(CubeMessagingService.EXTRA_TYPE) == null) return;
        try {
            JSONObject t = new JSONObject();
            t.put("type", intent.getStringExtra(CubeMessagingService.EXTRA_TYPE));
            t.put("uid", intent.getStringExtra(CubeMessagingService.EXTRA_UID));
            t.put("conversationId", intent.getStringExtra(CubeMessagingService.EXTRA_CONVERSATION));
            t.put("messageId", intent.getStringExtra(CubeMessagingService.EXTRA_MESSAGE));
            t.put("entryId", intent.getStringExtra(CubeMessagingService.EXTRA_ENTRY));
            t.put("acct", intent.getStringExtra(CubeMessagingService.EXTRA_ACCT));
            t.put("goalId", intent.getStringExtra(CubeMessagingService.EXTRA_GOAL));
            t.put("eventId", intent.getStringExtra(CubeMessagingService.EXTRA_EVENT));
            PushManager.setPendingTarget(t.toString());
        } catch (JSONException ignored) {
            return;
        }
        // Consume the extras so a rotation/recreate never replays the tap.
        intent.removeExtra(CubeMessagingService.EXTRA_TYPE);
        callJs("window.CubeyPush && CubeyPush.onOpenTarget();");
    }

    private final PushManager.ForegroundListener pushForegroundListener = (type, data) ->
            callJs("window.CubeyPush && CubeyPush.onForegroundPush(" + JSONObject.quote(type) + "," + data + ");");

    boolean pushAvailable() { return PushManager.isEnabled(this); }

    void pushLink(String email, String password) {
        runOnUiThread(() -> PushManager.link(this, email, password, (ok, json, err) -> {
            // The server account is the one that can verify purchases with
            // the Play Developer API — run that check now.
            if (ok && entitlements != null) entitlements.onServerAvailable();
            callJs("window.CubeyPush && CubeyPush.onLinkResult(" + ok + "," + (json == null ? "null" : json) + ","
                    + (err == null ? "null" : JSONObject.quote(err)) + ");");
        }));
    }

    void pushUnlink() {
        runOnUiThread(() -> PushManager.unlink(this,
                () -> callJs("window.CubeyPush && CubeyPush.onUnlinked();")));
    }

    void pushCall(String reqId, String name, String jsonArgs) {
        runOnUiThread(() -> PushManager.call(this, name, jsonArgs, (ok, json, err) ->
                callJs("window.CubeyPush && CubeyPush.onCallResult(" + JSONObject.quote(reqId) + "," + ok + ","
                        + (json == null ? "null" : json) + "," + (err == null ? "null" : JSONObject.quote(err)) + ");")));
    }

    void pushSendServerPasswordReset(String email) {
        runOnUiThread(() -> PushManager.sendServerPasswordReset(this, email, (ok, json, err) ->
                callJs("window.CubeyPush && CubeyPush.onServerResetSent(" + ok + ");")));
    }

    String pushConsumeTarget() { return PushManager.consumePendingTarget(); }

    String pushUid() { return PushManager.isEnabled(this) ? PushManager.currentUid() : null; }

    void pushSetActiveConversation(String conversationId) {
        PushManager.setActiveConversation(conversationId);
        // Opening a conversation clears its notifications from the shade.
        if (conversationId != null && !conversationId.isEmpty()) PushManager.cancelTag(this, PushManager.TAG_CHAT);
    }

    void pushSetLocalPrefs(String json) { PushManager.setLocalPrefs(this, json); }

    /** granted | default (never asked) | denied (may ask again) | blocked (only in system settings) */
    String pushPermissionState() {
        boolean enabled = androidx.core.app.NotificationManagerCompat.from(this).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return enabled ? "granted" : "blocked";
        if (NotificationScheduler.hasNotificationPermission(this)) return enabled ? "granted" : "blocked";
        if (!PushManager.wasPermissionAsked(this)) return "default";
        return shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) ? "denied" : "blocked";
    }

    void requestPushPermission() {
        runOnUiThread(() -> {
            String s = pushPermissionState();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ("default".equals(s) || "denied".equals(s))) {
                PushManager.markPermissionAsked(this);
                pushPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
            } else if (!"granted".equals(s)) {
                openNotificationSettings();
            } else {
                callJs("window.CubeyPush && CubeyPush.onPermission(\"granted\");");
            }
        });
    }

    void openNotificationSettings() {
        runOnUiThread(() -> {
            try {
                Intent i = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                startActivity(i);
            } catch (Exception e) {
                startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", getPackageName(), null)));
            }
        });
    }

    /**
     * Called from the JS bridge right after registration/verification succeeds.
     * On Android 13+ this requests POST_NOTIFICATIONS if it isn't already
     * granted, and the welcome notification only fires once that's approved.
     */
    void handleRegistrationComplete() {
        runOnUiThread(() -> {
            if (WelcomeNotifier.hasSentWelcomeNotification(this)) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                    && !NotificationScheduler.hasNotificationPermission(this)) {
                registrationNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
                return;
            }
            sendWelcomeNotificationOnce();
        });
    }

    private void sendWelcomeNotificationOnce() {
        if (WelcomeNotifier.hasSentWelcomeNotification(this)) return;
        WelcomeNotifier.sendWelcomeNotification(this);
        WelcomeNotifier.markWelcomeNotificationSent(this);
    }

    /**
     * Called from the JS bridge when the user owns Premium. Only the
     * in-session interstitial timer respects it — the App Open ad is shown
     * on every launch/foreground for every account, Premium included (a
     * deliberate product decision distinct from the interstitial's Premium
     * exemption; see AppOpenAdManager's class doc).
     */
    void setAdsEnabled(boolean enabled) {
        // No longer obeyed: the page's own premium flag lives in localStorage
        // and could be edited on the device. Ads follow EntitlementManager,
        // which checks the purchase with Play (and the server where set up).
        Log.d(BILL_TAG, "setPremium(" + !enabled + ") from the page — ads follow EntitlementManager instead");
    }

    // ---- AI Premium entitlement (AI chat + no ads) ----------------------------

    /** From the page: who is signed in now (null on logout), see EntitlementManager.setAccount. */
    void setAppAccount(String email, boolean hadLocalPremium, boolean anyLocalPremium) {
        if (entitlements != null) entitlements.setAccount(email, hadLocalPremium, anyLocalPremium);
        // Shared-savings pushes are addressed to an account; the service only
        // shows those for the account signed in here (also when the app is closed).
        PushManager.setSharedAccount(this, email == null || email.trim().isEmpty()
                ? null : EntitlementManager.accountKey(email));
    }

    // ---- shared savings: FCM token for the Supabase backend ---------------------

    /** SHA-256 key of an email, the same one the server puts on shared pushes. */
    String accountKey(String email) {
        return email == null ? null : EntitlementManager.accountKey(email);
    }

    String pushInstallId() { return PushManager.installId(this); }

    /** Fetches this install's FCM token; the answer arrives in CubeyPush.onFcmToken. */
    void requestFcmToken() {
        runOnUiThread(() -> PushManager.fcmToken(this, token ->
                callJs("window.CubeyPush && CubeyPush.onFcmToken && CubeyPush.onFcmToken("
                        + (token == null ? "null" : JSONObject.quote(token)) + ");")));
    }

    /** Page → native: a Supabase access token for the signed-in account; the check itself is made here. */
    void verifyComplimentary(String accessToken) {
        if (entitlements != null) entitlements.verifyComplimentary(accessToken);
    }

    /** The verdict for the signed-in account → the page (unlocks/locks the AI chat). */
    private void onEntitlement(String email, Boolean entitled, String reason) {
        String event = "";
        if (Boolean.TRUE.equals(entitled) && premiumJustBought) { event = "purchase"; premiumJustBought = false; }
        callJs("window.CubeyBilling && CubeyBilling.onEntitlement && CubeyBilling.onEntitlement("
                + (email == null ? "null" : JSONObject.quote(email)) + ","
                + (entitled == null ? "null" : entitled.toString()) + ","
                + JSONObject.quote(reason) + "," + JSONObject.quote(event) + ");");
    }

    /** "Restore purchase": ask Play again and report what this account has, whatever it is. */
    void restorePremium() {
        runOnUiThread(() -> {
            if (billing != null) billing.restorePurchases();
            if (entitlements != null) entitlements.requestRecheck();
            webView.postDelayed(() -> callJs("window.CubeyBilling && CubeyBilling.onRestoreResult && CubeyBilling.onRestoreResult("
                    + (entitlements != null && entitlements.isEntitled()) + ","
                    + JSONObject.quote(entitlements == null || entitlements.lastReason() == null ? "" : entitlements.lastReason()) + ");"),
                    3000);
        });
    }

    /** Called from the JS bridge while a sheet/keyboard is open. */
    void setAdsBlocked(boolean blocked) {
        if (ads != null) runOnUiThread(() -> ads.setBlocked(blocked));
        if (appOpenAdManager != null) runOnUiThread(() -> appOpenAdManager.setBlocked(blocked));
    }

    // ---- Sign in with Google, called from the JS bridge --------------------

    void startGoogleSignIn() {
        if (googleAuth != null) runOnUiThread(() -> googleAuth.signIn());
    }

    // ---- "Continue with Google" (Credential Manager), called from the JS bridge ----
    // Separate from startGoogleSignIn() above (the older Firebase flow behind
    // signInWithGoogle), which keeps its name and behaviour.

    private GoogleSignInHelper google;

    public void startGoogleCredentialSignIn() {
        runOnUiThread(() -> {
            if (google == null) google = new GoogleSignInHelper(this);
            google.signIn((ok, email, name, error) ->
                    callJs("window.CubeyAuth && CubeyAuth.onGoogleResult(" + ok + ","
                            + jsString(email) + "," + jsString(name) + "," + jsString(error) + ")"));
        });
    }

    void signOutGoogle() {
        if (googleAuth != null) runOnUiThread(() -> googleAuth.signOut());
    }

    @Override
    public void onSignInResult(boolean ok, String email, String displayName, String reason) {
        Log.i(AUTH_TAG, "onSignInResult ok=" + ok + " reason=" + reason);
        callJs("window.CubeyAuth && CubeyAuth.onGoogleSignInResult("
                + ok + "," + jsString(email) + "," + jsString(displayName) + "," + jsString(reason) + ");");
    }

    // ---- Phone verification, called from the JS bridge ---------------------

    void sendPhoneVerificationCode(String phoneNumber) {
        if (phoneAuth != null) runOnUiThread(() -> phoneAuth.sendCode(phoneNumber));
    }

    void resendPhoneVerificationCode() {
        if (phoneAuth != null) runOnUiThread(() -> phoneAuth.resendCode());
    }

    void verifyPhoneCode(String code) {
        if (phoneAuth != null) runOnUiThread(() -> phoneAuth.verifyCode(code));
    }

    @Override
    public void onCodeSent() {
        Log.i(PHONE_TAG, "onCodeSent");
        callJs("window.CubeyPhoneAuth && CubeyPhoneAuth.onCodeSent();");
    }

    @Override
    public void onCodeSendFailed(String reason) {
        Log.w(PHONE_TAG, "onCodeSendFailed: " + reason);
        callJs("window.CubeyPhoneAuth && CubeyPhoneAuth.onCodeSendFailed(" + jsString(reason) + ");");
    }

    @Override
    public void onPhoneVerified(String phoneNumber) {
        Log.i(PHONE_TAG, "onPhoneVerified");
        callJs("window.CubeyPhoneAuth && CubeyPhoneAuth.onPhoneVerified(" + jsString(phoneNumber) + ");");
    }

    @Override
    public void onPhoneVerifyFailed(String reason) {
        Log.w(PHONE_TAG, "onPhoneVerifyFailed: " + reason);
        callJs("window.CubeyPhoneAuth && CubeyPhoneAuth.onPhoneVerifyFailed(" + jsString(reason) + ");");
    }

    // ---- Remember me / biometric login, called from the JS bridge ----------

    void saveCredentials(String email, String password) {
        if (credentialStore != null) runOnUiThread(() -> credentialStore.save(email, password));
    }

    String getSavedEmail() {
        return credentialStore != null ? credentialStore.getSavedEmail() : null;
    }

    boolean hasSavedCredentials() {
        return credentialStore != null && credentialStore.hasSavedCredentials();
    }

    void clearSavedCredentials() {
        if (credentialStore != null) runOnUiThread(() -> {
            credentialStore.clear();
            // Nothing left for biometric login to unlock -- keeping the flag
            // on would just make the next biometric attempt fail confusingly.
            if (biometricAuth != null) biometricAuth.setEnabled(false);
        });
    }

    boolean isBiometricAvailable() {
        return biometricAuth != null && biometricAuth.isAvailable();
    }

    boolean isBiometricLoginEnabled() {
        return biometricAuth != null && biometricAuth.isEnabled();
    }

    void setBiometricLoginEnabled(boolean enabled) {
        if (biometricAuth != null) runOnUiThread(() -> biometricAuth.setEnabled(enabled));
    }

    void authenticateWithBiometric() {
        if (biometricAuth != null) runOnUiThread(() -> biometricAuth.authenticate());
    }

    @Override
    public void onBiometricSuccess(String email, String password) {
        Log.i(BIO_TAG, "onBiometricSuccess");
        callJs("window.CubeyBiometric && CubeyBiometric.onBiometricResult(true,"
                + jsString(email) + "," + jsString(password) + ",null);");
    }

    @Override
    public void onBiometricFailed(String reason) {
        Log.w(BIO_TAG, "onBiometricFailed: " + reason);
        callJs("window.CubeyBiometric && CubeyBiometric.onBiometricResult(false,null,null,"
                + jsString(reason) + ");");
    }

    /**
     * Called from the JS bridge for the worksheet's "save as PDF" button.
     * A WebView has no window.print(), so printing goes through the system
     * print dialog — which offers "Save as PDF" next to any real printer.
     * The page's @media print rules decide what actually lands on the page.
     */
    void printWebView(String jobName) {
        if (webView == null) return;
        runOnUiThread(() -> {
            try {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                if (pm == null) return;
                String name = (jobName == null || jobName.trim().isEmpty())
                        ? getString(R.string.app_name) : jobName.trim();
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
                pm.print(name, adapter, new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build());
            } catch (Exception ignored) { }
        });
    }

    // ---- billing, called from the JS bridge --------------------------------

    /** Start Google's purchase sheet for the Premium product. */
    void startPurchase() {
        startPurchase(BillingManager.PRODUCT_PREMIUM);
    }

    /**
     * Start Google's purchase sheet for one product. The id comes from
     * NativeBridge, which only ever passes our own constants -- the web layer
     * cannot name an arbitrary product, and BillingManager rejects anything
     * outside its list regardless.
     */
    void startPurchase(String productId) {
        if (billing != null) runOnUiThread(() -> billing.launchPurchase(productId));
    }

    /** Formatted price straight from Play (e.g. "₪10.00"), or null if not loaded. */
    String premiumPrice() {
        return billing == null ? null : billing.getFormattedPrice(BillingManager.PRODUCT_PREMIUM);
    }

    /** The signed-in app account owns a valid AI Premium purchase (not just "this phone's Play account"). */
    boolean ownsPremium() {
        return entitlements != null && entitlements.isEntitled();
    }

    /** Formatted price of the guide book, or null if not loaded. */
    String bookPrice() {
        return billing == null ? null : billing.getFormattedPrice(BillingManager.PRODUCT_BOOK);
    }

    boolean ownsBook() {
        return billing != null && billing.isOwned(BillingManager.PRODUCT_BOOK);
    }

    /** Re-check what the account owns (restore purchases). */
    void restorePurchases() {
        if (billing != null) runOnUiThread(() -> billing.restorePurchases());
    }

    /** Push a value into the page without disturbing anything else. */
    private void callJs(String script) {
        runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript(script, null); });
    }

    private static String jsString(String v) {
        if (v == null) return "null";
        return "\"" + v.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ") + "\"";
    }

    // ---- BillingManager.Listener ------------------------------------------

    @Override
    public void onOwnershipChanged(String productId, boolean owned) {
        // The guide book only. Premium (and with it the ads) is per app
        // account and arrives through onPremiumPurchases → EntitlementManager.
        callJs("window.CubeyBilling && CubeyBilling.onOwnershipChanged("
                + jsString(productId) + "," + owned + ");");
    }

    @Override
    public void onPremiumPurchases(java.util.List<com.android.billingclient.api.Purchase> purchases) {
        if (entitlements != null) entitlements.onPlayPurchases(purchases);
    }

    @Override
    public void onPremiumPurchaseCompleted() {
        premiumJustBought = true;
    }

    @Override
    public String premiumAccountKey() {
        return entitlements == null ? null : entitlements.currentAccountKey();
    }

    @Override
    public void onPurchaseResult(String productId, boolean ok, String reason) {
        Log.i(BILL_TAG, "purchase result " + productId + " ok=" + ok + " reason=" + reason);
        // A native toast as well as the in-page one: when a purchase fails the
        // page may not even be able to hear about it.
        if (!ok && reason != null) toast("רכישה נכשלה · " + reason);
        callJs("window.CubeyBilling && CubeyBilling.onPurchaseResult("
                + jsString(productId) + "," + ok + "," + jsString(reason) + ");");
    }

    /**
     * Billing is not usable at all — setup failed, or Play will not return the
     * products. Surfaced natively as well as through the page, because if the
     * JS bridge is the thing that is broken the page cannot tell anyone.
     */
    @Override
    public void onBillingUnavailable(String detail) {
        Log.e(BILL_TAG, "billing unavailable: " + detail);
        toast("החיוב אינו זמין: " + detail);
        callJs("window.CubeyBilling && CubeyBilling.onBillingUnavailable("
                + jsString(detail) + ");");
    }

    /** Short native toast — survives a broken JS bridge. */
    void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show());
    }

    @Override
    public void onPriceReady(String productId, String formattedPrice) {
        callJs("window.CubeyBilling && CubeyBilling.onPriceReady("
                + jsString(productId) + "," + jsString(formattedPrice) + ");");
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        PushManager.setForeground(true, pushForegroundListener);
        PushManager.setTokenListener(token -> callJs("window.CubeyPush && CubeyPush.onFcmToken && CubeyPush.onFcmToken("
                + (token == null ? "null" : JSONObject.quote(token)) + ");"));
        if (ads != null) ads.onForeground();
        if (billing != null) billing.restorePurchases();
    }

    @Override
    protected void onPause() {
        // From here on a chat reply is a system notification, even for the
        // conversation that was open.
        PushManager.setForeground(false, null);
        PushManager.setTokenListener(null);
        if (ads != null) ads.onBackground();
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (entitlements != null) {
            entitlements.removeAdsListener(adsGate);
            entitlements.setListener(null);
            entitlements.setRecheckHook(null);
            entitlements.setServerVerifier(null);
        }
        if (billing != null) billing.destroy();
        if (ads != null) ads.destroy();
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** Keep hardware keyboard/back semantics sane on old devices too. */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
