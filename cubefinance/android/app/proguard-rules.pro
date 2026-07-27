# Keep the JS bridge — it is called by name from the bundled web app.
-keepclassmembers class com.cubefinance.app.NativeBridge {
   public *;
}
-keepattributes JavascriptInterface
