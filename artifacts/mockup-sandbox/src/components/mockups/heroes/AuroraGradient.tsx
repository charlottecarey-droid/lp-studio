import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Activity, Shield, Zap, ChevronRight } from "lucide-react";
import "./AuroraGradient.css";

export function AuroraGradient() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 20 },
    },
  };

  const floatVariants = {
    initial: { y: 0 },
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="aurora-hero-wrapper min-h-[900px] h-[100dvh] flex flex-col font-sans selection:bg-purple-500/30">
      {/* Background Animation */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1"></div>
        <div className="aurora-blob aurora-blob-2"></div>
        <div className="aurora-blob aurora-blob-3"></div>
        <div className="aurora-blob aurora-blob-4"></div>
      </div>
      <div className="aurora-noise"></div>

      {/* Navigation */}
      <nav className="relative z-10 w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <Zap className="w-5 h-5 text-black" fill="currentColor" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Lumina</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
          <a href="#" className="hover:text-white transition-colors">Platform</a>
          <a href="#" className="hover:text-white transition-colors">Solutions</a>
          <a href="#" className="hover:text-white transition-colors">Resources</a>
          <a href="#" className="hover:text-white transition-colors">Pricing</a>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium">
          <a href="#" className="hidden sm:block text-white/70 hover:text-white transition-colors">Sign in</a>
          <button className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10 transition-all flex items-center gap-2">
            Get Started
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-10 pb-24 text-center">
        <motion.div 
          className="max-w-4xl mx-auto w-full flex flex-col items-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-sm text-purple-200">
              <Sparkles className="w-4 h-4" />
              <span>Introducing Lumina AI Generation</span>
              <div className="w-px h-4 bg-white/20 mx-1"></div>
              <a href="#" className="text-white hover:underline flex items-center gap-1">
                Read announcement <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            variants={itemVariants} 
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-8 leading-[1.1]"
          >
            Create at the speed of <br className="hidden md:block" />
            <span className="aurora-text-gradient">pure thought.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p 
            variants={itemVariants} 
            className="text-lg md:text-xl text-white/60 max-w-2xl mb-12 leading-relaxed"
          >
            Lumina is the world's first cognition engine. We map your intent to execution instantly, turning fragmented ideas into flawless digital experiences.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-4 mb-20 w-full sm:w-auto">
            <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-black font-semibold text-base hover:scale-105 transition-transform flex items-center justify-center gap-2">
              Start building free
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/5 text-white font-semibold text-base backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
              Book a demo
            </button>
          </motion.div>

          {/* Floating UI Chips */}
          <motion.div 
            className="relative w-full max-w-5xl h-40"
            variants={containerVariants}
          >
            {/* Chip 1 */}
            <motion.div 
              className="absolute left-0 sm:left-[10%] top-0 aurora-glass-panel rounded-2xl p-4 flex items-center gap-4 w-64"
              variants={floatVariants}
              initial="initial"
              animate="animate"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-300" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">Real-time sync</div>
                <div className="text-xs text-white/50">99.9% uptime SLA</div>
              </div>
            </motion.div>

            {/* Chip 2 */}
            <motion.div 
              className="absolute right-0 sm:right-[10%] top-8 aurora-glass-panel rounded-2xl p-4 flex items-center gap-4 w-64"
              variants={floatVariants}
              initial="initial"
              animate="animate"
              style={{ animationDelay: "-2s" }}
            >
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-300" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">Enterprise security</div>
                <div className="text-xs text-white/50">SOC2 Type II certified</div>
              </div>
            </motion.div>
          </motion.div>

        </motion.div>
      </main>
    </div>
  );
}
