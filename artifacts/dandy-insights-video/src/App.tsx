import React, { useState, useCallback } from 'react';
import VideoTemplate from './components/VideoTemplate';
import DownloadButton from './components/DownloadButton';

function App() {
  const [resetKey, setResetKey] = useState(0);

  const handleRestart = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);

  return (
    <div className="w-full h-screen bg-[#1B2E1B] overflow-hidden">
      <VideoTemplate key={resetKey} />
      <DownloadButton />
      <button
        onClick={handleRestart}
        className="fixed bottom-6 left-6 z-[9999] text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        ↺ Restart
      </button>
    </div>
  );
}

export default App;
