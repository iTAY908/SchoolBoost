# פרומפט: חשבון שנשמר בשרת, 2 מכשירים, קוד במייל בכל כניסה

מעתיקים את כל מה שבתוך המסגרת ומדביקים ל-Claude בטרמינל של אנדרואיד סטודיו.
אחרי שהוא מסיים, עושים את "מה שאתה עושה בעצמך ב-Supabase וב-EmailJS" שבסוף הקובץ.

```
אני עובד על אפליקציית האנדרואיד CubeFinance (applicationId = cube.Finance). זו WebView שטוענת את
app/src/main/assets/index.html, עם קוד Java בתיקייה של MainActivity (NativeBridge נרשם בשם "CubeyNative",
BillingManager, EntitlementManager). כרגע כל הנתונים של המשתמש נשמרים רק בטלפון (localStorage), ולכן
מחיקת האפליקציה מוחקת הכול. תבנה את מה שמתואר כאן, בדיוק לפי ההתנהגות שמתוארת. תקרא קודם את הקוד הקיים
(הרשמה, כניסה, כניסה עם Google, renderVerify / requestCode / submitCode, saveState / loadState, enterApp,
logout, wipeAccount, CubeyBilling, applyBookOwnership, complimentaryCheck) ותשתלב בו. אל תכתוב מחדש מה שעובד.

=== מה המשתמש צריך לחוות ===
1. מחק את האפליקציה בלי "יציאה" ובלי "מחיקת חשבון": החשבון והנתונים לא נמחקים מהשרת. אחרי התקנה מחדש
   הוא מגיע למסך ההתחברות (לא מחובר אוטומטית). נכנס עם Google או עם מייל וסיסמה, מגיע לדף אימות המייל,
   מקליד את הקוד, ונכנס ישר לדף הבית עם כל מה שהזין: קוביות, יתרות, הוצאות, פרופיל, וגם הרכישות
   (צ׳אט ה-AI וספר ההדרכה).
2. אותו מייל בטלפון שני: אחרי קוד במייל הוא רואה בדיוק אותם נתונים (אם בטלפון הראשון יש 2,777 ₪, גם בשני
   2,777 ₪), ואם קנה בטלפון הראשון את צ׳אט ה-AI בגוגל פליי, בטלפון השני הצ׳אט פתוח בלי לשלם שוב.
   שינוי בטלפון אחד מגיע לשני (סנכרון).
3. עד 2 מכשירים לחשבון. טלפון שלישי מקבל מסך: "החשבון כבר מחובר ב-2 מכשירים", עם רשימת המכשירים (שם + מתי
   היה פעיל לאחרונה) וכפתור "להוציא את המכשיר הזה ולהיכנס כאן" ליד כל אחד, ו"ביטול". אותו טלפון שנכנס שוב
   (גם אחרי התקנה מחדש) לא תופס מקום נוסף.
4. כל כניסה (מייל+סיסמה, Google, הרשמה, שכחתי סיסמה) עוברת דרך דף אימות המייל עם קוד בן 6 ספרות. בלי הקוד
   אין כניסה, כך שמי שיודע רק את המייל של מישהו אחר לא נכנס. פתיחה רגילה של האפליקציה כשהמשתמש כבר מחובר
   לא מבקשת קוד. חשבון הבדיקה של גוגל (REVIEWER_ID) נשאר פטור כמו היום.
5. "מחיקת חשבון לצמיתות" מוחקת הכול: בשרת (נתונים, מכשירים, רכישות, החשבון עצמו) ובטלפון. רכישה של חשבון
   שנמחק לא פותחת שום דבר יותר, גם לא לחשבון חדש עם אותו מייל: צריך לשלם שוב.
6. ליד הכפתור "🗑️ מחיקת חשבון לצמיתות" בהגדרות, ובמסך האישור שלו, להוסיף אזהרה בולטת:
   "⚠️ מחיקת החשבון מוחקת גם את כל הרכישות (צ׳אט ה-AI וספר ההדרכה). אם תפתחו חשבון חדש, גם עם אותו מייל,
   תצטרכו לשלם עליהן שוב. רוצים רק לצאת? 'יציאה מהחשבון' שומרת את הכול בשרת."
7. "יציאה מהחשבון": הנתונים נשארים בשרת, והמקום של המכשיר מתפנה.

=== השרת (כבר כתוב ובדוק, אל תשנה אותו) ===
Supabase: URL https://sfrkenhauekqdijtunpg.supabase.co · publishable key sb_publishable_kbdGeoyPH5Wof7yf4rnc6g_QzPSF1_q
(שניהם ציבוריים, כבר קיימים ב-index.html בקבוע CLOUD וב-build.gradle).
EmailJS (ציבוריים): serviceId service_upg7kqp · templateId template_7q8srkg · publicKey g7STyZwRjLgIMZXrA.
התבנית שולחת ל-{{to_email}} את {{code}}, כמו היום. מעכשיו הקוד נשלח מהשרת (פונקציה cf-auth) ולא מהטלפון,
כדי שהשרת יוכל לבדוק אותו. המפתח הפרטי של EmailJS נשמר רק ב-Supabase, לעולם לא באפליקציה.

שלב 0: להוריד את שני קובצי השרת לתיקייה supabase/ בשורש הפרויקט (לשמירה; אני מעלה אותם ל-Supabase בעצמי):
  בסיס: https://raw.githubusercontent.com/iTAY908/SchoolBoost/b333eee443a74847722f89dae891e9468ab2719c/
  א. cubefinance/supabase/live/account_sync.sql  → supabase/account_sync.sql
     20600 בתים · SHA-256 מתחיל ב-e1568474cc069898
  ב. cubefinance/supabase/live/functions/cf-auth/index.ts  → supabase/functions/cf-auth/index.ts
     10159 בתים · SHA-256 מתחיל ב-5f0ee1b9683fd4d2
  (Windows: curl.exe -fL -o <קובץ> "<כתובת>" ובדיקה עם certutil -hashfile <קובץ> SHA256). לא תואם? לעצור ולהגיד לי.
  תקרא את שניהם. הם החוזה המדויק שהאפליקציה מדברת איתו.

ה-API (כל הקריאות POST עם JSON; headers: apikey = ה-publishable key, Content-Type: application/json):
 א. פונקציית הקוד: <URL>/functions/v1/cf-auth
    {action:"ping"} → {ok:true, emailReady:true|false}
    {action:"send", email} → {ok:true} | {ok:false, error:"too_soon", retry_after} | {ok:false, error:"rate_limited"}
                             | {ok:false, error:"send_failed"|"email_not_configured"}
    {action:"verify", email, code, device_id, device_name, platform, replace_device?}
        → {ok:true, existing, session:{access_token, refresh_token, expires_in}}
        → {ok:false, error:"bad_code", attempts_left} | "expired" | "too_many_attempts" | "no_code"
        → {ok:false, error:"device_limit", max:2, devices:[{id,name,platform,last_seen,current}]}
          (הקוד נשאר בתוקף: שולחים שוב verify עם אותו קוד ו-replace_device = id של המכשיר שהמשתמש בחר להוציא)
 ב. פונקציות הנתונים: <URL>/rest/v1/rpc/<שם>, עם Authorization: Bearer <access_token>.
    access_token פג אחרי שעה: לרענן ב-POST <URL>/auth/v1/token?grant_type=refresh_token {refresh_token}.
    יש כבר ב-index.html את sbFetch ואת אותו מנגנון רענון ב-sbAccess/rpc2. תשתמש בהם או בגרסה שלהם לפי id של חשבון.
    לשמור את ה-session ב-localStorage במפתח "cubefinance_web:sb:<account id>" בצורה {email, access, refresh, exp},
    אותה צורה ש-sbLoad כבר קורא.
    cf3_pull {p_device} → {ok, data, version, updated_at, purchases:["premium","book"...], devices}
    cf3_push {p_device, p_data, p_base, p_force} → {ok, version} | {ok:false, error:"conflict", data, version}
    cf3_claim_purchase {p_device, p_product:"premium"|"book", p_token_hash} → {ok, valid, state:"claimed"|"burned"|"other_account"}
    cf3_devices {p_device} · cf3_remove_device {p_device, p_target} · cf3_sign_out {p_device} · cf3_delete_account {p_device}
    cf2_my_entitlements {} → {ok, email, complimentary, purchases}
      complimentary=true אם לחשבון יש AI Premium שנקנה בכל מכשיר שהוא. ה-Java כבר קורא את זה ב-verifyComplimentary.
    כל פונקציה שמחזירה {ok:false, error:"device_removed"}: המכשיר הזה הוצא מהחשבון ממכשיר אחר.

=== מה לבנות ב-index.html ===
1. זהות מכשיר: device_id = CubeyNative.deviceId() באנדרואיד (ראו Java למטה). בדפדפן: מזהה אקראי שנשמר
   ב-localStorage "cubefinance_web:device". device_name = CubeyNative.deviceName(), ובדפדפן שם כללי
   ("Android", "iPhone", "מחשב Windows", "Mac", "דפדפן"). platform = "android" / "web".
2. דף אימות המייל: requestCode שולח קודם דרך cf-auth (action "send"), ו-submitCode בודק דרך cf-auth
   (action "verify"). אם cf-auth לא זמין (תשובת 404/401/500, אין רשת, או error "send_failed" /
   "email_not_configured"): נופלים לשיטה הקיימת (EmailJS מהטלפון + בדיקה מקומית) כדי שהאפליקציה תמשיך
   לעבוד. במצב הזה אין סנכרון. "too_soon" / "rate_limited": להציג הודעה ולא לשלוח.
   "device_limit": לעבור למסך המכשירים (סעיף 3 בחוויה למעלה).
3. אחרי קוד נכון מהשרת: לשמור את ה-session, לקרוא cf3_pull, ורק אז לפתוח את האפליקציה:
   - יש בשרת data: לכתוב את data.state למפתח "cubefinance_web:state:<account id>" ולטעון.
     להשאיר את premium המקומי (premium נקבע לפי מכשיר: Play או השרת), ולאחד את books.owned (לא למחוק ספרים).
     לפני דריסה של נתונים מקומיים, לגבות אותם ל-"cubefinance_web:state_backup:<id>".
   - אין בשרת data: להעלות את הנתונים המקומיים (cf3_push עם p_base = version).
   - מבנה data: {v:1, state:<האובייקט ש-saveState כותב>, auth:{salt, hash, google, name, createdAt}}.
     auth הוא רשומת המשתמש המקומית (מ-loadUsers), כדי שסיסמה תעבוד גם בטלפון חדש.
   - כניסה במייל+סיסמה בטלפון שאין בו את החשבון (אחרי התקנה מחדש או בטלפון שני): לא להחזיר "פרטים שגויים".
     לשלוח קוד, ואחרי קוד נכון לבדוק את הסיסמה מול data.auth (hashPw(pw, auth.salt) === auth.hash).
     נכונה: ליצור את רשומת המשתמש המקומית מ-auth ולהיכנס. שגויה: cf3_sign_out, למחוק את ה-session,
     ולהציג "המייל או הסיסמה שגויים". אין חשבון בשרת: "לא מצאנו חשבון עם המייל הזה, אפשר להירשם".
     לחשבון Google בלי סיסמה (auth.hash ריק): "החשבון הזה נכנס עם Google".
   - הרשמה עם מייל שכבר קיים בשרת: אחרי הקוד לשחזר את הנתונים מהשרת, לשמור את הסיסמה החדשה ולהעלות אותה.
     להציג "החשבון כבר היה קיים — שחזרנו את הנתונים שלך".
   - Google: אחרי הקוד, אם בשרת יש סיסמה (auth.hash), לשמור אותה מקומית כדי שגם כניסה עם סיסמה תעבוד.
   - שכחתי סיסמה: לאפשר גם כשהחשבון לא נמצא בטלפון, אם השרת זמין. אחרי הקוד: למשוך מהשרת, ליצור רשומה
     מקומית, לבחור סיסמה חדשה, ולהעלות אותה.
   - הודעה אחרי שחזור: "✅ ברוכים השבים! כל הנתונים שלכם שוחזרו".
4. כל כניסה דורשת קוד (needsEmailCheck לא מדלג יותר על מי שאומת פעם). חוץ מ-REVIEWER_ID. פתיחה עם session
   שמור לא דורשת קוד.
5. סנכרון:
   - בכל saveState של משתמש שיש לו session בשרת: לסמן "dirty" ולהעלות אחרי 2.5 שניות (cf3_push עם
     p_base = הגרסה האחרונה שהמכשיר ראה). את הגרסה ו-dirty לשמור ב-"cubefinance_web:cloud:<id>".
   - conflict: אם במכשיר הזה יש שינוי שלא הועלה, להעלות שוב עם p_force=true (הפעולה האחרונה של המשתמש
     מנצחת). אחרת לקחת את הגרסה מהשרת.
   - למשוך (cf3_pull) כשנכנסים, כשהאפליקציה חוזרת מהרקע (visibilitychange), וכל 60 שניות כשהיא פתוחה.
     גרסה חדשה יותר ואין שינוי מקומי: להחיל ולרנדר (לא באמצע מסך שבו המשתמש מקליד).
   - בפתיחה עם session שמור: למשוך לפני enterApp (עם timeout של 4 שניות), כדי שהכנסה החודשית האוטומטית
     ו-ensureEmergencyCube לא ירוצו על נתונים ישנים וידרסו את השרת.
   - device_removed: לצאת מהחשבון במכשיר הזה (logout) ולהציג "המכשיר הזה נותק מהחשבון ממכשיר אחר.
     כדי להמשיך כאן, התחברו שוב."
6. משתמשים קיימים (מחוברים ומאומתים לפני העדכון, ואין להם session בשרת): נכנסים כרגיל. אם ping מחזיר
   emailReady=true, פותחים פעם אחת בכל הפעלה את דף האימות עם ההסבר "☁️ שמירת החשבון בשרת: אחרי האימות
   הנתונים שלכם יישמרו גם אם תמחקו את האפליקציה או תחליפו טלפון", וכפתור "אחר כך" שחוזר לאפליקציה.
   אחרי קוד נכון: להעלות את הנתונים המקומיים (או לשחזר מהשרת אם כבר יש שם).
7. רכישות:
   - אנדרואיד: אחרי כניסה עם session, וגם אחרי CubeyBilling.onEntitlement / onOwnershipChanged / רכישה
     שהצליחה: לקרוא JSON.parse(CubeyNative.ownedPurchases()) ולשלוח כל רכישה ל-cf3_claim_purchase
     (product, hash). Premium רק כש-account של הרכישה שווה ל-CubeyNative.accountKey(email). רכישה בלי
     account (מלפני העדכון) רק אם state.premium כבר true. ספר: תמיד.
     state "burned": CubeyNative.consumePurchase(hash), ואז הודעה "הרכישה נמחקה יחד עם חשבון קודם —
     צריך לקנות שוב". state "other_account" לספר: לא לפתוח אותו בחשבון הזה.
   - Premium בטלפון השני: complimentaryCheck צריך לרוץ כשיש session בשרת (לא רק כש-SERVER_FEATURES).
     באנדרואיד הוא מעביר את ה-token ל-CubeyNative.verifyComplimentary, וה-Java כבר מחזיר
     onEntitlement(..., "complimentary"). בדפדפן: rpc ל-cf2_my_entitlements ואז setComplimentary.
   - ספר בטלפון השני: אם "book" נמצא ב-purchases של cf3_pull, לסמן אותו כשלו (source "cloud").
     applyBookOwnership(false) מ-Play לא מוחק ספר שהשרת אומר שהוא שלו.
8. מחיקת חשבון (wipeAccount):
   א. אם השרת זמין ואין session: קודם דף אימות (purpose "delete"), ואחר כך להמשיך.
   ב. cf3_delete_account. נכשל (אין רשת)? לעצור עם הודעה, ולא למחוק רק מקומית.
   ג. רק אחרי הצלחה: CubeyNative.consumePurchase לכל רכישת Premium של החשבון הזה (account שווה
      accountKey) ולספר אם החשבון קנה אותו. כך אפשר לקנות שוב, והן לא נפתחות לחשבון חדש.
   ד. מחיקה מקומית כמו היום, וגם של "cubefinance_web:sb:<id>" ו-"cubefinance_web:cloud:<id>".
9. יציאה (logout): cf3_sign_out (בלי לחכות לתשובה), למחוק את ה-session המקומי. לא למחוק נתונים מהשרת.
10. בהגדרות:
    - שורת מצב: "☁️ החשבון שמור בשרת ✓" או "☁️ החשבון לא שמור בשרת — לחצו לאימות".
    - "📱 המכשירים שלי": רשימה מ-cf3_devices, ו"נתק" ליד כל מכשיר אחר (cf3_remove_device).
    - האזהרה מסעיף 6 בחוויה.
11. גילוי נאות (חובה): בתקנון להוסיף סעיף "למי האפליקציה מיועדת":
    "CubeFinance מיועדת לצעירים בתחילת הדרך, ללמידת ניהול הכסף הראשון שלהם. היא בנויה לשימוש של שנתיים עד
    שלוש שנים לכל היותר, ולא לשימוש לאורך 10 או 20 שנה. היא אינה כלי לתכנון פיננסי ארוך טווח, לפנסיה,
    למשכנתא או להשקעות. כל מה שמוצג בה, כולל הסימולטור, הטיפים והתשובות של קיובי, הוא להמחשה וללימוד בלבד,
    ואינו ייעוץ פיננסי, השקעות, מס או משפט ולא תחליף לאיש מקצוע מוסמך. ההחלטות הכספיות והאחריות להן הן של
    המשתמש בלבד." מספרי הסעיפים בתקנון צריכים להמשיך לעבוד (סעיף יצירת הקשר כבר לא 7). להוסיף גם שורה קצרה
    במסך ההרשמה: "האפליקציה מיועדת לצעירים בתחילת הדרך, לשימוש של עד 2–3 שנים. להמחשה וללימוד בלבד, לא ייעוץ פיננסי."
    בסעיף "גיל מתאים" לעדכן: נתוני התקציב נשמרים בטלפון וגם בשרת מאובטח כדי שיישמרו בהחלפת טלפון, ונמחקים
    עם מחיקת החשבון.

=== מה לבנות ב-Java ===
א. NativeBridge (כל אחת עם @JavascriptInterface):
   String deviceId(): SHA-256 של ("cubefinance-device:" + Settings.Secure.ANDROID_ID), ב-hex.
     ANDROID_ID נשאר אותו דבר גם אחרי מחיקה והתקנה מחדש של האפליקציה, ולכן הטלפון לא תופס מקום נוסף.
   String deviceName(): Build.MANUFACTURER + " " + Build.MODEL.
   String ownedPurchases(): JSON array של הרכישות במצב PURCHASED מהשאילתה האחרונה של BillingManager:
     [{"product":"premium"|"book","hash":sha256(purchaseToken),"account":obfuscatedAccountId או ""}].
     coins_100_v2 = "premium", premium_access = "book". הטוקן עצמו לא יוצא מה-Java, רק ה-hash.
   void consumePurchase(String hash): BillingManager מוצא את הרכישה עם ה-hash הזה, עושה לה consumeAsync,
     ואז restorePurchases(). אחר כך קורא ל-window.CubeyBilling.onConsumed(hash, ok).
     להוסיף הערה ב-BillingManager: consume קורה רק כשהחשבון נמחק או כשהשרת אומר שהרכישה burned, כדי
     שאפשר יהיה לקנות שוב. בשום מקרה אחר לא עושים consume.
ב. BillingManager: לשמור את רשימת ה-Purchase האחרונה מ-restorePurchases ומ-handlePurchase, בשביל
   ownedPurchases ו-consumePurchase.
ג. גיבוי: להוציא מ-res/xml/backup_rules.xml ומ-data_extraction_rules.xml את app_webview ואת database
   (או android:allowBackup="false"), כדי שהתקנה מחדש תתחיל בלי חיבור. הנתונים חוזרים מהשרת אחרי כניסה וקוד.

=== בדיקות לפני שמסיימים ===
- gradlew.bat assembleDebug עובר.
- בדפדפן (פותחים את index.html): הרשמה עם קוד, יציאה, כניסה עם קוד, נתונים נשמרים. כשהשרת לא מוגדר עדיין,
  חייבת לעבוד הנפילה ל-EmailJS מהטלפון, כך שהאפליקציה לא נשברת לפני שאני מעלה את השרת.
- אין ב-index.html, ב-Java או ב-git: מפתח פרטי של EmailJS, service_role, sb_secret, סיסמאות, keystore או .env.
- versionCode 19, versionName "19.0" ב-app/build.gradle.

בסוף: סיכום קצר של מה שינית (קבצים), ואז רשימת הצעדים שאני צריך לעשות ב-Supabase וב-EmailJS (לפי הקובץ
supabase/account_sync.sql ו-supabase/functions/cf-auth/index.ts). אל תבנה release, אני בונה דרך
Build → Generate Signed App Bundle.
```

## מה שאתה עושה בעצמך ב-Supabase וב-EmailJS (פעם אחת)

1. **EmailJS:**
   - Account → Security: לסמן **Allow EmailJS API for non-browser applications** ולשמור.
   - Account → API keys: להעתיק את ה-**Private Key**. לא לשלוח אותו בצ׳אט.
2. **Supabase, SQL Editor:** להדביק את כל `account_sync.sql` וללחוץ **Run**.
3. **Supabase, Edge Functions:**
   - Deploy a new function → Via Editor.
   - שם: `cf-auth`. להדביק את כל `index.ts` וללחוץ **Deploy**.
4. **בהגדרות הפונקציה `cf-auth`:** לכבות את **Verify JWT** (נקרא גם Enforce JWT verification) ולשמור.
5. **Edge Functions → Secrets:** להוסיף `EMAILJS_PRIVATE_KEY` עם ה-Private Key מסעיף 1.
6. **בנייה והעלאה:** לבנות את גרסה 19, להעלות לבדיקה, ולבדוק:
   - נרשמים בטלפון אחד.
   - מוחקים את האפליקציה ומתקינים מחדש: הנתונים חוזרים אחרי הקוד.
   - נכנסים עם אותו מייל בטלפון שני: אותם נתונים.
   - מנסים טלפון שלישי: מופיע מסך המכשירים.
