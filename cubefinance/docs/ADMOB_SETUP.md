# AdMob — interstitial every 6 minutes

Interstitial ads for the CubeFinance React Native (Expo) client, with the launch
intro animation and a foreground-aware 6-minute timer.

> **AdMob is native-only.** It cannot run in `cubefinance/web/cubefinance-web.html`
> — that's a web page, and the Google Mobile Ads SDK has no web build. Ads work in
> the React Native app in `cubefinance/app/`. If you want to monetise the web
> version, that's AdSense, which is a different product and account.

---

## 1. Credentials in use

| Item | Value |
|---|---|
| App ID | `ca-app-pub-8901066122989701~1639827795` |
| Interstitial unit | `ca-app-pub-8901066122989701/4541323300` |

The App ID lives in `app.json` (config plugin). The unit ID lives in
`src/ads/adConfig.ts`.

**Development builds automatically use Google's test unit instead of your real
one.** Requesting or tapping your live unit from a dev device counts as invalid
traffic and is the fastest route to a suspended AdMob account. The real unit is
only requested when `__DEV__ === false` (release builds).

---

## 2. Install

```bash
cd cubefinance/app
npx expo install react-native-google-mobile-ads expo-linear-gradient
```

Both are already declared in `package.json`:

```json
"react-native-google-mobile-ads": "^14.7.2",
"expo-linear-gradient": "~13.0.2"
```

### You need a development build — Expo Go will not work

The ads SDK contains native code, so it cannot run inside Expo Go.

```bash
npx expo install expo-dev-client
npx expo prebuild --clean          # generates android/ and ios/
npx expo run:android               # or: npx expo run:ios
```

From then on use `npx expo start --dev-client`.

### Bare React Native (no Expo prebuild)

`app.json`'s plugin block writes these for you. If you manage native projects by
hand, add them yourself:

**`android/app/src/main/AndroidManifest.xml`** — inside `<application>`:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-8901066122989701~1639827795"/>
```

**`ios/<App>/Info.plist`:**

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-8901066122989701~1639827795</string>
<key>SKAdNetworkItems</key>
<array>
  <dict><key>SKAdNetworkIdentifier</key><string>cstr6suwn9.skadnetwork</string></dict>
</array>
```

Missing the Android `meta-data` entry crashes the app on launch — that is the
single most common AdMob setup mistake.

---

## 3. Files added

```
cubefinance/app/
├── App.tsx                                  ← intro + ad engine wired in
├── app.json                                 ← AdMob config plugin, app IDs
└── src/
    ├── ads/
    │   ├── adConfig.ts                      ← IDs, 6-minute interval, backoff
    │   ├── AdManager.ts                     ← preload · timer · lifecycle
    │   └── useInterstitialTimer.ts          ← the hook you mount once
    └── components/intro/
        └── IntroAnimation.tsx               ← jar → shatter → poof → dashboard
```

---

## 4. How the timer behaves

`AdManager` counts **foreground time only**, using timestamps plus a single
`setTimeout` (no per-second ticking, no drift, nothing running while the app is
asleep).

| Situation | Behaviour |
|---|---|
| 6 minutes of use elapse | Interstitial shows instantly (it was preloaded) |
| App sent to the background | Elapsed slice is banked, timer cleared — **never shows while backgrounded** |
| App returns to the foreground | Resumes with **only the remainder**; time spent away never counts |
| Ad is closed | Countdown resets to a full 6 minutes, next ad preloads immediately |
| Ad not loaded when due | Doesn't stall the user — retries in 15s, keeps the slot |
| Load fails (no fill/offline) | Backs off 5s → 15s → 30s → 60s and retries |
| User is premium | `setEnabled(false)` — no SDK calls, no timer, no ads |
| Onboarding / modal / typing | `setBlocked(true)` defers; shows ~2s after unblocking |

Verified with a simulated-lifecycle suite (6 minutes compressed to 600 ms):
**14/14 checks passing** across all of the above.

---

## 5. Usage

Already wired in `App.tsx`. Mount the hook **once**, at the root:

```tsx
const inOnboarding = !!authUser && hydrated && !onboarded;

useInterstitialTimer({
  enabled: !isPremium,                                  // premium → no ads
  blocked: !introDone || !authUser || inOnboarding,     // don't interrupt a flow
});
```

Block ads around any other sensitive moment:

```ts
import adManager from './src/ads/AdManager';

adManager.setBlocked(true);   // opening a sheet / focusing an input
adManager.setBlocked(false);  // closed again
adManager.msUntilNextAd();    // ms remaining, handy for debugging
```

Turn ads off the moment the 110 ₪ purchase verifies:

```ts
adManager.setEnabled(false);
```

---

## 6. Before you ship

1. **Link the app in the AdMob console** (App ID above) and keep the package name
   `com.cubefinance.app` consistent with `app.json` and the Play listing.
2. **Consent / privacy.** For users in the EEA, UK and Switzerland you must show a
   consent form (Google UMP: `react-native-google-mobile-ads/lib/module/ump`) and
   pass `requestNonPersonalizedAdsOnly: true` until consent is granted.
   `AD_REQUEST_OPTIONS` in `adConfig.ts` is where that flag lives. Also complete
   the Play Console **Data safety** form.
3. **Test with test ads only** until release. Add your device as a test device in
   the AdMob console for release-build testing.
4. **App-ads.txt** — publish one on your developer site to protect the inventory.

### One caution about the 6-minute cadence

A timer that interrupts on a fixed schedule can land in the middle of what the
user is doing. Google's interstitial policy asks for ads at *natural transition
points*, and forced ads over content are a common reason for policy strikes or
limited ad serving. The implementation already softens this — `setBlocked()`
keeps ads out of onboarding, the intro and modals, and a 60-second minimum gap
prevents bursts. If you see policy warnings, the usual fix is to also trigger on
screen transitions rather than purely on elapsed time. The 6-minute interval is a
single constant (`AD_INTERVAL_MS`) if you want to relax it.

---

## 7. Porting to other stacks

The `AdManager` logic (preload, foreground-only countdown, pause/resume, reset on
close) is plain TypeScript with two dependencies: `AppState` and the ads SDK.

* **Flutter** — swap in `google_mobile_ads`, and replace `AppState` with
  `WidgetsBindingObserver.didChangeAppLifecycleState`
  (`AppLifecycleState.resumed` / `.paused`).
* **Native Android** — use `InterstitialAd.load(...)` plus
  `ProcessLifecycleOwner` (`ON_START` / `ON_STOP`) for the same pause/resume
  points.

Say the word and I'll port it.
