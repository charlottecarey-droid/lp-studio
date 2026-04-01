import React from 'react';
import { motion } from 'framer-motion';

interface SplitTextProps {
  text: string;
  delay?: number;
  stagger?: number;
  className?: string;
  ease?: number[];
  duration?: number;
}

export function SplitText({
  text,
  delay = 0,
  stagger = 0.07,
  className = '',
  ease = [0.16, 1, 0.3, 1],
  duration = 0.6,
}: SplitTextProps) {
  const words = text.split(' ');
  return (
    <span className={`inline-flex flex-wrap ${className}`} style={{ gap: '0.28em' }}>
      {words.map((word, i) => (
        <span key={i} style={{ overflow: 'hidden', display: 'inline-block' }}>
          <motion.span
            style={{ display: 'inline-block' }}
            initial={{ y: '105%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: delay + i * stagger, duration, ease }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function SplitChars({
  text,
  delay = 0,
  stagger = 0.03,
  className = '',
  duration = 0.4,
}: Omit<SplitTextProps, 'ease'>) {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + i * stagger, duration }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}
