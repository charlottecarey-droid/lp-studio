import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CONTENT = {
  eyebrow: "DANDY LABS · CUSTOMER STORIES",
  hero: "Stories from the network.",
  subhead: "How independent practices across North America rebuilt their workflows, their economics, and their patient experience with Dandy.",
  featured: {
    title: "Cut crown turnaround from 12 days to 4 with end-to-end digital.",
    doctor: "Dr. Sarah Jenkins",
    practice: "North Light Dental",
    location: "Portland OR",
    tag: "Crown & Bridge",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=1200&h=600"
  },
  filters: ["All", "Implants", "Crown & Bridge", "Clear Aligners", "Endodontics", "Cosmetic", "Pediatric"],
  stories: [
    { practice: "Greenfield Family Dental", location: "Austin, TX", headline: "How a 3-op practice scaled to 18 ops without a remake.", tag: "Implants", image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80&w=800&h=1000" },
    { practice: "Cedar Mountain Orthodontics", location: "Boulder, CO", headline: "Same-day clear aligner setups, 40% lower lab spend.", tag: "Clear Aligners", image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800&h=1000" },
    { practice: "Bayview Endodontic Studio", location: "San Diego, CA", headline: "Endo specialists ditched analog impressions in one month.", tag: "Endodontics", image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800&h=1000" },
    { practice: "Hilltop Pediatric Dental", location: "Atlanta, GA", headline: "Kid-friendly scans replaced gag-inducing trays.", tag: "Pediatric", image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=800&h=1000" },
    { practice: "Riverstone Cosmetic Lab", location: "Charleston, SC", headline: "Veneer turnaround dropped from 3 weeks to 5 days.", tag: "Cosmetic", image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800&h=1000" },
    { practice: "Anchor Dental Group", location: "Seattle, WA", headline: "13 locations on one digital workflow, finally.", tag: "Crown & Bridge", image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=800&h=1000" }
  ],
  stats: [
    { number: "1,200+", label: "practices" },
    { number: "94%", label: "would recommend" },
    { number: "$2.1B", label: "in workflow savings" }
  ],
  footer: {
    title: "Become the next story.",
    primary: "Talk to our team",
    secondary: "Browse all stories →"
  }
};

function StoryHub({ mode }: { mode: 'light' | 'dark' }) {
  const [activeFilter, setActiveFilter] = useState("All");

  const tokens = mode === 'dark' ? {
    bg: '#0C0F12',
    text: '#EAE4D6',
    accent: '#B59A6E',
    divider: 'rgba(234, 228, 214, 0.08)',
    dividerHover: 'rgba(234, 228, 214, 0.2)',
    muted: 'rgba(234, 228, 214, 0.6)'
  } : {
    bg: '#F7F4ED',
    text: '#0C0F12',
    accent: '#8C6F3F',
    divider: 'rgba(12, 15, 18, 0.08)',
    dividerHover: 'rgba(12, 15, 18, 0.2)',
    muted: 'rgba(12, 15, 18, 0.6)'
  };

  return (
    <div 
      className="min-h-screen selection:bg-opacity-20 selection:bg-current"
      style={{
        backgroundColor: tokens.bg,
        color: tokens.text,
        fontFamily: '"Inter", sans-serif'
      }}
    >
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap" />
      <style dangerouslySetInnerHTML={{__html: `
        .font-serif { font-family: 'Cormorant Garamond', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
      `}} />

      {/* Nav Spacer */}
      <div className="h-24" />

      {/* Hero */}
      <section className="px-6 md:px-12 max-w-7xl mx-auto mb-20 text-center flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="text-xs tracking-[0.2em] uppercase font-semibold mb-8"
          style={{ color: tokens.muted }}
        >
          {CONTENT.eyebrow}
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl font-serif mb-6 tracking-tight"
        >
          Stories from <span className="italic" style={{ color: tokens.accent }}>the network.</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg md:text-xl max-w-2xl font-light leading-relaxed"
          style={{ color: tokens.muted }}
        >
          {CONTENT.subhead}
        </motion.p>
      </section>

      {/* Featured Story */}
      <section className="px-6 md:px-12 max-w-7xl mx-auto mb-24">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.3 }}
          className="relative h-[600px] w-full rounded-sm overflow-hidden flex items-end cursor-pointer group"
          style={{ backgroundColor: tokens.divider }}
        >
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
            style={{ backgroundImage: `url(${CONTENT.featured.image})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          
          <div className="relative z-10 p-8 md:p-16 max-w-3xl text-white">
            <div className="text-xs tracking-widest uppercase mb-4 opacity-80 border border-white/20 inline-block px-3 py-1 rounded-full backdrop-blur-md">
              {CONTENT.featured.tag}
            </div>
            <h2 className="text-3xl md:text-5xl font-serif leading-tight mb-6 group-hover:text-[#B59A6E] transition-colors duration-300">
              {CONTENT.featured.title}
            </h2>
            <div className="flex items-center gap-4 text-sm opacity-80 uppercase tracking-widest">
              <span>{CONTENT.featured.doctor}</span>
              <span className="w-1 h-1 rounded-full bg-white/50" />
              <span>{CONTENT.featured.practice}</span>
              <span className="w-1 h-1 rounded-full bg-white/50" />
              <span>{CONTENT.featured.location}</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Filters */}
      <div className="px-6 md:px-12 max-w-7xl mx-auto mb-16 flex flex-wrap items-center gap-3">
        {CONTENT.filters.map(filter => {
          const isActive = filter === activeFilter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className="px-5 py-2 text-sm transition-all duration-300 rounded-full border"
              style={{
                borderColor: isActive ? tokens.accent : tokens.divider,
                backgroundColor: isActive ? tokens.accent : 'transparent',
                color: isActive ? (mode === 'dark' ? '#0C0F12' : '#F7F4ED') : tokens.text,
              }}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-x-12 gap-y-16">
        {CONTENT.stories.map((story, i) => (
          <motion.a 
            key={i}
            href="#"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="group flex flex-col h-full"
          >
            <div className="relative aspect-[3/4] mb-6 overflow-hidden rounded-sm" style={{ backgroundColor: tokens.divider }}>
              <img 
                src={story.image} 
                alt={story.practice}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale group-hover:grayscale-0"
              />
            </div>
            <div className="h-[1px] w-full mb-6 transition-colors duration-500" style={{ backgroundColor: tokens.divider }} />
            
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4 text-[11px] uppercase tracking-widest" style={{ color: tokens.muted }}>
                <span>{story.practice}</span>
                <span>{story.location}</span>
              </div>
              <h3 className="font-serif text-2xl md:text-3xl leading-snug mb-6 transition-all duration-300 relative inline-block">
                {story.headline}
                <span 
                  className="absolute -bottom-1 left-0 w-0 h-[1px] transition-all duration-500 group-hover:w-full"
                  style={{ backgroundColor: tokens.accent }}
                />
              </h3>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest px-3 py-1 rounded-full border transition-colors duration-300" style={{ borderColor: tokens.divider, color: tokens.muted }}>
                  {story.tag}
                </span>
                <span className="text-sm font-serif italic flex items-center gap-2 group-hover:gap-3 transition-all duration-300" style={{ color: tokens.accent }}>
                  Read story <span className="text-lg">→</span>
                </span>
              </div>
            </div>
          </motion.a>
        ))}
      </section>

      {/* Stats */}
      <section className="border-y" style={{ borderColor: tokens.divider }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 flex flex-col md:flex-row justify-between items-center gap-16 md:gap-8 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: tokens.divider }}>
          {CONTENT.stats.map((stat, i) => (
            <div key={i} className="flex-1 flex flex-col items-center text-center pt-8 md:pt-0 first:pt-0">
              <div className="font-serif text-5xl md:text-7xl mb-4 italic" style={{ color: tokens.accent }}>{stat.number}</div>
              <div className="text-xs uppercase tracking-[0.2em]" style={{ color: tokens.muted }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 text-center px-6">
        <h2 className="font-serif text-5xl md:text-6xl mb-12 tracking-tight">{CONTENT.footer.title}</h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <button 
            className="px-8 py-4 text-sm uppercase tracking-widest transition-transform hover:scale-105 rounded-sm"
            style={{ backgroundColor: tokens.accent, color: mode === 'dark' ? '#0C0F12' : '#F7F4ED' }}
          >
            {CONTENT.footer.primary}
          </button>
          <button 
            className="px-8 py-4 text-sm uppercase tracking-widest font-serif italic transition-colors"
            style={{ color: tokens.muted }}
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.text}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.muted}
          >
            {CONTENT.footer.secondary}
          </button>
        </div>
      </section>
    </div>
  );
}

export function Light() {
  return <StoryHub mode="light" />;
}

export default Light;
