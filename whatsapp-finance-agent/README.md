# 🤖💰 כספי - סוכן AI פיננסי בוואטסאפ

סוכן AI אישי שחי בוואטסאפ, מחובר ל-Google Sheets, ועוזר לך לנהל את הכסף:
הוצאות, הכנסות, תקציבים, סיכומים ותובנות - הכל בשיחה טבעית בעברית.

## מה הוא יודע לעשות?

| אתה כותב | הסוכן עושה |
|---|---|
| "קניתי קפה ב-18 שקל" | רושם הוצאה של ₪18 בקטגוריית אוכל בגיליון |
| "קיבלתי משכורת 12,000" | רושם הכנסה של ₪12,000 |
| "כמה הוצאתי החודש?" | מסכם את כל ההוצאות של החודש לפי הנתונים האמיתיים |
| "על מה בזבזתי הכי הרבה?" | מנתח לפי קטגוריות ונותן פירוט |
| "תגדיר תקציב של 1500 לאוכל" | קובע תקציב חודשי ועוקב אחריו |
| "כמה נשאר לי מהתקציב?" | משווה הוצאות מול תקציב ומתריע על חריגות |
| "תמחק את ההוצאה האחרונה" | מאתר את התנועה, מוודא איתך, ומוחק |

כל הנתונים נשמרים ב-**Google Sheets** שלך - אתה יכול לפתוח את הגיליון בכל רגע ולראות הכל.

## ארכיטקטורה

```
וואטסאפ (Meta Cloud API)
        │ webhook
        ▼
   שרת Express (Node.js)
        │
        ▼
   Claude (Opus 4.8) + כלים פיננסיים
        │
        ▼
   Google Sheets (אחסון הנתונים)
```

## התקנה

### 1. דרישות מוקדמות

- Node.js 18 ומעלה
- חשבון [Anthropic](https://platform.claude.com) עם מפתח API
- חשבון Meta for Developers עם אפליקציית WhatsApp
- חשבון Google Cloud

### 2. הגדרת Google Sheets

1. היכנס ל-[Google Cloud Console](https://console.cloud.google.com) וצור פרויקט חדש
2. הפעל את **Google Sheets API** (APIs & Services → Enable APIs)
3. צור **Service Account** (IAM & Admin → Service Accounts → Create)
4. צור מפתח JSON לחשבון השירות והורד אותו לתיקיית הפרויקט בשם `service-account.json`
5. צור גיליון חדש ב-[Google Sheets](https://sheets.google.com)
6. **שתף את הגיליון** עם כתובת המייל של חשבון השירות (מופיעה בקובץ ה-JSON תחת `client_email`) עם הרשאת **Editor**
7. העתק את מזהה הגיליון מה-URL: `https://docs.google.com/spreadsheets/d/`**`<SPREADSHEET_ID>`**`/edit`

הסוכן ייצור לבד את הטאבים `Transactions` ו-`Budgets` בהפעלה הראשונה.

### 3. הגדרת WhatsApp Cloud API

1. היכנס ל-[Meta for Developers](https://developers.facebook.com) וצור אפליקציה מסוג **Business**
2. הוסף את המוצר **WhatsApp** לאפליקציה
3. מתוך **WhatsApp → API Setup** העתק:
   - **Temporary access token** (לייצור צור טוקן קבוע דרך System User)
   - **Phone number ID**
4. תחת **WhatsApp → Configuration** הגדר את ה-Webhook:
   - **Callback URL**: `https://<הכתובת-שלך>/webhook`
   - **Verify token**: מחרוזת סודית שתבחר (אותה תשים ב-`.env`)
   - הירשם לאירוע **messages**

> 💡 לפיתוח מקומי אפשר לחשוף את השרת עם [ngrok](https://ngrok.com): `ngrok http 3000`

### 4. הפעלה

```bash
cd whatsapp-finance-agent
npm install
cp .env.example .env
# ערוך את .env עם הערכים שלך
npm start
```

שלח הודעה למספר הוואטסאפ של האפליקציה - והתחל לנהל את הכסף! 💸

## משתני סביבה

| משתנה | תיאור |
|---|---|
| `ANTHROPIC_API_KEY` | מפתח ה-API של Anthropic |
| `WHATSAPP_TOKEN` | טוקן גישה של WhatsApp Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | מזהה מספר הטלפון מ-Meta |
| `WHATSAPP_VERIFY_TOKEN` | מחרוזת אימות ל-webhook (בבחירתך) |
| `GOOGLE_SPREADSHEET_ID` | מזהה גיליון ה-Google Sheets |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | נתיב לקובץ JSON של חשבון השירות |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | חלופה: תוכן ה-JSON עצמו (לפריסה בענן) |
| `PORT` | פורט השרת (ברירת מחדל: 3000) |

## מבנה הפרויקט

```
whatsapp-finance-agent/
├── src/
│   ├── index.js     # שרת Express + webhook של וואטסאפ
│   ├── agent.js     # המוח: Claude + כלים פיננסיים + לולאת הסוכן
│   ├── sheets.js    # שכבת הנתונים: קריאה/כתיבה ל-Google Sheets
│   └── whatsapp.js  # שליחת הודעות דרך WhatsApp Cloud API
├── package.json
├── .env.example
└── README.md
```

## הערות אבטחה

- **אל תעלה ל-git** את `.env` או את `service-account.json` (שניהם ב-`.gitignore`)
- הנתונים מופרדים לפי מספר וואטסאפ - כל משתמש רואה רק את התנועות שלו
- מומלץ להגביל את חשבון השירות של Google לגיליון הספציפי בלבד
- היסטוריית השיחה נשמרת בזיכרון השרת ומתאפסת בהפעלה מחדש (הנתונים הפיננסיים עצמם תמיד ב-Sheets)
