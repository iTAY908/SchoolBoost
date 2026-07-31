import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../font";
import { P, sec } from "../theme";
import { CARDS, type Cue } from "../timeline";

/**
 * כתוביות מסונכרנות, מילה־אחר־מילה.
 *
 * שני מצבים:
 *  • `masked` — פאנל מטושטש אטום. משמש בחלק 1, שבו לקובץ המקור יש
 *    כתוביות צרובות בפיקסלים; הפאנל יושב בדיוק מעליהן ומוחק אותן.
 *  • רגיל — טקסט נקי בלי פאנל. משמש בחלק 2, שהוא צילום גולמי.
 */
export const Captions: React.FC<{
  cues: readonly Cue[];
  masked?: boolean;
}> = ({ cues, masked = false }) => {
  const frame = useCurrentFrame();

  const active = cues.find(
    (cue) =>
      cue.text.length > 0 &&
      frame >= sec(cue.start) &&
      frame < sec(cue.end),
  );

  /* בחלון של קלף מעוצב הטקסט הוא חלק מהעיצוב */
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

  const maskedStyle: React.CSSProperties = masked
    ? {
        top: 1140,
        height: 320,
        borderRadius: 44,
        backdropFilter: "blur(34px) saturate(125%)",
        /* אטום כמעט לגמרי — כתובית לבנה על פריים כהה מבצבצת גם דרך טשטוש */
        background: "rgba(30,10,71,0.94)",
        border: "2px solid rgba(251,191,36,0.28)",
        boxShadow:
          "0 30px 70px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
      }
    : {
        top: 1210,
        height: 300,
      };

  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        right: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 42px",
        ...maskedStyle,
        /* חיתוך חד — כל דהייה חושפת את הכתובית הצרובה שמתחת */
        opacity: masked
          ? interpolate(frame, [to - 1, to], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 1,
        scale: interpolate(frame, [from, from + 9], [0.95, 1], {
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
          fontSize: masked ? 78 : 88,
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
                /* בלי פאנל צריך קו מתאר כדי שהטקסט ייקרא על כל רקע */
                WebkitTextStroke: masked ? undefined : "3px rgba(14,5,36,0.55)",
                paintOrder: "stroke fill",
                textShadow: isActive
                  ? `0 0 38px ${P.gold}88, 0 6px 22px rgba(0,0,0,0.75)`
                  : "0 6px 22px rgba(0,0,0,0.75)",
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
