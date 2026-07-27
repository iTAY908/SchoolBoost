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

/**
 * CubeFinance runs as a single self-contained web app bundled in assets/.
 * This activity hosts it in a WebView and adds the two things a web page
 * cannot do on its own: AdMob interstitials and true audio autoplay.
 */
public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private AdController ads;

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

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        if (ads != null) ads.onForeground();
    }

    @Override
    protected void onPause() {
        if (ads != null) ads.onBackground();
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
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
