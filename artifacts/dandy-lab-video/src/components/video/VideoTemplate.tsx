import { AnimatePresence, motion } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import Scene1 from './scenes/Scene1';
import Scene2 from './scenes/Scene2';
import Scene3 from './scenes/Scene3';
import Scene4 from './scenes/Scene4';
import Scene5 from './scenes/Scene5';
import Scene6 from './scenes/Scene6';

const SCENE_DURATIONS = {
  scene1: 4500, // Intro
  scene2: 5000, // Products
  scene3: 4500, // Speed stat
  scene4: 4500, // Live Support
  scene5: 5000, // Why Dandy
  scene6: 5000, // CTA
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
    loop: true,
  });

  return (
    <div
      className="w-full h-screen overflow-hidden relative font-sans"
      style={{ backgroundColor: 'var(--color-bg-light)' }}
    >
      <AnimatePresence mode="wait">
        {currentScene === 0 && <Scene1 key="scene1" />}
        {currentScene === 1 && <Scene2 key="scene2" />}
        {currentScene === 2 && <Scene3 key="scene3" />}
        {currentScene === 3 && <Scene4 key="scene4" />}
        {currentScene === 4 && <Scene5 key="scene5" />}
        {currentScene === 5 && <Scene6 key="scene6" />}
      </AnimatePresence>
    </div>
  );
}