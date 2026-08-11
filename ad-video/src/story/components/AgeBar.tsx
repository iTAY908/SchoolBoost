import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../../font";
import { P } from "../../pitch/theme";

/** ── ירוק — צבע החובה של הפס לפי בקשת הלקוח ─────────────── */
const GREEN_DEEP = "#16A34A";
const GREEN = "#22C55E";
const GREEN_LIGHT = "#4ADE80";

export type AgeBarProps = {
  /** הפריים שבו הפס מתחיל לגדול (יחסית לתחילת ה-Sequence שעוטף אותו) */
  startFrame?: number;
  /** כמה פריימים לוקחת הגדילה מ-0 עד 15 */
  durationInFrames?: number;
  /** הגיל ההתחלתי שמוצג */
  fromAge?: number;
  /** הגיל הסופי — הפאנץ' של הקלף */
  toAge?: number;
  /** אורך המסילה בפיקסלים (הפס ארוך, לרוחב) */
  trackWidth?: number;
  /** עובי המסילה */
  trackHeight?: number;
  /** כיתוב קטן מתחת לפס (אופציונלי) */
  caption?: string;
  /** עיצוב נוסף לעטיפה החיצונית — לשימוש העורך למיקום */
  style?: React.CSSProperties;
};

/**
 * ── AgeBar ──────────────────────────────────────────────
 * פס גילאים אופקי וארוך שגדל מ-0 עד 15, כשמעל הקצה המוביל
 * רץ מספר שסופר יחד עם הגדילה. הצבע ירוק, עם הילה.
 *
 * הרכיב קורא בעצמו `useCurrentFrame()` ומקבע (clamp) לפני ואחרי
 * חלון הגדילה — אפשר להרכיב אותו על חלון ארוך יותר בלי חשש:
 * לפני `startFrame` הוא יושב על 0, ואחרי הסיום הוא נשאר על 15.
 */
export const AgeBar: React.FC<AgeBarProps> = ({
  startFrame = 0,
  durationInFrames = 40,
  fromAge = 0,
  toAge = 15,
  trackWidth = 820,
  trackHeight = 34,
  caption,
  style,
}) => {
  const frame = useCurrentFrame();
  const { width: canvasWidth } = useVideoConfig();

  /** הזמן המקומי של הרכיב — שלילי לפני שהגדילה מתחילה */
  const local = frame - startFrame;

  /**
   * ההתקדמות 0..1. עקומת ease-in-out סימטרית — נבחרה במכוון
   * (ולא ב-expo out) כדי שהספירה תטפס בקצב אחיד וקריא לכל אורך
   * הגדילה ותנחת על 15 בדיוק בסוף, במקום לקפוץ ל-15 באמצע ולעמוד.
   */
  const grow = interpolate(local, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.5, 1),
  });

  /** גודל המספר, ואומדן חצי־הרוחב שלו כולל הפופ — לשמירה בתוך הפריים */
  const numberSize = 150;
  const numberHalf =
    numberSize * 0.35 * String(Math.max(fromAge, toAge)).length * 1.2 + 12;
  /** המרחק מקצה המסילה לקצה הקנבס, בהנחה שהפס ממורכז */
  const sideRoom = Math.max(0, (canvasWidth - trackWidth) / 2);
  /** הקצה המוביל של המילוי, בקואורדינטות המסילה */
  const headMin = trackHeight * 0.9;

  /** הגיל הרציף, והגיל המוצג — תמיד מספר שלם */
  const rawAge = fromAge + (toAge - fromAge) * grow;
  const age = Math.round(rawAge);

  /**
   * דופק קטן בכל פעם שהספרה מתחלפת: 0 בדיוק ברגע ההחלפה, 1 באמצע.
   * מזין פופ קטן של המספר בלי לדעת מתי בדיוק "תקתק".
   */
  const tickPhase = Math.min(1, Math.abs(rawAge - age) * 2);

  /** כמה פריימים עברו מאז שהפס הגיע לסוף — לפופ של אבן הדרך */
  const sinceEnd = local - durationInFrames;

  /**
   * כניסת הרכיב עצמו — מתחילה 6 פריימים לפני הגדילה, אבל אף פעם
   * לא לפני הפריים הראשון, כדי שגם `startFrame={0}` ייכנס מאפס.
   */
  const intro = frame - Math.max(0, startFrame - 6);

  const ticks = Array.from({ length: toAge - fromAge + 1 }, (_, i) => i);

  return (
    <Interactive.Div
      name="AgeBar"
      style={{
        direction: "ltr",
        fontFamily,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: interpolate(intro, [0, 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(intro, [0, 18], [0.86, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1.4, 0.3, 1),
          output: "perceptual-scale",
        }),
        ...style,
      }}
    >
      {/* ── שכבת המספר — רוכבת מעל הקצה המוביל של המילוי ── */}
      <div
        style={{
          position: "relative",
          width: trackWidth,
          height: 230,
        }}
      >
        {/* המספר עצמו. המיקום מקובע לתוך הקנבס כדי שגם "15" בקצה
            הימני לא ייחתך — Math.min/Math.max עוטפים את ההנפשה. */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: Math.min(
              Math.max(
                interpolate(grow, [0, 1], [headMin, trackWidth], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                numberHalf - sideRoom,
              ),
              trackWidth + sideRoom - numberHalf,
            ),
            translate: "-50% 0",
            /* דופק קטן בכל החלפת ספרה, כפול הפופ הסופי של אבן הדרך.
               אחרי שהגדילה נגמרת הדופק כבוי כדי שהמספר ינוח על 1. */
            scale:
              interpolate(
                local >= durationInFrames ? 1 : tickPhase,
                [0, 0.5],
                [1.1, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                  output: "perceptual-scale",
                },
              ) *
              interpolate(sinceEnd, [0, 8, 18], [1, 1.18, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1.4, 0.3, 1),
                output: "perceptual-scale",
              }),
            fontFamily,
            fontWeight: 900,
            fontSize: numberSize,
            lineHeight: 1,
            color: P.white,
            whiteSpace: "nowrap",
            /* ההילה מתחזקת ככל שמתקרבים ל-15 — הפאנץ' של הקלף */
            textShadow: `0 0 ${interpolate(grow, [0, 1], [34, 96], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px ${GREEN}CC, 0 14px 42px rgba(0,0,0,0.6)`,
          }}
        >
          {age}
        </div>

        {/* חץ קטן שמצביע בדיוק אל קצה המילוי */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            width: 0,
            height: 0,
            borderLeft: "18px solid transparent",
            borderRight: "18px solid transparent",
            borderTop: `24px solid ${GREEN_LIGHT}`,
            filter: `drop-shadow(0 0 16px ${GREEN})`,
            left: interpolate(grow, [0, 1], [headMin, trackWidth], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: "-50% 0",
            /* פופ אחרון כשהמספר נוחת על 15 */
            scale: interpolate(sinceEnd, [0, 8, 18], [1, 1.35, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.4, 0.3, 1),
              output: "perceptual-scale",
            }),
          }}
        />
      </div>

      {/* ── המסילה — ארוכה ולרוחב ── */}
      <div
        style={{
          position: "relative",
          width: trackWidth,
          height: trackHeight,
          borderRadius: 999,
          background: "rgba(6,20,12,0.55)",
          border: "2px solid rgba(255,255,255,0.16)",
          boxShadow: "inset 0 4px 18px rgba(0,0,0,0.55)",
          overflow: "visible",
        }}
      >
        {/* המילוי הירוק שגדל */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${GREEN_DEEP} 0%, ${GREEN} 55%, ${GREEN_LIGHT} 100%)`,
            boxShadow: `0 0 34px ${GREEN}AA, 0 0 76px ${GREEN}55`,
            width: interpolate(
              grow,
              [0, 1],
              [headMin, trackWidth],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            ),
          }}
        />

        {/* ברק עדין בראש המילוי */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            translate: "-50% -50%",
            width: 14,
            height: trackHeight + 26,
            borderRadius: 999,
            background: `linear-gradient(180deg, ${P.white} 0%, ${GREEN_LIGHT} 100%)`,
            boxShadow: `0 0 30px ${P.white}AA, 0 0 60px ${GREEN}`,
            left: interpolate(
              grow,
              [0, 1],
              [headMin, trackWidth],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            ),
          }}
        />

        {/* שנתות הגילאים לאורך המסילה */}
        {ticks.map((i) => {
          const isMajor = i % 5 === 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: "50%",
                left: (i / (toAge - fromAge)) * trackWidth,
                translate: "-50% -50%",
                width: isMajor ? 4 : 2,
                height: isMajor ? trackHeight + 22 : trackHeight - 8,
                borderRadius: 999,
                background: P.white,
                /* שנתה נדלקת ברגע שהמילוי חולף מעליה */
                opacity: interpolate(
                  rawAge,
                  [i - 0.7, i],
                  [isMajor ? 0.3 : 0.18, isMajor ? 1 : 0.6],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                ),
              }}
            />
          );
        })}
      </div>

      {/* ── כיתובי אבני הדרך מתחת למסילה ── */}
      <div
        style={{
          position: "relative",
          width: trackWidth,
          height: 54,
          marginTop: 16,
        }}
      >
        {ticks
          .filter((i) => i % 5 === 0)
          .map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (i / (toAge - fromAge)) * trackWidth,
                translate: "-50% 0",
                fontFamily,
                fontWeight: 700,
                fontSize: i === toAge ? 46 : 36,
                color: i === toAge ? GREEN_LIGHT : P.white,
                textShadow:
                  i === toAge ? `0 0 26px ${GREEN}` : "0 4px 14px rgba(0,0,0,0.5)",
                opacity: interpolate(rawAge, [i - 1.2, i], [0.35, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                scale: interpolate(
                  i === toAge ? sinceEnd : -1,
                  [0, 9, 20],
                  [1, 1.25, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1.4, 0.3, 1),
                    output: "perceptual-scale",
                  },
                ),
              }}
            >
              {fromAge + i}
            </div>
          ))}
      </div>

      {caption ? (
        <div
          style={{
            direction: "rtl",
            fontFamily,
            fontWeight: 700,
            fontSize: 52,
            marginTop: 18,
            color: P.white,
            textShadow: "0 6px 22px rgba(0,0,0,0.55)",
            opacity: interpolate(intro, [6, 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {caption}
        </div>
      ) : null}
    </Interactive.Div>
  );
};
