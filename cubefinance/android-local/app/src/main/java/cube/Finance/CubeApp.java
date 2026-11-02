package cube.Finance;

import android.app.Application;
import android.webkit.WebView;

import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;

import java.util.Collections;

public class CubeApp extends Application {

    private AppOpenAdManager appOpenAdManager;
    private EntitlementManager entitlements;

    @Override
    public void onCreate() {
        super.onCreate();
        if (BuildConfig.DEBUG) {
            // Lets you inspect the running app from chrome://inspect
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // The Mobile Ads SDK is initialized exactly once, here, for every ad
        // surface in the app (interstitial + App Open). Doing it at the
        // Application level -- before any Activity exists -- lets the App
        // Open ad start preloading as early as physically possible, which is
        // the whole point of the format (it needs to be ready by the time the
        // very first foreground moment happens).
        MobileAds.setRequestConfiguration(
                new RequestConfiguration.Builder()
                        .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG)
                        .setTestDeviceIds(Collections.emptyList())
                        .build());
        // Initialisation touches disk/network -- keep it off the main thread.
        new Thread(() -> MobileAds.initialize(this, status -> { })).start();
        // Registering doesn't need to wait for init: AppOpenAd.load() is safe
        // to call before initialize() finishes -- the SDK queues it -- so the
        // manager starts watching for foreground events immediately.
        appOpenAdManager = new AppOpenAdManager(this);
        // The ad gate, from the first frame: App Open stays off until the
        // entitlement is known, so an AI Premium purchaser never sees one.
        entitlements = new EntitlementManager(this);
        entitlements.addAdsListener(appOpenAdManager::setEnabled);
    }

    AppOpenAdManager getAppOpenAdManager() {
        return appOpenAdManager;
    }

    EntitlementManager getEntitlements() {
        return entitlements;
    }
}
