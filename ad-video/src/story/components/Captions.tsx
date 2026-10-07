import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../font";
import { P } from "../../pitch/theme";
import { BLOCKED, CUES, sec, type Cue } from "../timeline";

/**
 * כתוביות מסונכרנות, מילה־אחר־מילה (קריוקי).
 *
 * שני הצילומים החדשים הם גולמיים — אין בהם כתוביות צרובות — ולכן
 * הכתוביות כאן **נקיות**: בלי פאנל מטושטש. הקריאוּת מגיעה מקו מתאר
 * כהה סביב האותיות ומצללית רכה מתחתן, כך שהטקסט עובד גם על רקע בהיר.
 */

/** שוליים בטוחים מהצדדים — הקנבס הוא 1080 רחב */
const SIDE = 96;
/** ראש תיבת הכתוביות; שליש תחתון, הרחק מקצה המסך */
const TOP = 1250;
const BOX_HEIGHT = 340;

const FADE_IN = 4;

export const Captions: React.FC<{
  cues?: readonly Cue[];
  /** קווי עזר לשוליים הבטוחים — לתצוגת בדיקה בלבד */
  guides?: boolean;
}> = ({ cues = CUES, guides = false }) => {
  const frame = useCurrentFrame();

  const index = cues.findIndex(
    (cue) =>
      cue.text.length > 0 && frame >= sec(cue.start) && frame < sec(cue.end),
  );
  const active = index === -1 ? undefined : cues[index];

  /* בכרטיס הפתיחה, בסטינגר ובכרטיס הסיום הגרפיקה מדברת בעצמה */
  const blocked = BLOCKED.some(
    (win) => frame >= sec(win.start) && frame < sec(win.end),
  );

  if (!active || blocked) {
    return guides ? <Guides /> : null;
  }

  const from = sec(active.start);
  const to = sec(active.end);
  const words = active.text.split(" ");
  const perWord = (to - from) / words.length;
  const activeIndex = Math.min(
    words.length - 1,
    Math.floor((frame - from) / perWord),
  );

  /* כתובית שנצמדת לקודמת נכנסת בלי דהייה, אחרת היא מהבהבת בתפר */
  const prev = cues[index - 1];
  const continuous = prev !== undefined && sec(prev.end) >= from;

  return (
    <>
      {guides ? <Guides /> : null}
      <div
        style={{
          position: "absolute",
          left: SIDE,
          right: SIDE,
          top: TOP,
          height: BOX_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: continuous
            ? 1
            : interpolate(frame, [from, from + FADE_IN], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
          scale: interpolate(frame, [from, from + 9], [0.94, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.3, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <div
          style={{
            direction: "rtl",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            alignContent: "center",
            gap: "6px 20px",
            width: "100%",
            fontFamily,
            fontWeight: 900,
            fontSize: 84,
            lineHeight: 1.24,
            textAlign: "center",
          }}
        >
          {words.map((word, i) => {
            const wordStart = from + i * perWord;
            const isActive = i === activeIndex;
            const spoken = i <= activeIndex;

            return (
              <span
                key={`${word}-${i}`}
                style={{
                  display: "inline-block",
                  color: isActive ? P.gold : P.white,
                  opacity: spoken ? 1 : 0.42,
                  /* קו מתאר כהה — בלי פאנל זה מה שמחזיק את הקריאוּת */
                  WebkitTextStroke: "9px rgba(14,5,36,0.92)",
                  paintOrder: "stroke fill",
                  textShadow: isActive
                    ? `0 0 40px ${P.gold}99, 0 8px 26px rgba(0,0,0,0.85)`
                    : "0 8px 26px rgba(0,0,0,0.85)",
                  scale: interpolate(
                    frame,
                    [wordStart, wordStart + 5],
                    [isActive ? 1.14 : 1, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.bezier(0.16, 1.4, 0.3, 1),
                      output: "perceptual-scale",
                    },
                  ),
                  translate: interpolate(
                    frame,
                    [wordStart, wordStart + 6],
                    ["0px 10px", "0px 0px"],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.bezier(0.16, 1, 0.3, 1),
                    },
                  ),
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
};

/** קווי שוליים בטוחים (80px) — עוזרים לוודא בסטילס שאין גלישה */
const Guides: React.FC = () => (
  <>
    {[80, 1000].map((x) => (
      <div
        key={x}
        style={{
          position: "absolute",
          left: x,
          top: 0,
          width: 2,
          height: "100%",
          background: "rgba(34,211,238,0.55)",
        }}
      />
    ))}
  </>
);
