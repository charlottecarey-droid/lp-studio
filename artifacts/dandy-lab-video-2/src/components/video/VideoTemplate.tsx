import { AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import Scene1 from './scenes/Scene1';
import Scene2 from './scenes/Scene2';
import Scene3 from './scenes/Scene3';
import Scene4 from './scenes/Scene4';
import Scene5 from './scenes/Scene5';
import Scene6 from './scenes/Scene6';
import Scene7 from './scenes/Scene7';
import Scene8 from './scenes/Scene8';
import Scene9 from './scenes/Scene9';
import Scene10 from './scenes/Scene10';

const SCENE_DURATIONS = {
  scene1:  4500,  // Intro
  scene2:  5000,  // Products grid
  scene3:  4500,  // 89% stat
  scene4:  5500,  // Live support (phone)
  scene5:  5000,  // Guided scanning
  scene6:  5000,  // AI scan review
  scene7:  5000,  // Order anything
  scene8:  5000,  // Review designs live
  scene9:  5000,  // Why Dandy
  scene10: 5000,  // CTA
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
        {currentScene === 0 && <Scene1  key="scene1"  />}
        {currentScene === 1 && <Scene2  key="scene2"  />}
        {currentScene === 2 && <Scene3  key="scene3"  />}
        {currentScene === 3 && <Scene4  key="scene4"  />}
        {currentScene === 4 && <Scene7  key="scene7"  />}
        {currentScene === 5 && <Scene10 key="scene10" />}
        {currentScene === 6 && <Scene8  key="scene8"  />}
        {currentScene === 7 && <Scene9  key="scene9"  />}
        {currentScene === 8 && <Scene5  key="scene5"  />}
        {currentScene === 9 && <Scene6  key="scene6"  />}
      </AnimatePresence>
    </div>
  );
}
