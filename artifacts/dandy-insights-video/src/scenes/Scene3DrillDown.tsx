import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assets } from '../utils/assets';
import { AlertCard } from '../components/ui';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';

const LEVELS = [
  {
    img: assets.doctorView,
    headlineA: 'Track performance',
    headlineB: 'by individual provider.',
    alert: { kind: 'warning' as const, title: 'Above network average', sub: 'Coaching recommended' },
    // headline LEFT, dashboard RIGHT
    layout: 'left' as const,
    headlineFrom: { x: -40, y: 0 },
  },
  {
    img: assets.practiceView,
    headlineA: 'Compare locations',
    headlineB: 'across every site.',
    alert: { kind: 'success' as const, title: 'On track this quarter', sub: 'All KPIs in range' },
    // headline TOP, dashboard BELOW
    layout: 'top' as const,
    headlineFrom: { x: 0, y: -40 },
  },
  {
    img: assets.dsoView,
    headlineA: 'Command the network',
    headlineB: 'from a single view.',
    alert: { kind: 'info' as const, title: '12 locations reporting', sub: 'Updated 30 min ago' },
    // headline RIGHT, dashboard LEFT
    layout: 'right' as const,
    headlineFrom: { x: 40, y: 0 },
  },
];

function LevelContent({ level }: { level: number }) {
  const current = LEVELS[level];
  const { layout, headlineFrom } = current;

  const isTop = layout === 'top';
  const isRight = layout === 'right';

  const headline = (
    <motion.div
      className={`relative z-10 flex-shrink-0 flex flex-col gap-3 ${isTop ? 'w-full text-center items-center' : 'w-[30vw]'}`}
      initial={{ opacity: 0, x: headlineFrom.x, y: headlineFrom.y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className={`font-bold leading-[1.2] tracking-tight ${isTop ? 'text-[3vw]' : 'text-[2.6vw]'}`}>
        <SplitText
          text={current.headlineA}
          delay={0.1}
          stagger={0.08}
          duration={0.5}
          className="text-[#C7E738]"
        />
        <br />
        <SplitText
          text={current.headlineB}
          delay={0.4}
          stagger={0.07}
          duration={0.5}
          className="text-white"
        />
      </h2>
    </motion.div>
  );

  const dashboard = (
    <div className={`relative z-10 flex-shrink-0 ${isTop ? 'w-[72vw]' : 'w-[58vw]'}`}>
      {/* Image — overflow-hidden for rounded corners */}
      <motion.div
        className="w-full rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.55)] border border-[#C7E738]/15"
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      >
        <img src={current.img} alt="" className="w-full h-auto" />
      </motion.div>

      {/* Alert card — outside overflow-hidden so it shows above the frame */}
      <AnimatePresence mode="wait">
        <motion.div
          key={level}
          className="absolute -top-4 -right-4 w-[22vw] z-20"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <AlertCard
            kind={current.alert.kind}
            title={current.alert.title}
            sub={current.alert.sub}
            delay={0}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );

  if (isTop) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2.5vw] px-[6vw]">
        <Background />
        {headline}
        {dashboard}
      </div>
    );
  }

  if (isRight) {
    return (
      <div className="absolute inset-0 flex flex-row-reverse items-center justify-center gap-[4vw] px-[4vw]">
        <Background />
        {headline}
        {dashboard}
      </div>
    );
  }

  // default: left
  return (
    <div className="absolute inset-0 flex flex-row items-center justify-center gap-[4vw] px-[4vw]">
      <Background />
      {headline}
      {dashboard}
    </div>
  );
}

export default function Scene3DrillDown() {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setLevel(1), 2800);
    const t2 = setTimeout(() => setLevel(2), 5600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      initial={{ opacity: 0, x: '6vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={level}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <LevelContent level={level} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
