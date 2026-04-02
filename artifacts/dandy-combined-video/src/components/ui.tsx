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
      {prefix}{value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

// ─── Metric pill ───────────────────────────────────────────────────────────────
interface MetricPillProps {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
  large?: boolean;
}
export function MetricPill({ label, value, trend = 'neutral', delay = 0, large = false }: MetricPillProps) {
  const trendColor = trend === 'up' ? '#059669' : trend === 'down' ? '#dc2626' : '#374151';
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  return (
    <motion.div
      className={`flex items-center gap-3 bg-white rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.2)] ${large ? 'px-7 py-4' : 'px-4 py-2'}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay, type: 'spring', bounce: 0.4 }}
    >
      <span className={`text-[#6b7280] ${large ? 'text-[1.15vw]' : 'text-[0.9vw]'}`}>{label}</span>
      <span className={`font-bold tabular-nums ${large ? 'text-[1.45vw]' : 'text-[1vw]'}`} style={{ color: trendColor }}>
        {arrow}{value}
      </span>
    </motion.div>
  );
}

// ─── Business KPI card ────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
  dark?: boolean;
}
export function KpiCard({ label, value, sub, trend = 'neutral', delay = 0, dark = false }: KpiCardProps) {
  const trendColor = trend === 'up' ? '#059669' : trend === 'down' ? '#dc2626' : '#6b7280';
  const trendColorDark = trend === 'up' ? '#C7E738' : trend === 'down' ? '#f87171' : '#9ca3af';
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  return (
    <motion.div
      className={`rounded-2xl px-6 py-5 flex flex-col gap-1 min-w-[12vw] ${
        dark
          ? 'bg-[#001a14]/80 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.45)] border border-white/10'
          : 'bg-white/95 shadow-[0_8px_32px_rgba(0,0,0,0.22)]'
      }`}
      initial={{ opacity: 0, y: 20, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className={`text-[0.85vw] font-medium uppercase tracking-wider ${dark ? 'text-white/50' : 'text-[#6b7280]'}`}>{label}</span>
      <span className={`text-[2vw] font-bold tabular-nums leading-none ${dark ? 'text-white' : 'text-[#111827]'}`}>
        {arrow && <span style={{ color: dark ? trendColorDark : trendColor }}>{arrow} </span>}{value}
      </span>
      {sub && <span className={`text-[0.78vw] ${dark ? 'text-white/35' : 'text-[#9ca3af]'}`}>{sub}</span>}
    </motion.div>
  );
}

// ─── Live badge ───────────────────────────────────────────────────────────────
export function LiveBadge({ label = 'Live Data', delay = 0 }: { label?: string; delay?: number }) {
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

// ─── Glow divider line ────────────────────────────────────────────────────────
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

// ─── Location row item ────────────────────────────────────────────────────────
interface LocationRowProps {
  name: string;
  chairs: number;
  margin: string;
  trend: 'up' | 'down' | 'neutral';
  delay?: number;
}
export function LocationRow({ name, chairs, margin, trend, delay = 0 }: LocationRowProps) {
  const trendColor = trend === 'up' ? '#059669' : trend === 'down' ? '#dc2626' : '#6b7280';
  const arrow = trend === 'up' ? '↑' : '↓';
  return (
    <motion.div
      className="flex items-center justify-between bg-white/90 rounded-xl px-5 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full" style={{ background: trendColor }} />
        <span className="text-[#111827] text-[1vw] font-semibold">{name}</span>
        <span className="text-[#9ca3af] text-[0.82vw]">{chairs} chairs</span>
      </div>
      <span className="text-[1.1vw] font-bold tabular-nums" style={{ color: trendColor }}>
        {arrow} {margin}
      </span>
    </motion.div>
  );
}

// ─── Alert Card ────────────────────────────────────────────────────────
export function AlertCard({ kind, title, sub, delay = 0 }: { kind: 'success'|'warning'|'error', title: string, sub: string, delay?: number }) {
  const colors = {
    success: { bg: '#059669', icon: '✓' },
    warning: { bg: '#d97706', icon: '!' },
    error: { bg: '#dc2626', icon: '✕' }
  };
  return (
    <motion.div
      className="flex items-center gap-3 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.15)] rounded-xl p-4 pr-6"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[0.9vw] font-bold" style={{ backgroundColor: colors[kind].bg }}>
        {colors[kind].icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[#111827] text-[0.95vw] font-bold">{title}</span>
        <span className="text-[#6b7280] text-[0.8vw]">{sub}</span>
      </div>
    </motion.div>
  );
}
