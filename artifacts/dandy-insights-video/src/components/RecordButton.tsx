import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DURATION_MS = 30000;

type State = 'idle' | 'countdown' | 'recording' | 'done' | 'error';

export default function RecordButton({ onRecordStart }: { onRecordStart?: () => void }) {
  const [state, setState] = useState<State>('idle');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanup() {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  async function startRecording() {
    setErrorMsg('');
    setState('countdown');
    setCountdown(3);

    let c = 3;
    const tick = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(tick);
        beginCapture();
      }
    }, 1000);
  }

  async function beginCapture() {
    chunksRef.current = [];
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 30, width: 1920, height: 1080 },
        audio: false,
        preferCurrentTab: true,
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        cleanup();
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dandy-insights-30s.webm';
        a.click();
        URL.revokeObjectURL(url);
        setState('done');
        setTimeout(() => setState('idle'), 4000);
      };

      recorder.start(100);
      setState('recording');
      setElapsed(0);
      onRecordStart?.();

      let ms = 0;
      intervalRef.current = setInterval(() => {
        ms += 200;
        setElapsed(ms);
        if (ms >= DURATION_MS) {
          recorder.stop();
          cleanup();
        }
      }, 200);

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
          cleanup();
        }
      });
    } catch (err: any) {
      cleanup();
      setState('error');
      setErrorMsg(err?.message || 'Screen share cancelled or not supported.');
      setTimeout(() => setState('idle'), 4000);
    }
  }

  const progress = Math.min(elapsed / DURATION_MS, 1);
  const remaining = Math.max(0, Math.round((DURATION_MS - elapsed) / 1000));
  const circumference = 2 * Math.PI * 22;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {state === 'error' && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-600 text-white text-xs rounded-lg px-3 py-2 max-w-[220px] text-right pointer-events-auto"
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
            className="bg-[#C7E738] text-[#1B2E1B] text-xs font-semibold rounded-lg px-3 py-2 pointer-events-auto"
          >
            Download started!
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="pointer-events-auto flex items-center gap-2 rounded-full text-sm font-semibold shadow-2xl select-none"
        style={{
          background: state === 'recording' ? '#1B2E1B' : '#C7E738',
          color: state === 'recording' ? '#C7E738' : '#1B2E1B',
          border: '2px solid rgba(199,231,56,0.4)',
          padding: state === 'recording' ? '8px 14px 8px 10px' : '10px 20px',
        }}
        onClick={state === 'idle' ? startRecording : undefined}
        whileHover={state === 'idle' ? { scale: 1.05 } : {}}
        whileTap={state === 'idle' ? { scale: 0.97 } : {}}
        animate={{ opacity: 1 }}
      >
        {state === 'idle' && (
          <>
            <span className="w-3 h-3 rounded-full bg-[#1B2E1B] inline-block" />
            Record & Download
          </>
        )}
        {state === 'countdown' && (
          <span className="w-8 text-center text-base font-bold">
            {countdown > 0 ? countdown : '▶'}
          </span>
        )}
        {state === 'recording' && (
          <>
            <svg width="52" height="52" className="-ml-1 -my-1">
              <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(199,231,56,0.2)" strokeWidth="3" />
              <circle
                cx="26" cy="26" r="22"
                fill="none"
                stroke="#C7E738"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                transform="rotate(-90 26 26)"
                style={{ transition: 'stroke-dashoffset 0.2s linear' }}
              />
              <circle cx="26" cy="26" r="6" fill="#ef4444" />
            </svg>
            <span>{remaining}s</span>
          </>
        )}
        {state === 'done' && <span>✓</span>}
        {state === 'error' && <span>Try again</span>}
      </motion.button>
    </div>
  );
}
