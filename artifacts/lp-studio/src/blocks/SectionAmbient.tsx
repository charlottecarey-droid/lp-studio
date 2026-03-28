import { motion } from "framer-motion";

const AW = "hsl(68,60%,52%)";

/** Thin horizontal line that sweeps top→bottom through the section */
export function ScanDown({
  color = AW,
  duration = 9,
  delay = 0,
  repeatDelay = 7,
}: {
  color?: string;
  duration?: number;
  delay?: number;
  repeatDelay?: number;
}) {
  return (
    <motion.div
      aria-hidden
      initial={{ top: "-2px" }}
      animate={{ top: ["0%", "102%"] }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear", repeatDelay }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent 0%, ${color}00 5%, ${color}AA 30%, ${color} 50%, ${color}AA 70%, ${color}00 95%, transparent 100%)`,
        boxShadow: `0 0 10px 2px ${color}55`,
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}

/** Thin vertical line that sweeps left→right across the section */
export function ScanAcross({
  color = AW,
  duration = 11,
  delay = 0,
  repeatDelay = 8,
}: {
  color?: string;
  duration?: number;
  delay?: number;
  repeatDelay?: number;
}) {
  return (
    <motion.div
      aria-hidden
      animate={{ left: ["-2px", "calc(100% + 2px)"] }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear", repeatDelay }}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 1,
        background: `linear-gradient(180deg, transparent 0%, ${color}00 5%, ${color}AA 30%, ${color} 50%, ${color}AA 70%, ${color}00 95%, transparent 100%)`,
        boxShadow: `0 0 10px 2px ${color}55`,
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}

/** Soft radial glow that pulses in and out at a fixed position */
export function PulseGlow({
  color = AW,
  size = 400,
  top,
  left,
  right,
  bottom,
  duration = 5,
  delay = 0,
}: {
  color?: string;
  size?: number;
  top?: string | number;
  left?: string | number;
  right?: string | number;
  bottom?: string | number;
  duration?: number;
  delay?: number;
}) {
  return (
    <motion.div
      aria-hidden
      animate={{ opacity: [0.06, 0.18, 0.06], scale: [0.9, 1.1, 0.9] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: "absolute",
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}

/** Tiny bright dot that flickers on and off */
export function FlickerDot({
  color = AW,
  top,
  left,
  right,
  bottom,
  delay = 0,
}: {
  color?: string;
  top?: string | number;
  left?: string | number;
  right?: string | number;
  bottom?: string | number;
  delay?: number;
}) {
  return (
    <motion.div
      aria-hidden
      animate={{ opacity: [0, 0.9, 0.3, 1, 0] }}
      transition={{ duration: 4, delay, repeat: Infinity, ease: "easeInOut", repeatDelay: Math.random() * 6 + 3 }}
      style={{
        position: "absolute",
        top,
        left,
        right,
        bottom,
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px 2px ${color}99`,
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}
