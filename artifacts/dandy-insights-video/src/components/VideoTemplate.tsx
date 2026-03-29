import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Scene1Hook from '../scenes/Scene1Hook';
import Scene2Reveal from '../scenes/Scene2Reveal';
import Scene3DrillDown from '../scenes/Scene3DrillDown';
import Scene4Quality from '../scenes/Scene4Quality';
import Scene5Payoff from '../scenes/Scene5Payoff';
import Scene6CTA from '../scenes/Scene6CTA';

const SCENES = [
  { id: 1, duration: 4500,  Component: Scene1Hook },
  { id: 2, duration: 6000,  Component: Scene2Reveal },
  { id: 3, duration: 7500,  Component: Scene3DrillDown },
  { id: 4, duration: 6000,  Component: Scene4Quality },
  { id: 5, duration: 5000,  Component: Scene5Payoff },
  { id: 6, duration: 4500,  Component: Scene6CTA },
];

export default function VideoTemplate() {
  const [currentScene, setCurrentScene] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const duration = SCENES[currentScene].duration;
    const interval = 50;
    let elapsed = 0;
    const tick = setInterval(() => {
      elapsed += interval;
      setProgress(Math.min(elapsed / duration, 1));
    }, interval);
    const timer = setTimeout(() => {
      clearInterval(tick);
      setCurrentScene((prev) => (prev + 1) % SCENES.length);
    }, duration);
    return () => { clearTimeout(timer); clearInterval(tick); };
  }, [currentScene]);

  const CurrentSceneComponent = SCENES[currentScene].Component;

  return (
    <div
      className="relative w-full h-full overflow-hidden flex items-center justify-center"
      style={{ background: '#001a14', fontFamily: "'Bagoss Standard', Arial, Helvetica, sans-serif" }}
    >
      {/* Subtle noise grain */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      <AnimatePresence mode="wait">
        <CurrentSceneComponent key={currentScene} />
      </AnimatePresence>

      {/* Scene progress — thin bar at very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/8 z-50">
        <motion.div
          className="h-full bg-[#C7E738]"
          style={{ width: `${progress * 100}%`, opacity: 0.7 }}
          transition={{ ease: 'linear' }}
        />
      </div>

      {/* Scene dots */}
      <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 z-50">
        {SCENES.map((_, i) => (
          <motion.div
            key={i}
            className="rounded-full"
            animate={{
              width: i === currentScene ? 20 : 6,
              backgroundColor: i === currentScene ? '#C7E738' : 'rgba(255,255,255,0.2)',
            }}
            style={{ height: 6 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
    </div>
  );
}
