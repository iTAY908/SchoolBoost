# פרומט: התחברות עם Google באנדרואיד סטודיו

מעתיקים את כל מה שבתוך המסגרת ומדביקים ל-Claude בטרמינל של אנדרואיד סטודיו.

```
אני עובד על אפליקציית האנדרואיד CubeFinance (WebView שטוען את app/src/main/assets/index.html,
applicationId = cube.Finance). תוסיף לה "המשך עם Google" — התחברות והרשמה עם חשבון Google.
גוגל חוסמת התחברות בתוך WebView, ולכן ההתחברות נעשית בקוד אנדרואיד (Credential Manager)
והתוצאה נשלחת לדף דרך הגשר של ה-WebView. הדף והקוד כבר כתובים ובדוקים ב-GitHub (repo ציבורי).
אל תכתוב אותם מחדש — תוריד אותם.

שלב 1 — להוריד שני קבצים לתיקייה זמנית ולבדוק אותם:
  בסיס הכתובת: https://raw.githubusercontent.com/iTAY908/SchoolBoost/03a0bdee1ee76537a1e0e92e5d18133b6f89163b/
  א. cubefinance/web/cubefinance-web.html
     גודל 525051 בתים · SHA-256 e531b984a42ab2332eef29a2e32ef9eee347bfe8b9ac237e78200b328f0a0c96
     חייב להכיל: window.CubeyAuth = {   ·   nativeApp.googleSignIn   ·   const EMAILJS = {
  ב. cubefinance/android/app/src/main/java/com/cubefinance/app/GoogleSignInHelper.java
     גודל 4794 בתים · SHA-256 be148c0efcd81a96af5eda3b67475daa411c6a74356e8734986a09dce25a2e31
     חייב להכיל: 1077092568958-32v58kcpofd06b8n2p95hhdsbva9telf.apps.googleusercontent.com
  להוריד עם curl.exe -fL -o <שם> "<בסיס+נתיב>" (ב-Mac/Linux: curl -fL). ב-Windows לבדוק hash עם
  certutil -hashfile <קובץ> SHA256. אם משהו לא תואם — עצור ותגיד לי.

שלב 2 — הדף: לגבות את app/src/main/assets/index.html ל-index.html.bak מחוץ ל-assets, ולהעתיק
  את cubefinance-web.html במקומו. לא לשנות בו כלום.

שלב 3 — קוד אנדרואיד (להתאים לפרויקט שלי, לא להעתיק נתיבים בעיוורון):
  א. למצוא את התיקייה של MainActivity.java ולשים שם את GoogleSignInHelper.java.
     לשנות רק את שורת ה-package הראשונה שלו כך שתתאים ל-package של MainActivity.
  ב. ב-app/build.gradle, בתוך dependencies, להוסיף:
       implementation 'androidx.credentials:credentials:1.3.0'
       implementation 'androidx.credentials:credentials-play-services-auth:1.3.0'
       implementation 'com.google.android.libraries.identity.googleid:googleid:1.1.1'
     (נדרש compileSdk 34 ומעלה — אם נמוך יותר, להעלות ל-34 ולהגיד לי.)
  ג. למצוא את המחלקה שנרשמת ל-WebView בשם "CubeyNative" (addJavascriptInterface(..., "CubeyNative"))
     ולהוסיף לה מתודה:
       @JavascriptInterface
       public void googleSignIn() { activity.startGoogleSignIn(); }
     (להשתמש בשם המשתנה שמחזיק שם את ה-Activity.)
  ד. ב-MainActivity להוסיף:
       private GoogleSignInHelper google;
       public void startGoogleSignIn() {
           runOnUiThread(() -> {
               if (google == null) google = new GoogleSignInHelper(this);
               google.signIn((ok, email, name, error) -> {
                   String js = "window.CubeyAuth && CubeyAuth.onGoogleResult(" + ok + ","
                           + q(email) + "," + q(name) + "," + q(error) + ")";
                   webView.evaluateJavascript(js, null);
               });
           });
       }
       private static String q(String v) {
           if (v == null) return "null";
           return "\"" + v.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ") + "\"";
       }
     (אם כבר יש פונקציה דומה ל-q או שה-WebView נקרא אחרת — להשתמש במה שקיים.)
  ה. ב-app/proguard-rules.pro להוסיף בסוף:
       -if class androidx.credentials.CredentialManager
       -keep class androidx.credentials.playservices.** {
         *;
       }
     ולוודא שקיימים גם: -keepattributes *Annotation*  ו-
       -keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }

שלב 4 — לבדוק שהפרויקט מתקמפל: gradlew.bat assembleDebug (ב-Mac/Linux: ./gradlew assembleDebug).
  אם יש שגיאת קומפילציה — לתקן ולהסביר לי מה תוקן.

שלב 5 — להעלות versionCode ב-1 מהגרסה האחרונה שהועלתה לגוגל פליי (אם לא ידוע — לשאול אותי),
  ו-versionName בהתאם. לא לבנות release — אני אבנה דרך Build → Generate Signed App Bundle.

חשוב:
  - לא לשנות שום דבר אחר בפרויקט, ולא בתוך index.html.
  - ה-Client ID ציבורי ומותר שיהיה בקוד. אסור להכניס לפרויקט Client secret, סיסמאות, keystore או .env.
  - בסוף: סיכום קצר של מה שונה ומה הצעד הבא שלי.
```

## אחרי הבנייה
1. Build ← Generate Signed App Bundle ← מעלים לבדיקה הפנימית בגוגל פליי.
2. מתקינים **מהחנות** (לא מאנדרואיד סטודיו) ולוחצים "המשך עם Google".
   - גרסה שהותקנה מגוגל פליי חתומה במפתח של גוגל, וזה מתאים ל-SHA-1 של "App signing key" שהוכנס ל-Google Cloud.
   - גרסה שהותקנה ישירות מאנדרואיד סטודיו (debug) חתומה במפתח אחר, ואצלה Google יחזיר שגיאה.
     כדי שגם היא תעבוד, צריך מפתח Android נוסף ב-Google Cloud עם ה-SHA-1 של ה-debug
     (`gradlew signingReport` מראה אותו).
3. אם מופיעה "ההתחברות עם Google לא הצליחה": לבדוק ב-Google Cloud ← Clients שיש מפתח Android עם
   package `cube.Finance` וה-SHA-1 הנכון, ושב-Audience כתוב "In production".
