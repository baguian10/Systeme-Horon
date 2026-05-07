'use client';

import { motion } from 'framer-motion';
import { FolderOpen, Bell, Wifi, AlertOctagon } from 'lucide-react';

interface Props {
  active_cases:    number;
  active_alerts:   number;
  devices_online:  number;
  violation_cases: number;
}

const ACCENTS = {
  blue:   'border-blue-500 bg-blue-50 text-blue-600',
  red:    'border-red-500 bg-red-50 text-red-600',
  green:  'border-green-500 bg-green-50 text-green-600',
  orange: 'border-orange-500 bg-orange-50 text-orange-600',
};

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const cardVariant = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

export default function AnimatedKPIGrid({ active_cases, active_alerts, devices_online, violation_cases }: Props) {
  const cards = [
    {
      label: 'Dossiers actifs',
      value: active_cases,
      icon: <FolderOpen className="w-5 h-5" />,
      accent: 'blue' as const,
    },
    {
      label: 'Alertes en cours',
      value: active_alerts,
      icon: <Bell className="w-5 h-5" />,
      accent: (active_alerts > 0 ? 'red' : 'green') as 'red' | 'green',
    },
    {
      label: 'Bracelets en ligne',
      value: devices_online,
      icon: <Wifi className="w-5 h-5" />,
      accent: 'green' as const,
    },
    {
      label: 'En violation',
      value: violation_cases,
      icon: <AlertOctagon className="w-5 h-5" />,
      accent: (violation_cases > 0 ? 'orange' : 'green') as 'orange' | 'green',
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {cards.map((card) => {
        const accentClass = ACCENTS[card.accent];
        return (
          <motion.div
            key={card.label}
            variants={cardVariant}
            whileHover={{ scale: 1.02, y: -2, transition: { duration: 0.15 } }}
            className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-100/80 p-5 flex items-start gap-4 shadow-lg shadow-black/5 cursor-default"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border flex-shrink-0 ${accentClass}`}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 leading-tight">{card.value}</p>
              <p className="text-sm font-medium text-gray-600 mt-0.5">{card.label}</p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
