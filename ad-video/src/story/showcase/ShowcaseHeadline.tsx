import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { P } from "../../pitch/theme";
import { Words } from "./Words";

export const HEADLINE_DURATION = 62;

/**
 * ── פעימה 1 · הכותרת (0–62) ──────────────────────────────
 * הצהרה אחת, קצרה, במילים של הלקוח עצמו: "עריכת וידאו מקצועית".
 * מאחוריה טבעת אור מתפוצצת, מעליה סמל הנגן של המותג, ומתחתיה
 * קו זהב שנפתח מהמרכז וסוגר את הבלוק.
 */
export const ShowcaseHeadline: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="ShowcaseHeadline"
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 90,
      }}
    >
      {/* טבעת אור שמתרחבת ברגע ההופעה */}
      <Interactive.Div
        name="Burst"
        style={{
          position: "absolute",
          width: 940,
          height: 940,
          borderRadius: "50%",
          border: `5px solid ${P.gold}`,
          /* הפריים הראשון כבר נושא תמונה — הרצף עשוי להיחתך פנימה
             בחיתוך חד, ואסור שיתחיל בריק. */
          opacity: interpolate(frame, [0, 4, 30], [0.38, 0.5, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 32], [0.32, 1.2], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
            output: "perceptual-scale",
          }),
        }}
      />

      {/* הילה סגולה רכה שמרימה את הטקסט מהרקע */}
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(10,3,26,0.62) 0%, rgba(10,3,26,0.28) 46%, rgba(10,3,26,0) 70%)",
        }}
      />

      {/* הבלוק כולו מקבל דחיפה איטית פנימה — יוקרה, לא רעש */}
      <Interactive.Div
        name="Block"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 54,
          scale: interpolate(frame, [0, HEADLINE_DURATION], [1, 1.05], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.ease),
            output: "perceptual-scale",
          }),
        }}
      >
        {/* סמל הנגן — מוטיב הלוגו, בזהב */}
        <Interactive.Div
          name="Mark"
          style={{
            width: 108,
            height: 108,
            borderRadius: "50%",
            border: `4px solid ${P.gold}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 46px ${P.gold}55`,
            opacity: interpolate(frame, [0, 6], [0.5, 0.95], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            scale: interpolate(frame, [0, 16], [0.6, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.4, 0.3, 1),
              output: "perceptual-scale",
            }),
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: "20px solid transparent",
              borderBottom: "20px solid transparent",
              borderRight: `32px solid ${P.gold}`,
              marginRight: 6,
            }}
          />
        </Interactive.Div>

        <Words
          words={[
            { text: "עריכת" },
            { text: "וידאו" },
            { text: "מקצועית", accent: true },
          ]}
          startAt={4}
          stagger={6}
          fontSize={138}
          maxWidth={880}
        />

        {/* קו זהב שנפתח מהמרכז וסוגר את הבלוק */}
        <Interactive.Div
          name="Rule"
          style={{
            height: 6,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${P.amber} 0%, ${P.gold} 50%, ${P.amber} 100%)`,
            boxShadow: `0 0 28px ${P.gold}AA`,
            width: interpolate(frame, [26, 44], [0, 440], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        />
      </Interactive.Div>
    </AbsoluteFill>
  );
};
