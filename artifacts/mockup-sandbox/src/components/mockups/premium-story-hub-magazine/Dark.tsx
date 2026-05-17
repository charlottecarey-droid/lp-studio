import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const STORIES = [
  {
    id: 1,
    practice: "Greenfield Family Dental",
    location: "Austin, TX",
    headline: "How a 3-op practice scaled to 18 ops without a remake.",
    tag: "Implants",
    image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80&w=800",
    size: "1x1",
  },
  {
    id: 2,
    practice: "Cedar Mountain Orthodontics",
    location: "Boulder, CO",
    headline: "Same-day clear aligner setups, 40% lower lab spend.",
    tag: "Clear Aligners",
    image: "https://images.unsplash.com/photo-1598256989800-fea5ce5146f2?auto=format&fit=crop&q=80&w=800",
    size: "1x1",
  },
  {
    id: 3,
    practice: "Bayview Endodontic Studio",
    location: "San Diego, CA",
    headline: "Endo specialists ditched analog impressions in one month.",
    tag: "Endodontics",
    image: "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&q=80&w=1200",
    size: "2x1",
  },
  {
    id: 4,
    practice: "Hilltop Pediatric Dental",
    location: "Atlanta, GA",
    headline: "Kid-friendly scans replaced gag-inducing trays.",
    tag: "Pediatric",
    image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800",
    size: "1x1",
  },
  {
    id: 5,
    practice: "Riverstone Cosmetic Lab",
    location: "Charleston, SC",
    headline: "Veneer turnaround dropped from 3 weeks to 5 days.",
    tag: "Cosmetic",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=800",
    size: "1x1",
  },
  {
    id: 6,
    practice: "Anchor Dental Group",
    location: "Seattle, WA",
    headline: "13 locations on one digital workflow, finally.",
    tag: "Crown & Bridge",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=1200",
    size: "2x1",
  },
];

const FILTERS = ['All', 'Implants', 'Crown & Bridge', 'Clear Aligners', 'Endodontics', 'Cosmetic', 'Pediatric'];

function StoryHub({ mode }: { mode: 'light' | 'dark' }) {
  const isLight = mode === 'light';
  
  const palette = {
    bg: isLight ? '#F4F4F2' : '#0A0A0A',
    text: isLight ? '#0A0A0A' : '#F4F4F2',
    textMuted: isLight ? '#0A0A0A99' : '#F4F4F299',
    accent: isLight ? '#FF5A1F' : '#FF7A3D',
    secondary: isLight ? '#1F3A5F' : '#7AA7D9',
    chipBg: isLight ? '#0A0A0A10' : '#F4F4F215',
    chipBgActive: isLight ? '#0A0A0A' : '#F4F4F2',
    chipTextActive: isLight ? '#F4F4F2' : '#0A0A0A',
  };

  return (
    <div 
      className="min-h-screen w-full selection:bg-[#FF7A3D] selection:text-[#0A0A0A]"
      style={{ backgroundColor: palette.bg, color: palette.text, fontFamily: '"Inter", sans-serif' }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .font-display { font-family: "Plus Jakarta Sans", sans-serif; letter-spacing: -0.03em; }
        .grid-magazine {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 2rem;
        }
        .col-span-full { grid-column: span 12 / span 12; }
        @media (min-width: 768px) {
          .col-span-6 { grid-column: span 6 / span 6; }
          .col-span-4 { grid-column: span 4 / span 4; }
          .col-span-8 { grid-column: span 8 / span 8; }
        }
      `}} />

      <main className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-24">
        {/* Header */}
        <header className="mb-24">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] font-bold tracking-[0.2em] uppercase mb-8"
            style={{ color: palette.textMuted }}
          >
            Dandy Labs &middot; Customer Stories
          </motion.div>
          <div className="grid-magazine items-end">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="col-span-full md:col-span-8 font-display text-6xl md:text-8xl lg:text-[110px] leading-[0.9] uppercase font-extrabold"
            >
              Stories from <br/>the network.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="col-span-full md:col-span-4 text-lg md:text-xl leading-relaxed mt-8 md:mt-0 font-medium"
              style={{ color: palette.textMuted }}
            >
              How independent practices across North America rebuilt their workflows, their economics, and their patient experience with Dandy.
            </motion.p>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-16">
          {FILTERS.map((f, i) => (
            <motion.button
              key={f}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
              style={{
                backgroundColor: i === 0 ? palette.chipBgActive : palette.chipBg,
                color: i === 0 ? palette.chipTextActive : palette.text,
              }}
            >
              {f}
            </motion.button>
          ))}
        </div>

        {/* Featured Story */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="relative w-full aspect-[4/3] md:aspect-[21/9] mb-8 overflow-hidden group cursor-pointer"
        >
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500 z-10" />
          <img 
            src="https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=2000" 
            alt="Featured Practice" 
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-20" />
          <div className="absolute bottom-0 left-0 p-8 md:p-16 z-30 w-full md:w-3/4">
            <div className="bg-white text-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest inline-block mb-6">
              Crown & Bridge
            </div>
            <h2 className="font-display text-4xl md:text-6xl text-white leading-[1.1] mb-6">
              "Cut crown turnaround from 12 days to 4 with end-to-end digital."
            </h2>
            <div className="text-white/80 font-medium tracking-wide">
              Dr. Sarah Jenkins &mdash; North Light Dental, Portland OR
            </div>
          </div>
        </motion.div>

        {/* Grid */}
        <div className="grid-magazine">
          {STORIES.map((story, i) => {
            const isSpan2 = story.size === '2x1';
            return (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className={`col-span-full ${isSpan2 ? 'md:col-span-8' : 'md:col-span-4'} group cursor-pointer relative mb-12 md:mb-16`}
              >
                {/* Accent color block behind the first item in the grid */}
                {i === 0 && (
                  <div 
                    className="absolute -inset-4 md:-inset-8 z-0 hidden md:block" 
                    style={{ backgroundColor: palette.accent }}
                  />
                )}
                
                <div className="relative z-10 h-full flex flex-col">
                  <div className="aspect-[4/3] w-full overflow-hidden mb-6 relative">
                    <img 
                      src={story.image} 
                      alt={story.practice} 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-4 left-4 bg-white text-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                      {story.tag}
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between" style={{ color: i === 0 ? '#0A0A0A' : palette.text }}>
                    <div>
                      <div className="text-[11px] font-bold tracking-widest uppercase mb-4 opacity-60">
                        {story.practice} &middot; {story.location}
                      </div>
                      <h3 className="font-display text-2xl md:text-3xl leading-[1.1] mb-8 group-hover:underline underline-offset-4 decoration-2">
                        {story.headline}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider group-hover:gap-4 transition-all">
                      Read story <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Stats Strip */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="my-32 py-24 border-y"
          style={{ borderColor: palette.chipBg }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8">
            {[
              { val: "1,200+", label: "Practices" },
              { val: "94%", label: "Would recommend" },
              { val: "$2.1B", label: "Workflow savings" }
            ].map((stat, i) => (
              <div key={i} className="text-center relative">
                <div className="absolute inset-0 mx-auto w-32 h-32 rounded-full -z-10 blur-3xl opacity-30" style={{ backgroundColor: palette.secondary }} />
                <div className="font-display text-7xl md:text-8xl font-black mb-4 tracking-tighter" style={{ color: palette.secondary }}>
                  {stat.val}
                </div>
                <div className="text-sm font-bold uppercase tracking-widest" style={{ color: palette.textMuted }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA Footer */}
        <div className="text-center py-16 md:py-32">
          <h2 className="font-display text-5xl md:text-8xl font-black uppercase leading-[0.9] mb-12 tracking-tighter">
            Become the <br/>next story.
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button 
              className="px-10 py-5 text-sm font-bold uppercase tracking-widest transition-transform hover:scale-105 text-[#0A0A0A]"
              style={{ backgroundColor: palette.accent }}
            >
              Talk to our team
            </button>
            <button 
              className="px-10 py-5 text-sm font-bold uppercase tracking-widest transition-opacity hover:opacity-70 flex items-center gap-2"
            >
              Browse all stories <ArrowRight size={16} />
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}

export function Dark() {
  return <StoryHub mode="dark" />;
}

export default Dark;
