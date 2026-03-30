import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';
import { KpiCard, LiveBadge, GlowLine } from '../components/ui';
import dashboardImg from '@assets/isa_1774822623873.png';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function BizReveal() {
  const [showDash, setShowDash] = useState(false);
  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowDash(true), 1400);
    const t2 = setTimeout(() => setShowCards(true), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      {/* ── Top band: headline on dark background ── */}
      <div className="relative z-10 flex flex-col items-center pt-[7vh] gap-4 flex-shrink-0">
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

        <div className="w-[38vw]">
          <GlowLine delay={0.85} />
        </div>
      </div>

      {/* ── KPI cards row — appear below headline ── */}
      <div className="relative z-10 flex justify-center mt-5 flex-shrink-0 px-8">
        {showCards ? (
          <motion.div
            className="flex items-stretch gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <KpiCard label="Net Production"    value="$4.2M"  sub="This month · 43 sites"       trend="up"   delay={0.00} dark />
            <KpiCard label="Case Acceptance"   value="68.4%"  sub="↑ 9pts vs. last quarter"     trend="up"   delay={0.08} dark />
            <KpiCard label="Scan Quality"      value="91.2"   sub="Network avg · 2,973 chairs"  trend="up"   delay={0.16} dark />
            <KpiCard label="Sites Below Target" value="7"     sub="Needs attention"             trend="down" delay={0.24} dark />
          </motion.div>
        ) : (
          /* Reserve space so layout doesn't shift */
          <div style={{ height: '5.5vw' }} />
        )}
      </div>

      {/* ── Dashboard image fills the rest ── */}
      <div className="relative flex-1 flex items-end justify-center mt-1 pb-0">
        <motion.div
          className="w-[82vw]"
          initial={{ opacity: 0, y: 60 }}
          animate={showDash ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
          transition={{ duration: 1.0, ease: EASE }}
        >
          <div
            className="rounded-xl overflow-hidden relative"
            style={{ boxShadow: '0 0 0 1.5px rgba(199,231,56,0.22), 0 -20px 50px rgba(0,0,0,0.5)' }}
          >
            <img
              src={dashboardImg}
              alt="Dandy Insights network dashboard"
              className="w-full block"
              style={{ maxHeight: '44vh', objectFit: 'cover', objectPosition: 'top' }}
            />
            {/* Fade bottom edge into background */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,26,20,0.92) 100%)' }}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
