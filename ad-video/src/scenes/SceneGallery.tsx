import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { CreativeCard } from "../components/CreativeCard";
import { PopWords } from "../components/PopWords";

const TOP_ROW = ["רילס", "פרסומת", "טיזר", "סטורי", "קמפיין"];
const BOTTOM_ROW = ["אירוע", "מוצר", "לוגו", "ראיון", "קליפ"];

/**
 * שקופית 2 — "...של הסרטונים שמושכים הכי הרבה עיניים?"
 * גלריית עבודות שנעה במהירות ברקע בפרספקטיבה תלת־ממדית.
 */
export const SceneGallery: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="SceneGallery" style={{ overflow: "hidden" }}>
      {/* שתי שורות כרטיסים שנעות לכיוונים מנוגדים */}
      <Interactive.Div
        name="CardWall"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 60,
          perspective: 1400,
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 44,
            paddingRight: 60,
            rotate: "-8deg",
            translate: interpolate(frame, [0, 84], ["220px -40px", "-260px -40px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            }),
          }}
        >
          {TOP_ROW.map((label, i) => (
            <CreativeCard key={label} index={i} width={280} label={label} />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 44,
            paddingRight: 60,
            rotate: "-8deg",
            translate: interpolate(frame, [0, 84], ["-300px 40px", "200px 40px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            }),
          }}
        >
          {BOTTOM_ROW.map((label, i) => (
            <CreativeCard key={label} index={i + 3} width={280} label={label} />
          ))}
        </div>
      </Interactive.Div>

      {/* שכבת כהות כדי שהטקסט יישאר קריא מעל הכרטיסים */}
      <AbsoluteFill
        name="Scrim"
        style={{
          background:
            "linear-gradient(180deg, rgba(120,4,60,0.28) 0%, rgba(150,6,72,0.7) 40%, rgba(150,6,72,0.7) 62%, rgba(120,4,60,0.28) 100%)",
        }}
      />

      <AbsoluteFill
        name="Copy"
        style={{ justifyContent: "center", alignItems: "center", padding: 90 }}
      >
        <PopWords
          words={[
            { text: "של" },
            { text: "הסרטונים" },
            { text: "שמושכים" },
            { text: "הכי", accent: true },
            { text: "הרבה", accent: true },
            { text: "עיניים?", accent: true },
          ]}
          startAt={4}
          stagger={4}
          fontSize={124}
          maxWidth={940}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
