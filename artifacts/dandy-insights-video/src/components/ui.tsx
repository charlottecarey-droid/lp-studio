import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

// ─── Animated counter ─────────────────────────────────────────────────────────
interface CounterProps {
  from: number;
  to: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}
export function Counter({ from, to, duration = 1.4, decimals = 0, suffix = '', prefix = '', className = '' }: CounterProps) {
  const [value, setValue] = useState(from);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const diff = to - from;
    function tick(now: number) {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(from + diff * ease);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [from, to, duration]);

  return (
    <span className={className}>
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─── Alert / notification card ────────────────────────────────────────────────
type AlertKind = 'warning' | 'success' | 'info' | 'critical';

const kindStyles: Record<AlertKind, { dot: string; leftBar: string; valueColor: string }> = {
  warning:  { dot: 'bg-amber-400',  leftBar: 'bg-amber-400',  valueColor: '#92400e' },
  success:  { dot: 'bg-emerald-500', leftBar: 'bg-emerald-500', valueColor: '#065f46' },
  info:     { dot: 'bg-sky-500',    leftBar: 'bg-sky-500',    valueColor: '#0c4a6e' },
  critical: { dot: 'bg-red-500',    leftBar: 'bg-red-500',    valueColor: '#991b1b' },
};

interface AlertCardProps {
  kind?: AlertKind;
  title: string;
  sub?: string;
  value?: string;
  delay?: number;
  className?: string;
}
export function AlertCard({ kind = 'info', title, sub, value, delay = 0, className = '' }: AlertCardProps) {
  const s = kindStyles[kind];
  return (
    <motion.div
      className={`flex items-stretch bg-white rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.18)] ${className}`}
      initial={{ opacity: 0, y: 16, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Colored left accent bar */}
      <div className={`w-1 flex-shrink-0 ${s.leftBar}`} />

      <div className="flex items-start gap-3 px-4 py-3 flex-1">
        {/* Status dot with pulse */}
        <div className="mt-[5px] flex-shrink-0 relative">
          <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
          <motion.div
            className={`absolute inset-0 rounded-full ${s.dot}`}
            animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[#111827] text-[1.05vw] font-semibold leading-tight">{title}</p>
          {sub && <p className="text-[#6b7280] text-[0.88vw] mt-0.5">{sub}</p>}
        </div>

        {value && (
          <span className="flex-shrink-0 text-[1.15vw] font-bold tabular-nums ml-2" style={{ color: s.valueColor }}>
            {value}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Metric pill / badge ───────────────────────────────────────────────────────
interface MetricPillProps {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
}
export function MetricPill({ label, value, trend = 'neutral', delay = 0 }: MetricPillProps) {
  const trendColor = trend === 'up' ? '#059669' : trend === 'down' ? '#dc2626' : '#374151';
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  return (
    <motion.div
      className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.14)]"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay, type: 'spring', bounce: 0.4 }}
    >
      <span className="text-[#6b7280] text-[0.9vw]">{label}</span>
      <span className="text-[1vw] font-bold tabular-nums" style={{ color: trendColor }}>
        {arrow}{value}
      </span>
    </motion.div>
  );
}

// ─── Live pulse badge ─────────────────────────────────────────────────────────
export function LiveBadge({ label = 'Live', delay = 0 }: { label?: string; delay?: number }) {
  return (
    <motion.div
      className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.14)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay }}
    >
      <motion.div
        className="w-2 h-2 rounded-full bg-emerald-500"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span className="text-[#374151] text-[0.85vw] font-semibold tracking-wide uppercase">{label}</span>
    </motion.div>
  );
}

// ─── Horizontal divider line ──────────────────────────────────────────────────
export function GlowLine({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="h-[1px] bg-gradient-to-r from-transparent via-[#C7E738]/50 to-transparent w-full"
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.9, delay }}
    />
  );
}
