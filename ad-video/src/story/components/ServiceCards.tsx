import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../font";
import { P } from "../../pitch/theme";

/**
 * ── כרטיס שירות ─────────────────────────────────────────
 *
 * תג קטן שנוחת מעל הצילום החי בדיוק כשהדובר מזכיר שירות.
 * הטקסט היחיד שמותר להיכנס לכאן הוא מילים שהדובר אומר בתמלול
 * (`CUES` ב-`../timeline`) — **אין** מספרים, אחוזים, דירוגים או
 * הבטחות. הכרטיס מציג שם שירות בלבד.
 *
 * העיצוב: לוח סגול כהה עם מסגרת זהב, סמל גיאומטרי בריבוע מעוגל,
 * וקו זהב שנמתח מתחת לכיתוב. הרקע בצילום הוא קיר בהיר מאוד, ולכן
 * הלוח כהה ואטום כמעט לגמרי — זה מה שמחזיק את הקריאוּת.
 *
 * ── אזורים אסורים בקנבס 1080x1920 ──
 *  • y 1250–1590 — תיבת הכתוביות. אסור להיכנס.
 *  • מרכז הפריים (בערך y 480–1250) — הפנים והידיים של הדובר.
 * לכן ברירת המחדל היא הרצועה העליונה: y 250 בפינה השמאלית העליונה,
 * גובה כולל של כ-165px — נגמר הרבה מעל הראש.
 */

/** גבול תחתון בטוח לרצועה העליונה — מתחת לזה מתחיל הראש */
export const SAFE_TOP_BAND_BOTTOM = 470;
/** ראש תיבת הכתוביות — אסור לחצות אותו כלפי מטה */
export const CAPTION_BAND_TOP = 1250;

export type ServiceMark = "star" | "network" | "play" | "spark";

export type ServiceCardProps = {
  /** שם השירות — חייב להילקח מהתמלול של הדובר */
  label: string;
  /** הפריים שבו הכרטיס מתחיל להיכנס, יחסית ל-Sequence העוטף */
  startFrame?: number;
  /** אורך החלון בפריימים — היציאה ננעלת לסופו */
  durationInFrames?: number;
  /** הסמל הגיאומטרי שבריבוע */
  mark?: ServiceMark;
  /** מרחק מהקצה האופקי (לפי `anchor`), בפיקסלים */
  x?: number;
  /** מרחק מראש הקנבס, בפיקסלים */
  y?: number;
  /** מאיזה צד נמדד `x`, וממנו גם מגיעה הכניסה */
  anchor?: "left" | "right";
  /** מכפיל גודל כללי (1 = ברירת המחדל, כ-165px גובה) */
  size?: number;
  /** גודל הכיתוב בפיקסלים לפני `size` */
  fontSize?: number;
  /** אורך הכניסה בפריימים */
  enterFrames?: number;
  /** אורך היציאה בפריימים */
  exitFrames?: number;
  /** עיצוב נוסף לעטיפה — לשימוש העורך */
  style?: React.CSSProperties;
};

/** יחידות הבסיס של הכרטיס, לפני המכפיל `size` */
const TILE = 82;
const PAD_Y = 22;
const PAD_X = 26;
const GAP = 22;
const RADIUS = 30;

export const ServiceCard: React.FC<ServiceCardProps> = ({
  label,
  startFrame = 0,
  durationInFrames = 90,
  mark = "spark",
  x = 64,
  y = 250,
  anchor = "left",
  size = 1,
  fontSize = 58,
  enterFrames = 15,
  exitFrames = 12,
  style,
}) => {
  const frame = useCurrentFrame();
  /** הזמן המקומי — שלילי לפני שהכרטיס נכנס */
  const local = frame - startFrame;

  /* היציאה ננעלת לסוף החלון. אם החלון קצר מהאנימציות, הן נדחפות
     קדימה ולא חופפות — כך הכרטיס בטוח גם בחלון של 20 פריימים. */
  const outStart = Math.max(enterFrames, durationInFrames - exitFrames);
  const outEnd = outStart + exitFrames;

  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;

  const appear = interpolate(local, [0, enterFrames * 0.6], [0, 1], clamp);
  const disappear = interpolate(local, [outStart, outEnd], [1, 0], clamp);

  /** כיוון הכניסה — הכרטיס מחליק פנימה מהקצה שאליו הוא צמוד */
  const dir = anchor === "right" ? 1 : -1;

  const tx =
    interpolate(local, [0, enterFrames], [dir * 54, 0], {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }) +
    interpolate(local, [outStart, outEnd], [0, dir * 30], {
      ...clamp,
      easing: Easing.in(Easing.quad),
    });

  const ty =
    interpolate(local, [0, enterFrames], [22, 0], {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }) +
    interpolate(local, [outStart, outEnd], [0, -18], {
      ...clamp,
      easing: Easing.in(Easing.quad),
    });

  const pop =
    interpolate(local, [0, enterFrames], [0.86, 1], {
      ...clamp,
      easing: Easing.bezier(0.16, 1.4, 0.3, 1),
      output: "perceptual-scale",
    }) *
    interpolate(local, [outStart, outEnd], [1, 0.94], {
      ...clamp,
      output: "perceptual-scale",
    });

  const tilt = interpolate(local, [0, enterFrames], [dir * 3, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1.3, 0.3, 1),
  });

  /** ההילה הסגולה נדלקת בנחיתה ואז נרגעת — זה ה"פאנץ'" של הכרטיס */
  const halo = interpolate(local, [2, 12, 34], [0, 0.85, 0.3], clamp);
  /** הקו הזהוב נמתח מימין לשמאל, בכיוון הקריאה של העברית */
  const rule = interpolate(local, [5, 22], [0, 100], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <Interactive.Div
      name={`ServiceCard-${label}`}
      style={{
        position: "absolute",
        top: y,
        ...(anchor === "right" ? { right: x } : { left: x }),
        direction: "rtl",
        fontFamily,
        opacity: appear * disappear,
        translate: `${tx}px ${ty}px`,
        scale: pop * size,
        transformOrigin: anchor === "right" ? "100% 0%" : "0% 0%",
        rotate: `${tilt}deg`,
        ...style,
      }}
    >
      {/* הילה רכה מאחורי הלוח — נדלקת בנחיתה */}
      <div
        style={{
          position: "absolute",
          inset: -34,
          borderRadius: RADIUS + 26,
          background: `radial-gradient(ellipse at 50% 50%, ${P.bright}66 0%, rgba(14,5,36,0) 70%)`,
          opacity: halo,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: GAP,
          padding: `${PAD_Y}px ${PAD_X}px`,
          borderRadius: RADIUS,
          background: `linear-gradient(135deg, rgba(30,10,71,0.94) 0%, rgba(14,5,36,0.92) 100%)`,
          border: `2px solid ${P.gold}88`,
          boxShadow: `0 22px 54px rgba(6,2,18,0.62), inset 0 1px 0 ${P.glow}55`,
        }}
      >
        {/* הריבוע עם הסמל */}
        <div
          style={{
            width: TILE,
            height: TILE,
            flex: "none",
            borderRadius: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(150deg, ${P.violet} 0%, ${P.bright} 100%)`,
            boxShadow: `0 0 26px ${P.bright}77, inset 0 2px 0 rgba(255,255,255,0.22)`,
            /* פופ קטן ומאוחר של הסמל — נותן לכרטיס שני פעימות */
            scale: interpolate(local, [4, 18], [0.7, 1], {
              ...clamp,
              easing: Easing.bezier(0.16, 1.5, 0.3, 1),
              output: "perceptual-scale",
            }),
          }}
        >
          <Mark mark={mark} size={TILE * 0.58} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize,
              lineHeight: 1.05,
              color: P.white,
              whiteSpace: "nowrap",
              textShadow: "0 6px 20px rgba(0,0,0,0.6)",
            }}
          >
            {label}
          </div>

          {/* קו הזהב שנמתח מתחת לכיתוב */}
          <div style={{ height: 6, borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${rule}%`,
                borderRadius: 999,
                background: `linear-gradient(270deg, ${P.gold} 0%, ${P.amber} 60%, ${P.glow} 100%)`,
                boxShadow: `0 0 18px ${P.gold}AA`,
              }}
            />
          </div>
        </div>
      </div>
    </Interactive.Div>
  );
};

/**
 * ── הסמלים ──────────────────────────────────────────────
 * צורות גיאומטריות בלבד, בקו זהב. אין בהן טקסט ואין בהן נתון.
 */
const Mark: React.FC<{ mark: ServiceMark; size: number }> = ({
  mark,
  size,
}) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 100 100",
    fill: "none",
    stroke: P.gold,
    strokeWidth: 8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { filter: `drop-shadow(0 0 10px ${P.gold}88)` },
  };

  if (mark === "star") {
    /* מגן דוד — שני משולשים, מתאים לבר מצווה */
    return (
      <svg {...common}>
        <polygon points="50,8 91,79 9,79" />
        <polygon points="50,92 9,21 91,21" />
      </svg>
    );
  }

  if (mark === "network") {
    /* גלי שידור מנקודה אחת — נקרא ברור גם ב-45px */
    return (
      <svg {...common}>
        <path d="M50 76 A24 24 0 0 0 26 52" />
        <path d="M70 76 A44 44 0 0 0 26 32" />
        <path d="M90 76 A64 64 0 0 0 26 12" />
        <circle cx="26" cy="76" r="10" fill={P.gold} stroke="none" />
      </svg>
    );
  }

  if (mark === "play") {
    return (
      <svg {...common}>
        <circle cx="50" cy="50" r="40" />
        <path d="M40 32 L70 50 L40 68 Z" fill={P.gold} />
      </svg>
    );
  }

  /* spark — ניצוץ ארבע־קצוות */
  return (
    <svg {...common} strokeWidth={0}>
      <path
        d="M50 6 C55 33 67 45 94 50 C67 55 55 67 50 94 C45 67 33 55 6 50 C33 45 45 33 50 6 Z"
        fill={P.gold}
      />
    </svg>
  );
};

/**
 * עוטף נוחות: מרכיב כמה כרטיסים בבת אחת מתוך רשימה אחת.
 * כל פריט הוא בדיוק ה-props של `ServiceCard`.
 */
export const ServiceCards: React.FC<{
  items: readonly ServiceCardProps[];
}> = ({ items }) => (
  <>
    {items.map((item) => (
      <ServiceCard key={`${item.label}-${item.startFrame ?? 0}`} {...item} />
    ))}
  </>
);
