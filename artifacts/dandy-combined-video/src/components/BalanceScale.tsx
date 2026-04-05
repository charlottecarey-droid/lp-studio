import React from 'react';
import { motion, type Transition } from 'framer-motion';

// Geometry constants (SVG units, viewBox 800×420)
const PX = 400; // pivot x
const PY = 210; // pivot y
const ARM = 210; // half-beam length
const CHAIN = 72; // chain length
const PAN_R = 32; // pan circle radius

// Beam rocks: left-heavy → right-heavy → balanced
const BEAM_KF  = [-16, 13, 0];
const PAN_KF   = [16, -13, 0]; // opposite, keeps pans hanging level
const DURATION = 4.2;
const TIMES    = [0, 0.44, 1];
const EASE     = [0.4, 0, 0.2, 1];

// Shared transition
const tx = (extra: object = {}): Transition => ({
  duration: DURATION,
  times: TIMES,
  ease: EASE,
  ...extra,
} as unknown as Transition);

export default function BalanceScale({ delay = 0 }: { delay?: number }) {
  return (
    <motion.svg
      viewBox="0 0 800 420"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.9, ease: 'easeOut' }}
    >
      {/* ── Fulcrum ── */}
      <motion.polygon
        points={`${PX},${PY + 4} ${PX - 22},${PY + 54} ${PX + 22},${PY + 54}`}
        fill="rgba(199,231,56,0.35)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.2, duration: 0.6 }}
      />
      {/* Stand */}
      <line
        x1={PX} y1={PY + 54}
        x2={PX} y2={PY + 90}
        stroke="rgba(199,231,56,0.25)"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* ── Beam group — rotates around pivot ── */}
      <motion.g
        style={{ transformOrigin: `${PX}px ${PY}px` } as any}
        animate={{ rotate: BEAM_KF }}
        transition={tx({ delay })}
      >
        {/* Beam bar */}
        <line
          x1={PX - ARM} y1={PY}
          x2={PX + ARM} y2={PY}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Pivot dot */}
        <circle cx={PX} cy={PY} r={7} fill="rgba(199,231,56,0.6)" />

        {/* ── Left pan group — counter-rotates to stay plumb ── */}
        <motion.g
          style={{ transformOrigin: `${PX - ARM}px ${PY}px` } as any}
          animate={{ rotate: PAN_KF }}
          transition={tx({ delay })}
        >
          {/* Chain */}
          <line
            x1={PX - ARM} y1={PY}
            x2={PX - ARM} y2={PY + CHAIN}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          {/* Pan circle */}
          <circle
            cx={PX - ARM} cy={PY + CHAIN + PAN_R}
            r={PAN_R}
            fill="none"
            stroke="rgba(199,231,56,0.5)"
            strokeWidth="2"
          />
          {/* "Clinical" label */}
          <text
            x={PX - ARM} y={PY + CHAIN + PAN_R + 5}
            textAnchor="middle"
            fill="rgba(199,231,56,0.7)"
            fontSize="11"
            fontFamily="sans-serif"
            letterSpacing="0.08em"
          >
            CLINICAL
          </text>
        </motion.g>

        {/* ── Right pan group — counter-rotates to stay plumb ── */}
        <motion.g
          style={{ transformOrigin: `${PX + ARM}px ${PY}px` } as any}
          animate={{ rotate: PAN_KF }}
          transition={tx({ delay })}
        >
          {/* Chain */}
          <line
            x1={PX + ARM} y1={PY}
            x2={PX + ARM} y2={PY + CHAIN}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          {/* Pan circle */}
          <circle
            cx={PX + ARM} cy={PY + CHAIN + PAN_R}
            r={PAN_R}
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="2"
          />
          {/* "Enterprise" label */}
          <text
            x={PX + ARM} y={PY + CHAIN + PAN_R + 5}
            textAnchor="middle"
            fill="rgba(255,255,255,0.6)"
            fontSize="11"
            fontFamily="sans-serif"
            letterSpacing="0.08em"
          >
            ENTERPRISE
          </text>
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}
