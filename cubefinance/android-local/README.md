# CubeFinance — the Android Studio project (current)

This folder mirrors the project that is actually built and shipped to Google
Play (`applicationId cube.Finance`). It was synced from Android Studio on
2026-10-04 and is the base for all further work.

- The page the WebView loads lives at `../web/cubefinance-web.html`
  (copied into `app/src/main/assets/index.html` in Android Studio).
- `../android/` is the older `com.cubefinance.app` wrapper, kept for history
  only — do not build or edit it.
- Signing values come from environment variables / `~/.gradle/gradle.properties`
  and are never committed.
