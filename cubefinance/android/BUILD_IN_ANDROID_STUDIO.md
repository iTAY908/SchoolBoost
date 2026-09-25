# Building the AAB in Android Studio

This folder is a complete, standalone Android project. Nothing needs to be
generated first — open it and build.

## 1. Open it

Android Studio → **File → Open** → select this folder (the one containing
`settings.gradle`). Do **not** use "Import Project"; this is already a Gradle
project.

On first open Gradle syncs and downloads the Android Gradle Plugin 8.5.2,
Gradle 8.7, and the Play Billing / AdMob libraries. **That needs an internet
connection** and takes a few minutes. `local.properties` is deliberately not
included — Android Studio writes it itself, pointing at your SDK.

Requirements: **JDK 17** (Android Studio bundles a suitable JBR, so normally
you do not have to install anything) and the **Android 34** SDK platform, which
Android Studio offers to install if it is missing.

## 2. Create a signing key

**Build → Generate Signed App Bundle / APK… → Android App Bundle → Next →
Create new…**

Fill in the keystore path, two passwords, an alias, and your details.

> **Back the keystore file up somewhere you will not lose it.**
> Google Play ties the app to this key permanently. If it is lost you can never
> publish an update to this listing again — you would have to ship a new app
> under a new package name and lose your installs and reviews.
>
> Keep it out of git. `*.jks` and `*.keystore` are already in `.gitignore`.

## 3. Build

Same dialog → choose the **release** variant → **Create**.

Android Studio shows a "locate" link when it finishes. The bundle is at:

```
app/build/outputs/bundle/release/app-release.aab
```

That file is what you upload to the Play Console.

## 4. Every later upload

Play rejects a bundle whose `versionCode` has been used before, so raise it
each time. Either edit `app/build.gradle`, or leave the file alone and pass the
values in:

```
./gradlew bundleRelease -PCUBEY_VERSION_CODE=2 -PCUBEY_VERSION_NAME=1.0.1
```

## Things worth knowing

**The whole UI is one file.** `app/src/main/assets/index.html` is the app; the
Java around it is a WebView host plus the Play Billing and AdMob bridges. To
ship a UI change, replace that file — it must stay identical to
`cubefinance/web/cubefinance-web.html`.

**Ads.** Debug builds use Google's official *test* ad unit, release builds use
the live one — `AdController` picks by `BuildConfig.DEBUG`. Never run the live
unit on your own device: Google counts it as invalid traffic and suspends
AdMob accounts for it.

**Billing.** In-app purchases only work for a build installed from Play — an
internal-testing track is enough. They will not work from a local debug
install, so test them after the first upload rather than before.

**The store-review account.** Details are in `../docs/STORE_REVIEW.md`. Its
password belongs in the Play Console's *App access* form, and is deliberately
not in this project.

**Command line instead.** If you would rather not use the IDE:

```
./gradlew bundleRelease            # macOS / Linux
gradlew.bat bundleRelease          # Windows
```

with `CUBEY_KEYSTORE_PATH`, `CUBEY_KEYSTORE_PASSWORD`, `CUBEY_KEY_ALIAS` and
`CUBEY_KEY_PASSWORD` set as environment variables, or in
`~/.gradle/gradle.properties`. `tools/make-keystore.sh` wraps `keytool` if you
want the key created for you.
