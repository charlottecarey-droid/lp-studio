import React from 'react';
import { motion } from 'framer-motion';

interface TypeWriterProps {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function TypeWriter({ text, delay = 0, speed = 0.04, className, style }: TypeWriterProps) {
  return (
    <span className={className} style={{ display: 'inline', ...style }}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          style={{ display: 'inline' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + i * speed, duration: 0.01 }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}
