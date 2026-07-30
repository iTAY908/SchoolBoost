import { COLORS } from "../config";
import { fontFamily } from "../font";

/** פלטות לכרטיסי הקריאייטיב המרחפים ברקע */
const PALETTES = [
  ["#1B2A4A", "#31507F"],
  ["#3A1145", "#7A2A6B"],
  ["#0F3B36", "#1E6E5C"],
  ["#4A1524", "#9A2F46"],
  ["#232338", "#4C4A72"],
  ["#4A2A0C", "#9A6321"],
];

/**
 * דמה של כרטיס קריאייטיב — תמונה ממוזערת של סרטון.
 * מופשט לגמרי (ללא תוכן חיצוני) כך שאפשר להחליף בקלות
 * ב-<CanvasImage src={staticFile("...")} /> עם עבודות אמיתיות.
 */
export const CreativeCard: React.FC<{
  index: number;
  width?: number;
  label?: string;
}> = ({ index, width = 260, label }) => {
  const [from, to] = PALETTES[index % PALETTES.length];
  const height = width * 1.6;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.11,
        background: `linear-gradient(150deg, ${from} 0%, ${to} 100%)`,
        border: "2px solid rgba(255,255,255,0.22)",
        boxShadow:
          "0 30px 60px rgba(45,0,25,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: width * 0.09,
        gap: width * 0.045,
        direction: "rtl",
      }}
    >
      {/* ברק אלכסוני על גבי הכרטיס */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(115deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%)",
        }}
      />

      {/* כפתור נגן במרכז */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          translate: "-50% -50%",
          width: width * 0.26,
          height: width * 0.26,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: `${width * 0.055}px solid transparent`,
            borderBottom: `${width * 0.055}px solid transparent`,
            borderRight: `${width * 0.09}px solid ${COLORS.ink}`,
            marginRight: width * 0.02,
          }}
        />
      </div>

      {label ? (
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: width * 0.085,
            color: "rgba(255,255,255,0.95)",
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {label}
        </div>
      ) : null}

      {/* פסי טקסט מדומים */}
      <div
        style={{
          height: width * 0.045,
          width: "78%",
          borderRadius: 999,
          background: "rgba(255,255,255,0.55)",
        }}
      />
      <div
        style={{
          height: width * 0.045,
          width: "52%",
          borderRadius: 999,
          background: "rgba(255,255,255,0.3)",
        }}
      />
    </div>
  );
};
