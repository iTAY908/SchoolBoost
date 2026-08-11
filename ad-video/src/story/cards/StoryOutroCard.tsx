import {
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { fontFamily } from "../../font";
import { CardShell } from "../../pitch/cards/CardShell";
import { CREATOR, P } from "../../pitch/theme";
import { LogoBadge } from "../components/LogoBadge";

/** גרדיאנט אינסטגרם — מסמן את הרשת בלי להשתמש בלוגו המסחרי שלה */
const IG = "linear-gradient(45deg, #F58529 0%, #DD2A7B 42%, #8134AF 72%, #515BD4 100%)";

/**
 * ── כרטיס הסיום (26.70–29.20) ────────────────────────────
 * המשפט האחרון שנאמר הוא "אז פנו אליי באינסטגרם", ולכן הקלף
 * נוחת בדיוק על ההנעה לפעולה: הסמל, השם באינסטגרם, וכפתור
 * בגרדיאנט של הרשת.
 *
 * 75 פריימים בלבד — כל האלמנטים בפנים עד פריים ~44.
 */
export const StoryOutroCard: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <CardShell name="StoryOutroCard" intensity={1.25}>
      {/*
        הלוגו של הלקוח, עם טבעת זהב דקה בלבד — הסמל כבר עיגול כהה
        ומלא בעצמו, וטבעת עבה הייתה מתחרה בו.
        להחלפת קובץ בעתיד: משנים רק את הנתיב ב-`staticFile` כאן.
      */}
      <Interactive.Div
        name="Mark"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* הילה כהה מאחורי הסמל — חותם מותג מכוון, לא מדבקה */}
        <div
          style={{
            position: "absolute",
            width: 620,
            height: 620,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(9,3,26,0.74) 0%, rgba(9,3,26,0.4) 42%, rgba(9,3,26,0) 70%)",
          }}
        />
        {/*
          בלי אנימציית כניסה. הקלף מתמזג לתוך נעילת המותג של הראווה,
          שכבר מציגה את אותו לוגו — פופ נוסף כאן היה קורא כשכפול
          במקום כהתייצבות.
        */}
        <LogoBadge
          src={staticFile("source/logo.png")}
          size={280}
          ringWidth={6}
          animate={false}
        />
      </Interactive.Div>

      <Interactive.Div
        name="Cta"
        style={{
          direction: "rtl",
          marginTop: 52,
          fontFamily,
          fontWeight: 900,
          fontSize: 96,
          lineHeight: 1.16,
          color: P.white,
          textAlign: "center",
          textShadow:
            "0 0 50px rgba(255,255,255,0.26), 0 10px 34px rgba(0,0,0,0.6)",
          opacity: interpolate(frame, [10, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [10, 28], ["0px 38px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        פנו אליי באינסטגרם
      </Interactive.Div>

      {/* כפתור בגרדיאנט אינסטגרם עם שם המשתמש */}
      <Interactive.Div
        name="Handle"
        style={{
          direction: "ltr",
          display: "flex",
          alignItems: "center",
          gap: 22,
          marginTop: 46,
          padding: "26px 58px",
          borderRadius: 999,
          background: IG,
          boxShadow: "0 24px 58px rgba(0,0,0,0.5), 0 0 70px rgba(221,42,123,0.35)",
          fontFamily,
          fontWeight: 900,
          fontSize: 68,
          letterSpacing: 1,
          color: P.white,
          opacity: interpolate(frame, [22, 32], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale:
            interpolate(frame, [22, 38], [0.72, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.4, 0.3, 1),
              output: "perceptual-scale",
            }) *
            /* פעימה עדינה אחרי הכניסה — מושכת את העין לכפתור */
            interpolate(frame, [46, 54, 62], [1, 1.05, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              output: "perceptual-scale",
            }),
        }}
      >
        {/* מסגרת מצלמה מרומזת — לא הלוגו הרשמי */}
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            border: `6px solid ${P.white}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: `5px solid ${P.white}`,
              boxSizing: "border-box",
            }}
          />
        </span>
        {CREATOR.handle}
      </Interactive.Div>

      <Interactive.Div
        name="Kicker"
        style={{
          position: "absolute",
          bottom: 168,
          direction: "rtl",
          fontFamily,
          fontWeight: 700,
          fontSize: 48,
          color: P.white,
          opacity: interpolate(frame, [36, 48], [0, 0.86], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {CREATOR.cta}
      </Interactive.Div>
    </CardShell>
  );
};
