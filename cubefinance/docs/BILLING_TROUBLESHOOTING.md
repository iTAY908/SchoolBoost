# When a purchase does nothing

## What was actually broken (fixed in this change)

`app/proguard-rules.pro` contained:

```
-keepattributes JavascriptInterface
```

That line does nothing. `-keepattributes` takes **class-file attribute** names —
`Signature`, `InnerClasses`, `*Annotation*`, `RuntimeVisibleAnnotations` —
and `JavascriptInterface` is an **annotation type**, not an attribute. R8
ignored it and stripped the annotations with everything else it was not told to
keep.

From API 17 onward, WebView exposes a bridge method **only** if it still carries
`@JavascriptInterface` at runtime. With the annotations gone:

* `window.CubeyNative` still exists, so the page believes it is inside the app;
* every method on it is `undefined`;
* `nativeBilling.available()` sees no `buyPremium` and decides it is running in
  a browser;
* the page falls back to the **local purchase simulation** — no Google sheet,
  no charge, nothing to acknowledge.

It only affects builds with `minifyEnabled true`, which is release — so it works
in debug and fails on the track you upload. Reproduced here by injecting an
empty `CubeyNative`, which is exactly what the page sees.

Three things changed:

1. The rules now keep `*Annotation*` and every `@JavascriptInterface` method.
2. `MainActivity.onPageFinished` asks the page which bridge methods it can see
   and logs the answer, so this class of failure announces itself instead of
   degrading quietly.
3. Inside the app the page no longer falls back to the simulation. If the
   bridge is not callable it says so, because a fake sheet that charges nobody
   looks like a working purchase.

**You need a new build for this.** Raise `versionCode` to 5 and upload again —
Play rejects a repeat of 4.

## Reading the logs

Everything uses one tag:

```bash
adb logcat -s CubeyBilling
```

A healthy launch looks like:

```
CubeyBilling: start(): package=com.cubefinance.app products=[coins_100, premium_access]
CubeyBilling: JS bridge check: buyPremium=function buyBook=function …
CubeyBilling: onBillingSetupFinished: OK —
CubeyBilling: products returned by Play: 2
CubeyBilling:   ✓ coins_100 = ₪10.00
CubeyBilling:   ✓ premium_access = ₪19.00
```

If the bridge line says `buyPremium=undefined`, the ProGuard problem is back.
If a product shows `✗`, Play is not offering it to this build/account.

Pressing buy logs the whole attempt, ending in `launchBillingFlow -> OK` or a
named failure. Failures now also raise a native toast, so a tester can report
what they saw without a cable.

## If it still fails after rebuilding

The response name in the log tells you which of these it is.

| Response | What it actually means |
|---|---|
| `ITEM_UNAVAILABLE` | Play will not sell this product **to this account, from this build**. The id is right (both are verified byte-for-byte against Play Console), so look at the build and the tester instead — see below. |
| `BILLING_UNAVAILABLE` | The Play Store account cannot transact: signed out, unsupported country, or a Play Store that needs updating. |
| `DEVELOPER_ERROR` | The request did not match the uploaded build — usually `applicationId` or the signing key. |
| `SERVICE_UNAVAILABLE` / `NETWORK_ERROR` | No usable connection to Play. |
| `FEATURE_NOT_SUPPORTED` | This Play Store version cannot do it. |

Things that are true of billing regardless of the code, and catch people out:

* **The app must be installed from a Play track**, through the internal-testing
  opt-in link. A sideloaded APK — including one Android Studio pushed to the
  device — cannot buy anything, even when the products are live.
* **The Google account on the device must be on the testers list**, and should
  be added under *Setup → License testing* so purchases are free and refund
  automatically.
* **The signing key and `applicationId` must match the uploaded build.** A debug
  build has `applicationIdSuffix ".debug"`, so it is a different app to Play and
  will never see these products.
* **A newly created product can take a few hours** to become buyable, even when
  the console already shows it Active.
* Propagation of a **newly uploaded build** to the track takes time too; buying
  against an older installed version fails in confusing ways.

## The two product IDs

| Product ID | Sells | Type |
|---|---|---|
| `coins_100` | AI Premium | one-time, non-consumable |
| `premium_access` | The guide book | one-time, non-consumable |

Both names read backwards on purpose (they were specified that way). Neither is
a coin pack, and neither is consumable — **never** "fix" `coins_100` by
consuming it, or the same user can buy it again and loses the entitlement.
