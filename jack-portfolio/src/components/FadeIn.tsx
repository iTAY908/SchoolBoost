import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';

type FadeInProps = {
  children?: ReactNode;
  /** Element type to render. Resolved through motion.create() so any tag works. */
  as?: ElementType;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
};

export default function FadeIn({
  children,
  as = 'div',
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  className,
  style,
}: FadeInProps) {
  // Memoised: motion.create() returns a new component each call, and an
  // unstable type would remount the subtree on every render.
  const MotionTag = useMemo(() => motion.create(as as ElementType), [as]);

  return (
    <MotionTag
      className={className}
      style={style}
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '50px', amount: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </MotionTag>
  );
}
