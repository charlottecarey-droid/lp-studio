import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import './_storyteller.css';

const SENTENCES = [
  "Crafting a homepage that helps busy parents in Austin trust Northwind Dental...",
  "Choosing a calm, clean layout that fits a modern family dentistry...",
  "Writing copy that makes booking online feel effortless...",
  "Selecting teal and blue accents to build a trustworthy brand vibe...",
  "Structuring sections to highlight you as a trusted local dentist...",
  "Applying premium typography for a refined, professional look...",
  "Adding the final polish to your new online home..."
];

const STAGES = [
  "Understanding your brief",
  "Choosing a layout",
  "Writing your copy",
  "Designing sections",
  "Final polish"
];

const CYCLE_TIME_MS = 24000;
const SENTENCE_INTERVAL_MS = 3500;
const STAGE_INTERVAL_MS = CYCLE_TIME_MS / STAGES.length;

export function Storyteller() {
  const [progress, setProgress] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [completedStages, setCompletedStages] = useState<number>(0);

  useEffect(() => {
    let startTime = Date.now();
    let frameId: number;

    const update = () => {
      const elapsed = (Date.now() - startTime) % CYCLE_TIME_MS;
      setProgress((elapsed / CYCLE_TIME_MS) * 100);
      
      const currentStage = Math.floor(elapsed / STAGE_INTERVAL_MS);
      setCompletedStages(currentStage);

      frameId = requestAnimationFrame(update);
    };
    
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimatingOut(true);
      setTimeout(() => {
        setSentenceIndex(prev => (prev + 1) % SENTENCES.length);
        setIsAnimatingOut(false);
      }, 500);
    }, SENTENCE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="storyteller-bg min-h-screen flex flex-col items-center justify-center p-8 font-sans text-slate-900 overflow-hidden">
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center space-y-16">
        
        {/* Main Sentence */}
        <div className="h-32 flex items-center justify-center">
          <h1 
            className={`text-2xl md:text-3xl font-medium tracking-tight text-slate-800 leading-relaxed transition-all duration-500 ease-in-out ${
              isAnimatingOut ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'
            }`}
          >
            {SENTENCES[sentenceIndex]}
          </h1>
        </div>

        {/* Progress Section */}
        <div className="w-full max-w-md space-y-10">
          {/* Progress Bar */}
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-teal-500 transition-all ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stages */}
          <div className="flex flex-col space-y-5">
            {STAGES.map((stage, idx) => {
              const isCompleted = completedStages > idx;
              const isCurrent = completedStages === idx;
              
              return (
                <div 
                  key={stage} 
                  className={`flex items-center space-x-4 transition-all duration-500 ${
                    isCompleted ? 'text-slate-800' : isCurrent ? 'text-slate-800' : 'text-slate-300'
                  }`}
                >
                  <div className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors duration-500 ${
                    isCompleted 
                      ? 'border-teal-500 bg-teal-500 text-white' 
                      : isCurrent 
                        ? 'border-teal-500 text-teal-500' 
                        : 'border-slate-200'
                  }`}>
                    {isCompleted ? <Check className="w-3 h-3" strokeWidth={3} /> : (
                      isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                    )}
                  </div>
                  <span className={`text-sm md:text-base ${isCurrent ? 'font-medium' : 'font-normal'}`}>
                    {stage}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
