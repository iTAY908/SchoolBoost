# פרומפט: תיקון קוד האימות במייל (לטרמינל של Claude באנדרואיד סטודיו)

מעתיקים את כל מה שבתוך המסגרת ומדביקים ל-Claude בטרמינל של אנדרואיד סטודיו.

```
אני עובד על אפליקציית CubeFinance (applicationId = cube.Finance). זו WebView שטוענת את
app/src/main/assets/index.html. יש תיקון בדוק לקוד האימות במייל, ואתה צריך לשלב אותו בגרסה שלי ולבנות.
אל תכתוב את הקוד מחדש, אלא תמזג אותו לפי השלבים. אל תשנה שום דבר אחר באפליקציה.

הבעיה: האפליקציה מייצרת ובודקת את הקוד בטלפון ושולחת אותו ישירות ל-EmailJS. כשהשליחה נכשלת
המסך עדיין כותב "שלחנו קוד", מציג "שליחת המייל נכשלה" ו"הקוד פג תוקף", והמשתמש נתקע.
התיקון: הקוד נוצר, נשלח ונבדק רק בשרת (Supabase Edge Function בשם cf-auth). המסך מציג שליחה,
הצלחה רק אחרי שהשרת אישר שספק המייל קיבל את ההודעה, וכישלון עם הודעה בעברית וכפתור "נסו שוב".
אפשר לתקן כתובת מייל שגויה, ו"הקוד פג תוקף" מופיע רק לקוד שבאמת נשלח.

שלב 1, גיבוי: להעתיק את app/src/main/assets/index.html אל index.html.bak-verify בשורש הפרויקט
(מחוץ ל-assets). אם הפרויקט ב-git, לבצע commit של המצב הנוכחי לפני שמתחילים.

שלב 2, להוריד שני קבצים לתיקייה זמנית ולבדוק אותם (Windows: curl.exe -fL -o <קובץ> "<כתובת>",
ואת ה-hash לבדוק עם certutil -hashfile <קובץ> SHA256). בסיס הכתובת:
  https://raw.githubusercontent.com/iTAY908/SchoolBoost/
  א. base.html ← 90ffa5e7a61b2a4cd90a576ad7ffe5ff6bd45205/cubefinance/web/cubefinance-web.html
     654705 בתים · SHA-256 מתחיל ב-d8704349d5aa6723   (הגרסה שלפני התיקון)
  ב. new.html  ← 525ff73e5aa280d0ecfd03c5b72172b46b2ea94f/cubefinance/web/cubefinance-web.html
     662853 בתים · SHA-256 מתחיל ב-b543b53b147fcd64   (הגרסה עם התיקון)
  אם משהו לא תואם, לעצור ולהגיד לי.

שלב 3, מיזוג תלת-כיווני, כדי שכל מה שהשתנה אצלי מאז יישמר:
  git merge-file -p app/src/main/assets/index.html base.html new.html > merged.html
  (git merge-file עובד גם בלי שהפרויקט ב-git.)
  אם יש קונפליקטים (<<<<<<< / >>>>>>>), לפתור אותם ככה:
  - הפונקציות authCall, sendErrorText, requestCode, startVerification, renameLocalAccount,
    changeVerifyEmail, submitCode ו-renderVerify, וגם ה-CSS של .otpsending/.otpspin/.otpfail/.otpinfo/.otpedit,
    נלקחות מ-new.html במלואן.
  - כל השאר נשאר כמו אצלי.
  - אם אצלי כבר יש סנכרון חשבון לשרת (cf3_pull / "cubefinance_web:sb:" / cloudAdopt): ב-submitCode
    לשלוח verify בלי session:false ועם device_id/device_name/platform, ואחרי הצלחה להמשיך בלוגיקת
    הסנכרון הקיימת שלי. ב-device_limit להשתמש במסך המכשירים הקיים שלי. כל שאר ההתנהגות (מצבי המסך,
    השגיאות, מניעת שליחה כפולה ותיקון המייל) נלקחת מ-new.html.
  בסוף: אסור שיישארו סימני קונפליקט, ואסור שיישאר ב-requestCode שימוש ב-sendViaEmailJS או בקוד
  שנוצר בטלפון (randomCode). להעתיק את merged.html אל app/src/main/assets/index.html.

שלב 4, בדיקות על הקובץ:
  - חייב להכיל: async function authCall(   ·   function changeVerifyEmail(   ·   .otpsending
                "/functions/v1/cf-auth"   ·   session: false   (אלא אם נשאר סנכרון לפי שלב 3)
  - אסור שיכיל: <<<<<<<   ·   await sendViaEmailJS(email, code)   ·   vf.mailedCode
  - להריץ: node -e "const s=require('fs').readFileSync('app/src/main/assets/index.html','utf8');
    for (const m of s.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]); console.log('JS OK')"

שלב 5, גרסה: לקרוא את versionCode ואת versionName ב-app/build.gradle (גם ערכי ברירת המחדל של
CUBEY_VERSION_CODE). versionCode חייב להיות גבוה מה-versionCode הכי גבוה שהועלה אי פעם ל-Play Console.
שאל אותי מה המספר הגבוה ביותר שמופיע ב-Play Console ← App bundle explorer, וקבע את הבא אחריו.
versionName = "<versionCode>.0". אל תנחש. אם לא עניתי, תשאיר הערה ברורה בסיכום.

שלב 6, בנייה ובדיקות (Windows: gradlew.bat):
  ./gradlew testDebugUnitTest          (בדיקות היחידה הקיימות, למשל EntitlementResolverTest)
  ./gradlew assembleDebug              → app/build/outputs/apk/debug/
  ./gradlew bundleRelease              → app/build/outputs/bundle/release/app-release.aab
  את ה-release לבנות רק אם החתימה כבר מוגדרת (CUBEY_KEYSTORE_PATH, CUBEY_KEYSTORE_PASSWORD,
  CUBEY_KEY_ALIAS, CUBEY_KEY_PASSWORD במשתני סביבה או ב-~/.gradle/gradle.properties). אסור ליצור
  keystore חדש, אסור להדפיס סיסמאות, ואסור להוסיף אותן ל-git. אם החתימה חסרה, לעצור ולהגיד לי
  שאבנה דרך Build ← Generate Signed App Bundle עם מפתח ההעלאה הקיים.
  כדאי לדעת: ה-debug APK חתום במפתח אחר משל הגרסה מגוגל פליי. לכן לא מתקינים אותו על טלפון שיש בו
  את האפליקציה מהחנות. אסור להציע להסיר את האפליקציה הקיימת, כי זה מוחק את הנתונים שבטלפון.
  את ה-debug בודקים על אמולטור או על טלפון אחר, ואת הטלפון הרגיל מעדכנים דרך מסלול הבדיקה הפנימית.

שלב 7: לא להעלות לגוגל פליי. בסוף לכתוב לי:
  - אילו קבצים שונו, והאם היו קונפליקטים ואיך נפתרו.
  - versionCode ו-versionName החדשים.
  - הנתיבים המלאים של ה-APK ושל ה-AAB.
  - תוצאות הבדיקות.
```

## מה אתה עושה בעצמך (בלי זה הגרסה החדשה לא תוכל לשלוח קודים)

1. **EmailJS** (https://dashboard.emailjs.com):
   - ב-Account ← Security: מסמנים **Allow EmailJS API for non-browser applications** ושומרים.
   - ב-Account ← API keys: מעתיקים את ה-**Private Key**. לא שולחים אותו בצ׳אט.
2. **Supabase** (https://supabase.com/dashboard/project/sfrkenhauekqdijtunpg):
   - ב-SQL Editor: מדביקים את כל `cubefinance/supabase/live/account_sync.sql` (הגרסה העדכנית) ולוחצים Run.
   - ב-Edge Functions: יוצרים פונקציה בשם `cf-auth` (או פותחים את הקיימת), מדביקים את כל `cubefinance/supabase/live/functions/cf-auth/index.ts` ולוחצים Deploy.
   - בהגדרות הפונקציה: מכבים **Verify JWT**.
   - ב-Edge Functions ← Secrets: מוסיפים `EMAILJS_PRIVATE_KEY` עם ה-Private Key מ-EmailJS.
3. **בדיקה:** פותחים את דף הבדיקה ועוברים על שלושת השלבים (בודקים שהשירות קיים, שולחים קוד לכתובת שלך ומאמתים אותו):
   https://cubefinance-git-claude-cubefinance-app-architect-5272e3-75-a4b1.vercel.app/auth-check
