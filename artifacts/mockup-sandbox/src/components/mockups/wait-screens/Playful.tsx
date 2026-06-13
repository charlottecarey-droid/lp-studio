import React, { useState, useEffect } from 'react';
import './_playful.css';
import { Sparkles, CheckCircle2, CircleDashed } from 'lucide-react';

const MESSAGES = [
  "Giving Northwind Dental a homepage that actually wins over busy parents ✨",
  "Making 'book online' impossible to miss…",
  "Adding that trusted-local-dentist warmth…",
  "Tuning the color palette to match your calm, clean vibe 🎨",
  "Sprinkling in some Austin charm 🤠",
  "Almost ready to show you the magic…"
];

const STAGES = [
  { id: 1, label: "Drafting the blueprint 📝", duration: 4000 },
  { id: 2, label: "Writing friendly copy ✍️", duration: 6000 },
  { id: 3, label: "Picking the perfect colors 🎨", duration: 8000 },
  { id: 4, label: "Polishing the layout ✨", duration: 6000 }
];

const TOTAL_DURATION = 24000;

export function Playful() {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [activeStage, setActiveStage] = useState(1);
  const [isLooping, setIsLooping] = useState(false); // Used to trigger re-renders on loop

  useEffect(() => {
    let startTime = Date.now();
    let animationFrameId: number;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      
      if (elapsed >= TOTAL_DURATION) {
        // Loop it
        startTime = now;
        setProgress(0);
        setActiveStage(1);
        setMessageIndex(0);
        setIsLooping(prev => !prev);
      } else {
        const newProgress = Math.min((elapsed / TOTAL_DURATION) * 100, 100);
        setProgress(newProgress);
        
        // Calculate stage
        let accumulatedTime = 0;
        let currentStage = 1;
        for (const stage of STAGES) {
          accumulatedTime += stage.duration;
          if (elapsed <= accumulatedTime) {
            currentStage = stage.id;
            break;
          }
        }
        if (elapsed > accumulatedTime) currentStage = STAGES.length;
        setActiveStage(currentStage);

        // Calculate message (every 4 seconds)
        const msgIdx = Math.floor(elapsed / 4000) % MESSAGES.length;
        setMessageIndex(msgIdx);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-teal-200">
      {/* Playful background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-100/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 playful-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 playful-blob-2"></div>
      
      <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center">
        
        {/* Playful Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-teal-100 mb-6 playful-progress-dot">
            <Sparkles className="w-8 h-8 text-teal-500" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight mb-3">
            Building your page...
          </h1>
          
          <div className="h-8 relative w-full flex justify-center items-center">
            {MESSAGES.map((msg, idx) => (
              <p 
                key={idx + '-' + isLooping}
                className={`absolute w-full text-lg text-slate-500 font-medium transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  idx === messageIndex 
                    ? 'opacity-100 translate-y-0 scale-100' 
                    : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                }`}
              >
                {msg}
              </p>
            ))}
          </div>
        </div>

        {/* Playful Progress Bar */}
        <div className="w-full bg-white p-2 rounded-full shadow-sm border border-slate-100 mb-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-slate-100/50 rounded-full"></div>
          <div 
            className="h-4 bg-gradient-to-r from-teal-400 to-blue-400 rounded-full relative z-10 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, progress)}%` }}
          >
            <div className="absolute inset-0 bg-white/20 rounded-full w-full opacity-0 animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>

        {/* Stages Checklist */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
          {STAGES.map((stage) => {
            const isCompleted = activeStage > stage.id;
            const isActive = activeStage === stage.id;
            const isPending = activeStage < stage.id;

            return (
              <div 
                key={stage.id}
                className={`flex items-center gap-3 p-4 rounded-2xl transition-all duration-500 ${
                  isActive ? 'bg-white shadow-md border border-teal-100 scale-105 z-10' : 
                  isCompleted ? 'opacity-60' : 'opacity-40'
                }`}
              >
                <div className="flex-shrink-0 relative flex items-center justify-center">
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-teal-500" />
                  ) : isActive ? (
                    <>
                      <CircleDashed className="w-6 h-6 text-teal-400 animate-spin absolute" />
                      <div className="w-2.5 h-2.5 bg-teal-400 rounded-full playful-progress-dot"></div>
                    </>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-200" />
                  )}
                </div>
                <span className={`text-sm font-semibold transition-colors duration-300 ${
                  isActive ? 'text-teal-700' : 
                  isCompleted ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
