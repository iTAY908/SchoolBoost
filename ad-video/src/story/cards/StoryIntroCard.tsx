import {
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { PopWords } from "../../components/PopWords";
import { CardShell } from "../../pitch/cards/CardShell";
import { P } from "../../pitch/theme";
import { LogoBadge } from "../components/LogoBadge";

/**
 * ── כרטיס הפתיחה (0.00–1.50) ─────────────────────────────
 * הדובר עוד שותק כאן, ולכן הקלף צריך לעשות את כל העבודה:
 * סמל המותג נכנס ראשון ומיד אחריו שורת הוו בעברית.
 *
 * הכל מגיע לשיא בתוך ~25 פריימים מתוך 45, כדי שהקלף ייראה
 * "נחת" ולא "נקטע" ברגע החיתוך לצילום הראשון.
 */
export const StoryIntroCard: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <CardShell name="StoryIntroCard" intensity={1.15}>
      {/*
        הלוגו של הלקוח. הוא כבר עיגול כהה משל עצמו, ולכן טבעת הזהב
        דקה במיוחד (6 במקום 10) — מספיק כדי לקשור אותו לפלטת הזהב־סגול,
        בלי שיתחרה עם המצלמה הכחולה־אדומה שבפנים.
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
        {/* הילה כהה־סגולה מאחורי הסמל — נותנת לו אוויר מול הרקע */}
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 560,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(9,3,26,0.72) 0%, rgba(9,3,26,0.38) 42%, rgba(9,3,26,0) 70%)",
          }}
        />
        <LogoBadge
          src={staticFile("source/logo.png")}
          size={240}
          ringWidth={6}
          startFrame={0}
        />
      </Interactive.Div>

      <div style={{ height: 54 }} />

      <PopWords
        words={[
          { text: "עורך" },
          { text: "וידאו" },
          { text: "מקצועי", accent: true },
        ]}
        startAt={5}
        stagger={3}
        fontSize={118}
        maxWidth={880}
        accentColor={P.gold}
      />

      {/* קו זהב דק שנפתח מתחת לשורה — סוגר את הקומפוזיציה */}
      <Interactive.Div
        name="Rule"
        style={{
          marginTop: 42,
          height: 8,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${P.gold}00 0%, ${P.gold} 50%, ${P.gold}00 100%)`,
          width: interpolate(frame, [14, 34], [0, 620], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      />
    </CardShell>
  );
};
