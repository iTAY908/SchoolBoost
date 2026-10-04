# חיסכון משותף — הפעלה

## 1. Supabase: להריץ את קוד המאגר (פעם אחת)
1. Supabase ← הפרויקט ← בתפריט הצדדי **SQL Editor** ← **New query**.
2. מעתיקים את כל התוכן של `cubefinance/supabase/shared_savings.sql`
   (או מהכתובת: https://raw.githubusercontent.com/iTAY908/SchoolBoost/129b4e131b0db598b3f0b93bfc7a726cb32ae783/cubefinance/supabase/shared_savings.sql)
   ומדביקים.
3. לוחצים **Run**. אמור להופיע "Success. No rows returned".
   (אם מופיעה הודעה על "destructive operation" — זה בגלל שורות ה-revoke; מאשרים.)

כמה משתמשים נרשמו: ב-SQL Editor מריצים `select count(*) from public.cf_profiles;`
או: **Table Editor** ← `cf_profiles`.

## 2. EmailJS: תבנית להזמנות (מומלץ)
בלי תבנית נפרדת, ההזמנה נשלחת בתבנית של קוד האימות ונראית כמו "קוד אימות".
Email Templates ← Create New Template:
- **To Email:** `{{to_email}}`
- **From Name:** `CubeFinance`
- **Subject:** `{{inviter}} מזמין/ה אותך לחסוך ביחד ב-CubeFinance 🤝`
- **Content:**
  `{{inviter}} מזמין/ה אותך לחסוך ביחד למטרה "{{goal}}". קוד ההצטרפות שלך: {{code}} — תקף ל-10 דקות. פותחים את CubeFinance ← חיסכון משותף ← "יש לי קוד הצטרפות".`
- Save, ושולחים את ה-Template ID החדש.

## 3. מה מגיע לשרת
אימייל, שם תצוגה, שמות ויעדי החסכונות המשותפים וסכומי ההפקדות אליהם.
לא נשלחים לשרת: הסיסמה, הקוביות, ההכנסות או ההוצאות.
צריך לעדכן את מדיניות הפרטיות ואת Data safety בגוגל פליי בהתאם.

## מגבלות (גרסה ראשונה)
- חשבון אחד = מכשיר אחד לחיסכון משותף. אותו מייל במכשיר שני יקבל הודעה שהוא כבר רשום.
- פרויקט Supabase חינמי נכנס להשהיה אחרי שבוע בלי שימוש; מחזירים אותו בלחיצה בדשבורד.
