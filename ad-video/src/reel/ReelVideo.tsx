import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { AgeCard } from "../pitch/cards/AgeCard";
import { FlashCard } from "../pitch/cards/FlashCard";
import { IntroCard } from "../pitch/cards/IntroCard";
import { OutroCard } from "../pitch/cards/OutroCard";
import { PitchBackdrop } from "../pitch/components/PitchBackdrop";
import { Captions } from "./components/Captions";
import { Chrome } from "./components/Chrome";
import { Clip } from "./components/Clip";
import { P, sec } from "./theme";
import {
  CARDS,
  CUES_PART1,
  CUES_PART2,
  PART1,
  PART2,
  SFX,
  type CardId,
} from "./timeline";

const CARD_COMPONENTS: Record<CardId, React.FC> = {
  intro: IntroCard,
  age: AgeCard,
  sting: FlashCard,
  outro: OutroCard,
};

/**
 * ריל אחד שמחבר את שני הצילומים.
 *
 * כל קטע מנוגן עם פס הקול המקורי שלו בחלון הזמן שלו, ולכן הדיבור
 * תמיד מסונכרן לתמונה. מעליהם יושבות שכבות משותפות — כתוביות,
 * קלפים מעוצבים, כרום ומוזיקה — שהופכות את שני הקליפים לסרטון אחד.
 */
export const ReelVideo: React.FC = () => {
  /* נקישה רכה בכל החלפת כתובית */
  const captionTicks = [...CUES_PART1, ...CUES_PART2]
    .filter((cue) => cue.text.length > 0)
    .map((cue) => cue.start);

  return (
    <AbsoluteFill name="ReelVideo" style={{ backgroundColor: P.ink }}>
      {/* בסיס — נראה מתחת לקלפים המעוצבים */}
      <PitchBackdrop />

      <Sequence
        name="חלק 1 · הצילום"
        from={sec(PART1.at)}
        durationInFrames={sec(PART1.to - PART1.from)}
        layout="absolute-fill"
      >
        <Clip
          src="source/part1.mp4"
          trimBefore={PART1.from}
          durationInFrames={sec(PART1.to - PART1.from)}
        />
      </Sequence>

      <Sequence
        name="חלק 2 · הצילום"
        from={sec(PART2.at)}
        durationInFrames={sec(PART2.to - PART2.from)}
        layout="absolute-fill"
      >
        <Clip
          src="source/part2.mp4"
          trimBefore={PART2.from}
          durationInFrames={sec(PART2.to - PART2.from)}
          zoom={[1.1, 1.02]}
        />
      </Sequence>

      {CARDS.map((card) => {
        const Card = CARD_COMPONENTS[card.id];
        return (
          <Sequence
            key={card.id}
            name={`קלף · ${card.id}`}
            from={sec(card.start)}
            durationInFrames={sec(card.end) - sec(card.start)}
            layout="absolute-fill"
          >
            <Card />
          </Sequence>
        );
      })}

      {/* חלק 1 — פאנל מטושטש שמסתיר את הכתוביות הצרובות של המקור */}
      <Captions cues={CUES_PART1} masked />
      {/* חלק 2 — צילום גולמי, כתוביות נקיות בלי פאנל */}
      <Captions cues={CUES_PART2} />

      <Chrome />

      <AbsoluteFill
        name="Grain"
        style={{
          opacity: 0.1,
          mixBlendMode: "overlay",
          backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>`,
          )}")`,
        }}
      />

      {/* רצועות הדיבור — מנורמלות לאותה עוצמה, ראו scripts/prepare-clips.mjs */}
      <Audio
        src={staticFile("audio/part1-voice.m4a")}
        from={sec(PART1.at)}
        volume={1}
      />
      <Audio
        src={staticFile("audio/part2-voice.m4a")}
        from={sec(PART2.at)}
        volume={1}
      />

      {/* פס מוזיקה — העוצמה כבר מעוצבת בקובץ עצמו כך שיישב מתחת לדיבור */}
      <Audio src={staticFile("audio/music-bed.m4a")} volume={0.7} />

      {SFX.map((effect, i) => (
        <Audio
          key={`${effect.src}-${i}`}
          src={staticFile(`audio/${effect.src}.m4a`)}
          from={sec(effect.at)}
          volume={effect.volume ?? 0.6}
        />
      ))}

      {captionTicks.map((at, i) => (
        <Audio
          key={`tick-${i}`}
          src={staticFile("audio/tick.m4a")}
          from={sec(at)}
          volume={0.45}
        />
      ))}
    </AbsoluteFill>
  );
};
