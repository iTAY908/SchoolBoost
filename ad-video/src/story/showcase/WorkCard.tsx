import { P } from "../../pitch/theme";

/**
 * פלטות לכרטיסי העבודה — כולן בתוך משפחת הסגול־זהב של המותג,
 * עם וריאציה בעומק כדי שהקיר לא ייראה שטוח.
 */
const PALETTES: readonly (readonly [string, string])[] = [
  ["#1B0A3E", "#4C1D95"],
  ["#2A0F52", "#7C3AED"],
  ["#140628", "#3B1178"],
  ["#3A1466", "#A855F7"],
  ["#1E0A47", "#5B21B6"],
  ["#241046", "#6D28D9"],
];

/** צבע ההדגשה על הכרטיס — זהב ברוב הכרטיסים, ציאן במיעוט */
const ACCENTS: readonly string[] = [P.gold, P.gold, P.cyan, P.gold, P.amber, P.gold];

/** משולש נגן — אותו מוטיב שחוזר בלוגו ובשאר הסרטון */
const PlayGlyph: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <div
    style={{
      width: 0,
      height: 0,
      borderTop: `${size * 0.5}px solid transparent`,
      borderBottom: `${size * 0.5}px solid transparent`,
      borderRight: `${size * 0.82}px solid ${color}`,
      marginRight: size * 0.12,
    }}
  />
);

/**
 * ── WorkCard ────────────────────────────────────────────
 * "תמונה ממוזערת" מופשטת לגמרי של סרטון — גרדיאנט, סמל נגן,
 * ופסים שמייצגים טקסט או ציר עריכה. אין כאן שום צילום, לוגו
 * או תוכן חיצוני: הקיר נועד לרמוז על גוף עבודה, לא להציג אותו.
 */
export const WorkCard: React.FC<{
  index: number;
  width?: number;
}> = ({ index, width = 260 }) => {
  const [from, to] = PALETTES[index % PALETTES.length];
  const accent = ACCENTS[index % ACCENTS.length];
  const variant = index % 3;
  const height = width * 1.58;

  return (
    <div
      style={{
        width,
        height,
        flexShrink: 0,
        borderRadius: width * 0.1,
        background: `linear-gradient(152deg, ${from} 0%, ${to} 100%)`,
        border: "2px solid rgba(255,255,255,0.16)",
        boxShadow:
          "0 40px 80px rgba(6,1,18,0.62), inset 0 1px 0 rgba(255,255,255,0.22)",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: width * 0.1,
        gap: width * 0.05,
      }}
    >
      {/* ברק אלכסוני — נותן לכרטיס תחושה של זכוכית */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(118deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 46%)",
        }}
      />

      {/* הילת צבע רכה בפינה העליונה */}
      <div
        style={{
          position: "absolute",
          top: -width * 0.3,
          right: -width * 0.25,
          width: width * 0.9,
          height: width * 0.9,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}3D 0%, rgba(0,0,0,0) 68%)`,
        }}
      />

      {variant === 0 ? (
        /* ── נגן במרכז ── */
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "42%",
            translate: "-50% -50%",
            width: width * 0.28,
            height: width * 0.28,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 28px rgba(0,0,0,0.4)",
          }}
        >
          <PlayGlyph size={width * 0.11} color={P.ink} />
        </div>
      ) : null}

      {variant === 1 ? (
        /* ── גל קול — עמודות בגבהים משתנים ── */
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "42%",
            translate: "-50% -50%",
            display: "flex",
            alignItems: "center",
            gap: width * 0.035,
            height: width * 0.42,
          }}
        >
          {[0.34, 0.66, 0.98, 0.52, 0.8, 0.4, 0.72].map((h, i) => (
            <div
              key={i}
              style={{
                width: width * 0.035,
                height: `${h * 100}%`,
                borderRadius: 999,
                background: i % 3 === 1 ? accent : "rgba(255,255,255,0.82)",
              }}
            />
          ))}
        </div>
      ) : null}

      {variant === 2 ? (
        /* ── ציר עריכה — קטעים על טיימליין ── */
        <div
          style={{
            position: "absolute",
            left: width * 0.1,
            right: width * 0.1,
            top: "40%",
            translate: "0px -50%",
            display: "flex",
            flexDirection: "column",
            gap: width * 0.055,
          }}
        >
          {[
            [0.46, 0.3],
            [0.24, 0.58],
            [0.62, 0.2],
          ].map(([a, b], i) => (
            <div key={i} style={{ display: "flex", gap: width * 0.035 }}>
              <div
                style={{
                  height: width * 0.075,
                  width: `${a * 100}%`,
                  borderRadius: width * 0.02,
                  background:
                    i === 1 ? accent : "rgba(255,255,255,0.72)",
                }}
              />
              <div
                style={{
                  height: width * 0.075,
                  width: `${b * 100}%`,
                  borderRadius: width * 0.02,
                  background: "rgba(255,255,255,0.3)",
                }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* פסים שמחליפים כותרת — מרמזים על טקסט בלי לכתוב דבר */}
      <div
        style={{
          height: width * 0.05,
          width: "74%",
          borderRadius: 999,
          background: "rgba(255,255,255,0.6)",
        }}
      />
      <div
        style={{
          height: width * 0.05,
          width: "44%",
          borderRadius: 999,
          background: `${accent}99`,
        }}
      />
    </div>
  );
};
