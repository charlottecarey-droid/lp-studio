import React, { useRef, useEffect } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { ArrowRight, Terminal, Zap, Shield, ChevronRight } from 'lucide-react';
import './SpotlightGlow.css';

export function SpotlightGlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { left, top } = containerRef.current.getBoundingClientRect();
      containerRef.current.style.setProperty('--mouse-x', `${e.clientX - left}px`);
      containerRef.current.style.setProperty('--mouse-y', `${e.clientY - top}px`);
    };
    
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="spotlight-glow-hero flex flex-col"
    >
      <div className="grid-bg"></div>
      <div className="spotlight"></div>

      {/* Navigation */}
      <nav className="content-wrapper w-full px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-violet-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">NEXUS</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
          <a href="#" className="hover:text-white transition-colors">Platform</a>
          <a href="#" className="hover:text-white transition-colors">Solutions</a>
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
          <a href="#" className="hover:text-white transition-colors">Pricing</a>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="#" className="text-sm font-medium text-white/70 hover:text-white transition-colors hidden sm:block">Sign In</a>
          <button className="spotlight-glow-glass px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-2">
            Get Started
            <ChevronRight className="w-4 h-4 text-violet-400" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="content-wrapper flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-12 md:py-24 max-w-7xl mx-auto w-full">
        
        <div className="text-center max-w-3xl mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm font-medium mb-8"
          >
            <span className="flex h-2 w-2 rounded-full bg-violet-500"></span>
            Nexus Engine v2.0 is now live
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
          >
            Build with <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">absolute velocity</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-xl text-white/60 mb-10 max-w-2xl mx-auto"
          >
            The world's most powerful infrastructure for deploying scalable applications. 
            Zero configuration. Infinite performance.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button className="h-12 px-8 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(139,92,246,0.4)]">
              Start Building Free
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="h-12 px-8 rounded-full spotlight-glow-glass text-white font-medium hover:bg-white/5 transition-colors flex items-center gap-2">
              <Terminal className="w-4 h-4 text-white/60" />
              Read Documentation
            </button>
          </motion.div>
        </div>

        {/* Bento Grid Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
          className="w-full max-w-5xl"
        >
          <div className="spotlight-glow-bento-glow rounded-2xl p-1">
            <div className="spotlight-glow-glass rounded-xl overflow-hidden flex flex-col md:flex-row">
              
              {/* Sidebar */}
              <div className="w-full md:w-64 border-r border-white/5 p-6 flex flex-col gap-6">
                <div className="space-y-4">
                  <div className="h-2 w-16 bg-white/20 rounded"></div>
                  <div className="h-2 w-32 bg-white/10 rounded"></div>
                  <div className="h-2 w-24 bg-white/10 rounded"></div>
                </div>
                
                <div className="mt-8 space-y-3">
                  <div className="flex items-center gap-3 text-violet-400 font-mono text-sm">
                    <Zap className="w-4 h-4" />
                    <span>Real-time Sync</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/40 font-mono text-sm">
                    <Shield className="w-4 h-4" />
                    <span>Enterprise Sec</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/40 font-mono text-sm">
                    <Terminal className="w-4 h-4" />
                    <span>Edge Compute</span>
                  </div>
                </div>
              </div>

              {/* Main Preview Area */}
              <div className="flex-1 p-1">
                <div className="w-full h-[400px] bg-[#0A0A0C] rounded-lg border border-white/5 overflow-hidden relative group">
                  <img 
                    src="/__mockup/images/hero-spotlight-glow-dashboard.png" 
                    alt="Dashboard Preview" 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-transparent to-transparent"></div>
                  
                  {/* Overlay code snippet */}
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="spotlight-glow-glass p-4 rounded-lg border border-white/10 font-mono text-xs sm:text-sm text-white/80 overflow-hidden relative">
                      <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                        <span className="text-white/40 ml-2">nexus.config.ts</span>
                      </div>
                      <p><span className="text-pink-400">export</span> <span className="text-blue-400">default</span> <span className="text-yellow-200">defineConfig</span>({`{`}</p>
                      <p className="ml-4">edge: <span className="text-orange-300">true</span>,</p>
                      <p className="ml-4">scaling: <span className="text-green-300">'auto'</span>,</p>
                      <p className="ml-4">regions: [<span className="text-green-300">'global'</span>],</p>
                      <p>{`}`});</p>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </motion.div>
        
      </main>
    </div>
  );
}
