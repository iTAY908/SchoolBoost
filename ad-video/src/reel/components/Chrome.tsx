import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../../font";
import { CREATOR, P, sec } from "../theme";
import { OUTRO, PART1, PART2 } from "../timeline";

/** פס התקדמות דק שרץ לאורך כל הריל ומחבר את שני הקטעים לרצף אחד */
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
          width: `${interpolate(frame, [0, durationInFrames - 1], [0, 100], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}%`,
        }}
      />
    </div>
  );
};

/**
 * תג פרק שמופיע לרגע בתחילת כל קטע.
 * זה מה שקושר את שני הצילומים לסרטון אחד במקום שני קליפים נפרדים.
 */
const ChapterTag: React.FC<{ at: number; index: string; label: string }> = ({
  at,
  index,
  label,
}) => {
  const frame = useCurrentFrame();
  const from = sec(at);
  const to = from + 42;

  if (frame < from || frame >= to) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 132,
        right: 60,
        direction: "rtl",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 26px",
        borderRadius: 999,
        background: "rgba(14,5,36,0.6)",
        border: `2px solid ${P.gold}88`,
        backdropFilter: "blur(10px)",
        opacity: interpolate(frame, [from, from + 5, to - 8, to - 1], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: interpolate(frame, [from, from + 12], ["40px 0px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 40,
          color: P.gold,
          direction: "ltr",
        }}
      >
        {index}
      </span>
      <span
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 34,
          color: P.white,
        }}
      >
        {label}
      </span>
    </div>
  );
};

/** תג מיתוג קבוע בפינה */
const BrandTag: React.FC = () => {
  const frame = useCurrentFrame();
  const hideFrom = sec(OUTRO.at);

  if (frame >= hideFrom) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 96,
        right: 60,
        fontFamily,
        fontWeight: 900,
        fontSize: 34,
        letterSpacing: 3,
        color: "rgba(255,255,255,0.82)",
        textShadow: "0 4px 16px rgba(0,0,0,0.7)",
        opacity: interpolate(frame, [0, 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      {CREATOR.name}
    </div>
  );
};

export const Chrome: React.FC = () => {
  return (
    <>
      <ProgressBar />
      <ChapterTag at={PART1.at + 1.55} index="01" label="השאלה" />
      <ChapterTag at={PART2.at + 0.1} index="02" label="התשובה" />
      <BrandTag />
    </>
  );
};
