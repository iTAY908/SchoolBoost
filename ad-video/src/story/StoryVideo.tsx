import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FlashCard } from "../pitch/cards/FlashCard";
import { PitchBackdrop } from "../pitch/components/PitchBackdrop";
import { P } from "../pitch/theme";
import { AgeOverlay, AGE_BAR_START, AGE_OVERLAY_DURATION } from "./cards/AgeOverlay";
import { StoryIntroCard } from "./cards/StoryIntroCard";
import { StoryOutroCard } from "./cards/StoryOutroCard";
import { Captions } from "./components/Captions";
import { Clip } from "./components/Clip";
import {
  AGE_MOMENT,
  CLIP_A,
  CLIP_B,
  CUES,
  INTRO,
  OUTRO,
  sec,
  STING,
} from "./timeline";

/* ── חלונות בפריימים ────────────────────────────────────── */

const CLIP_A_FROM = sec(CLIP_A.at);
const CLIP_A_LEN = sec(CLIP_A.to - CLIP_A.from);

const CLIP_B_FROM = sec(CLIP_B.at);
const CLIP_B_LEN = sec(CLIP_B.to - CLIP_B.from);

/**
 * הקלפים אטומים, ולכן הם נחתכים **פנימה** בחדות (אין מה לערבב איתו —
 * מתחת לפריים הראשון של הקלף אין עדיין צילום) ומתמוססים **החוצה**
 * אל תוך הצילום שכבר רץ מתחתיהם. שני הצילומים כאן גולמיים לגמרי,
 * בלי כתוביות או גרפיקה צרובות, ולכן דיסולב מותר וגם רצוי.
 */
const INTRO_FADE = 10;
const STING_FADE = 8;

const INTRO_FROM = sec(INTRO.at);
const INTRO_LEN = sec(INTRO.to) - sec(INTRO.at) + INTRO_FADE;

const STING_FROM = sec(STING.at);
const STING_LEN = sec(STING.to) - sec(STING.at) + STING_FADE;

const OUTRO_FROM = sec(OUTRO.at);
const OUTRO_LEN = sec(OUTRO.to) - sec(OUTRO.at);

/**
 * ── סרגל הגילים ─────────────────────────────────────────
 * הגדילה חייבת להסתיים בדיוק ב-AGE_MOMENT (9.3s = פריים 279),
 * ו-`story-counter.m4a` מכריע במכה שנמצאת 1.300s בתוך הקובץ.
 * לכן גם הגדילה וגם הצליל מתחילים באותו רגע: 9.3 − 1.3 = 8.0s.
 */
const AGE_CLIMB_SECONDS = 1.3;
const AGE_GROWTH_START = sec(AGE_MOMENT - AGE_CLIMB_SECONDS); // 240 = 8.00s
/** ה-Sequence מקדים את הגדילה ב-AGE_BAR_START, כי `startFrame` יחסי אליו */
const AGE_FROM = AGE_GROWTH_START - AGE_BAR_START;

/* ── אפקטי קול ──────────────────────────────────────────── */

type Sfx = { src: string; at: number; volume: number };

/**
 * העוצמות מכוילות מדידה על ה-PCM של הרינדור.
 * `story-impact` נופל בדיוק על הקראש והדאונביט של פס המוזיקה,
 * ולכן הוא מוחזק נמוך (0.38) — ב-0.6 השיא המצטבר הגיע ל-1.04 וגזר.
 */
const SFX: readonly Sfx[] = [
  /* פתיחה — הקלף נכנס יחד עם הבס הראשון של המוזיקה */
  { src: "story-impact", at: INTRO.at, volume: 0.32 },
  /* וווש שנכנס אל החיתוך לצילום הראשון (1.50) */
  { src: "story-whoosh", at: 1.22, volume: 0.44 },
  /* רַייזר באורך 1.259s — נבנה בדיוק אל תוך הסטינגר ב-6.17 */
  { src: "story-riser", at: 4.95, volume: 0.4 },
  /* המכה של כניסת הסטינגר */
  { src: "story-impact", at: STING.at, volume: 0.38 },
  /* וווש שיוצא מהסטינגר אל הצילום השני (6.90) */
  { src: "story-whoosh", at: 6.62, volume: 0.44 },
  /* המונה — ההכרעה שלו ב-1.300s נופלת בדיוק על 9.30 */
  { src: "story-counter", at: AGE_MOMENT - AGE_CLIMB_SECONDS, volume: 0.55 },
  /* וווש אל תוך כרטיס הסיום (26.70) */
  { src: "story-whoosh", at: 26.42, volume: 0.44 },
  /* המכה של כניסת כרטיס הסיום */
  { src: "story-impact", at: OUTRO.at, volume: 0.38 },
];

/**
 * עוטף קלף אטום ומתמוסס ממנו החוצה בסוף החלון.
 * חייב לשבת **בתוך** ה-Sequence — כך `useCurrentFrame` מקומי.
 */
const CardLayer: React.FC<{
  children: React.ReactNode;
  /** כמה פריימים אחרונים מוקדשים ליציאה. 0 = חיתוך חד */
  fadeOut?: number;
}> = ({ children, fadeOut = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        opacity:
          fadeOut > 0
            ? interpolate(
                frame,
                [durationInFrames - fadeOut, durationInFrames - 1],
                [1, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              )
            : 1,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * ── סרטון הסטורי ────────────────────────────────────────
 *
 *   0.00–1.50   כרטיס פתיחה
 *   1.50–6.17   story-a.mp4 + story-a-voice
 *   6.17–6.90   סטינגר ממותג שמכסה את התפר בין הקליפים
 *   6.90–26.70  story-b.mp4 + story-b-voice  (סרגל הגילים ב-8.00–9.30)
 *  26.70–29.20  כרטיס סיום — הנעה לפעולה לאינסטגרם
 *
 * סדר השכבות מלמטה למעלה: רקע → צילום → סרגל הגילים → כתוביות →
 * קלפים אטומים → גריין. הכתוביות חייבות לשבת מתחת לקלפים (הן ממילא
 * מושתקות בחלונות שלהם דרך BLOCKED), והקלפים חייבים לכסות הכל.
 */
export const StoryVideo: React.FC = () => {
  return (
    <AbsoluteFill name="StoryVideo" style={{ backgroundColor: P.ink }}>
      {/* בסיס — נראה רק אם משהו מעליו שקוף */}
      <PitchBackdrop intensity={0.75} />

      <Sequence
        name="צילום א׳"
        from={CLIP_A_FROM}
        durationInFrames={CLIP_A_LEN}
        layout="absolute-fill"
      >
        <Clip
          src="source/story-a.mp4"
          trimBefore={CLIP_A.from}
          durationInFrames={CLIP_A_LEN}
          zoom={[1.02, 1.09]}
        />
      </Sequence>

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

      {/* סרגל הגילים — שכבה מעל הצילום, לא במקומו */}
      <Sequence
        name="סרגל הגילים"
        from={AGE_FROM}
        durationInFrames={AGE_OVERLAY_DURATION}
        layout="absolute-fill"
      >
        <AgeOverlay />
      </Sequence>

      {/* כתובית אחת לכל ציר הזמן — הרכיב מטפל בעצמו בפערים ובחסימות */}
      <Captions />

      <Sequence
        name="קלף פתיחה"
        from={INTRO_FROM}
        durationInFrames={INTRO_LEN}
        layout="absolute-fill"
      >
        <CardLayer fadeOut={INTRO_FADE}>
          <StoryIntroCard />
        </CardLayer>
      </Sequence>

      <Sequence
        name="סטינגר"
        from={STING_FROM}
        durationInFrames={STING_LEN}
        layout="absolute-fill"
      >
        <CardLayer fadeOut={STING_FADE}>
          <FlashCard />
        </CardLayer>
      </Sequence>

      <Sequence
        name="קלף סיום"
        from={OUTRO_FROM}
        durationInFrames={OUTRO_LEN}
        layout="absolute-fill"
      >
        <CardLayer>
          <StoryOutroCard />
        </CardLayer>
      </Sequence>

      {/* גריין עדין מעל הכל — מאחד צילום גולמי וגרפיקה לאותו חומר */}
      <AbsoluteFill
        name="Grain"
        style={{
          opacity: 0.09,
          mixBlendMode: "overlay",
          backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>`,
          )}")`,
        }}
      />

      {/* ── פס הקול ───────────────────────────────────────
          כל הנכסים הם m4a בכוונה: הרינדור של Remotion מנגן m4a
          אבל **מפיל wav בשקט**, בלי שום שגיאה. */}

      {/* הדיבור — שתי הרצועות כבר מנורמלות לאותה עוצמה */}
      <Audio
        src={staticFile("audio/story-a-voice.m4a")}
        from={CLIP_A_FROM}
        volume={1}
      />
      <Audio
        src={staticFile("audio/story-b-voice.m4a")}
        from={CLIP_B_FROM}
        volume={1}
      />

      {/* המוזיקה — ההנמכה מתחת לדיבור כבר צרובה בקובץ עצמו */}
      <Audio src={staticFile("audio/story-music.m4a")} volume={0.7} />

      {SFX.map((effect, i) => (
        <Audio
          key={`${effect.src}-${i}`}
          src={staticFile(`audio/${effect.src}.m4a`)}
          from={sec(effect.at)}
          volume={effect.volume}
        />
      ))}

      {/* נקישה רכה בכל החלפת כתובית — story-tick כבר שקט מאוד בקובץ */}
      {CUES.map((cue, i) => (
        <Audio
          key={`tick-${i}`}
          src={staticFile("audio/story-tick.m4a")}
          from={sec(cue.start)}
          volume={1}
        />
      ))}
    </AbsoluteFill>
  );
};
