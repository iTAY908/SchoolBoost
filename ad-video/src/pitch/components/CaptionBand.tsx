import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../font";
import { P, sec } from "../theme";
import { CARDS, CUES } from "../timeline";

/**
 * פס הכתוביות.
 *
 * שתי מטרות:
 * 1. מציג את הכתובית הנוכחית מילה־אחר־מילה, כשהמילה הפעילה מודגשת בזהב.
 * 2. הפאנל המטושטש יושב בדיוק מעל האזור שבו יושבות הכתוביות הצרובות
 *    של קובץ המקור (בערך 64%–72% מגובה הפריים), ומסתיר אותן.
 */
export const CaptionBand: React.FC = () => {
  const frame = useCurrentFrame();

  const active = CUES.find(
    (cue) => frame >= sec(cue.start) && frame < sec(cue.end),
  );

  /* בחלון של קלף מעוצב הטקסט הוא חלק מהעיצוב — בלי פס כתוביות מעליו */
  const inCard = CARDS.some(
    (card) => frame >= sec(card.start) && frame < sec(card.end),
  );

  if (!active || inCard) {
    return null;
  }

  const from = sec(active.start);
  const to = sec(active.end);
  const words = active.text.split(" ");
  const perWord = (to - from) / words.length;
  const activeIndex = Math.min(
    words.length - 1,
    Math.floor((frame - from) / perWord),
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        right: 56,
        /* מכסה 59%–76% מגובה הפריים — בדיוק הרצועה של הכתוביות הצרובות */
        top: 1140,
        height: 320,
        borderRadius: 44,
        /* הטשטוש הוא מה שמוחק את הכתוביות הצרובות שמתחת */
        backdropFilter: "blur(34px) saturate(125%)",
        /* אטום כמעט לגמרי — כתובית לבנה על פריים שחור מבצבצת גם דרך טשטוש חזק */
        background: "rgba(30,10,71,0.94)",
        border: "2px solid rgba(251,191,36,0.28)",
        boxShadow:
          "0 30px 70px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 54px",
        /* חיתוך חד בכניסה וביציאה — כל דהייה חושפת את הכתובית
           הצרובה שמתחת, ולכן הפאנל חייב להיות אטום מהפריים הראשון */
        opacity: interpolate(frame, [to - 1, to], [1, 0], {
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
          gap: "10px 22px",
          fontFamily,
          fontWeight: 900,
          fontSize: 78,
          lineHeight: 1.2,
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
                textShadow: isActive
                  ? `0 0 38px ${P.gold}88, 0 6px 20px rgba(0,0,0,0.6)`
                  : "0 6px 20px rgba(0,0,0,0.6)",
                scale: interpolate(
                  frame,
                  [wordStart, wordStart + 5],
                  [isActive ? 1.16 : 1, 1],
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
  );
};
