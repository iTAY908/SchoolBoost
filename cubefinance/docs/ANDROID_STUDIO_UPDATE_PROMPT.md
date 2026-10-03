# פרומט לעדכון האפליקציה באנדרואיד סטודיו

מעתיקים את כל מה שבתוך המסגרת ומדביקים ל-Claude בטרמינל של אנדרואיד סטודיו.

```
אני עובד על אפליקציית האנדרואיד CubeFinance (com.cubefinance.app). האפליקציה היא WebView
שטוען את הקובץ app/src/main/assets/index.html. תעדכן לי את הפרויקט לגרסה החדשה, שכוללת:
- הצ׳אט עם Cubey וספרי ההדרכה חינמיים לכולם (בלי תשלום)
- אימות מייל: אחרי הרשמה/כניסה נשלח למייל קוד בן 6 ספרות דרך EmailJS

שלב 1 — להביא את הקובץ החדש של האפליקציה (לפי הסדר, הראשון שעובד):
  א. אם התיקייה היא git clone של github.com/iTAY908/SchoolBoost:
       git fetch origin claude/cubefinance-app-architecture-foyzt8
       git checkout origin/claude/cubefinance-app-architecture-foyzt8 -- cubefinance/web/cubefinance-web.html
     והקובץ החדש הוא cubefinance/web/cubefinance-web.html
  ב. אחרת: חפש קובץ בשם cubefinance-web.html שהורדתי (בתיקיית ההורדות Downloads או בתיקיית הפרויקט).
     אם יש כמה — קח את החדש ביותר. אם לא מצאת — עצור ותשאל אותי איפה הוא.

שלב 2 — לוודא שזה הקובץ הנכון לפני שמעתיקים. הקובץ חייב להכיל את כל השורות האלה:
  const EMAILJS = { serviceId: "service_upg7kqp", templateId: "template_7q8srkg", publicKey: "g7STyZwRjLgIMZXrA" };
  const FREE_ACCESS = true;
  const CODE_LEN = 6;
  אם אחת חסרה — עצור ותגיד לי, זה קובץ ישן.

שלב 3 — להעתיק אותו על app/src/main/assets/index.html (לגבות קודם את הישן ל-index.html.bak מחוץ ל-assets).

שלב 4 — לבדוק את הפרויקט:
  - ב-AndroidManifest.xml יש <uses-permission android:name="android.permission.INTERNET" />
  - ב-MainActivity ה-WebView עם setJavaScriptEnabled(true) ו-setDomStorageEnabled(true)
  - ב-proguard-rules.pro יש -keepattributes *Annotation* ושמירה על מתודות @android.webkit.JavascriptInterface
  אם משהו חסר — תקן ותגיד לי מה תיקנת.

שלב 5 — להעלות גרסה: ב-app/build.gradle להעלות את versionCode ב-1 מעל הגרסה האחרונה שהועלתה
  לגוגל פליי (אם אתה לא יודע מה הייתה — שאל אותי), ואת versionName ל-1.0.5.

שלב 6 — לבנות: ./gradlew clean bundleRelease  (ב-Windows: gradlew.bat clean bundleRelease)
  ותגיד לי איפה נוצר קובץ ה-.aab. אם החתימה (keystore) לא מוגדרת — אל תמציא סיסמאות ואל
  תיצור keystore חדש; עצור ותסביר לי מה חסר.

חשוב:
  - אל תשנה שום דבר בתוך index.html חוץ מההעתקה.
  - שלושת קודי ה-EmailJS ציבוריים ומותר שיהיו בקוד. אל תכניס לפרויקט סיסמאות, keystore או קובצי .env.
  - בסוף תן לי סיכום קצר: מה שונה, איפה ה-.aab, ומה הצעד הבא שלי.
```

## אחרי הבנייה
1. Google Play Console ← בדיקה פנימית (Internal testing) ← גרסה חדשה ← מעלים את ה-.aab.
2. מתקינים מהחנות ונרשמים עם מייל אמיתי. הקוד אמור להגיע תוך דקה (לבדוק גם בספאם).
3. אם הקוד לא מגיע באפליקציה אבל כן הגיע ב-email-test.html: ב-EmailJS ← Account ← Security
   ← לסמן "Allow EmailJS API for non-browser applications".
4. ב-Play Console ← App content ← Data safety: לעדכן שכתובת המייל נשלחת לשירות חיצוני לאימות.
