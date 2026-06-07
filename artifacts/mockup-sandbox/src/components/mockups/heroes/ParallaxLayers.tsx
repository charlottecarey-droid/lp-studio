import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ArrowRight, Menu } from 'lucide-react';
import './ParallaxLayers.css';

export function ParallaxLayers() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start']
  });

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    setMousePosition({
      x: (clientX / innerWidth - 0.5) * 2,
      y: (clientY / innerHeight - 0.5) * 2
    });
  };

  // Scroll transforms
  const yBg = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const yMid = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const yFront = useTransform(scrollYProgress, [0, 1], [0, -300]);
  const opacityFade = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Spring physics for mouse
  const springConfig = { stiffness: 50, damping: 20 };
  const mouseX = useSpring(mousePosition.x, springConfig);
  const mouseY = useSpring(mousePosition.y, springConfig);

  // Mouse transforms (distinct depths)
  const xBgMouse = useTransform(mouseX, [-1, 1], [-15, 15]);
  const yBgMouse = useTransform(mouseY, [-1, 1], [-15, 15]);
  
  const xMidMouse = useTransform(mouseX, [-1, 1], [-40, 40]);
  const yMidMouse = useTransform(mouseY, [-1, 1], [-40, 40]);

  const xFrontMouse = useTransform(mouseX, [-1, 1], [-90, 90]);
  const yFrontMouse = useTransform(mouseY, [-1, 1], [-90, 90]);

  return (
    <div 
      ref={containerRef}
      className="relative min-h-[120vh] bg-[#050505] text-white overflow-hidden parallax-container font-sans"
      onMouseMove={handleMouseMove}
    >
      {/* Background Layer: Deep Glows */}
      <motion.div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ y: yBg, x: xBgMouse, translateY: yBgMouse }}
      >
        <div className="absolute top-[20%] left-[20%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] right-[10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]" />
      </motion.div>

      {/* Midground Layer: Geometric Shapes */}
      <motion.div 
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ y: yMid, x: xMidMouse, translateY: yMidMouse }}
      >
        <img 
          src="/__mockup/images/hero-parallax-layers-shape1.png" 
          alt="Abstract Sphere" 
          className="absolute top-[15%] left-[10%] w-64 h-64 object-contain opacity-80"
        />
        <img 
          src="/__mockup/images/hero-parallax-layers-shape2.png" 
          alt="Abstract Torus" 
          className="absolute top-[60%] right-[5%] w-80 h-80 object-contain opacity-80"
        />
      </motion.div>

      {/* Foreground Layer: Content & Fast Shapes */}
      <div className="relative z-20 flex flex-col h-[100vh]">
        {/* Navigation */}
        <header className="glass-nav sticky top-0 w-full z-50 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold text-xl tracking-tighter">
              A
            </div>
            <span className="font-bold text-xl tracking-tight">AURA</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
            <a href="#" className="hover:text-white transition-colors">Products</a>
            <a href="#" className="hover:text-white transition-colors">Solutions</a>
            <a href="#" className="hover:text-white transition-colors">Resources</a>
            <a href="#" className="hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="hidden md:block text-sm font-medium text-white/70 hover:text-white transition-colors">
              Log in
            </button>
            <button className="bg-white text-black px-4 py-2 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
              Get Started
            </button>
            <button className="md:hidden text-white">
              <Menu size={24} />
            </button>
          </div>
        </header>

        {/* Hero Content */}
        <motion.main 
          className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto"
          style={{ opacity: opacityFade }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm mb-8"
          >
            <span className="flex h-2 w-2 rounded-full bg-indigo-500"></span>
            <span className="text-white/80">Introducing Aura 2.0</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 hero-gradient-text"
          >
            Design with depth.<br />Build with precision.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl md:text-2xl text-white/60 mb-10 max-w-2xl"
          >
            The completely reimagined platform for teams who refuse to compromise on craft. Experience true dimensional workflow.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <button className="w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-semibold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2">
              Start Building Free <ArrowRight size={20} />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white border border-white/10 rounded-full font-semibold text-lg hover:bg-white/10 transition-colors">
              Book a Demo
            </button>
          </motion.div>
        </motion.main>

        {/* Marquee Band */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="w-full pb-12"
        >
          <p className="text-center text-sm text-white/40 mb-6 uppercase tracking-widest font-semibold">Trusted by visionary teams</p>
          <div className="marquee-container">
            <div className="marquee-content">
              {[...Array(6)].map((_, i) => (
                <React.Fragment key={i}>
                  <span className="text-2xl font-bold text-white/30">LUMINA</span>
                  <span className="text-2xl font-bold text-white/30">NEXUS</span>
                  <span className="text-2xl font-bold text-white/30">ELEVATE</span>
                  <span className="text-2xl font-bold text-white/30">SYNTH</span>
                  <span className="text-2xl font-bold text-white/30">VERTEX</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Ultra Foreground Layer: Fast floating elements */}
      <motion.div 
        className="absolute inset-0 z-30 pointer-events-none"
        style={{ y: yFront, x: xFrontMouse, translateY: yFrontMouse }}
      >
        <img 
          src="/__mockup/images/hero-parallax-layers-shape3.png" 
          alt="Floating Crystal" 
          className="absolute top-[80%] left-[20%] w-48 h-48 object-contain opacity-90 blur-[1px]"
        />
        {/* Some CSS glowing orbs in front */}
        <div className="absolute top-[30%] right-[25%] w-4 h-4 bg-white rounded-full shadow-[0_0_30px_10px_rgba(255,255,255,0.5)]" />
        <div className="absolute top-[70%] left-[40%] w-3 h-3 bg-indigo-400 rounded-full shadow-[0_0_20px_5px_rgba(99,102,241,0.5)]" />
      </motion.div>
    </div>
  );
}
