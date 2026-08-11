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

/** גודל המספר הרץ */
const NUMBER_SIZE = 150;
/** רוחב תיבת המספר במצב אנכי — המספר מיושר לימין, לכיוון הפס */
const NUMBER_BOX = 240;
/** מרווח בין תיבת המספר לחץ, ובין החץ לפס */
const POINTER_GAP = 8;
const POINTER_W = 22;
/** מרווח בין הפס לכיתובי אבני הדרך */
const LABEL_GAP = 22;
const LABEL_BOX = 72;

export type AgeBarProps = {
  /** הפריים שבו הפס מתחיל לגדול (יחסית ל-Sequence שעוטף אותו) */
  startFrame?: number;
  /** כמה פריימים לוקחת הגדילה מ-0 עד 15 */
  durationInFrames?: number;
  /** הגיל ההתחלתי שמוצג */
  fromAge?: number;
  /** הגיל הסופי — הפאנץ' של הקלף */
  toAge?: number;
  /**
   * כיוון הפס. ברירת המחדל **אנכית** — הלקוח ביקש סרגל לאורך,
   * שמתמלא מלמטה כלפי מעלה. `"horizontal"` שומר על הגרסה הקודמת.
   */
  orientation?: "vertical" | "horizontal";
  /** הציר הארוך של הפס. ברירת מחדל: 700 אנכי, 820 אופקי */
  trackLength?: number;
  /** הציר הצר של הפס. ברירת מחדל: 44 אנכי, 34 אופקי */
  trackThickness?: number;
  /** @deprecated השתמשו ב-`trackLength`. נקרא רק במצב אופקי. */
  trackWidth?: number;
  /** @deprecated השתמשו ב-`trackThickness`. נקרא רק במצב אופקי. */
  trackHeight?: number;
  /** כיתוב קטן ליד הפס (אופציונלי) */
  caption?: string;
  /** עיצוב נוסף לעטיפה החיצונית — לשימוש העורך למיקום */
  style?: React.CSSProperties;
};

/**
 * ── לוגיקת הזמן, משותפת לשני הכיוונים ────────────────────
 * חוזה התזמון זהה בשתי הגרסאות: הגדילה מתחילה ב-`startFrame`,
 * נמשכת בדיוק `durationInFrames`, והמספר נוחת על `toAge` באותו
 * פריים בדיוק — כך שחישובי העורך והסאונד נשארים תקפים.
 */
const useGrowth = (
  startFrame: number,
  durationInFrames: number,
  fromAge: number,
  toAge: number,
) => {
  const frame = useCurrentFrame();

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

  /** הגיל הרציף, והגיל המוצג — תמיד מספר שלם */
  const rawAge = fromAge + (toAge - fromAge) * grow;
  const age = Math.round(rawAge);

  return {
    local,
    grow,
    rawAge,
    age,
    /**
     * דופק קטן בכל פעם שהספרה מתחלפת: 0 בדיוק ברגע ההחלפה, 1 באמצע.
     * מזין פופ קטן של המספר בלי לדעת מתי בדיוק "תקתק".
     */
    tickPhase: Math.min(1, Math.abs(rawAge - age) * 2),
    /** כמה פריימים עברו מאז שהפס הגיע לסוף — לפופ של אבן הדרך */
    sinceEnd: local - durationInFrames,
    /**
     * כניסת הרכיב עצמו — מתחילה 6 פריימים לפני הגדילה, אבל אף פעם
     * לא לפני הפריים הראשון, כדי שגם `startFrame={0}` ייכנס מאפס.
     */
    intro: frame - Math.max(0, startFrame - 6),
  };
};

/**
 * ── AgeBar ──────────────────────────────────────────────
 * סרגל גילאים שגדל מ-0 עד 15, כשעל הקצה המוביל רוכב מספר שסופר
 * יחד עם הגדילה. הצבע ירוק, עם הילה.
 *
 * ברירת המחדל אנכית: פס גבוה שמתמלא **מלמטה כלפי מעלה** — 0 למטה,
 * 15 למעלה. המספר והחץ שלו יושבים משמאל לפס, וכיתובי אבני הדרך
 * (0/5/10/15) יורדים לאורך צדו הימני.
 *
 * הרכיב קורא בעצמו `useCurrentFrame()` ומקבע (clamp) לפני ואחרי
 * חלון הגדילה — אפשר להרכיב אותו על חלון ארוך יותר בלי חשש:
 * לפני `startFrame` הוא יושב על 0, ואחרי הסיום הוא נשאר על 15.
 */
export const AgeBar: React.FC<AgeBarProps> = ({
  orientation = "vertical",
  trackLength,
  trackThickness,
  trackWidth,
  trackHeight,
  ...rest
}) => {
  if (orientation === "horizontal") {
    return (
      <AgeBarHorizontal
        trackLength={trackLength ?? trackWidth ?? 820}
        trackThickness={trackThickness ?? trackHeight ?? 34}
        {...rest}
      />
    );
  }

  /* המידות הישנות (trackWidth/trackHeight) תוארו לציר אופקי ולכן
     אינן נקראות כאן — הגרסה האנכית מגיעה עם מידות משלה. */
  return (
    <AgeBarVertical
      trackLength={trackLength ?? 700}
      trackThickness={trackThickness ?? 44}
      {...rest}
    />
  );
};

type InnerProps = Omit<
  AgeBarProps,
  "orientation" | "trackWidth" | "trackHeight"
> & {
  trackLength: number;
  trackThickness: number;
};

/* ══════════════════════════════════════════════════════════
   הגרסה האנכית — ברירת המחדל
   ══════════════════════════════════════════════════════════ */
const AgeBarVertical: React.FC<InnerProps> = ({
  startFrame = 0,
  durationInFrames = 40,
  fromAge = 0,
  toAge = 15,
  trackLength,
  trackThickness,
  caption,
  style,
}) => {
  const { grow, rawAge, age, tickPhase, sinceEnd, intro, local } = useGrowth(
    startFrame,
    durationInFrames,
    fromAge,
    toAge,
  );

  /** הקצה המוביל של המילוי, נמדד מתחתית הפס כלפי מעלה */
  const headMin = trackThickness * 0.9;
  const trackLeft = NUMBER_BOX + POINTER_GAP + POINTER_W + POINTER_GAP;
  const span = Math.max(1, toAge - fromAge);
  const ticks = Array.from({ length: span + 1 }, (_, i) => i);

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
      <div
        style={{
          position: "relative",
          width: trackLeft + trackThickness + LABEL_GAP + LABEL_BOX,
          height: trackLength,
        }}
      >
        {/* ── המספר — רוכב על הקצה המוביל, משמאל לפס ── */}
        <div
          style={{
            position: "absolute",
            left: 0,
            width: NUMBER_BOX,
            textAlign: "right",
            bottom: interpolate(grow, [0, 1], [headMin, trackLength], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: "0 50%",
            /* הפופ גדל שמאלה, הרחק מהפס */
            transformOrigin: "100% 50%",
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
            fontSize: NUMBER_SIZE,
            lineHeight: 1,
            color: P.white,
            whiteSpace: "nowrap",
            /* ההילה מתחזקת ככל שמתקרבים ל-15 — הפאנץ' של הקלף */
            textShadow: `0 0 ${interpolate(grow, [0, 1], [34, 96], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px ${GREEN}CC, 0 14px 42px rgba(0,0,0,0.6)`,
          }}
        />

        {/* המספר עצמו יושב בתוך אותה תיבה — נפרד כדי לשמור על
            יישור לימין בלי שה-scale ידחוף אותו הצידה */}
        <div
          style={{
            position: "absolute",
            left: 0,
            width: NUMBER_BOX,
            textAlign: "right",
            bottom: interpolate(grow, [0, 1], [headMin, trackLength], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: "0 50%",
            transformOrigin: "100% 50%",
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
            fontSize: NUMBER_SIZE,
            lineHeight: 1,
            color: P.white,
            whiteSpace: "nowrap",
            textShadow: `0 0 ${interpolate(grow, [0, 1], [34, 96], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px ${GREEN}CC, 0 14px 42px rgba(0,0,0,0.6)`,
          }}
        >
          {age}
        </div>

        {/* חץ שמצביע ימינה, בדיוק אל קצה המילוי */}
        <div
          style={{
            position: "absolute",
            left: NUMBER_BOX + POINTER_GAP,
            width: 0,
            height: 0,
            borderTop: "18px solid transparent",
            borderBottom: "18px solid transparent",
            borderLeft: `${POINTER_W}px solid ${GREEN_LIGHT}`,
            filter: `drop-shadow(0 0 16px ${GREEN})`,
            bottom: interpolate(grow, [0, 1], [headMin, trackLength], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: "0 50%",
            /* פופ אחרון כשהמספר נוחת על 15 */
            scale: interpolate(sinceEnd, [0, 8, 18], [1, 1.35, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.4, 0.3, 1),
              output: "perceptual-scale",
            }),
          }}
        />

        {/* ── המסילה — גבוהה ולאורך ── */}
        <div
          style={{
            position: "absolute",
            left: trackLeft,
            bottom: 0,
            width: trackThickness,
            height: trackLength,
            borderRadius: 999,
            background: "rgba(6,20,12,0.55)",
            border: "2px solid rgba(255,255,255,0.16)",
            boxShadow: "inset 0 4px 18px rgba(0,0,0,0.55)",
            overflow: "visible",
          }}
        >
          {/* המילוי הירוק — גדל מלמטה כלפי מעלה */}
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "100%",
              borderRadius: 999,
              background: `linear-gradient(0deg, ${GREEN_DEEP} 0%, ${GREEN} 55%, ${GREEN_LIGHT} 100%)`,
              boxShadow: `0 0 34px ${GREEN}AA, 0 0 76px ${GREEN}55`,
              height: interpolate(grow, [0, 1], [headMin, trackLength], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />

          {/* ברק עדין בראש המילוי */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              width: trackThickness + 26,
              height: 14,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${P.white} 0%, ${GREEN_LIGHT} 100%)`,
              boxShadow: `0 0 30px ${P.white}AA, 0 0 60px ${GREEN}`,
              bottom: interpolate(grow, [0, 1], [headMin, trackLength], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: "-50% 50%",
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
                  left: "50%",
                  bottom: (i / span) * trackLength,
                  translate: "-50% 50%",
                  height: isMajor ? 4 : 2,
                  width: isMajor ? trackThickness + 22 : trackThickness - 12,
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

        {/* ── כיתובי אבני הדרך לאורך צדו הימני של הפס ── */}
        {ticks
          .filter((i) => i % 5 === 0)
          .map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: trackLeft + trackThickness + LABEL_GAP,
                width: LABEL_BOX,
                textAlign: "left",
                bottom: (i / span) * trackLength,
                translate: "0 50%",
                transformOrigin: "0% 50%",
                fontFamily,
                fontWeight: 700,
                fontSize: i === span ? 52 : 40,
                lineHeight: 1,
                color: i === span ? GREEN_LIGHT : P.white,
                textShadow:
                  i === span
                    ? `0 0 26px ${GREEN}`
                    : "0 4px 14px rgba(0,0,0,0.5)",
                opacity: interpolate(rawAge, [i - 1.2, i], [0.35, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                scale: interpolate(
                  i === span ? sinceEnd : -1,
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
            marginTop: 26,
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

/* ══════════════════════════════════════════════════════════
   הגרסה האופקית — נשמרה כמו שאושרה קודם
   ══════════════════════════════════════════════════════════ */
const AgeBarHorizontal: React.FC<InnerProps> = ({
  startFrame = 0,
  durationInFrames = 40,
  fromAge = 0,
  toAge = 15,
  trackLength,
  trackThickness,
  caption,
  style,
}) => {
  const { grow, rawAge, age, tickPhase, sinceEnd, intro, local } = useGrowth(
    startFrame,
    durationInFrames,
    fromAge,
    toAge,
  );
  const { width: canvasWidth } = useVideoConfig();

  /** אומדן חצי־הרוחב של המספר כולל הפופ — לשמירה בתוך הפריים */
  const numberHalf =
    NUMBER_SIZE * 0.35 * String(Math.max(fromAge, toAge)).length * 1.2 + 12;
  /** המרחק מקצה המסילה לקצה הקנבס, בהנחה שהפס ממורכז */
  const sideRoom = Math.max(0, (canvasWidth - trackLength) / 2);
  const headMin = trackThickness * 0.9;
  const span = Math.max(1, toAge - fromAge);
  const ticks = Array.from({ length: span + 1 }, (_, i) => i);

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
      <div style={{ position: "relative", width: trackLength, height: 230 }}>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: Math.min(
              Math.max(
                interpolate(grow, [0, 1], [headMin, trackLength], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                numberHalf - sideRoom,
              ),
              trackLength + sideRoom - numberHalf,
            ),
            translate: "-50% 0",
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
            fontSize: NUMBER_SIZE,
            lineHeight: 1,
            color: P.white,
            whiteSpace: "nowrap",
            textShadow: `0 0 ${interpolate(grow, [0, 1], [34, 96], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px ${GREEN}CC, 0 14px 42px rgba(0,0,0,0.6)`,
          }}
        >
          {age}
        </div>

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
            left: interpolate(grow, [0, 1], [headMin, trackLength], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: "-50% 0",
            scale: interpolate(sinceEnd, [0, 8, 18], [1, 1.35, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.4, 0.3, 1),
              output: "perceptual-scale",
            }),
          }}
        />
      </div>

      <div
        style={{
          position: "relative",
          width: trackLength,
          height: trackThickness,
          borderRadius: 999,
          background: "rgba(6,20,12,0.55)",
          border: "2px solid rgba(255,255,255,0.16)",
          boxShadow: "inset 0 4px 18px rgba(0,0,0,0.55)",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${GREEN_DEEP} 0%, ${GREEN} 55%, ${GREEN_LIGHT} 100%)`,
            boxShadow: `0 0 34px ${GREEN}AA, 0 0 76px ${GREEN}55`,
            width: interpolate(grow, [0, 1], [headMin, trackLength], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "50%",
            translate: "-50% -50%",
            width: 14,
            height: trackThickness + 26,
            borderRadius: 999,
            background: `linear-gradient(180deg, ${P.white} 0%, ${GREEN_LIGHT} 100%)`,
            boxShadow: `0 0 30px ${P.white}AA, 0 0 60px ${GREEN}`,
            left: interpolate(grow, [0, 1], [headMin, trackLength], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />

        {ticks.map((i) => {
          const isMajor = i % 5 === 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: "50%",
                left: (i / span) * trackLength,
                translate: "-50% -50%",
                width: isMajor ? 4 : 2,
                height: isMajor ? trackThickness + 22 : trackThickness - 8,
                borderRadius: 999,
                background: P.white,
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

      <div
        style={{
          position: "relative",
          width: trackLength,
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
                left: (i / span) * trackLength,
                translate: "-50% 0",
                fontFamily,
                fontWeight: 700,
                fontSize: i === span ? 46 : 36,
                color: i === span ? GREEN_LIGHT : P.white,
                textShadow:
                  i === span
                    ? `0 0 26px ${GREEN}`
                    : "0 4px 14px rgba(0,0,0,0.5)",
                opacity: interpolate(rawAge, [i - 1.2, i], [0.35, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                scale: interpolate(
                  i === span ? sinceEnd : -1,
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
