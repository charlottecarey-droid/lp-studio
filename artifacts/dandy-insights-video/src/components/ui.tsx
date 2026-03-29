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

const kindStyles: Record<AlertKind, { dot: string; border: string; icon: string }> = {
  warning:  { dot: 'bg-amber-400',    border: 'border-amber-400/30',  icon: '⚠' },
  success:  { dot: 'bg-[#C7E738]',    border: 'border-[#C7E738]/30',  icon: '✓' },
  info:     { dot: 'bg-sky-400',      border: 'border-sky-400/25',    icon: 'i' },
  critical: { dot: 'bg-red-500',      border: 'border-red-500/30',    icon: '!' },
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
      className={`flex items-start gap-3 bg-[#001F19]/95 backdrop-blur-xl border ${s.border} rounded-2xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${className}`}
      initial={{ opacity: 0, y: 16, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Status dot */}
      <div className="mt-[3px] flex-shrink-0 relative">
        <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
        <motion.div
          className={`absolute inset-0 rounded-full ${s.dot} opacity-50`}
          animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-[1.1vw] font-semibold leading-tight">{title}</p>
        {sub && <p className="text-white/50 text-[0.9vw] mt-0.5">{sub}</p>}
      </div>
      {value && (
        <span className="flex-shrink-0 text-[#C7E738] text-[1.2vw] font-bold tabular-nums">{value}</span>
      )}
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
  const trendColor = trend === 'up' ? 'text-[#C7E738]' : trend === 'down' ? 'text-red-400' : 'text-white/70';
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  return (
    <motion.div
      className="flex items-center gap-2 bg-[#001F19]/90 backdrop-blur-md border border-white/10 rounded-full px-4 py-2"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay, type: 'spring', bounce: 0.4 }}
    >
      <span className="text-white/55 text-[0.9vw]">{label}</span>
      <span className={`text-[1vw] font-bold ${trendColor}`}>
        {arrow}{value}
      </span>
    </motion.div>
  );
}

// ─── Live pulse badge ─────────────────────────────────────────────────────────
export function LiveBadge({ label = 'Live', delay = 0 }: { label?: string; delay?: number }) {
  return (
    <motion.div
      className="flex items-center gap-2 bg-[#001F19]/90 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay }}
    >
      <motion.div
        className="w-2 h-2 rounded-full bg-[#C7E738]"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span className="text-white/70 text-[0.85vw] font-medium tracking-wide uppercase">{label}</span>
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
