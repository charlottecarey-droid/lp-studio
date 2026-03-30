import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assets } from '../utils/assets';
import { MetricPill, AlertCard } from '../components/ui';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';

const LEVELS = [
  {
    label: 'Doctor',
    img: assets.doctorView,
    caption: 'Track performance',
    captionAccent: 'by individual provider.',
    metric: { label: 'Remake rate', value: '6.1%', trend: 'down' as const },
    alert: { kind: 'warning' as const, title: 'Above network average', sub: 'Coaching recommended' },
  },
  {
    label: 'Practice',
    img: assets.practiceView,
    caption: 'Compare locations',
    captionAccent: 'across every site.',
    metric: { label: 'Avg scan quality', value: '94%', trend: 'up' as const },
    alert: { kind: 'success' as const, title: 'On track this quarter', sub: 'All KPIs in range' },
  },
  {
    label: 'DSO Group',
    img: assets.dsoView,
    caption: 'Command the network',
    captionAccent: 'from a single view.',
    metric: { label: 'Group remake rate', value: '5.3%', trend: 'down' as const },
    alert: { kind: 'info' as const, title: '12 locations reporting', sub: 'Updated 30 min ago' },
  },
];

export default function Scene3DrillDown() {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setLevel(1), 2500);
    const t2 = setTimeout(() => setLevel(2), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const current = LEVELS[level];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 w-full h-full overflow-hidden px-8"
      initial={{ opacity: 0, x: '6vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <Background />

      {/* Level tabs */}
      <motion.div
        className="flex items-center gap-3 flex-shrink-0"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        {LEVELS.map((l, i) => (
          <React.Fragment key={l.label}>
            <div className={`text-[1.4vw] font-semibold transition-all duration-500 ${i === level ? 'text-[#C7E738]' : 'text-white/30'}`}>
              {l.label}
            </div>
            {i < LEVELS.length - 1 && (
              <div className={`w-8 h-[2px] rounded-full transition-colors duration-700 ${i < level ? 'bg-[#C7E738]/60' : 'bg-white/15'}`} />
            )}
          </React.Fragment>
        ))}
      </motion.div>

      {/* Screenshot with overlays */}
      <div className="relative w-[76vw] flex-shrink-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={level}
            className="w-full rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.55)] border border-[#C7E738]/15"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 1.01 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <img src={current.img} alt={current.label} className="w-full h-auto" />
          </motion.div>
        </AnimatePresence>

        {/* Floating alert — top right of screenshot */}
        <div className="absolute -top-3 -right-2 w-[24vw] z-20">
          <AnimatePresence mode="wait">
            <AlertCard
              key={level}
              kind={current.alert.kind}
              title={current.alert.title}
              sub={current.alert.sub}
              delay={0.2}
            />
          </AnimatePresence>
        </div>

        {/* Metric pill — bottom left of screenshot */}
        <div className="absolute -bottom-3 -left-2 z-20">
          <AnimatePresence mode="wait">
            <motion.div key={level}>
              <MetricPill
                label={current.metric.label}
                value={current.metric.value}
                trend={current.metric.trend}
                delay={0.25}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Caption pill — below the dashboard */}
      <div className="flex justify-center flex-shrink-0">
        <div className="bg-[#001F19]/90 backdrop-blur-md px-8 py-3.5 rounded-full border border-white/10 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={level}
              className="flex flex-wrap items-baseline justify-center"
              style={{ gap: '0.28em' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <SplitText
                text={current.caption}
                delay={0}
                stagger={0.07}
                duration={0.45}
                className="text-[1.25vw] tracking-wide text-white"
              />
              <SplitText
                text={'— ' + current.captionAccent}
                delay={current.caption.split(' ').length * 0.07 + 0.05}
                stagger={0.06}
                duration={0.4}
                className="text-[1.25vw] tracking-wide text-[#C7E738] font-semibold"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
