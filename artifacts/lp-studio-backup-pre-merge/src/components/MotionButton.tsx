import { motion } from "framer-motion";
import type { ComponentPropsWithoutRef } from "react";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

export function MotionButton({ className, ...props }: ComponentPropsWithoutRef<"button">) {
  return (
    <motion.button
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96, y: 0 }}
      transition={SPRING}
      className={className}
      {...(props as Record<string, unknown>)}
    />
  );
}

export function MotionA({ className, ...props }: ComponentPropsWithoutRef<"a">) {
  return (
    <motion.a
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96, y: 0 }}
      transition={SPRING}
      className={className}
      {...(props as Record<string, unknown>)}
    />
  );
}
