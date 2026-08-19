import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { fontFamily } from "../../font";
import { CREATOR, P } from "../../pitch/theme";
import { LogoBadge } from "../components/LogoBadge";

export const BRAND_DURATION = 53;

/**
 * ── פעימה 3 · נחיתת המותג (142–195) ──────────────────────
 * הסמל האמיתי של הלקוח בתוך טבעות זהב מסתובבות, ומתחתיו
 * שם המותג, קו זהב ושם המשתמש. נחיתה שקטה — אין כאן שום
 * הבטחה, מספר או נתון, רק החתימה.
 */
export const ShowcaseBrand: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="ShowcaseBrand"
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 90,
      }}
    >
      {/*
        טבעות שממסגרות את כל הנעילה מבחוץ — לא עוברות דרך הטקסט.
        שתיים מהן קשתות (רק שני צדדים צבועים) כדי שהסיבוב אכן ייראה:
        עיגול מלא שמסתובב נראה סטטי לחלוטין.
      */}
      <Interactive.Div
        name="Rings"
        style={{
          position: "absolute",
          width: 1060,
          height: 1060,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {/* טבעת מלאה דקה — עוגן שקט */}
        <div
          style={{
            position: "absolute",
            width: 1040,
            height: 1040,
            borderRadius: "50%",
            border: "2px solid rgba(251,191,36,0.20)",
            scale: interpolate(frame, [0, 26], [0.86, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.2, 0.3, 1),
              output: "perceptual-scale",
            }),
          }}
        />

        {/* קשת חיצונית — מסתובבת עם כיוון השעון */}
        <div
          style={{
            position: "absolute",
            width: 900,
            height: 900,
            borderRadius: "50%",
            border: "4px solid transparent",
            borderTopColor: "rgba(251,191,36,0.85)",
            borderRightColor: "rgba(251,191,36,0.32)",
            boxShadow: "0 0 46px rgba(251,191,36,0.22)",
            rotate: interpolate(
              frame,
              [0, BRAND_DURATION],
              ["-46deg", "18deg"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              },
            ),
            scale: interpolate(frame, [0, 24], [0.7, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.3, 0.3, 1),
              output: "perceptual-scale",
            }),
          }}
        />

        {/* קשת פנימית — מסתובבת נגד כיוון השעון */}
        <div
          style={{
            position: "absolute",
            width: 780,
            height: 780,
            borderRadius: "50%",
            border: "3px solid transparent",
            borderBottomColor: "rgba(251,191,36,0.55)",
            borderLeftColor: "rgba(245,158,11,0.22)",
            rotate: interpolate(
              frame,
              [0, BRAND_DURATION],
              ["38deg", "-16deg"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              },
            ),
            scale: interpolate(frame, [0, 30], [0.72, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.3, 0.3, 1),
              output: "perceptual-scale",
            }),
          }}
        />
      </Interactive.Div>

      <Interactive.Div
        name="Lockup"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          scale: interpolate(frame, [0, BRAND_DURATION], [1, 1.04], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.ease),
            output: "perceptual-scale",
          }),
        }}
      >
        {/* הסמל, על הילה כהה שמפרידה אותו מהגרדיאנט הסגול */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 700,
              height: 700,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(9,3,26,0.78) 0%, rgba(9,3,26,0.42) 44%, rgba(9,3,26,0) 70%)",
            }}
          />
          <LogoBadge
            src={staticFile("source/logo.png")}
            size={360}
            ringWidth={7}
            startFrame={2}
          />
        </div>

        {/* שם המותג */}
        <Interactive.Div
          name="BrandName"
          style={{
            direction: "ltr",
            fontFamily,
            fontWeight: 900,
            fontSize: 112,
            letterSpacing: 8,
            lineHeight: 1,
            color: P.white,
            textShadow:
              "0 0 60px rgba(255,255,255,0.32), 0 12px 34px rgba(8,2,22,0.7)",
            opacity: interpolate(frame, [14, 26], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [14, 32], ["0px 38px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          {CREATOR.name}
        </Interactive.Div>

        {/* קו זהב שנפתח מהמרכז */}
        <Interactive.Div
          name="Rule"
          style={{
            height: 5,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${P.amber} 0%, ${P.gold} 50%, ${P.amber} 100%)`,
            boxShadow: `0 0 26px ${P.gold}AA`,
            width: interpolate(frame, [24, 40], [0, 360], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        />

        {/* שם המשתמש — החתימה הסופית */}
        <Interactive.Div
          name="Handle"
          style={{
            direction: "ltr",
            fontFamily,
            fontWeight: 700,
            fontSize: 54,
            letterSpacing: 5,
            color: P.gold,
            textShadow: "0 6px 22px rgba(8,2,22,0.7)",
            opacity: interpolate(frame, [30, 42], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [30, 46], ["0px 24px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          {CREATOR.handle}
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
