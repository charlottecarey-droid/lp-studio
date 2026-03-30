import React, { useState, useEffect, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Scene1Hook from '../scenes/Scene1Hook';
import SceneChairs from '../scenes/SceneChairs';
import Scene2Reveal from '../scenes/Scene2Reveal';
import Scene3DrillDown from '../scenes/Scene3DrillDown';
import Scene4Quality from '../scenes/Scene4Quality';
import Scene5Payoff from '../scenes/Scene5Payoff';
import Scene6CTA from '../scenes/Scene6CTA';

const SCENES = [
  { id: 1, duration: 4500,  Component: Scene1Hook },
  { id: 2, duration: 4000,  Component: SceneChairs },
  { id: 3, duration: 6500,  Component: Scene2Reveal },
  { id: 4, duration: 7500,  Component: Scene3DrillDown },
  { id: 5, duration: 6000,  Component: Scene4Quality },
  { id: 6, duration: 5000,  Component: Scene5Payoff },
  { id: 7, duration: 4500,  Component: Scene6CTA },
];

// Isolated progress bar — owns its own state so the scene never re-renders on tick
const SceneProgressBar = memo(function SceneProgressBar({
  sceneIndex,
  duration,
}: {
  sceneIndex: number;
  duration: number;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const interval = 50;
    let elapsed = 0;
    const tick = setInterval(() => {
      elapsed += interval;
      setProgress(Math.min(elapsed / duration, 1));
    }, interval);
    return () => clearInterval(tick);
  }, [sceneIndex, duration]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/8 z-50">
      <div
        className="h-full bg-[#C7E738]"
        style={{ width: `${progress * 100}%`, opacity: 0.7, transition: 'width 0.05s linear' }}
      />
    </div>
  );
});

// Isolated dots — reads sceneIndex only, no per-tick state
const SceneDots = memo(function SceneDots({ sceneIndex }: { sceneIndex: number }) {
  return (
    <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 z-50">
      {SCENES.map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{
            width: i === sceneIndex ? 20 : 6,
            backgroundColor: i === sceneIndex ? '#C7E738' : 'rgba(255,255,255,0.2)',
          }}
          style={{ height: 6 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
});

export default function VideoTemplate() {
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    const duration = SCENES[currentScene].duration;
    const timer = setTimeout(() => {
      setCurrentScene((prev) => (prev + 1) % SCENES.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [currentScene]);

  const { Component: CurrentSceneComponent, duration } = SCENES[currentScene];

  return (
    <div
      className="relative w-full h-full overflow-hidden flex items-center justify-center"
      style={{ background: '#001a14', fontFamily: "'Bagoss Standard', Arial, Helvetica, sans-serif" }}
    >
      {/* Subtle noise grain — static, never re-renders */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain-clinical">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-clinical)" />
        </svg>
      </div>

      <AnimatePresence mode="wait">
        <CurrentSceneComponent key={currentScene} />
      </AnimatePresence>

      {/* Progress bar lives in its own component — scene is NOT re-rendered on each tick */}
      <SceneProgressBar sceneIndex={currentScene} duration={duration} />
      <SceneDots sceneIndex={currentScene} />
    </div>
  );
}
