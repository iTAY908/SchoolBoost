# Supabase — הפעלה מלאה (שליחת קודים, חיסכון משותף, גישת יוצר)

האפליקציה מבקשת מ-Supabase לשלוח את קוד האימות למייל ומאמתת אותו שם. כך לכל משתמש יש זהות
אמיתית בשרת: אפשר להתחבר מכל מכשיר, למצוא משתמשים לחיסכון משותף, ולתת גישת יוצר חינם
רק למייל שבאמת אומת. כדי שזה יעבוד צריך שני דברים: **שליחת מיילים** ו-**המאגר**.

## 1. שליחת מיילים (זה מה שחסר כשהקוד "נשלח" ולא מגיע)
ברירת המחדל של Supabase שולחת רק כ-2 מיילים בשעה, ורק לחברי הצוות של הפרויקט. לכל שאר המשתמשים
זה נכשל בשקט. צריך לחבר שולח אמיתי:

1. יוצרים סיסמת אפליקציה בג׳ימייל: https://myaccount.google.com/apppasswords
   (דורש אימות דו-שלבי). שם: `CubeFinance-Supabase`. מעתיקים את 16 התווים.
2. Supabase ← הפרויקט ← **Authentication** ← **Emails** ← **SMTP Settings** ← **Enable custom SMTP**:
   - Sender email: כתובת הג׳ימייל · Sender name: `CubeFinance`
   - Host: `smtp.gmail.com` · Port: `465`
   - Username: כתובת הג׳ימייל המלאה · Password: 16 התווים (בלי רווחים)
   - **Save**
3. אותו מקום, לשונית **Templates**. בשתי התבניות **Confirm sign up** ו-**Magic Link** מחליפים את התוכן ב:
   ```
   <div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px">
     <h2>🧊 CubeFinance</h2>
     <p>קוד האימות שלך:</p>
     <p style="font-size:34px;letter-spacing:8px;font-weight:bold;direction:ltr">{{ .Token }}</p>
     <p>הקוד תקף למספר דקות. אם לא ביקשת אותו, אפשר להתעלם מהמייל.</p>
   </div>
   ```
   ובשדה Subject: `קוד האימות שלך ל-CubeFinance`. בלי `{{ .Token }}` נשלח קישור במקום קוד.
4. **Authentication** ← **Sign In / Providers** ← **Email**: מוודאים שהספק פעיל, ושאורך הקוד
   (**Email OTP Length**) הוא **6**.
5. **Authentication** ← **Rate Limits**: אחרי חיבור SMTP מותרים 30 מיילים בשעה כברירת מחדל;
   אפשר להעלות לפי הצורך. הגבלת ג׳ימייל: כ-500 מיילים ביום.

בדיקה: באפליקציה מבקשים קוד למייל חדש; אמור להגיע תוך שניות (גם בספאם).

## 2. המאגר (פעם אחת)
1. Supabase ← **SQL Editor** ← **New query**.
2. מדביקים את **כל** התוכן של `cubefinance/supabase/live/deploy_all.sql` ← **Run**.
   אם מופיעה אזהרה על "destructive operation" מאשרים (זה `drop trigger/constraint if exists`).
3. אמור להופיע Success. אפשר להריץ שוב בלי נזק.

## 3. גישת יוצר חינם
הקובץ כבר כולל את `itayleiss2010@gmail.com`. הגישה ניתנת רק למי שאימת את המייל בקוד, ולא למי
שסתם הקליד אותו בהרשמה. להוספה או הסרה:
```sql
insert into public.cf_complimentary (email, note) values ('someone@example.com', 'note');
delete from public.cf_complimentary where email = 'someone@example.com';
```

## 4. כמה משתמשים נרשמו
- Authentication ← **Users**: כל מי שאימת מייל.
- או ב-SQL Editor: `select count(*) from public.cf_profiles;`

## 5. התראות Push (אופציונלי, לא נדרש לשום דבר למעלה)
`supabase/live/schedule_push.sql` והפונקציה `supabase/live/functions/cf-push` דורשות Firebase וסודות;
בלעדיהן הכל עובד, פשוט בלי התראות כשהאפליקציה סגורה.
