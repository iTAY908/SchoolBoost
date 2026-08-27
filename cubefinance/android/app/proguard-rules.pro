# ---------------------------------------------------------------------------
# The JavaScript bridge.
#
# This file previously said:
#
#     -keepattributes JavascriptInterface
#
# which does nothing. -keepattributes takes CLASS FILE ATTRIBUTE names
# (Signature, InnerClasses, *Annotation*, RuntimeVisibleAnnotations…).
# JavascriptInterface is an annotation TYPE, not an attribute, so R8 silently
# ignored the line and stripped the annotations along with the rest.
#
# That breaks release builds only, which is why it survived debug testing:
# from API 17 onward WebView exposes a bridge method ONLY if it still carries
# @JavascriptInterface at runtime. With the annotations gone, window.CubeyNative
# exists but has no callable methods, so nativeBilling.available() sees no
# buyPremium, decides it is not running inside the app, and quietly falls back
# to the browser purchase simulation — no Google sheet, no real charge.
#
# Keep the annotations, and keep every annotated method wherever it lives.
# ---------------------------------------------------------------------------
-keepattributes *Annotation*
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the bridge class itself and its members by name. The web app calls these
# methods by their literal names, so they must not be renamed or removed.
-keep class com.cubefinance.app.NativeBridge { *; }

# The activity is reached from the bridge; keep the methods it calls back into.
-keepclassmembers class com.cubefinance.app.MainActivity {
    public *;
}

# ---------------------------------------------------------------------------
# Google Play Billing ships its own consumer rules inside the AAR, so it needs
# nothing here. These two only make failures readable in a Play Console crash
# report or a logcat capture from a release build.
# ---------------------------------------------------------------------------
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
