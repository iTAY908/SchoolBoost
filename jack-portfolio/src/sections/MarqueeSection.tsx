import { useEffect, useRef, useState } from 'react';
import { ROW_ONE, ROW_TWO } from '../data/marquee';

/** Tripled so the strip never runs out of tiles while translating. */
const triple = <T,>(items: T[]) => [...items, ...items, ...items];

export default function MarqueeSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const sectionTop = el.offsetTop;
      setOffset((window.scrollY - sectionTop + window.innerHeight) * 0.3);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const shift = offset - 200;

  return (
    <section
      ref={sectionRef}
      className="overflow-hidden pb-10 pt-24 sm:pt-32 md:pt-40"
      style={{ background: '#0C0C0C' }}
    >
      <div className="flex flex-col gap-3">
        <Row images={triple(ROW_ONE)} translate={shift} />
        <Row images={triple(ROW_TWO)} translate={-shift} />
      </div>
    </section>
  );
}

function Row({ images, translate }: { images: string[]; translate: number }) {
  return (
    <div className="flex w-max gap-3" style={{ transform: `translateX(${translate}px)`, willChange: 'transform' }}>
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          loading="lazy"
          className="rounded-2xl object-cover"
          style={{ width: 420, height: 270, flex: 'none' }}
        />
      ))}
    </div>
  );
}
