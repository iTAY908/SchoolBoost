import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { Words } from "./Words";
import { WorkCard } from "./WorkCard";

export const WALL_DURATION = 100;

const CARD_W = 250;
const ROW_GAP = 46;
const COL_GAP = 40;
const PER_ROW = 7;

/**
 * כל שורה נעה בכיוון אחר — כך הקיר נראה כמו מרחב ולא כמו רצועה.
 * ארבע שורות כדי שהקיר ייצא מהמסך למעלה ולמטה ולא ירחף במרכזו.
 */
const ROWS: readonly { from: number; to: number; offset: number }[] = [
  { from: 170, to: -230, offset: 0 },
  { from: -240, to: 200, offset: 7 },
  { from: 100, to: -300, offset: 14 },
  { from: -180, to: 240, offset: 3 },
];

/**
 * ── פעימה 2 · קיר העבודות (52–152) ───────────────────────
 * קיר של "תמונות ממוזערות" מופשטות שנע בפרספקטיבה תלת־ממדית
 * מאחורי שכבת כהות. מעליו מתחלפות שתי שורות — סוגי העבודות
 * שהלקוח מונה בסרטון עצמו.
 *
 * הכרטיסים מופשטים לחלוטין: אין בהם צילום, לוגו או תוכן חיצוני.
 */
export const ShowcaseWall: React.FC = () => {
  const frame = useCurrentFrame();

  /* הזווית סביב ציר Y מחושבת כמספר ומורכבת לטקסט —
     `interpolate` של רמושן לא יודע לפרש את צורת הציר ("y 12deg"). */
  const yaw = interpolate(frame, [0, WALL_DURATION], [-17, -9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill name="ShowcaseWall" style={{ overflow: "hidden" }}>
      <AbsoluteFill
        name="WallStage"
        style={{
          alignItems: "center",
          justifyContent: "center",
          perspective: 1700,
          opacity: interpolate(frame, [0, 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          /* דחיפה איטית פנימה לאורך כל הפעימה */
          scale: interpolate(frame, [0, WALL_DURATION], [1.04, 1.16], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.ease),
            output: "perceptual-scale",
          }),
        }}
      >
        {/* הקיר מסתובב סביב ציר Y — נותן את העומק */}
        <Interactive.Div
          name="WallPlane"
          style={{
            transformStyle: "preserve-3d",
            rotate: `y ${yaw}deg`,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: ROW_GAP,
              rotate: "-7deg",
            }}
          >
            {ROWS.map((row, r) => (
              <div
                key={r}
                style={{
                  display: "flex",
                  gap: COL_GAP,
                  translate: interpolate(
                    frame,
                    [0, WALL_DURATION],
                    [`${row.from}px`, `${row.to}px`],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.out(Easing.quad),
                    },
                  ),
                }}
              >
                {Array.from({ length: PER_ROW }).map((_, i) => (
                  <WorkCard key={i} index={row.offset + i} width={CARD_W} />
                ))}
              </div>
            ))}
          </div>
        </Interactive.Div>
      </AbsoluteFill>

      {/* שכבת כהות — הכרטיסים נשארים קריאים בקצוות, הטקסט שולט במרכז */}
      <AbsoluteFill
        name="Scrim"
        style={{
          background:
            "linear-gradient(180deg, rgba(12,4,32,0.72) 0%, rgba(12,4,32,0.22) 20%, rgba(12,4,32,0.80) 41%, rgba(12,4,32,0.84) 59%, rgba(12,4,32,0.22) 80%, rgba(12,4,32,0.72) 100%)",
        }}
      />

      {/* שורה 1 — נכנסת, מחזיקה, ויוצאת כלפי מעלה */}
      <AbsoluteFill
        name="LineOne"
        style={{ justifyContent: "center", alignItems: "center", padding: 90 }}
      >
        <Words
          words={[
            { text: "סרטון" },
            { text: "בר" },
            { text: "מצווה" },
            { text: "מושקע", accent: true },
          ]}
          startAt={5}
          stagger={5}
          exitAt={40}
          fontSize={108}
          maxWidth={880}
        />
      </AbsoluteFill>

      {/* שורה 2 — נכנסת אחרי שהראשונה עזבה, ונשארת עד המעבר */}
      <AbsoluteFill
        name="LineTwo"
        style={{ justifyContent: "center", alignItems: "center", padding: 90 }}
      >
        <Words
          words={[
            { text: "סרטון" },
            { text: "לרשתות" },
            { text: "חברתיות", accent: true },
          ]}
          startAt={52}
          stagger={5}
          fontSize={108}
          maxWidth={880}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
