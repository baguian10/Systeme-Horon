'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDES = [
  { src: '/reinsertion-sociale.jpg',    alt: 'Réinsertion sociale par le travail' },
  { src: '/justice-rehabilitation.jpg', alt: 'Justice et réhabilitation' },
  { src: '/suivi-precision.jpg',        alt: 'Surveillance GPS de précision' },
  { src: '/centre-controle-sigep.jpg',  alt: 'Centre de contrôle SIGEP' },
];

const INTERVAL = 5000;

export default function HeroSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      {/* Image crossfade layer */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence>
          <motion.div
            key={index}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 0.38, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
          >
            <Image
              src={SLIDES[index].src}
              alt={SLIDES[index].alt}
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover object-center"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Gradient overlays — always on top of images */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/88 to-slate-900/40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent pointer-events-none" />

      {/* Slide indicators */}
      <div className="absolute bottom-24 right-8 flex gap-2 z-20">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Image ${i + 1}`}
            className={`transition-all duration-300 rounded-full ${
              i === index
                ? 'w-6 h-2 bg-emerald-400'
                : 'w-2 h-2 bg-white/30 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </>
  );
}
