import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Scene1Hook from '../scenes/Scene1Hook';
import Scene2Reveal from '../scenes/Scene2Reveal';
import Scene3DrillDown from '../scenes/Scene3DrillDown';
import Scene4Quality from '../scenes/Scene4Quality';
import Scene5Payoff from '../scenes/Scene5Payoff';
import Scene6CTA from '../scenes/Scene6CTA';
import { assets } from '../utils/assets';

const SCENES = [
  { id: 1, duration: 4000, Component: Scene1Hook },
  { id: 2, duration: 6000, Component: Scene2Reveal },
  { id: 3, duration: 7000, Component: Scene3DrillDown },
  { id: 4, duration: 6000, Component: Scene4Quality },
  { id: 5, duration: 5000, Component: Scene5Payoff },
  { id: 6, duration: 2000, Component: Scene6CTA },
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
    <div className="relative w-full h-full bg-[#1B2E1B] overflow-hidden flex items-center justify-center font-sans text-white">
      {/* Background Layer - persistent across scenes */}
      <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>
      </div>

      {/* Global floating gradients */}
      <motion.div 
        className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-10 bg-[#C7E738]"
        animate={{
          x: currentScene === 0 ? '-20vw' : currentScene === 2 ? '40vw' : currentScene === 5 ? '10vw' : '0vw',
          y: currentScene === 0 ? '-20vh' : currentScene === 3 ? '40vh' : currentScene === 5 ? '-10vh' : '10vh',
          scale: currentScene === 5 ? 2 : 1
        }}
        transition={{ duration: 4, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-20 bg-[#0D1F0D]"
        animate={{
          x: currentScene === 1 ? '30vw' : currentScene === 4 ? '-30vw' : '10vw',
          y: currentScene === 1 ? '30vh' : currentScene === 4 ? '-30vh' : '20vh',
        }}
        transition={{ duration: 5, ease: "easeInOut" }}
      />

      <AnimatePresence mode="wait">
        <CurrentSceneComponent key={currentScene} />
      </AnimatePresence>
    </div>
  );
}
