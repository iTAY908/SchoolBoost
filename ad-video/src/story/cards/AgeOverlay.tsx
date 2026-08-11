import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { AgeBar } from "../components/AgeBar";

/** כמה פריימים אחרי תחילת ה-Sequence מתחילה הגדילה */
export const AGE_BAR_START = 6;
/** משך הגדילה — 39 פריימים = 1.300s, בדיוק כמו ההכרעה של story-counter */
export const AGE_BAR_CLIMB = 39;
/** אורך החלון כולו: נחיתה, החזקה של ~2 שניות ואז יציאה */
export const AGE_OVERLAY_DURATION = 120;

/** תחילת דהיית היציאה, יחסית ל-Sequence */
const EXIT_AT = AGE_OVERLAY_DURATION - 15;

/**
 * ── שכבת סרגל הגילים ─────────────────────────────────────
 * הבקשה המרכזית של הלקוח: המספר חייב לנחות על 15 בדיוק כשהדובר
 * אומר "אני בן 15" (AGE_MOMENT = 9.3s).
 *
 * זו **שכבה מעל הצילום** ולא קלף מסך־מלא — הלקוח ביקש שהפס יופיע
 * בזמן שהוא מדבר, לא במקומו.
 *
 * מיקום: אזור עליון־אמצעי, ממורכז אופקית (ה-AgeBar מקבע את המספר
 * לתוך הקנבס בהנחה שהוא ממורכז — אסור להזיז אותו הצידה).
 * הכתוביות יושבות ב-y 1250–1590 והפנים של הדובר מתחילות סביב y 560,
 * ולכן הפס יושב בין 150 ל-~490 ולא מתנגש בשניהם.
 */
export const AgeOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  /* דהיית יציאה בסוף החלון, אחרי שהמספר החזיק על 15 */
  const exit = interpolate(frame, [EXIT_AT, AGE_OVERLAY_DURATION], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* הכניסה של הסקרים — מקדימה בכמה פריימים את הפס עצמו */
  const enter = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const visible = enter * exit;

  return (
    <AbsoluteFill name="AgeOverlay" style={{ opacity: visible }}>
      {/* סקרים כהה בראש הפריים. הקיר מאחורי הדובר בהיר מאוד,
          ובלעדיו המספר הלבן והשנתות היו נבלעים בו. */}
      <AbsoluteFill
        style={{
          height: 700,
          background:
            "linear-gradient(180deg, rgba(10,3,28,0.86) 0%, rgba(10,3,28,0.7) 46%, rgba(10,3,28,0) 100%)",
        }}
      />

      {/* הילה סגולה רכה מאחורי הפס — קושרת אותו לקלפים */}
      <AbsoluteFill
        style={{
          top: 60,
          height: 540,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(124,58,237,0.42) 0%, rgba(124,58,237,0) 70%)",
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 150,
          /* דחיפה קלה כלפי מעלה ביציאה — הפס "עולה ונעלם" */
          translate: interpolate(
            frame,
            [EXIT_AT, AGE_OVERLAY_DURATION],
            ["0px 0px", "0px -46px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.4, 0, 1, 1),
            },
          ),
        }}
      >
        <AgeBar
          startFrame={AGE_BAR_START}
          durationInFrames={AGE_BAR_CLIMB}
          trackWidth={820}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
