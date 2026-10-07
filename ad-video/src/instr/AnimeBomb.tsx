import { Easing, interpolate } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * פצצה בסגנון אנימה — קו מתאר עבה, ברק לבן, פתיל וניצוץ מהבהב.
 * `age` = פריימים מאז שהופיעה; `boom` = 0..1 לפיצוץ בסוף.
 * הקומפוננטה מציירת סביב (0,0) — המיקום נקבע מבחוץ (נעול לעולם).
 */
export const AnimeBomb: React.FC<{ age: number; boom: number }> = ({
  age,
  boom,
}) => {
  const pop = interpolate(age, [0, 9], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.2, 1.8, 0.4, 1),
  });
  // דופק "תקתוק" — רק קנה מידה, בלי תזוזה, כדי שהפצצה תישאר נעולה במקום
  const tick = 1 + 0.035 * Math.max(0, Math.sin(age * 0.42)) ** 6;
  const spark = age * 37;
  const lines = interpolate(age, [0, 4, 16], [0, 1, 0], clamp);
  const shake = boom > 0 ? Math.sin(age * 3.1) * 10 * boom : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        scale: String(pop * tick * (1 + boom * 0.25)),
        translate: `${shake}px 0px`,
      }}
    >
      <svg
        width={520}
        height={520}
        viewBox="-260 -260 520 520"
        style={{ position: "absolute", left: -260, top: -260, overflow: "visible" }}
      >
        {/* קווי אקשן של מנגה בכניסה */}
        <g opacity={lines} stroke="#0E0524" strokeLinecap="round">
          {Array.from({ length: 18 }).map((_, i) => {
            const a = (i / 18) * Math.PI * 2;
            const r1 = 175 + (i % 3) * 12;
            const r2 = r1 + 50 + (i % 2) * 30;
            return (
              <line
                key={i}
                x1={Math.cos(a) * r1}
                y1={Math.sin(a) * r1 + 20}
                x2={Math.cos(a) * r2}
                y2={Math.sin(a) * r2 + 20}
                strokeWidth={i % 2 ? 7 : 11}
              />
            );
          })}
        </g>
        {/* צל על הקיר */}
        <ellipse cx={18} cy={34} rx={140} ry={140} fill="rgba(14,5,36,0.22)" />
        {/* גוף */}
        <circle cx={0} cy={20} r={135} fill="#1B1340" stroke="#0E0524" strokeWidth={14} />
        <path
          d="M -95 95 A 135 135 0 0 0 110 90"
          fill="none"
          stroke="#3B2A7A"
          strokeWidth={22}
          strokeLinecap="round"
        />
        {/* ברק אנימה */}
        <ellipse cx={-52} cy={-38} rx={34} ry={20} fill="#fff" transform="rotate(-38 -52 -38)" />
        <circle cx={-14} cy={-70} r={9} fill="#fff" />
        {/* מכסה */}
        <g transform="rotate(28 60 -95)">
          <rect x={22} y={-128} width={78} height={50} rx={10} fill="#4C1D95" stroke="#0E0524" strokeWidth={12} />
          <rect x={34} y={-120} width={18} height={30} rx={4} fill="#A855F7" />
        </g>
        {/* פתיל */}
        <path
          d="M 90 -140 C 120 -190, 170 -170, 165 -215"
          fill="none"
          stroke="#0E0524"
          strokeWidth={18}
          strokeLinecap="round"
        />
        <path
          d="M 90 -140 C 120 -190, 170 -170, 165 -215"
          fill="none"
          stroke="#C08A4A"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray="14 10"
        />
        {/* ניצוץ */}
        <g transform={`translate(165 -218) rotate(${spark}) scale(${0.85 + 0.25 * Math.abs(Math.sin(age * 0.9))})`}>
          <polygon
            points="0,-46 11,-12 46,0 11,12 0,46 -11,12 -46,0 -11,-12"
            fill="#FBBF24"
            stroke="#0E0524"
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <circle r={11} fill="#fff" />
        </g>
        {[0, 1, 2, 3, 4].map((k) => {
          const a = spark * 0.05 + k * 1.3;
          const d = 46 + ((age * 7 + k * 13) % 30);
          return (
            <circle
              key={k}
              cx={165 + Math.cos(a) * d}
              cy={-218 + Math.sin(a) * d}
              r={5}
              fill="#F59E0B"
            />
          );
        })}
      </svg>
    </div>
  );
};

/** פיצוץ אנימה — כוכב משונן שמתנפח, במרכז (0,0) */
export const AnimeBlast: React.FC<{ t: number }> = ({ t }) => {
  if (t <= 0 || t >= 1) return null;
  const s = interpolate(t, [0, 1], [0.2, 3.2], { easing: Easing.out(Easing.cubic) });
  const o = interpolate(t, [0, 0.6, 1], [1, 1, 0]);
  const star = (r1: number, r2: number, k: number) =>
    Array.from({ length: k * 2 })
      .map((_, i) => {
        const a = (i / (k * 2)) * Math.PI * 2;
        const r = i % 2 ? r2 : r1;
        return `${Math.cos(a) * r},${Math.sin(a) * r}`;
      })
      .join(" ");
  return (
    <svg
      width={800}
      height={800}
      viewBox="-400 -400 800 800"
      style={{ position: "absolute", left: -400, top: -400, scale: String(s), opacity: o, overflow: "visible" }}
    >
      <polygon points={star(260, 150, 14)} fill="#F59E0B" stroke="#0E0524" strokeWidth={10} strokeLinejoin="round" />
      <polygon points={star(190, 110, 12)} fill="#FBBF24" />
      <polygon points={star(120, 70, 10)} fill="#fff" />
    </svg>
  );
};
