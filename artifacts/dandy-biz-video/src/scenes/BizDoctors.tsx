import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';

const EASE = [0.16, 1, 0.3, 1] as const;

interface Doctor {
  initials: string;
  color: string;
  name: string;
  practice: string;
  scanQuality: number;
  remakeRate: string;
  orders: number;
}

const DOCTORS: Doctor[] = [
  { initials: 'JB', color: '#0d9488', name: 'Dr. Jamie B.',    practice: 'Coral Family Dental',    scanQuality: 94, remakeRate: '3.2%', orders: 287 },
  { initials: 'NL', color: '#3b82f6', name: 'Dr. Niles L.',    practice: 'Midtown Smiles',          scanQuality: 96, remakeRate: '2.8%', orders: 318 },
  { initials: 'KS', color: '#f59e0b', name: 'Dr. Kipp S.',     practice: 'Monroe Family Dental',    scanQuality: 91, remakeRate: '3.9%', orders: 271 },
  { initials: 'MP', color: '#8b5cf6', name: 'Dr. Michelle P.', practice: 'Coral Family Dental',    scanQuality: 89, remakeRate: '4.1%', orders: 241 },
  { initials: 'AK', color: '#ec4899', name: 'Dr. Anna K.',     practice: 'Wynne Dental',            scanQuality: 85, remakeRate: '5.1%', orders: 198 },
  { initials: 'MC', color: '#10b981', name: 'Dr. Miles C.',    practice: 'Heyworth Family Dental', scanQuality: 78, remakeRate: '6.4%', orders: 203 },
];

function qualityColor(q: number) {
  if (q >= 90) return '#22c55e';
  if (q >= 80) return '#f59e0b';
  return '#ef4444';
}

function rateColor(r: string) {
  const n = parseFloat(r);
  if (n < 4) return '#22c55e';
  if (n < 5.5) return '#f59e0b';
  return '#ef4444';
}

function DoctorRow({ doc, index, visible }: { doc: Doctor; index: number; visible: boolean }) {
  const qc = qualityColor(doc.scanQuality);
  const rc = rateColor(doc.remakeRate);

  return (
    <motion.div
      className="flex items-center gap-5 bg-white/6 rounded-xl px-5 py-3 backdrop-blur-sm border border-white/8"
      initial={{ opacity: 0, x: 40 }}
      animate={visible ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
      transition={{ delay: index * 0.11, duration: 0.5, ease: EASE }}
    >
      {/* Avatar */}
      <div
        className="w-[2.8vw] h-[2.8vw] rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[1vw]"
        style={{ background: doc.color }}
      >
        {doc.initials}
      </div>

      {/* Name + practice */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-[1.1vw] font-medium leading-tight truncate">{doc.name}</p>
        <p className="text-white/40 text-[1vw] truncate">{doc.practice}</p>
      </div>

      {/* Scan quality bar */}
      <div className="flex flex-col items-end gap-1 w-[7vw]">
        <span className="text-white/40 text-[1vw] uppercase tracking-wider">Scan Quality</span>
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 h-[5px] bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: qc }}
              initial={{ width: 0 }}
              animate={visible ? { width: `${doc.scanQuality}%` } : { width: 0 }}
              transition={{ delay: index * 0.11 + 0.3, duration: 0.6, ease: EASE }}
            />
          </div>
          <span className="text-[1.05vw] font-bold tabular-nums flex-shrink-0" style={{ color: qc }}>
            {doc.scanQuality}
          </span>
        </div>
      </div>

      {/* Remake rate */}
      <div className="flex flex-col items-end w-[4.5vw]">
        <span className="text-white/40 text-[1vw] uppercase tracking-wider">Remakes</span>
        <span className="text-[1.1vw] font-bold tabular-nums" style={{ color: rc }}>{doc.remakeRate}</span>
      </div>

      {/* Orders */}
      <div className="flex flex-col items-end w-[4vw]">
        <span className="text-white/40 text-[1vw] uppercase tracking-wider">Orders</span>
        <span className="text-[1.1vw] font-bold text-white/80 tabular-nums">{doc.orders}</span>
      </div>
    </motion.div>
  );
}

export default function BizDoctors() {
  const [headlineVisible, setHeadlineVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setHeadlineVisible(true), 150);
    const t2 = setTimeout(() => setRowsVisible(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -30, filter: 'blur(6px)' }}
      transition={{ duration: 0.75 }}
    >
      <Background />

      <div className="relative z-10 w-full px-[6vw] flex items-center gap-[5vw]">

        {/* ── Left: headline ── */}
        <div className="flex flex-col gap-4 w-[32vw] flex-shrink-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={headlineVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <SplitChars
              text="PROVIDER LEVEL VIEW"
              delay={0.1}
              stagger={0.02}
              className="text-[#C7E738] text-[1.1vw] font-semibold tracking-[0.3em] uppercase"
            />
          </motion.div>

          <h2 className="text-[3.8vw] font-normal leading-[1.15] tracking-tight">
            <SplitText
              text="Every doctor."
              delay={0.2}
              stagger={0.08}
              duration={0.6}
              className="text-white"
            />
            <br />
            <SplitText
              text="Every metric."
              delay={0.55}
              stagger={0.08}
              duration={0.6}
              className="text-[#C7E738]"
            />
          </h2>

          <motion.p
            className="text-white/50 text-[1.1vw] leading-relaxed"
            initial={{ opacity: 0, y: 10 }}
            animate={headlineVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 1.0, duration: 0.55 }}
          >
            Know which providers are driving margin —
            <br />
            and which ones are quietly bleeding it.
          </motion.p>

          {/* Legend */}
          <motion.div
            className="flex items-center gap-4 mt-2"
            initial={{ opacity: 0 }}
            animate={rowsVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            {[['#22c55e', 'On track'], ['#f59e0b', 'Watch'], ['#ef4444', 'Needs coaching']].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-white/40 text-[1vw]">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Right: doctor rows ── */}
        <div className="flex-1 flex flex-col gap-[0.6vw]">
          {DOCTORS.map((doc, i) => (
            <DoctorRow key={doc.initials} doc={doc} index={i} visible={rowsVisible} />
          ))}

          {/* Footer note */}
          <motion.p
            className="text-white/25 text-[1vw] text-right mt-1"
            initial={{ opacity: 0 }}
            animate={rowsVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 0.9, duration: 0.4 }}
          >
            Showing 6 of 247 providers · Real-time data
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
