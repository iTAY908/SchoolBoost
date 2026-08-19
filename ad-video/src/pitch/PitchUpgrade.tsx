import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CaptionBand } from "./components/CaptionBand";
import { Footage } from "./components/Footage";
import { PitchBackdrop } from "./components/PitchBackdrop";
import { AgeCard } from "./cards/AgeCard";
import { DifferentCard } from "./cards/DifferentCard";
import { FlashCard } from "./cards/FlashCard";
import { IntroCard } from "./cards/IntroCard";
import { OutroCard } from "./cards/OutroCard";
import { WantCard } from "./cards/WantCard";
import { P, sec } from "./theme";
import { CARDS, type CardId } from "./timeline";

const CARD_COMPONENTS: Record<CardId, React.FC> = {
  intro: IntroCard,
  age: AgeCard,
  flash: FlashCard,
  flash2: FlashCard,
  want: WantCard,
  different: DifferentCard,
  outro: OutroCard,
};

/** פס התקדמות דק בראש הפריים */
const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <div
      style={{
        position: "absolute",
        top: 78,
        left: 60,
        right: 60,
        height: 8,
        borderRadius: 999,
        background: "rgba(255,255,255,0.18)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: 999,
          background: `linear-gradient(90deg, ${P.gold} 0%, ${P.cyan} 100%)`,
          boxShadow: `0 0 20px ${P.gold}88`,
          width: `${interpolate(
            frame,
            [0, durationInFrames - 1],
            [0, 100],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )}%`,
        }}
      />
    </div>
  );
};

/**
 * הסרטון המשודרג.
 *
 * ציר הזמן של הפלט זהה לציר של קובץ המקור, כך שהקול, הצילום
 * והכתוביות נשארים מסונכרנים בלי שום מיפוי זמנים. הקלפים המעוצבים
 * הם שכבות אטומות שמכסות את הצילום בחלונות שבהם המקור הציג
 * גרפיקה משלו.
 */
export const PitchUpgrade: React.FC = () => {
  return (
    <AbsoluteFill name="PitchUpgrade" style={{ backgroundColor: P.ink }}>
      {/* בסיס — נראה רק בזנב שאחרי סוף הצילום */}
      <PitchBackdrop />

      <Footage />

      {CARDS.map((card) => {
        const Card = CARD_COMPONENTS[card.id];
        return (
          <Sequence
            key={card.id}
            name={`Card · ${card.id}`}
            from={sec(card.start)}
            durationInFrames={sec(card.end) - sec(card.start)}
            layout="absolute-fill"
          >
            <Card />
          </Sequence>
        );
      })}

      {/* כתוביות מעל הכל — משתמשות בציר הזמן הגלובלי */}
      <CaptionBand />

      <ProgressBar />

      {/* גרעיניות אחידה שמחברת בין הצילום לקלפים */}
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

      {/* פס הקול המקורי — רץ ברצף מתחילת הסרטון */}
      <Audio src={staticFile("source/pitch-audio.m4a")} />
    </AbsoluteFill>
  );
};
