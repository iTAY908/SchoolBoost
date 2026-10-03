# פרומט לעדכון האפליקציה באנדרואיד סטודיו

מעתיקים את כל מה שבתוך המסגרת ומדביקים ל-Claude בטרמינל של אנדרואיד סטודיו.
לא צריך לשלוח לו שום קובץ, כי הוא מוריד את הקוד בעצמו מ-GitHub.

```
אני עובד על אפליקציית האנדרואיד CubeFinance (com.cubefinance.app). האפליקציה היא WebView
שטוען את הקובץ app/src/main/assets/index.html. תעדכן אותו לגרסה החדשה, שמוסיפה:
- דף אימות מייל: אחרי הרשמה או כניסה נשלח למייל של המשתמש קוד בן 6 ספרות דרך EmailJS,
  והמשתמש מקליד אותו באפליקציה
- קישור "שכחת את הסיסמה?" בדף ההתחברות: קוד למייל ואז בחירת סיסמה חדשה
- משתמשים ותיקים שכבר נרשמו לפני העדכון ועדיין מחוברים: בפתיחה הראשונה אחרי העדכון נפתח להם
  ישר דף אימות למייל שאיתו נרשמו (פעם אחת בלבד, הנתונים שלהם נשמרים)

הקוד המלא והבדוק נמצא ב-GitHub (repo ציבורי). אל תכתוב את הקוד בעצמך — תוריד אותו.

שלב 1 — להוריד את הקובץ לתיקייה זמנית (לא ישר ל-assets):
  כתובת:
  https://raw.githubusercontent.com/iTAY908/SchoolBoost/e9668df14a4811d431f8ae8fcb8ca355e994ad73/cubefinance/web/cubefinance-web.html
  ב-Mac/Linux:   curl -fL -o cubefinance-new.html "<הכתובת>"
  ב-Windows:     curl.exe -fL -o cubefinance-new.html "<הכתובת>"
  (אם curl לא קיים: PowerShell Invoke-WebRequest -Uri "<הכתובת>" -OutFile cubefinance-new.html)

שלב 2 — לוודא שההורדה תקינה:
  - הגודל בערך 520KB (520272 בתים)
  - SHA-256 של הקובץ:
    afacd2eea9ee82a2a9fa522e82aef7f369b4006fb1564dcef5973fadbc99057b
    (Mac/Linux: shasum -a 256 cubefinance-new.html · Windows: certutil -hashfile cubefinance-new.html SHA256)
  - והקובץ מכיל את השורות האלה:
    const EMAILJS = { serviceId: "service_upg7kqp", templateId: "template_7q8srkg", publicKey: "g7STyZwRjLgIMZXrA" };
    const CODE_LEN = 6;
    function renderVerify()
    function renderForgot()
    startVerification(users[email].email, "existing");
  אם משהו לא תואם — עצור ותגיד לי, אל תעתיק.

שלב 3 — לגבות את app/src/main/assets/index.html הישן ל-index.html.bak מחוץ לתיקיית assets,
  ואז להעתיק את cubefinance-new.html על app/src/main/assets/index.html. למחוק את הקובץ הזמני.

שלב 4 — לבדוק את הפרויקט:
  - ב-AndroidManifest.xml יש <uses-permission android:name="android.permission.INTERNET" />
  - ב-MainActivity ה-WebView עם setJavaScriptEnabled(true) ו-setDomStorageEnabled(true)
  אם משהו חסר — תקן ותגיד לי מה תיקנת. אל תשנה שום דבר אחר בפרויקט.

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
3. אם הקוד לא מגיע: ב-EmailJS ← Account ← Security ← לסמן
   "Allow EmailJS API for non-browser applications".
4. ב-Play Console ← App content ← Data safety: לעדכן שכתובת המייל נשלחת לשירות חיצוני לאימות.
