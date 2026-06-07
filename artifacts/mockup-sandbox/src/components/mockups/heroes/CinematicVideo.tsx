import React from "react";
import { motion } from "framer-motion";
import { Play, ArrowDown, ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CinematicVideo() {
  return (
    <div className="relative min-h-[900px] h-[100dvh] w-full bg-black text-white overflow-hidden flex flex-col font-sans selection:bg-white/20">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Inter:wght@300;400;500&display=swap');
        
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
        
        .glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .glass-button {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }
        
        .glass-button:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.4);
          transform: translateY(-1px);
        }
        
        .text-glow {
          text-shadow: 0 0 40px rgba(255, 255, 255, 0.3);
        }
      `}} />

      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-80"
          src="/__mockup/images/hero-cinematic-video-bg.mp4"
        />
        {/* Scrims */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80 z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] z-10" />
      </div>

      {/* Top Nav */}
      <header className="relative z-20 w-full px-8 py-6 flex items-center justify-between">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2"
        >
          <div className="w-6 h-6 rounded-full border border-white/50 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
          <span className="font-cinzel text-xl tracking-widest font-semibold uppercase">AURA</span>
        </motion.div>

        <motion.nav 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="hidden md:flex items-center gap-10 font-inter text-sm tracking-wide text-white/70"
        >
          <a href="#" className="hover:text-white transition-colors">Vision</a>
          <a href="#" className="hover:text-white transition-colors">Experience</a>
          <a href="#" className="hover:text-white transition-colors">Curation</a>
          <a href="#" className="hover:text-white transition-colors">Journal</a>
        </motion.nav>

        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="flex items-center gap-4"
        >
          <button className="hidden md:block font-inter text-sm tracking-wide text-white/90 hover:text-white transition-colors uppercase px-4 py-2">
            Sign In
          </button>
          <button className="glass-button px-6 py-2.5 rounded-full font-inter text-sm tracking-wide uppercase">
            Request Access
          </button>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 text-center mt-[-5%]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="font-cinzel text-5xl md:text-7xl lg:text-8xl leading-[1.1] tracking-wide mb-6 text-glow">
            Redefine Your<br />
            <span className="italic font-light">Perspective</span>
          </h1>
        </motion.div>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.8 }}
          className="font-inter text-lg md:text-xl text-white/60 max-w-xl mx-auto leading-relaxed mb-12 font-light tracking-wide"
        >
          A masterclass in restraint and performance. The definitive platform for those who demand excellence without compromise.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 1 }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          <button className="glass-panel px-8 py-4 rounded-full font-inter text-sm tracking-widest uppercase hover:bg-white/10 transition-all flex items-center gap-3 group">
            Begin the Journey
            <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
          
          <button className="flex items-center gap-3 font-inter text-sm tracking-widest uppercase text-white/70 hover:text-white transition-colors group">
            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center group-hover:border-white/50 transition-colors">
              <Play className="w-3 h-3 ml-0.5" />
            </div>
            Watch Film
          </button>
        </motion.div>
      </main>

      {/* Scroll Cue */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="relative z-20 pb-8 flex flex-col items-center justify-center gap-4"
      >
        <div className="w-[1px] h-16 bg-gradient-to-b from-white/0 via-white/20 to-white/0" />
        <span className="font-inter text-xs tracking-[0.2em] text-white/40 uppercase">Discover</span>
      </motion.div>
    </div>
  );
}
