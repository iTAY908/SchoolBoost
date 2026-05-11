import React from 'react';
import { useCurrentFrame } from 'remotion';

const EMOJIS = [
  { char: '⭐', x: 8,  baseY: 110, speed: 0.14, size: 50, delay: 0   },
  { char: '🎉', x: 22, baseY: 115, speed: 0.11, size: 55, delay: 30  },
  { char: '❤️', x: 38, baseY: 112, speed: 0.16, size: 44, delay: 15  },
  { char: '✨', x: 55, baseY: 108, speed: 0.13, size: 48, delay: 45  },
  { char: '🎈', x: 70, baseY: 118, speed: 0.10, size: 58, delay: 20  },
  { char: '💫', x: 85, baseY: 113, speed: 0.15, size: 46, delay: 60  },
  { char: '👑', x: 14, baseY: 120, speed: 0.09, size: 52, delay: 75  },
  { char: '🎊', x: 46, baseY: 116, speed: 0.12, size: 50, delay: 10  },
  { char: '🌟', x: 78, baseY: 111, speed: 0.17, size: 42, delay: 50  },
  { char: '🎂', x: 92, baseY: 117, speed: 0.10, size: 56, delay: 35  },
  { char: '💥', x: 30, baseY: 109, speed: 0.14, size: 46, delay: 80  },
  { char: '🔥', x: 62, baseY: 114, speed: 0.11, size: 48, delay: 25  },
];

export const FloatingEmojis: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {EMOJIS.map((e, i) => {
        const ef = Math.max(0, frame - e.delay);
        const y = ((e.baseY - ef * e.speed) % 130) - 15;
        if (y > 108 || y < -15) return null;

        const wobble = Math.sin(ef * 0.04 + i * 1.2) * 2.5;
        const tilt = Math.sin(ef * 0.03 + i) * 12;
        const pulse = Math.sin(ef * 0.06 + i * 0.9) * 0.08 + 1;
        const opacity = 0.75 + Math.sin(ef * 0.05 + i) * 0.2;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${e.x + wobble}%`,
              top: `${y}%`,
              fontSize: e.size,
              lineHeight: 1,
              transform: `translate(-50%, -50%) rotate(${tilt}deg) scale(${pulse})`,
              opacity,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
            }}
          >
            {e.char}
          </div>
        );
      })}
    </div>
  );
};
