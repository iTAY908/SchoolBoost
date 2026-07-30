# סרטון פרסומת — סגנון Reels / TikTok

סרטון פרסומת אנכי בעברית (RTL), בנוי ב-[Remotion](https://remotion.dev).
פורמט: **1080×1920, 30fps, ~12.9 שניות** — מתאים ל-Instagram Reels, TikTok ו-Stories.

## מבנה הסרטון

| # | שקופית | טקסט | אפקט |
|---|--------|------|------|
| 1 | `SceneHook` | "מה הסוד..." | טקסט קופץ מילה־אחר־מילה + טבעת אור מתפרצת |
| 2 | `SceneGallery` | "של הסרטונים שמושכים הכי הרבה עיניים?" | גלריית עבודות שנעה בפרספקטיבה תלת־ממדית |
| 3 | `SceneResults` | "עריכת וידאו מקצועית ברמה הגבוהה ביותר!" | כרטיסי מדדים עם מונים רצים |
| 4 | `SceneBrand` | שם המותג + הסלוגן | טבעות ניאון מסתובבות וסמל נגן |
| 5 | `SceneCta` | "רוצים סרטון כזה לעסק שלכם?" | כפתור פועם + "דברו איתי בפרטי 📩" |

המעברים בין השקופיות הם `slide` ו-`fade` דרך `TransitionSeries`, באורך 10 פריימים כל אחד.
הרקע (`Backdrop`) יושב **מתחת** ל-`TransitionSeries` כך שהגרדיאנט זורם ברציפות בזמן שהתוכן מתחלף.

## שינוי הפרטים שלכם

כמעט כל מה שצריך לשנות נמצא בקובץ אחד — [`src/config.ts`](src/config.ts):

```ts
export const BRAND = {
  name: "STUDIO CUT",                        // ← שם העסק שלכם
  tagline: "מערכת העריכה שדואגת לתוצאות",
  handle: "@studiocut",                      // ← היוזר באינסטגרם
};

export const METRICS = [
  { value: 96,  suffix: "%", label: "מעורבות" },
  { value: 3.2, suffix: "x", label: "יותר צפיות" },
  { value: 91,  suffix: "%", label: "שימור צופים" },
];
```

> המדדים הם ערכי דוגמה. החליפו אותם במספרים אמיתיים שלכם לפני פרסום.

באותו קובץ נמצאים גם הצבעים (`COLORS`) ואורך כל שקופית בפריימים (`SCENE_DURATIONS`) —
30 פריימים = שנייה אחת. משך הסרטון הכולל מחושב אוטומטית ומקזז את המעברים.

### החלפת כרטיסי הגלריה בעבודות אמיתיות

`CreativeCard` מצייר כרטיס מופשט. כדי להשתמש בעבודות שלכם, שימו קבצים ב-`public/`
והחליפו את גוף הקומפוננטה ב:

```tsx
<CanvasImage src={staticFile("works/reel-1.jpg")} style={{ width, height }} />
```

## הרצה

```bash
npm i
npx remotion studio        # תצוגה מקדימה חיה בדפדפן
npx remotion render AdVideo out/ad-video.mp4
```

כל שקופית רשומה גם בנפרד בתיקיית `Scenes` ב-Studio, כך שאפשר לערוך או לייצא אותה לבד:

```bash
npx remotion render Scene5-Cta out/cta.mp4
```

## פונטים

הסרטון משתמש ב-**Heebo** (משקלים 400/700/900). קבצי ה-TTF שמורים ב-`public/fonts/`
ונטענים דרך `@remotion/fonts` — כך שהרינדור אינו תלוי ברשת ויוצא זהה בכל סביבה.

## רינדור בסביבה בלי הורדת דפדפן

Remotion מוריד Chrome Headless Shell בהרצה הראשונה. אם ההורדה חסומה,
אפשר להצביע על Chromium מקומי:

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/headless_shell npx remotion render AdVideo out/ad-video.mp4
```

`remotion.config.ts` קורא את משתנה הסביבה הזה אם הוא מוגדר.

## רישיון

Remotion דורש רישיון חברה עבור חלק מהגופים —
[קראו את התנאים כאן](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
