import { AbsoluteFill, Sequence } from "remotion";
import { fontFamily } from "../font";
import { P } from "../pitch/theme";
import { Captions } from "./components/Captions";
import { Clip } from "./components/Clip";
import { Emphasis } from "./components/Emphasis";
import {
  CAPTION_BAND_TOP,
  SAFE_TOP_BAND_BOTTOM,
  ServiceCard,
} from "./components/ServiceCards";
import { SERVICE_WINDOWS } from "./StoryVideo";
import { CLIP_B, sec } from "./timeline";

/**
 * ── תצוגת בדיקה לשכבות הגרפיקה ──────────────────────────
 *
 * ציר הזמן כאן **זהה** לציר של `StoryVideo`: פריים 0 = שנייה 0 בפלט.
 * לכן אפשר לרנדר סטיל בכל פריים ולראות בדיוק מה יקרה בסרטון האמיתי —
 * מעל הצילום האמיתי (`story-b.mp4`), עם הכתוביות האמיתיות מתחת.
 * הקומפוזיציה הזו היא כלי עבודה בלבד; היא אינה חלק מהסרטון.
 */

/**
 * ── חלונות הכרטיסים ─────────────────────────────────────
 * מקור אמת יחיד: החלונות מוגדרים ב-`StoryVideo` ומיובאים לכאן,
 * כדי שהתצוגה הזו תראה בדיוק את מה שיוצא בסרטון.
 */
export { SERVICE_WINDOWS };

export const GRAPHICS_PREVIEW_DURATION = sec(26.7);

const CLIP_B_FROM = sec(CLIP_B.at);
const CLIP_B_LEN = sec(CLIP_B.to - CLIP_B.from);

export const GraphicsPreview: React.FC<{ guides?: boolean }> = ({
  guides = false,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: P.ink }}>
      {/* הצילום האמיתי, עם אותו דירוג צבע כמו בסרטון */}
      <Sequence
        name="צילום ב׳"
        from={CLIP_B_FROM}
        durationInFrames={CLIP_B_LEN}
        layout="absolute-fill"
      >
        <Clip
          src="source/story-b.mp4"
          trimBefore={CLIP_B.from}
          durationInFrames={CLIP_B_LEN}
          zoom={[1.09, 1.02]}
        />
      </Sequence>

      {/* הכתוביות האמיתיות — כדי לראות שהכרטיסים לא נלחמים בהן */}
      <Captions />

      {SERVICE_WINDOWS.map((win) => {
        const from = sec(win.start);
        const duration = sec(win.end) - from;

        return (
          <Sequence
            key={win.card.label}
            name={`כרטיס — ${win.card.label}`}
            from={from}
            durationInFrames={duration}
            layout="absolute-fill"
          >
            <ServiceCard
              {...win.card}
              startFrame={0}
              durationInFrames={duration}
            />
          </Sequence>
        );
      })}

      {/* שלוש הווריאציות של Emphasis, מרווחות בזמן, כדי לבחון אותן
          מעל הצילום החי לפני שמחליטים איפה לירות אותן בסרטון */}
      <Sequence name="Emphasis — burst" from={sec(12.0)} durationInFrames={24}>
        {/* על הקיר הבהיר — המקרה הקשה ביותר לזהב */}
        <Emphasis x={820} y={330} size={340} variant="burst" />
        {/* ועל האזור הכהה ליד הכתף — המקרה הקל.
            y=1040 עם size=300 מגיע עד ~1220, מעל ראש הכתוביות (1250) */}
        <Emphasis x={250} y={1040} size={300} variant="burst" color={P.glow} />
      </Sequence>
      <Sequence name="Emphasis — ring" from={sec(13.5)} durationInFrames={24}>
        <Emphasis x={820} y={330} size={360} variant="ring" color={P.glow} />
      </Sequence>
      <Sequence name="Emphasis — sweep" from={sec(15.0)} durationInFrames={24}>
        <Emphasis x={540} y={330} size={620} variant="sweep" />
      </Sequence>

      {guides ? <Guides /> : null}
    </AbsoluteFill>
  );
};

/** קווי עזר — רק לבדיקה, לעולם לא בסרטון עצמו */
const Guides: React.FC = () => (
  <>
    {[
      { y: SAFE_TOP_BAND_BOTTOM, color: P.cyan, label: "גבול הרצועה העליונה" },
      { y: CAPTION_BAND_TOP, color: "#F43F5E", label: "ראש הכתוביות" },
      { y: 1590, color: "#F43F5E", label: "תחתית הכתוביות" },
    ].map((line) => (
      <div key={line.y}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: line.y,
            height: 3,
            background: line.color,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 12,
            top: line.y + 8,
            direction: "rtl",
            fontFamily,
            fontWeight: 700,
            fontSize: 30,
            color: line.color,
          }}
        >
          {`${line.label} · ${line.y}`}
        </div>
      </div>
    ))}
    {[80, 1000].map((x) => (
      <div
        key={x}
        style={{
          position: "absolute",
          left: x,
          top: 0,
          width: 2,
          height: "100%",
          background: "rgba(34,211,238,0.5)",
        }}
      />
    ))}
  </>
);
