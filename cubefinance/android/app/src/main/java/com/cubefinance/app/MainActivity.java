package com.cubefinance.app;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;

import android.content.Intent;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;

/**
 * CubeFinance runs as a single self-contained web app bundled in assets/.
 * This activity hosts it in a WebView and adds the two things a web page
 * cannot do on its own: AdMob interstitials and true audio autoplay.
 */
public class MainActivity extends AppCompatActivity implements BillingManager.Listener {

    private WebView webView;
    private AdController ads;
    private BillingManager billing;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Draw behind the system bars for an app-like feel; the page is dark.
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
            WebView.setSafeBrowsingEnabled(true);
        }

        webView.setWebViewClient(new WebViewClient() {
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

        // Bridge: lets the web app switch ads off the moment Premium is verified.
        webView.addJavascriptInterface(new NativeBridge(this), "CubeyNative");

        ads = new AdController(this);
        ads.start();

        // Real Google Play Billing for the one-time Premium unlock.
        billing = new BillingManager(this, this);
        billing.start();

        // Android back button → in-app back, then leave.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
    }

    /** Called from the JS bridge when the user owns Premium. */
    void setAdsEnabled(boolean enabled) {
        if (ads != null) runOnUiThread(() -> ads.setEnabled(enabled));
    }

    /** Called from the JS bridge while a sheet/keyboard is open. */
    void setAdsBlocked(boolean blocked) {
        if (ads != null) runOnUiThread(() -> ads.setBlocked(blocked));
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
        if (billing != null) runOnUiThread(() -> billing.launchPurchase());
    }

    /** Formatted price straight from Play (e.g. "₪10.00"), or null if not loaded. */
    String premiumPrice() {
        return billing == null ? null : billing.getFormattedPrice();
    }

    boolean ownsPremium() {
        return billing != null && billing.isPremium();
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
    public void onPremiumChanged(boolean premium) {
        if (ads != null) ads.setEnabled(!premium);   // owning Premium removes ads
        callJs("window.CubeyBilling && CubeyBilling.onPremiumChanged(" + premium + ");");
    }

    @Override
    public void onPurchaseResult(boolean ok, String reason) {
        callJs("window.CubeyBilling && CubeyBilling.onPurchaseResult(" + ok + "," + jsString(reason) + ");");
    }

    @Override
    public void onPriceReady(String formattedPrice) {
        callJs("window.CubeyBilling && CubeyBilling.onPriceReady(" + jsString(formattedPrice) + ");");
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        if (ads != null) ads.onForeground();
        if (billing != null) billing.restorePurchases();
    }

    @Override
    protected void onPause() {
        if (ads != null) ads.onBackground();
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
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
