package com.cubefinance.app;

import android.app.Application;
import android.webkit.WebView;

public class CubeApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        if (BuildConfig.DEBUG) {
            // Lets you inspect the running app from chrome://inspect
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }
}
