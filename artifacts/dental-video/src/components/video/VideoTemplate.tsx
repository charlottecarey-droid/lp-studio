import { AnimatePresence, motion } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene0 } from './scenes/Scene0';
import { Scene1 } from './scenes/Scene1';
import { Scene2 } from './scenes/Scene2';
import { Scene3 } from './scenes/Scene3';

const SCENE_DURATIONS = {
  scene0: 5000,
  scene1: 5000,
  scene2: 5000,
  scene3: 6000,
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{ backgroundColor: 'var(--color-bg-light)' }}
    >
      {/* Background persistent layers outside AnimatePresence */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-bg-light to-bg-muted"
        animate={{
          background: currentScene === 3 
            ? 'linear-gradient(to bottom right, #F8FAFC, #E0F2FE)' 
            : 'linear-gradient(to bottom right, #FFFFFF, #F1F5F9)'
        }}
        transition={{ duration: 2 }}
      />
      
      {/* Moving geometric accents */}
      <motion.div
        className="absolute rounded-full opacity-20 pointer-events-none"
        style={{ background: 'var(--color-primary)', filter: 'blur(80px)' }}
        animate={{
          width: currentScene === 2 ? '60vw' : '40vw',
          height: currentScene === 2 ? '60vw' : '40vw',
          top: currentScene === 3 ? '-10vw' : '-20vw',
          right: currentScene === 1 ? '10vw' : '-10vw',
        }}
        transition={{ duration: 3, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute rounded-full opacity-10 pointer-events-none"
        style={{ background: 'var(--color-accent)', filter: 'blur(60px)' }}
        animate={{
          width: '30vw',
          height: '30vw',
          bottom: currentScene === 3 ? '10vw' : '-10vw',
          left: currentScene === 2 ? '10vw' : '-10vw',
        }}
        transition={{ duration: 4, ease: 'easeInOut' }}
      />

      <AnimatePresence>
        {currentScene === 0 && <Scene0 key="scene0" />}
        {currentScene === 1 && <Scene1 key="scene1" />}
        {currentScene === 2 && <Scene2 key="scene2" />}
        {currentScene === 3 && <Scene3 key="scene3" />}
      </AnimatePresence>
    </div>
  );
}