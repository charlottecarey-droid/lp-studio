import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Scene1Hook from '../scenes/Scene1Hook';
import Scene2Reveal from '../scenes/Scene2Reveal';
import Scene3DrillDown from '../scenes/Scene3DrillDown';
import Scene4Quality from '../scenes/Scene4Quality';
import Scene5Payoff from '../scenes/Scene5Payoff';
import Scene6CTA from '../scenes/Scene6CTA';

const SCENES = [
  { id: 1, duration: 4000,  Component: Scene1Hook },
  { id: 2, duration: 6000,  Component: Scene2Reveal },
  { id: 3, duration: 7500,  Component: Scene3DrillDown },
  { id: 4, duration: 6000,  Component: Scene4Quality },
  { id: 5, duration: 5000,  Component: Scene5Payoff },
  { id: 6, duration: 4000,  Component: Scene6CTA },
];

export default function VideoTemplate() {
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScene((prev) => (prev + 1) % SCENES.length);
    }, SCENES[currentScene].duration);
    return () => clearTimeout(timer);
  }, [currentScene]);

  const CurrentSceneComponent = SCENES[currentScene].Component;

  return (
    <div
      className="relative w-full h-full overflow-hidden flex items-center justify-center"
      style={{ background: '#003A30', fontFamily: "'Bagoss Standard', Arial, Helvetica, sans-serif" }}
    >
      {/* Subtle noise grain */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay">
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
    </div>
  );
}
