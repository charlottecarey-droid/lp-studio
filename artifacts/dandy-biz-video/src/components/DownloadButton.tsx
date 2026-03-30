import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TOTAL_MS = 40500;

type State = 'idle' | 'rendering' | 'done' | 'error';

export default function DownloadButton() {
  const [state, setState] = useState<State>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleDownload() {
    setState('rendering');
    setElapsed(0);
    setErrorMsg('');

    const totalExpected = TOTAL_MS + 4000;
    const start = Date.now();
    const ticker = setInterval(() => {
      setElapsed(Math.min(Date.now() - start, totalExpected));
    }, 500);

    try {
      const res = await fetch('/api/video/render?video=biz', {
        signal: AbortSignal.timeout(180_000),
      });

      clearInterval(ticker);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `Server error ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dandy-insights-business.mp4';
      a.click();
      URL.revokeObjectURL(url);

      setState('done');
      setTimeout(() => setState('idle'), 5000);
    } catch (err: any) {
      clearInterval(ticker);
      setState('error');
      setErrorMsg(err?.message ?? 'Render failed — try again');
      setTimeout(() => setState('idle'), 6000);
    }
  }

  const progress = Math.min(elapsed / (TOTAL_MS + 4000), 0.95);
  const secondsLeft = Math.max(0, Math.round((TOTAL_MS + 4000 - elapsed) / 1000));

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {state === 'error' && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-600 text-white text-xs rounded-lg px-3 py-2 max-w-[240px] text-right pointer-events-auto"
          >
            {errorMsg}
          </motion.div>
        )}
        {state === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-[#C7E738] text-[#003A30] text-xs font-semibold rounded-lg px-3 py-2 pointer-events-auto"
          >
            Download started!
          </motion.div>
        )}
        {state === 'rendering' && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-[#003A30]/90 backdrop-blur text-[#C7E738] text-xs rounded-lg px-3 py-2 pointer-events-auto text-right"
          >
            <div className="mb-1.5 font-medium">Rendering video on server…</div>
            <div className="w-44 h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#C7E738] rounded-full"
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.5, ease: 'linear' }}
              />
            </div>
            <div className="mt-1 text-white/60">~{secondsLeft}s remaining</div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="pointer-events-auto flex items-center gap-2 rounded-full text-sm font-semibold shadow-2xl select-none"
        style={{
          background: state === 'rendering' ? '#1a2e1a' : '#C7E738',
          color: state === 'rendering' ? '#C7E738' : '#003A30',
          border: '2px solid rgba(199,231,56,0.35)',
          padding: '10px 20px',
          opacity: state === 'rendering' ? 0.75 : 1,
          cursor: state === 'rendering' ? 'not-allowed' : 'pointer',
        }}
        onClick={state === 'idle' || state === 'error' ? handleDownload : undefined}
        whileHover={state === 'idle' ? { scale: 1.05 } : {}}
        whileTap={state === 'idle' ? { scale: 0.97 } : {}}
      >
        {state === 'idle' && (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 10.5L3 6h3V1h3v5h3L7.5 10.5z" fill="currentColor" />
              <path d="M1 12h13v2H1v-2z" fill="currentColor" />
            </svg>
            Download Video
          </>
        )}
        {state === 'rendering' && (
          <>
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="16 18" strokeLinecap="round" />
            </svg>
            Rendering…
          </>
        )}
        {state === 'done' && '✓ Done'}
        {state === 'error' && 'Try again'}
      </motion.button>
    </div>
  );
}
