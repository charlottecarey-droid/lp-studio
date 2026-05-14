import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const THEME = {
  bg: '#FAF7F0',
  text: '#1A1A1A',
  accent: '#B91C1C',
  violet: 'hsl(258, 70%, 54%)',
};

const SectionDivider = ({ numeral, title, id }: { numeral: string; title: string, id: string }) => (
  <div id={id} className="flex items-start md:items-center gap-4 md:gap-8 my-32 border-t border-[#1A1A1A]/10 pt-16 flex-col md:flex-row scroll-mt-24">
    <div className="text-[#B91C1C] font-serif text-3xl md:text-5xl italic w-16">{numeral}</div>
    <h2 className="text-[#1A1A1A] font-serif text-4xl md:text-6xl tracking-tight">{title}</h2>
  </div>
);

const PullQuote = ({ quote, citation }: { quote: string; citation: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    className="my-32 pl-8 border-l-[3px] border-[#B91C1C] max-w-4xl relative"
  >
    <div className="absolute -left-6 -top-8 text-[120px] leading-none font-serif text-[#B91C1C]/10 pointer-events-none select-none">"</div>
    <p className="text-3xl md:text-5xl font-serif text-[#1A1A1A] leading-[1.2] mb-8 z-10 relative">
      {quote}
    </p>
    <p className="text-sm uppercase tracking-[0.2em] text-[#1A1A1A]/60 font-semibold font-sans">
      — {citation}
    </p>
  </motion.div>
);

const StatGrid = () => {
  const stats = [
    { value: '84%', label: 'Practices adopted digital scanning in 2025, up from 62% in 2023.' },
    { value: '3.2x', label: 'Faster turnaround times for crown & bridge when fully digital.' },
    { value: '$12k', label: 'Average monthly savings on lab remakes and shipping costs.' },
    { value: '91%', label: 'Patient preference for digital impressions over analog material.' },
    { value: '45m', label: 'Reduction in average seating time per complex case.' },
    { value: 'Zero', label: 'Tolerance for analog impression materials among new grads.' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-24 my-32">
      {stats.map((stat, i) => (
        <motion.div 
          key={i}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, margin: "-50px" }}
          className="flex flex-col gap-4 relative group"
        >
          <div className="absolute -inset-4 bg-[#1A1A1A]/[0.02] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="text-6xl md:text-8xl font-serif text-[#B91C1C] tracking-tighter leading-none">
            {stat.value}
          </div>
          <div className="w-12 h-px bg-[#1A1A1A]/20 my-2" />
          <div className="text-sm md:text-base text-[#1A1A1A]/70 leading-relaxed font-sans pr-4">
            {stat.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const BarChart = () => {
  const data = [
    { year: '2023', value: 42 },
    { year: '2024', value: 58 },
    { year: '2025', value: 76 },
    { year: '2026', value: 91 } // projected
  ];
  
  return (
    <div className="w-full max-w-3xl my-24 bg-[#1A1A1A]/[0.02] p-8 md:p-12 rounded-2xl border border-[#1A1A1A]/5">
      <div className="mb-12">
        <h4 className="font-serif text-2xl md:text-3xl text-[#1A1A1A] mb-2">The Digital Acceleration</h4>
        <p className="text-sm text-[#1A1A1A]/60 font-sans uppercase tracking-wider">Percentage of network cases submitted digitally (2023-2026P)</p>
      </div>
      
      <div className="w-full h-[300px] md:h-[400px] flex items-end justify-between gap-2 md:gap-8">
        {data.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-6 group relative">
            <motion.div 
              initial={{ height: 0 }}
              whileInView={{ height: `${item.value}%` }}
              transition={{ duration: 1.2, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true, margin: "-100px" }}
              className="w-full max-w-[80px] bg-[#1A1A1A] group-hover:bg-[#B91C1C] transition-colors duration-500 relative rounded-t-sm"
            >
              <motion.span 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 1 + (i * 0.15) }}
                viewport={{ once: true }}
                className="absolute -top-10 left-1/2 -translate-x-1/2 font-serif text-2xl md:text-3xl text-[#1A1A1A] group-hover:text-[#B91C1C] transition-colors"
              >
                {item.value}%
              </motion.span>
            </motion.div>
            <div className="text-xs md:text-sm font-sans tracking-widest text-[#1A1A1A]/50 font-medium">
              {item.year}{i === 3 ? 'P' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DonutChart = () => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const percentage = 84;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="w-full max-w-sm mx-auto my-24 text-center">
      <div className="relative w-64 h-64 mx-auto mb-8">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            className="text-[#1A1A1A]/10"
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
          <motion.circle
            className="text-[#B91C1C]"
            strokeWidth="8"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            viewport={{ once: true }}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            viewport={{ once: true }}
            className="font-serif text-6xl text-[#1A1A1A]"
          >
            {percentage}%
          </motion.span>
        </div>
      </div>
      <p className="font-sans text-sm text-[#1A1A1A]/60 uppercase tracking-widest">
        Of new practices cite "Lab Integration" as their primary reason for adopting iOS.
      </p>
    </div>
  );
};


const Sidebar = () => {
  const [activeId, setActiveId] = useState('chapter-i');

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['chapter-i', 'chapter-ii', 'chapter-iii', 'chapter-iv'];
      let current = activeId;

      for (const id of sections) {
        const element = document.getElementById(id);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 200) {
            current = id;
          }
        }
      }

      if (current !== activeId) {
        setActiveId(current);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeId]);

  return (
    <aside className="hidden lg:block w-72 shrink-0 h-screen sticky top-0 py-24 pr-12">
      <div className="h-full flex flex-col justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A]/40 mb-12 flex items-center gap-3">
            <div className="w-4 h-px bg-[#1A1A1A]/20" />
            Contents
          </div>
          <nav className="flex flex-col gap-6 relative">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-[#1A1A1A]/5" />
            {[
              { id: 'chapter-i', num: 'I', title: 'Executive Summary' },
              { id: 'chapter-ii', num: 'II', title: 'The Digital Shift' },
              { id: 'chapter-iii', num: 'III', title: 'Growth Mechanics' },
              { id: 'chapter-iv', num: 'IV', title: 'Methodology' },
            ].map((item) => {
              const isActive = activeId === item.id;
              return (
                <a 
                  key={item.id} 
                  href={`#${item.id}`} 
                  className={`group flex items-center gap-6 text-sm transition-all duration-300 relative pl-6 ${isActive ? 'translate-x-2' : 'hover:translate-x-1'}`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-full bg-[#B91C1C]"
                    />
                  )}
                  <span className={`font-serif italic transition-colors ${isActive ? 'text-[#B91C1C]' : 'text-[#1A1A1A]/40 group-hover:text-[#B91C1C]'}`}>
                    {item.num}
                  </span>
                  <span className={`font-sans transition-colors ${isActive ? 'text-[#1A1A1A] font-semibold' : 'text-[#1A1A1A]/60 group-hover:text-[#1A1A1A]'}`}>
                    {item.title}
                  </span>
                </a>
              );
            })}
          </nav>
        </div>
        
        <div className="pb-12">
          <div className="w-12 h-12 rounded-full border border-[#1A1A1A]/10 flex items-center justify-center mb-6">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <p className="text-xs font-sans text-[#1A1A1A]/50 leading-relaxed mb-4">
            Available offline.<br/>Includes 24 extra pages of methodology.
          </p>
          <a href="#download" className="text-sm font-sans font-semibold text-[#1A1A1A] hover:text-[#B91C1C] transition-colors border-b border-transparent hover:border-[#B91C1C]">
            Download PDF PDF
          </a>
        </div>
      </div>
    </aside>
  );
};

const GatedForm = () => (
  <div id="download" className="bg-[#1A1A1A] text-[#FAF7F0] p-12 md:p-24 my-32 rounded-3xl relative overflow-hidden">
    {/* Decorative background elements */}
    <div className="absolute top-0 right-0 w-96 h-96 bg-[#B91C1C] opacity-5 blur-[100px] rounded-full pointer-events-none" />
    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-white opacity-[0.02] blur-[80px] rounded-full pointer-events-none" />
    
    <div className="relative z-10 flex flex-col md:flex-row gap-16 items-center">
      <div className="flex-1">
        <h3 className="font-serif text-5xl md:text-6xl mb-8 leading-tight">Get the Full <br/><span className="text-[#FAF7F0]/50 italic">48-Page Report</span></h3>
        <p className="text-[#FAF7F0]/70 text-lg md:text-xl font-sans leading-relaxed mb-12 max-w-lg">
          Dive deeper into the dataset. The complete PDF includes practice-size breakdowns, specialty-specific adoption curves, and future projections for 2028.
        </p>
        <ul className="flex flex-col gap-4 font-sans text-[#FAF7F0]/80">
          {['Specialty drill-downs (Ortho, Implant, Dentures)', 'Regional adoption heatmaps', 'Financial modeling templates'].map((item, i) => (
            <li key={i} className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="w-full max-w-md bg-white/5 p-8 rounded-2xl backdrop-blur-sm border border-white/10">
        <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-sans text-[#FAF7F0]/60 ml-2">Work Email</label>
            <input 
              type="email" 
              placeholder="dr.smith@practice.com" 
              className="w-full bg-white/10 border border-white/20 p-4 rounded-xl text-[#FAF7F0] placeholder:text-[#FAF7F0]/30 focus:outline-none focus:border-[#FAF7F0]/60 transition-colors font-sans"
            />
          </div>
          <button 
            className="w-full py-5 px-8 text-white font-sans tracking-[0.1em] uppercase text-sm font-bold transition-all hover:scale-[1.02] active:scale-100 rounded-xl shadow-lg mt-4"
            style={{ backgroundColor: THEME.violet, boxShadow: '0 10px 30px -10px rgba(109, 40, 217, 0.5)' }}
          >
            Download PDF Now
          </button>
          <p className="text-center text-xs font-sans text-[#FAF7F0]/40 mt-2">
            We will never share your information.
          </p>
        </form>
      </div>
    </div>
  </div>
);

export default function AnnualReportPage() {
  return (
    <div
      className="annual-report-root min-h-screen selection:bg-[#B91C1C] selection:text-white relative overflow-x-hidden"
      style={{
        backgroundColor: THEME.bg,
        color: THEME.text,
        fontFamily: '"Inter", sans-serif'
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700&family=Inter:wght@400;500;600;700&display=swap"
      />
      <style dangerouslySetInnerHTML={{__html: `
        .annual-report-root .font-serif { font-family: "Playfair Display", serif; }
        .annual-report-root .font-sans { font-family: "Inter", sans-serif; }
        .annual-report-root .paper-texture {
          position: absolute;
          inset: 0;
          opacity: 0.4;
          pointer-events: none;
          z-index: 50;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
      `}} />

      <div className="paper-texture mix-blend-multiply" />

      <main className="max-w-[1600px] mx-auto px-6 md:px-12 flex items-start gap-8 relative z-10">
        <Sidebar />
        
        <div className="flex-1 max-w-5xl mx-auto pb-32">
          {/* Hero Section */}
          <header className="min-h-[90vh] flex flex-col justify-center py-32 border-b border-[#1A1A1A]/10 relative">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10"
            >
              <div className="flex items-center gap-6 mb-16 text-xs uppercase tracking-[0.3em] font-semibold text-[#1A1A1A]/50">
                <span>Dandy Labs</span>
                <span className="w-16 h-px bg-[#1A1A1A]/20"></span>
                <span>Annual Report</span>
              </div>
              
              <div className="relative">
                <h1 className="font-serif leading-[0.75] text-[18vw] lg:text-[240px] tracking-tighter text-[#1A1A1A] mb-8 -ml-2 lg:-ml-4 drop-shadow-sm">
                  2026
                </h1>
                <div className="absolute top-8 md:top-16 right-0 md:right-12 hidden md:block w-32 h-32 rounded-full border border-[#B91C1C]/20 flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-serif text-3xl text-[#B91C1C]">3rd</div>
                    <div className="text-[10px] uppercase tracking-widest font-sans">Edition</div>
                  </div>
                </div>
              </div>

              <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[1.1] mb-16 max-w-4xl tracking-tight">
                The State of <br/>
                <span className="italic text-[#B91C1C]">Dental Technology</span>
              </h2>
              
              <div className="flex flex-wrap items-center gap-12 md:gap-24 pt-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#1A1A1A] text-[#FAF7F0] flex items-center justify-center font-serif italic text-xl">
                    S
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A]/50 mb-1 font-semibold">Byline</div>
                    <div className="font-serif text-xl">Dr. Sarah Jenkins</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A]/50 mb-1 font-semibold">Read Time</div>
                  <div className="font-serif text-xl flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    12 Minutes
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Scroll indicator */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 1 }}
              className="absolute bottom-12 left-0 hidden md:flex items-center gap-4"
            >
              <div className="w-px h-16 bg-gradient-to-b from-[#1A1A1A] to-transparent" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-[#1A1A1A]/40 rotate-90 origin-left translate-x-4">Scroll</span>
            </motion.div>
          </header>

          <article className="prose prose-xl md:prose-2xl prose-p:text-[#1A1A1A]/80 prose-p:leading-[1.8] prose-p:font-sans prose-p:font-light max-w-none">
            
            <section>
              <SectionDivider id="chapter-i" numeral="I" title="Executive Summary" />
              <p className="text-3xl md:text-4xl font-serif leading-[1.6] text-[#1A1A1A] mb-16 font-normal">
                <span className="text-[#B91C1C] text-5xl float-left mr-4 mt-2 font-bold leading-none">W</span>e have crossed the Rubicon. 2026 marks the first year where analog impression materials represent less than a quarter of all restorative cases submitted to Dandy's network. The digital native practice is no longer a future state—it is the baseline.
              </p>
              <p>
                In our third annual analysis of over 2.4 million anonymized case records across 8,000+ practices, the data reveals a stark divergence. Practices that fully integrated digital scanning and CAD/CAM workflows grew their production volume at 3.4x the rate of their analog counterparts.
              </p>
              
              <StatGrid />
            </section>

            <section>
              <SectionDivider id="chapter-ii" numeral="II" title="The Digital Shift" />
              <p>
                The narrative of the past five years has been one of gradual adoption. The narrative of 2026 is one of acceleration. As scanner hardware commoditizes and software capabilities expand into predictive AI and automated treatment planning, the barrier to entry has evaporated.
              </p>
              
              <PullQuote 
                quote="The question is no longer whether to go digital, but how quickly you can retrain your staff to trust the algorithm over their eyes."
                citation="Dr. Marcus Wei, Clinical Director"
              />

              <BarChart />

              <p>
                What's particularly notable is the shift in single-unit crown workflows. The traditional two-week wait has been effectively compressed. With intraoral scanning and integrated lab communication, the average turnaround time has dropped to an unprecedented 4.2 days across the network.
              </p>
            </section>

            <section>
              <SectionDivider id="chapter-iii" numeral="III" title="Growth Mechanics" />
              <p>
                How does this translate to practice economics? We isolated the top quartile of practices by production growth and analyzed their case mix. The findings indicate that digital workflows don't just speed up existing procedures—they unlock entirely new service lines.
              </p>
              
              <DonutChart />

              <p>
                Clear aligners and complex implant retained prosthetics saw a 145% YoY increase in these high-growth practices, directly correlated with the implementation of advanced 3D scanning protocols.
              </p>
              
              <div className="my-32 p-12 md:p-20 bg-white border border-[#1A1A1A]/10 shadow-2xl shadow-[#1A1A1A]/5 rounded-sm relative">
                <div className="absolute top-0 left-0 w-2 h-full bg-[#B91C1C]" />
                <h4 className="font-serif text-4xl md:text-5xl mb-8 text-[#1A1A1A]">The Efficiency Dividend</h4>
                <p className="text-[#1A1A1A]/70 font-sans text-xl leading-relaxed mb-12">
                  By eliminating physical shipping, reducing chair time for adjustments, and nearly eradicating impression-based remakes, the average digital practice reclaims 14 hours of clinical time per month. 
                </p>
                <div className="flex items-center gap-6 text-[#B91C1C] font-serif text-5xl md:text-6xl border-t border-[#1A1A1A]/10 pt-12">
                  <span className="text-3xl">→</span>
                  <span>14 Hours / Month</span>
                </div>
              </div>
            </section>

            <section>
              <SectionDivider id="chapter-iv" numeral="IV" title="Methodology" />
              <div className="pl-6 md:pl-12 border-l border-[#1A1A1A]/20">
                <p className="text-base md:text-lg text-[#1A1A1A]/60 font-sans leading-relaxed">
                  This report is based on aggregated, anonymized data from the Dandy clinical network, encompassing over 8,000 dental practices in the United States. Data was collected between January 1, 2025, and December 31, 2025. Practice revenue and growth metrics are based on self-reported survey data matched with platform utilization rates. For detailed statistical methodology, including regression models for efficiency metrics, please download the full report.
                </p>
              </div>
            </section>

          </article>

          <GatedForm />

        </div>
      </main>
    </div>
  );
}