'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const fadeUp = (delay: number) => ({
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const, delay } },
});

const fadeIn = (delay: number) => ({
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, delay } },
});

export default function HeroContent() {
  return (
    <motion.div initial="hidden" animate="visible" className="max-w-3xl">
      {/* Badge */}
      <motion.div
        variants={fadeIn(0.1)}
        className="inline-flex items-center gap-2.5 bg-emerald-600/15 border border-emerald-500/25 rounded-full px-4 py-2 mb-10"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm font-medium text-emerald-300">Initiative Présidentielle · Burkina Faso</span>
      </motion.div>

      {/* Title */}
      <motion.h1
        className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6"
      >
        <motion.span variants={fadeUp(0.2)} className="block">Une Justice</motion.span>
        <motion.span variants={fadeUp(0.35)} className="block text-emerald-400">Active.</motion.span>
        <motion.span variants={fadeUp(0.5)} className="block">Une Réinsertion Garantie.</motion.span>
      </motion.h1>

      {/* Paragraph */}
      <motion.p
        variants={fadeIn(0.65)}
        className="text-xl text-slate-300 max-w-2xl leading-relaxed mb-10"
      >
        Le Système Horon permet aux personnes condamnées à des Travaux d&apos;Intérêt Général de servir leur peine au cœur de la communauté — sous surveillance électronique stricte, dans le respect de leur dignité.
      </motion.p>

      {/* CTAs */}
      <motion.div variants={fadeUp(0.8)} className="flex flex-col sm:flex-row gap-4">
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Link
            href="/initiative"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/40"
          >
            Découvrir l&apos;initiative <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Link
            href="/fonctionnement"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-slate-600 text-slate-200 font-semibold text-sm hover:bg-slate-800 transition-colors"
          >
            Voir le fonctionnement
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
