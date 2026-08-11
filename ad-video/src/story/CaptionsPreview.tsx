import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fontFamily } from "../font";
import { P } from "../pitch/theme";
import { Captions } from "./components/Captions";
import { CUES, FPS, TOTAL_DURATION } from "./timeline";

/**
 * קומפוזיציית בדיקה לכתוביות בלבד.
 *
 * הרקע הוא מדרג כהה עם פס בהיר בגובה הכתוביות — כדי לבדוק
 * שהקו המתאר מחזיק קריאוּת גם על צילום בהיר. הסרגל למעלה מראה
 * את הזמן ואת החלון הפעיל, וקווי העזר מסמנים את השוליים הבטוחים.
 */
export const CaptionsPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / FPS;
  const active = CUES.find(
    (cue) => seconds >= cue.start && seconds < cue.end,
  );

  return (
    <AbsoluteFill style={{ background: P.ink }}>
      {/* דמה לצילום: מדרג כהה ופס בהיר בדיוק מאחורי הכתוביות */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, ${P.deep} 0%, ${P.ink} 55%, #000 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1180,
          height: 300,
          background:
            "linear-gradient(90deg, #F8FAFC 0%, #94A3B8 45%, #1E293B 100%)",
          opacity: 0.85,
        }}
      />

      <Captions guides />

      {/* סרגל מידע — לא חלק מהעיצוב, רק לבדיקה */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 60,
          textAlign: "center",
          fontFamily,
          fontWeight: 700,
          fontSize: 40,
          color: P.cyan,
          direction: "rtl",
        }}
      >
        {`${seconds.toFixed(2)}s · פריים ${frame} · ${
          active ? `${active.start}–${active.end}` : "שקט"
        }`}
      </div>
    </AbsoluteFill>
  );
};

export const CAPTIONS_PREVIEW_DURATION = TOTAL_DURATION;
