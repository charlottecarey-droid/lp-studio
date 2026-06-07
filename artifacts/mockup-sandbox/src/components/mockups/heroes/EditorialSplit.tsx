import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Menu } from "lucide-react";

export function EditorialSplit() {
  return (
    <div className="relative min-h-[900px] h-[100dvh] w-full bg-[#fdfbf9] text-[#1a1a1a] flex flex-col font-sans overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500&display=swap');
        
        .font-serif-display {
          font-family: 'Playfair Display', serif;
        }
        .font-sans-body {
          font-family: 'Inter', sans-serif;
        }
      `}} />

      {/* Top Nav */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-6 mix-blend-difference text-[#fdfbf9]">
        <div className="text-xl tracking-widest font-serif-display uppercase font-medium">Aura.</div>
        
        <div className="hidden md:flex items-center gap-8 text-sm tracking-wide font-sans-body">
          <a href="#" className="hover:opacity-70 transition-opacity">Collection</a>
          <a href="#" className="hover:opacity-70 transition-opacity">Journal</a>
          <a href="#" className="hover:opacity-70 transition-opacity">About</a>
        </div>

        <div className="flex items-center gap-6">
          <button className="hidden md:block text-sm uppercase tracking-wider font-sans-body border-b border-transparent hover:border-current transition-colors pb-0.5">
            Cart (0)
          </button>
          <button className="md:hidden">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        {/* Left: Content */}
        <div className="relative z-10 flex flex-col justify-center px-8 lg:px-20 py-24 bg-[#fdfbf9]">
          <div className="max-w-xl mx-auto lg:mx-0 w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            >
              <span className="block text-xs uppercase tracking-[0.2em] mb-8 text-gray-500 font-sans-body">
                The New Standard
              </span>
            </motion.div>

            <motion.h1 
              className="text-6xl lg:text-7xl xl:text-[88px] leading-[1.05] font-serif-display font-medium mb-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            >
              Quiet <br />
              <span className="italic text-gray-400">Intention.</span>
            </motion.h1>

            <motion.p 
              className="text-lg text-gray-600 font-sans-body leading-relaxed max-w-md mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
            >
              We believe in the power of restraint. Designing objects that speak softly but resonate deeply in the spaces they inhabit.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.7 }}
              className="flex items-center gap-6"
            >
              <button className="group flex items-center gap-4 text-sm uppercase tracking-widest font-sans-body font-medium pb-2 border-b border-black">
                Explore the collection
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>
        </div>

        {/* Right: Image */}
        <div className="relative w-full h-[50vh] lg:h-full bg-stone-200 overflow-hidden">
          <motion.div
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full"
          >
            <img 
              src="/__mockup/images/hero-editorial-split-abstract.png" 
              alt="Minimalist abstract architecture" 
              className="w-full h-full object-cover"
            />
          </motion.div>
          
          {/* Subtle overlay gradient to ensure image blends well */}
          <div className="absolute inset-0 bg-black/5 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
