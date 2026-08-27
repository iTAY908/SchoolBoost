# CubeFinance → Google Play

The app you liked (`cubefinance/web/cubefinance-web.html`) is packaged here as a
real Android app: `cubefinance/android/`.

It is **not** a shortcut to a website. The entire app is bundled inside the APK
as an asset and runs offline — the WebView is just the canvas.

---

## What the native wrapper adds

| | |
|---|---|
| 🔊 **Sound plays by itself** | The wrapper sets `setMediaPlaybackRequiresUserGesture(false)`, which lifts the browser's autoplay block. The intro soundtrack starts on its own — no "tap for sound" hint, exactly what you wanted. |
| 💾 **Data survives** | DOM storage is on and included in Android backup, so accounts, cubes and balances persist across launches and device restores. |
| 📺 **AdMob interstitials** | One every 6 minutes of foreground time, preloaded so it shows instantly. |
| 👑 **Premium removes ads** | The web app calls `CubeyNative.setPremium(true)` the moment a purchase verifies; the native side then shuts the ad engine down. |
| ⬅️ **Back button** | Goes back inside the app, then exits. |
| 🎨 **No white flash** | Dark splash theme + dark WebView background. |

---

## Build it

### Option A — GitHub Actions ✅ recommended, nothing to install

This is the supported path. A GitHub runner ships the Android SDK and can reach
Google's Maven repo, which a sandboxed or locked-down dev machine often cannot.

1. Create the upload key **once**:
   ```bash
   bash cubefinance/android/tools/make-keystore.sh
   ```
   It prints the exact `KEYSTORE_BASE64` line to copy.
2. Add four repository secrets (*Settings → Secrets and variables → Actions*):
   `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
3. **Actions** tab → *Build Android App Bundle* → **Run workflow**. Optionally
   set `versionCode` / `versionName` there — no file edit needed. Pushing a
   `v1.0.1` tag works too and takes the name from the tag.
4. Download the **`cubefinance-aab`** artifact. That file goes to Play.

The workflow refuses to finish quietly if signing didn't work: it inspects the
bundle for a signature block and fails the run when a keystore was supplied but
no signature came out, rather than letting you find out at upload time. With no
keystore configured at all it still builds, but marks the run with a warning
that the bundle is unsigned.

Artifacts produced: the `.aab` for Play, an `.apk` for sideloading, and
`mapping.txt` for de-obfuscating crash reports.

### Option B — Android Studio

1. Install [Android Studio](https://developer.android.com/studio).
2. **Open** → select `cubefinance/android`. Let it sync (first sync downloads
   the Android Gradle Plugin and SDK — a few minutes).
3. *Build → Generate Signed App Bundle / APK → Android App Bundle*, create or
   pick your key, choose **release**.
4. The bundle lands in `app/build/outputs/bundle/release/app-release.aab`.

### Option C — command line

Needs a JDK 17+ **and** the Android SDK, and the machine must be able to reach
`dl.google.com` (both the SDK downloads and Google's Maven repo live there). On
a machine without them:

```bash
# JDK 17
sudo apt-get update && sudo apt-get install -y openjdk-17-jdk unzip

# Android SDK command-line tools
export ANDROID_SDK_ROOT="$HOME/android-sdk"
mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
curl -o /tmp/cmdline-tools.zip \
  https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q /tmp/cmdline-tools.zip -d "$ANDROID_SDK_ROOT/cmdline-tools"
mv "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

Then:

```bash
cd cubefinance/android
export CUBEY_KEYSTORE_PATH=$HOME/keys/upload-keystore.jks
export CUBEY_KEYSTORE_PASSWORD=...
export CUBEY_KEY_ALIAS=upload
export CUBEY_KEY_PASSWORD=...
./gradlew bundleRelease
```

---

## Create your upload key (once — never lose it)

```bash
bash cubefinance/android/tools/make-keystore.sh
```

The script wraps `keytool`, refuses to overwrite an existing keystore, and
prints the base64 line for the CI secret. Only a JDK is needed — no Android SDK.
By hand it is:

```bash
keytool -genkeypair -v \
  -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```

> **Back this file up.** With Play App Signing you *can* ask Google to reset a
> lost upload key, but it is a slow support process — keep the `.jks` and its
> passwords somewhere safe.

For the CI secret:

```bash
base64 -w0 upload-keystore.jks > keystore.b64   # paste into KEYSTORE_BASE64
```

---

## Updating the app later

The web app is the source of truth. After editing
`cubefinance/web/cubefinance-web.html`:

```bash
cp cubefinance/web/cubefinance-web.html \
   cubefinance/android/app/src/main/assets/index.html
```

(The GitHub Actions workflow does this automatically on every run.)

Then set the new version. Play rejects an upload that reuses a `versionCode`,
so it must increase every single time.

Easiest — pass it to the workflow, no file edit:

*Actions → Run workflow →* `versionCode: 2`, `versionName: 1.0.1`.

Or edit the defaults in `cubefinance/android/app/build.gradle`:

```gradle
versionCode 2          // must increase by at least 1 for EVERY Play upload
versionName "1.0.1"    // what users see
```

Locally the same overrides work as environment variables:

```bash
CUBEY_VERSION_CODE=2 CUBEY_VERSION_NAME=1.0.1 ./gradlew bundleRelease
```

---

## Play Console checklist

1. **Create the app** — Play Console → *Create app*. Package name
   `com.cubefinance.app` (must match `build.gradle`; it can never be changed
   after the first upload).
2. **Upload** the `.aab` to *Testing → Internal testing* first. Install it on
   your own device from the tester link before going to production.
3. **Store listing** — you'll need:
   - App icon **512×512 PNG** (the in-app icon is a vector; Play needs a PNG)
   - Feature graphic **1024×500 PNG**
   - At least **2 phone screenshots** (grab them from the running app)
   - Short description (≤80 chars) and full description
4. **Content rating** questionnaire.
5. **Data safety** — declare honestly:
   - The app stores financial info **on the device only**; no server, no account
     upload.
   - **AdMob collects an advertising ID and device data** — you must declare
     this. Google's own guidance: <https://support.google.com/googleplay/android-developer/answer/10787469>
6. **Ads** — tick *"This app contains ads"*. Not doing so is a policy violation.
7. **Privacy policy URL** — mandatory for any app that shows ads. Host a page
   (GitHub Pages is fine) covering local storage + AdMob.
8. **Target audience** — the app has a kids mode; if you declare a child
   audience you enter the **Families policy** programme, which imposes extra ad
   restrictions. If the app is meant for 13+/adults, say so and keep the kids
   mode framed as parent-supervised (the in-app terms already say this).

---

## Things to fix before you publish

These are real blockers/risks, not nitpicks:

1. **Server-side receipt verification is not wired up.** Real Play Billing is
   implemented (`BillingManager.java`) and Google takes the payment, but the
   entitlement is granted from the client. That is how most small apps ship and
   it is fine to launch with, though a rooted device could spoof it. To harden,
   send `purchaseToken` to your backend and check it against the Play Developer
   API (`purchases.products.get`) before unlocking.
2. **A 6-minute forced interstitial can trigger policy action.** Google wants
   interstitials at natural transition points, not interrupting content on a
   timer. The wrapper already blocks ads during sheets and enforces a 60-second
   minimum gap, but if you get "limited ad serving" warnings, raise
   `INTERVAL_MS` in `AdController.java` or tie ads to screen changes instead.
3. **Consent for EEA/UK/Switzerland users.** You need a Google UMP consent flow
   before serving personalised ads there. Add the
   `com.google.android.ump:user-messaging-platform` dependency and gate
   `MobileAds.initialize()` behind consent.
4. **Debug builds use Google's test ad unit** (`AdController.UNIT_TEST`).
   That's deliberate — requesting your live unit from a dev device is invalid
   traffic and gets AdMob accounts suspended. Never flip that to the real ID for
   testing; register a test device in the AdMob console instead.

---

## Project layout

```
cubefinance/android/
├── settings.gradle · build.gradle · gradle.properties
├── gradlew · gradlew.bat · gradle/wrapper/          ← no local Gradle needed
└── app/
    ├── build.gradle                                 ← IDs, versionCode, signing
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml                      ← AdMob App ID, permissions
        ├── assets/index.html                        ← the whole app
        ├── java/com/cubefinance/app/
        │   ├── MainActivity.java                    ← WebView host
        │   ├── AdController.java                    ← 6-minute interstitial engine
        │   ├── NativeBridge.java                    ← JS ⇄ native
        │   └── CubeApp.java
        └── res/                                     ← icon, splash, themes, backup
```

---

## In-app purchases (real Google Play Billing)

Nothing inside the Android app is a simulation any more: Google's own purchase
sheet takes the payment for both products.

### Create the products (required — nothing works until you do)

Play Console → your app → **Monetise with Play → In-app products → Create**,
once per row. Both are **one-time (non-consumable)** products.

| Product ID | Sells | Price | Status |
|---|---|---|---|
| `premium_upgrade_10` | AI Premium — removes ads, opens the adviser and the AI tools | ₪10 | **Active** |
| `premium_access` | The ₪19 guide book | ₪19 | **Active** |

> A product ID can **never** be changed after creation, and these two strings
> must match `BillingManager.java` and `cubefinance-web.html` exactly.
>
> `premium_access` is the ID for the **book**, not for Premium. The name is
> confusing and was chosen upstream; if you would rather it read
> `guide_book_5000`, change it in both files *before* creating it in the
> console — afterwards it is fixed for the life of the app.

The prices live in Play Console, not in the code. The app asks Google for each
price and displays whatever it returns, so you can change them later without
shipping a new build. The ₪19 in the source is only the browser fallback and
the struck-through "was ₪35" is marketing copy, not a Play price.

### How it behaves

| | |
|---|---|
| Buy Premium | `CubeyNative.buyPremium()` → Google's sheet → payment |
| Buy the book | `CubeyNative.buyBook()` → Google's sheet → payment |
| Consent | The book's purchase button refuses to launch the flow until the terms tick is given; the tick is also re-checked inside the sheet path |
| Unlock | Only after Google confirms `PURCHASED` — the client never self-grants. On success the book is recorded and the reading site opens |
| Restore | On every launch and resume. A restore re-grants silently; it does **not** throw the user into the reader |
| Refund | Play dropping the entitlement revokes it locally too |
| Acknowledge | Automatic, for both products. **Purchases must be acknowledged within 3 days or Google auto-refunds them** — `BillingManager` does this immediately, and never consumes (consuming would let a non-consumable be bought twice) |
| Restore | Ownership is re-queried on every launch and resume, so reinstalls and new devices keep Premium. Settings also has a manual **🔄 שחזור רכישה** |
| Pending payments | Handled (e.g. cash payments) — access opens when the payment completes |
| Already owned | Detected and restored instead of erroring |
| Ads | Owning Premium disables AdMob immediately |
| In a browser | No bridge exists, so the app falls back to the clearly-labelled local simulation |

### Testing purchases without spending money

1. Upload a build to **Internal testing** (billing does not work in a debug build
   installed over USB — the app must come from Play).
2. Play Console → **Setup → License testing** → add your Gmail address.
3. Install from the internal-testing link. Purchases show as *test* and cost
   nothing; you can refund and re-buy freely.

> A non-consumable can only be bought once per account. To test again, refund the
> order in Play Console, or use another test account.
