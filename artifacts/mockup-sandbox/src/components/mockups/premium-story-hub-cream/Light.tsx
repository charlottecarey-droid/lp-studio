import React from 'react';
import { motion } from 'framer-motion';

const stories = [
  { id: '01', clinic: 'Greenfield Family Dental', location: 'Austin, TX', headline: 'How a 3-op practice scaled to 18 ops without a remake.', tag: 'Implants', img: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=400&q=80' },
  { id: '02', clinic: 'Cedar Mountain Orthodontics', location: 'Boulder, CO', headline: 'Same-day clear aligner setups, 40% lower lab spend.', tag: 'Clear Aligners', img: 'https://images.unsplash.com/photo-1598256989800-fea5f610262b?auto=format&fit=crop&w=400&q=80' },
  { id: '03', clinic: 'Bayview Endodontic Studio', location: 'San Diego, CA', headline: 'Endo specialists ditched analog impressions in one month.', tag: 'Endodontics', img: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=400&q=80' },
  { id: '04', clinic: 'Hilltop Pediatric Dental', location: 'Atlanta, GA', headline: 'Kid-friendly scans replaced gag-inducing trays.', tag: 'Pediatric', img: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=400&q=80' },
  { id: '05', clinic: 'Riverstone Cosmetic Lab', location: 'Charleston, SC', headline: 'Veneer turnaround dropped from 3 weeks to 5 days.', tag: 'Cosmetic', img: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=400&q=80' },
  { id: '06', clinic: 'Anchor Dental Group', location: 'Seattle, WA', headline: '13 locations on one digital workflow, finally.', tag: 'Crown & Bridge', img: 'https://images.unsplash.com/photo-1598256989800-fea5f610262b?auto=format&fit=crop&w=400&q=80' }
];

const filters = ['All', 'Implants', 'Crown & Bridge', 'Clear Aligners', 'Endodontics', 'Cosmetic', 'Pediatric'];

function StoryHub({ mode }: { mode: 'light' | 'dark' }) {
  const isLight = mode === 'light';
  const bg = isLight ? '#FAF7F0' : '#13110E';
  const text = isLight ? '#1A1A1A' : '#F2EDE0';
  const accent = isLight ? '#B91C1C' : '#E6A45C';
  const muted = isLight ? 'rgba(26, 26, 26, 0.1)' : 'rgba(242, 237, 224, 0.1)';
  const secondaryText = isLight ? 'rgba(26, 26, 26, 0.6)' : 'rgba(242, 237, 224, 0.6)';

  return (
    <div style={{ backgroundColor: bg, color: text, minHeight: '100vh', fontFamily: '"Inter", sans-serif' }} className="selection:bg-opacity-30 relative selection:bg-red-500 overflow-x-hidden">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        .font-serif { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
      `}} />

      <main className="max-w-[1280px] mx-auto px-6 md:px-12 lg:px-16 pt-24 pb-32">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-8 flex items-center gap-4" style={{ color: secondaryText }}>
            <span style={{ width: '40px', height: '1px', backgroundColor: muted }}></span>
            DANDY LABS · CUSTOMER STORIES
          </div>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl tracking-tight mb-8" style={{ color: text }}>
            Stories from <span className="italic" style={{ color: accent }}>the network.</span>
          </h1>
          <p className="text-lg md:text-2xl max-w-3xl leading-relaxed" style={{ color: secondaryText }}>
            How independent practices across North America rebuilt their workflows, their economics, and their patient experience with Dandy.
          </p>
        </motion.div>

        {/* Featured Story */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="mt-24 mb-16 border-t pt-12 flex flex-col lg:flex-row gap-12 lg:gap-24" style={{ borderColor: muted }}>
          <div className="lg:w-1/2">
            <div className="mb-6 text-[10px] uppercase tracking-[0.2em] font-semibold flex items-center gap-3" style={{ color: accent }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }}></span>
              Featured Story
            </div>
            <h2 className="font-serif text-3xl md:text-5xl leading-tight mb-6">
              Cut crown turnaround from 12 days to 4 with end-to-end digital.
            </h2>
            <div className="text-sm tracking-widest uppercase mb-8" style={{ color: secondaryText }}>
              Dr. Sarah Jenkins — North Light Dental, Portland OR
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-widest border rounded-full transition-colors hover:bg-opacity-10 cursor-pointer" style={{ borderColor: muted, color: text }}>
              Crown & Bridge
            </div>
          </div>
          <div className="lg:w-1/2 aspect-[4/3] lg:aspect-auto relative bg-neutral-200 overflow-hidden">
            <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1000&q=80" alt="Featured Story" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-90" style={{ filter: 'grayscale(20%) contrast(120%)' }} />
          </div>
        </motion.div>

        {/* Filter Row */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="flex flex-wrap items-center gap-3 mb-16 border-y py-6" style={{ borderColor: muted }}>
          {filters.map((filter, idx) => {
            const isSelected = filter === 'All';
            return (
              <button key={filter} className="text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all" style={{ 
                backgroundColor: isSelected ? text : 'transparent', 
                color: isSelected ? bg : secondaryText,
                border: `1px solid ${isSelected ? 'transparent' : muted}`
              }}>
                {filter}
              </button>
            )
          })}
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
          {stories.map((story, idx) => (
            <motion.div key={story.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 + idx * 0.1 }} className="group cursor-pointer">
              <div className="flex items-start gap-6 mb-6">
                <div className="font-serif text-3xl italic" style={{ color: accent }}>{story.id}</div>
                <div className="flex-1 border-t pt-2" style={{ borderColor: muted }}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: text }}>{story.clinic}</div>
                  <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: secondaryText }}>{story.location}</div>
                  <div className="aspect-square w-24 overflow-hidden bg-neutral-100 float-left mr-4 mb-2">
                    <img src={story.img} alt={story.clinic} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                  </div>
                  <h3 className="font-serif text-xl leading-snug mb-4" style={{ color: text }}>{story.headline}</h3>
                  <div className="text-xs uppercase tracking-widest" style={{ color: accent }}>{story.tag}</div>
                </div>
              </div>
              <div className="flex justify-end border-b pb-4" style={{ borderColor: muted }}>
                <span className="text-xs uppercase tracking-widest font-semibold flex items-center gap-2 group-hover:translate-x-2 transition-transform" style={{ color: text }}>
                  Read story <span style={{ color: accent }}>→</span>
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats Strip */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8 }} className="my-32 border-y py-16 grid grid-cols-1 md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x" style={{ borderColor: muted }}>
          {[
            { label: '1,200+ practices', desc: 'Running on Dandy' },
            { label: '94% would recommend', desc: 'Based on 2025 survey' },
            { label: '$2.1B in workflow savings', desc: 'Across the network' }
          ].map((stat, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center pt-8 md:pt-0">
              <div className="font-serif text-3xl md:text-4xl mb-4" style={{ color: text }}>{stat.label}</div>
              <div className="text-xs uppercase tracking-widest" style={{ color: secondaryText }}>{stat.desc}</div>
            </div>
          ))}
        </motion.div>

        {/* Footer CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 1 }} className="text-center py-16">
          <h2 className="font-serif text-5xl md:text-7xl mb-12" style={{ color: text }}>Become the <span className="italic" style={{ color: accent }}>next story.</span></h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button className="px-8 py-4 text-sm font-semibold uppercase tracking-widest transition-transform hover:-translate-y-1" style={{ backgroundColor: accent, color: isLight ? '#FAF7F0' : '#13110E' }}>
              Talk to our team
            </button>
            <button className="px-8 py-4 text-sm font-semibold uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: text }}>
              Browse all stories <span>→</span>
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export function Light() {
  return <StoryHub mode="light" />;
}

export default Light;