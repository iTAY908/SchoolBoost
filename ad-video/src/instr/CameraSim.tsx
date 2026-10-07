import { Easing, interpolate } from "remotion";
import { fontFamily } from "../font";
import { P } from "../pitch/theme";
import { CAM_IN, EXPLODE_AT, SCAN_AT, f } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const INK = "#0E0524";
const LINE = "#C4B5FD";

/** כל חלק מצויר בתוך תיבה של 200×120 סביב (0,0) */
const Lens = () => (
  <g>
    <rect x={-70} y={-48} width={140} height={96} rx={14} fill="#2A2350" stroke={LINE} strokeWidth={4} />
    {[-50, -25, 0, 25, 50].map((x) => (
      <line key={x} x1={x} y1={-48} x2={x} y2={48} stroke="#4B3F8A" strokeWidth={3} />
    ))}
    <ellipse cx={-78} cy={0} rx={16} ry={52} fill="#22D3EE" fillOpacity={0.55} stroke={LINE} strokeWidth={4} />
    <ellipse cx={78} cy={0} rx={10} ry={40} fill="#22D3EE" fillOpacity={0.35} stroke={LINE} strokeWidth={3} />
  </g>
);
const Aperture = () => (
  <g>
    <circle r={54} fill="#1E1A3C" stroke={LINE} strokeWidth={4} />
    {Array.from({ length: 6 }).map((_, i) => (
      <path
        key={i}
        d="M 0 -50 L 30 -12 L 8 -6 Z"
        fill="#5B4BA8"
        stroke={LINE}
        strokeWidth={2}
        transform={`rotate(${i * 60})`}
      />
    ))}
    <circle r={14} fill="#22D3EE" fillOpacity={0.6} />
  </g>
);
const Shutter = () => (
  <g>
    <rect x={-74} y={-50} width={148} height={100} rx={8} fill="#1E1A3C" stroke={LINE} strokeWidth={4} />
    {[-34, -14, 6, 26].map((y) => (
      <rect key={y} x={-60} y={y} width={120} height={16} rx={3} fill="#3B3470" stroke="#7C6FD0" strokeWidth={2} />
    ))}
  </g>
);
const Sensor = () => (
  <g>
    <rect x={-72} y={-50} width={144} height={100} rx={8} fill="#B45309" stroke={LINE} strokeWidth={4} />
    <rect x={-50} y={-34} width={100} height={68} rx={4} fill="#0F766E" />
    {Array.from({ length: 6 }).map((_, i) => (
      <line key={i} x1={-50 + i * 20} y1={-34} x2={-50 + i * 20} y2={34} stroke="#5EEAD4" strokeOpacity={0.5} strokeWidth={1.5} />
    ))}
    {Array.from({ length: 4 }).map((_, i) => (
      <line key={i} x1={-50} y1={-34 + i * 22} x2={50} y2={-34 + i * 22} stroke="#5EEAD4" strokeOpacity={0.5} strokeWidth={1.5} />
    ))}
  </g>
);
const Board = () => (
  <g>
    <rect x={-80} y={-46} width={160} height={92} rx={8} fill="#14532D" stroke={LINE} strokeWidth={4} />
    <rect x={-26} y={-24} width={52} height={48} rx={4} fill="#111827" stroke="#9CA3AF" strokeWidth={2} />
    {[-16, -6, 4, 14].map((d) => (
      <g key={d}>
        <line x1={-26} y1={d} x2={-60} y2={d} stroke="#FBBF24" strokeWidth={2} />
        <line x1={26} y1={d} x2={62} y2={d} stroke="#FBBF24" strokeWidth={2} />
      </g>
    ))}
    <circle cx={-62} cy={-32} r={5} fill="#FBBF24" />
    <circle cx={62} cy={32} r={5} fill="#FBBF24" />
  </g>
);
const Battery = () => (
  <g>
    <rect x={-70} y={-36} width={132} height={72} rx={10} fill="#1F2937" stroke={LINE} strokeWidth={4} />
    <rect x={62} y={-14} width={12} height={28} rx={3} fill={LINE} />
    <rect x={-58} y={-24} width={44} height={48} rx={4} fill="#22C55E" />
    <rect x={-10} y={-24} width={44} height={48} rx={4} fill="#22C55E" />
    <path d="M 46 -16 L 38 2 L 48 2 L 40 18" stroke="#FBBF24" strokeWidth={4} fill="none" />
  </g>
);
const SdCard = () => (
  <g>
    <path d="M -44 -56 L 28 -56 L 46 -38 L 46 56 L -44 56 Z" fill="#1D4ED8" stroke={LINE} strokeWidth={4} />
    {[-34, -22, -10, 2, 14].map((x) => (
      <rect key={x} x={x} y={-50} width={7} height={18} fill="#FBBF24" />
    ))}
    <rect x={-32} y={-10} width={64} height={40} rx={4} fill="#fff" fillOpacity={0.85} />
    <text x={0} y={18} textAnchor="middle" fontSize={22} fontWeight={900} fill={INK}>
      SD
    </text>
  </g>
);
const Screen = () => (
  <g>
    <rect x={-80} y={-50} width={160} height={100} rx={10} fill="#111827" stroke={LINE} strokeWidth={4} />
    <rect x={-68} y={-38} width={136} height={76} rx={4} fill="#312E81" />
    <path d="M -68 26 L -30 -6 L -6 14 L 20 -14 L 68 26 L 68 38 L -68 38 Z" fill="#7C3AED" />
    <circle cx={40} cy={-20} r={8} fill="#FBBF24" />
  </g>
);
const Shell = () => (
  <g>
    <path
      d="M -90 -36 L -40 -36 L -26 -54 L 26 -54 L 40 -36 L 90 -36 L 90 50 L -90 50 Z"
      fill="none"
      stroke={LINE}
      strokeWidth={5}
      strokeDasharray="10 6"
    />
    <circle cx={0} cy={8} r={30} fill="none" stroke={LINE} strokeWidth={4} />
    <rect x={56} y={-28} width={22} height={12} rx={3} fill={LINE} />
  </g>
);

const PARTS: { label: string; Part: React.FC }[] = [
  { label: "עדשה", Part: Lens },
  { label: "צמצם", Part: Aperture },
  { label: "תריס", Part: Shutter },
  { label: "חיישן תמונה", Part: Sensor },
  { label: "מעבד ולוח אם", Part: Board },
  { label: "סוללה", Part: Battery },
  { label: "כרטיס זיכרון", Part: SdCard },
  { label: "מסך", Part: Screen },
  { label: "גוף המצלמה", Part: Shell },
];

/** מיקום המצלמה השלמה, ועמודת החלקים אחרי הפירוק */
const HOME = { x: 250, y: 860 };
const COL_X = 118;
const slotY = (i: number) => 330 + i * 168;
/** זמני הופעת התוויות — מתפזרים מרגע הפירוק עד "אילו כלים" */
const labelAt = (i: number) => EXPLODE_AT + f(1.0) + i * f(1.15);

/** המצלמה השלמה — מבט מלפנים */
const WholeCamera: React.FC = () => (
  <svg width={420} height={300} viewBox="-210 -150 420 300" style={{ overflow: "visible" }}>
    <path
      d="M -190 -70 L -80 -70 L -58 -112 L 58 -112 L 80 -70 L 190 -70 L 190 130 L -190 130 Z"
      fill="#1E1A3C"
      stroke={LINE}
      strokeWidth={6}
      strokeLinejoin="round"
    />
    <rect x={-190} y={-40} width={56} height={170} rx={10} fill="#2A2350" />
    <circle cx={10} cy={30} r={86} fill="#2A2350" stroke={LINE} strokeWidth={6} />
    <circle cx={10} cy={30} r={62} fill="#111827" stroke="#4B3F8A" strokeWidth={6} />
    <circle cx={10} cy={30} r={36} fill="#22D3EE" fillOpacity={0.5} />
    <circle cx={-6} cy={14} r={10} fill="#fff" fillOpacity={0.8} />
    <rect x={120} y={-56} width={48} height={24} rx={5} fill="#FBBF24" />
    <rect x={-150} y={-96} width={44} height={20} rx={5} fill={LINE} />
  </svg>
);

export const CameraSim: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < CAM_IN) return null;
  const inP = interpolate(frame, [CAM_IN, CAM_IN + 14], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.2, 1.6, 0.4, 1),
  });
  // רעידה קצרה לפני הפירוק
  const pre = interpolate(frame, [EXPLODE_AT - 10, EXPLODE_AT], [0, 1], clamp);
  const shake = frame < EXPLODE_AT ? Math.sin(frame * 2.7) * 9 * pre : 0;
  const wholeO = interpolate(frame, [EXPLODE_AT, EXPLODE_AT + 4], [1, 0], clamp);
  const flash = interpolate(frame, [EXPLODE_AT, EXPLODE_AT + 3, EXPLODE_AT + 12], [0, 0.9, 0], clamp);
  const scan = interpolate(frame, [CAM_IN, CAM_IN + 40], [0, 1], clamp);
  const axisO = interpolate(frame, [EXPLODE_AT + 12, EXPLODE_AT + 30], [0, 1], clamp);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* ציר הפירוק */}
      <div
        style={{
          position: "absolute",
          left: COL_X - 2,
          top: slotY(0) - 70,
          width: 4,
          height: slotY(PARTS.length - 1) - slotY(0) + 140,
          opacity: axisO * 0.6,
          background: `repeating-linear-gradient(${LINE} 0 14px, transparent 14px 26px)`,
        }}
      />

      {/* המצלמה השלמה */}
      {wholeO > 0 && (
        <div
          style={{
            position: "absolute",
            left: HOME.x - 210,
            top: HOME.y - 150,
            opacity: wholeO,
            scale: String(inP),
            translate: `${shake}px 0px`,
            filter: `drop-shadow(0 0 30px ${P.glow})`,
          }}
        >
          <WholeCamera />
          {/* קו סריקה */}
          <div
            style={{
              position: "absolute",
              left: -20,
              right: -20,
              top: 300 * scan - 4,
              height: 6,
              background: P.cyan,
              boxShadow: `0 0 24px ${P.cyan}`,
              opacity: scan < 1 ? 0.9 : 0,
            }}
          />
        </div>
      )}

      {/* החלקים — עפים מהמצלמה לעמודה */}
      {frame >= EXPLODE_AT &&
        PARTS.map(({ label, Part }, i) => {
          const start = EXPLODE_AT + i * 2;
          const p = interpolate(frame, [start, start + 24], [0, 1], {
            ...clamp,
            easing: Easing.bezier(0.18, 1.35, 0.4, 1),
          });
          const x = HOME.x + (COL_X - HOME.x) * p;
          const y = HOME.y + (slotY(i) - HOME.y) * p;
          const rot = (1 - p) * (i % 2 ? 1 : -1) * (30 + i * 8);
          const lp = interpolate(frame, [labelAt(i), labelAt(i) + 10], [0, 1], {
            ...clamp,
            easing: Easing.bezier(0.2, 1.4, 0.4, 1),
          });
          // הדגשה שעוברת חלק אחרי חלק ב"אילו חלקים יש בתוך המצלמה"
          const hl = interpolate(
            frame,
            [SCAN_AT + i * 5, SCAN_AT + i * 5 + 6, SCAN_AT + i * 5 + 20],
            [0, 1, 0.35],
            clamp,
          );
          return (
            <div key={label}>
              <svg
                width={200}
                height={130}
                viewBox="-100 -65 200 130"
                style={{
                  position: "absolute",
                  left: x - 100,
                  top: y - 65,
                  overflow: "visible",
                  rotate: `${rot}deg`,
                  scale: String(0.55 + 0.35 * p + 0.12 * hl),
                  filter: `drop-shadow(0 0 ${10 + 26 * hl}px ${hl > 0.1 ? P.gold : P.glow})`,
                }}
              >
                <Part />
              </svg>
              <div
                style={{
                  position: "absolute",
                  left: COL_X + 84,
                  top: slotY(i),
                  translate: `${(1 - lp) * -30}px -50%`,
                  opacity: lp,
                  direction: "rtl",
                  fontFamily,
                  fontWeight: 900,
                  fontSize: 38,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  color: hl > 0.5 ? INK : P.white,
                  background: hl > 0.5 ? P.gold : "rgba(30,10,71,0.85)",
                  border: `3px solid ${hl > 0.1 ? P.gold : P.glow}`,
                  borderRadius: 14,
                  padding: "8px 16px 10px",
                  boxShadow: `0 0 18px rgba(168,85,247,0.5)`,
                }}
              >
                {label}
              </div>
            </div>
          );
        })}

      {/* הבזק הפירוק */}
      <div
        style={{
          position: "absolute",
          left: HOME.x - 300,
          top: HOME.y - 300,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, #fff 0%, ${P.glow} 40%, transparent 70%)`,
          opacity: flash,
        }}
      />
    </div>
  );
};
