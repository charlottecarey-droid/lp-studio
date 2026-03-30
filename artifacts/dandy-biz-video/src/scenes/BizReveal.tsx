import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';
import { KpiCard, LiveBadge, GlowLine } from '../components/ui';
import dashboardImg from '@assets/isa_1774822623873.png';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function BizReveal() {
  const [phase, setPhase] = useState(0);
  const [cardsVisible, setCardsVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1500);
    const t2 = setTimeout(() => setCardsVisible(true), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      {/* Dashboard screenshot — rises from bottom, pushes headline up */}
      <motion.div
        className="absolute bottom-0 left-1/2 w-[80vw]"
        style={{ transformOrigin: 'bottom center', perspective: '1200px', x: '-50%' }}
        initial={{ opacity: 0, y: 80, rotateX: 14 }}
        animate={{ opacity: 1, y: 0, rotateX: 7 }}
        transition={{ delay: 0.5, duration: 1.0, ease: EASE }}
      >
        <div
          className="rounded-t-xl overflow-hidden relative"
          style={{
            boxShadow: '0 0 0 1.5px rgba(199,231,56,0.25), 0 -24px 60px rgba(0,0,0,0.4)',
          }}
        >
          <img src={dashboardImg} alt="Dandy Insights network dashboard" className="w-full block" />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,26,20,0.95) 100%)' }}
          />
        </div>
      </motion.div>

      {/* Headline block — starts centered, gets pushed to top as dashboard rises */}
      <motion.div
        className="absolute left-1/2 flex flex-col items-center gap-4 z-10 w-full"
        initial={{ top: '50%', y: '-50%', x: '-50%' }}
        animate={
          phase >= 1
            ? { top: '6%', y: '0%', x: '-50%' }
            : { top: '50%', y: '-50%', x: '-50%' }
        }
        transition={{ duration: 0.85, ease: EASE }}
      >
        <LiveBadge label="Network Live" delay={0.2} />

        <h1 className="text-[5.5vw] font-normal leading-[1.3] tracking-tight text-white">
          <SplitText
            text="Not anymore."
            delay={0.3}
            stagger={0.1}
            duration={0.65}
            className="text-white"
          />
        </h1>

        <div className="w-[40vw]">
          <GlowLine delay={0.9} />
        </div>
      </motion.div>

      {/* KPI cards — appear in the space between headline and dashboard */}
      {cardsVisible && (
        <motion.div
          className="absolute z-10 left-1/2 flex items-stretch gap-4 justify-center flex-wrap"
          style={{ top: '28%', x: '-50%' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <KpiCard label="Net Production" value="$4.2M" sub="This month · 43 sites" trend="up" delay={0.0} dark />
          <KpiCard label="Avg Case Acceptance" value="68.4%" sub="↑ 9pts vs. last quarter" trend="up" delay={0.1} dark />
          <KpiCard label="Scan Quality Score" value="91.2" sub="Network avg · 2,973 chairs" trend="up" delay={0.2} dark />
          <KpiCard label="Sites Below Target" value="7" sub="Requires attention" trend="down" delay={0.3} dark />
        </motion.div>
      )}
    </motion.div>
  );
}
