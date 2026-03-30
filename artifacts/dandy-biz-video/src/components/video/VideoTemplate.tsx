import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BizHook from '../../scenes/BizHook';
import BizBlackBox from '../../scenes/BizBlackBox';
import BizReveal from '../../scenes/BizReveal';
import BizNetwork from '../../scenes/BizNetwork';
import BizDoctors from '../../scenes/BizDoctors';
import BizPayoff from '../../scenes/BizPayoff';
import BizCTA from '../../scenes/BizCTA';

const SCENES = [
  { id: 1, duration: 5000,  Component: BizHook },
  { id: 2, duration: 4500,  Component: BizBlackBox },
  { id: 3, duration: 6500,  Component: BizReveal },
  { id: 4, duration: 6500,  Component: BizNetwork },
  { id: 5, duration: 7000,  Component: BizDoctors },
  { id: 6, duration: 5500,  Component: BizPayoff },
  { id: 7, duration: 5500,  Component: BizCTA },
];

const TOTAL_MS = SCENES.reduce((sum, s) => sum + s.duration, 0);

declare global {
  interface Window {
    startRecording?: () => Promise<void>;
    stopRecording?: () => void;
  }
}

export default function VideoTemplate() {
  const [currentScene, setCurrentScene] = useState(0);
  const [progress, setProgress] = useState(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    window.startRecording?.();
  }, []);

  useEffect(() => {
    const duration = SCENES[currentScene].duration;
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      const scenePct = Math.min(elapsed / duration, 1);
      const sceneElapsed = elapsedRef.current + elapsed;
      setProgress(Math.min(sceneElapsed / TOTAL_MS, 1));

      if (scenePct < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        elapsedRef.current += duration;
        if (currentScene < SCENES.length - 1) {
          setCurrentScene(prev => prev + 1);
        } else {
          window.stopRecording?.();
          elapsedRef.current = 0;
          setCurrentScene(0);
        }
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentScene]);

  const { Component } = SCENES[currentScene];

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{ background: '#001a14' }}
    >
      {/* Scene layer */}
      <AnimatePresence mode="wait">
        <Component key={currentScene} />
      </AnimatePresence>

      {/* Progress scrubber bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/8 z-50">
        <motion.div
          className="h-full"
          style={{ background: '#C7E738', width: `${progress * 100}%` }}
        />
      </div>

      {/* Scene dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50">
        {SCENES.map((_, i) => (
          <motion.div
            key={i}
            className="h-[5px] rounded-full"
            animate={{
              width: i === currentScene ? 20 : 5,
              background: i === currentScene ? '#C7E738' : 'rgba(255,255,255,0.25)',
            }}
            transition={{ duration: 0.35 }}
          />
        ))}
      </div>
    </div>
  );
}
