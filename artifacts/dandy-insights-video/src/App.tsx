import React, { useState, useCallback } from 'react';
import VideoTemplate from './components/VideoTemplate';
import RecordButton from './components/RecordButton';

function App() {
  const [resetKey, setResetKey] = useState(0);

  const handleRecordStart = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);

  return (
    <div className="w-full h-screen bg-[#1B2E1B] overflow-hidden">
      <VideoTemplate key={resetKey} />
      <RecordButton onRecordStart={handleRecordStart} />
    </div>
  );
}

export default App;
