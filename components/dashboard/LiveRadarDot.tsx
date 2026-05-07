'use client';

import { motion } from 'framer-motion';

interface Props {
  color?: 'green' | 'red' | 'amber';
  label?: string;
  size?: 'sm' | 'md';
}

const PALETTE = {
  green: { dot: 'bg-emerald-400', ring: 'bg-emerald-400', text: 'text-emerald-400' },
  red:   { dot: 'bg-red-400',     ring: 'bg-red-400',     text: 'text-red-400' },
  amber: { dot: 'bg-amber-400',   ring: 'bg-amber-400',   text: 'text-amber-400' },
};

export default function LiveRadarDot({ color = 'green', label, size = 'sm' }: Props) {
  const c = PALETTE[color];
  const dotSize  = size === 'md' ? 'w-3 h-3' : 'w-2 h-2';
  const wrapSize = size === 'md' ? 24 : 16;
  const ringMax  = size === 'md' ? 36 : 24;

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: wrapSize, height: wrapSize }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={`absolute rounded-full ${c.ring}`}
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            animate={{ width: [wrapSize * 0.5, ringMax], height: [wrapSize * 0.5, ringMax], opacity: [0.75, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
          />
        ))}
        <span className={`relative z-10 rounded-full ${dotSize} ${c.dot}`} />
      </div>
      {label && (
        <span className={`text-xs font-semibold ${c.text}`}>{label}</span>
      )}
    </div>
  );
}
