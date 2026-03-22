import { AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import Scene1 from './scenes/Scene1';
import Scene2 from './scenes/Scene2';
import Scene3 from './scenes/Scene3';
import Scene4 from './scenes/Scene4';
import Scene5 from './scenes/Scene5';
import Scene7 from './scenes/Scene7';
import Scene8 from './scenes/Scene8';
import Scene9 from './scenes/Scene9';
import Scene10 from './scenes/Scene10';

const SCENE_DURATIONS = {
  scene1:  4500,
  scene2:  5000,
  scene3:  4500,
  scene4:  5500,
  scene5:  5000,
  scene6:  5000,
  scene7:  5000,
  scene8:  5000,
  scene9:  5000,
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
    loop: true,
  });

  return (
    <div
      className="w-full h-screen overflow-hidden relative font-sans"
      style={{ backgroundColor: '#FFFFFF' }}
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
      </AnimatePresence>

      {/* Hero CTA button */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <button
          className="flex items-center gap-3 px-10 py-5 rounded-full text-xl font-bold uppercase tracking-widest transition-transform hover:scale-105 active:scale-95"
          style={{
            backgroundColor: '#C7E738',
            color: '#003A30',
            boxShadow: '0 8px 32px rgba(199,231,56,0.4)',
          }}
        >
          Get started
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
