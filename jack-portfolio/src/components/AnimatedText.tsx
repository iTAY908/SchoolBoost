import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import type { MotionValue } from 'framer-motion';

type AnimatedTextProps = {
  text: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Character-by-character scroll reveal. Every character fades 0.2 -> 1 as the
 * paragraph travels through the viewport. Splitting on words first keeps
 * normal line wrapping — a flat char list would break mid-word.
 */
export default function AnimatedText({ text, className, style }: AnimatedTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.8', 'end 0.2'],
  });

  const words = text.split(' ');
  const total = text.length;
  let cursor = 0;

  return (
    <p ref={ref} className={className} style={style}>
      {words.map((word, wi) => {
        const chars = word.split('');
        const node = (
          <span key={wi} className="inline-block whitespace-nowrap">
            {chars.map((char, ci) => {
              const index = cursor + ci;
              return (
                <Char
                  key={ci}
                  progress={scrollYProgress}
                  range={[index / total, (index + 1) / total]}
                >
                  {char}
                </Char>
              );
            })}
          </span>
        );
        cursor += chars.length + 1; // +1 for the space that follows
        return (
          <span key={`w${wi}`}>
            {node}
            {wi < words.length - 1 ? ' ' : null}
          </span>
        );
      })}
    </p>
  );
}

function Char({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.2, 1]);

  return (
    <span className="relative inline-block">
      {/* invisible placeholder holds the layout box */}
      <span className="invisible">{children}</span>
      <motion.span className="absolute left-0 top-0" style={{ opacity }}>
        {children}
      </motion.span>
    </span>
  );
}
