import React, { useEffect } from 'react';
import { ArrowRight, Quote, Instagram, Twitter, Linkedin, Facebook } from 'lucide-react';

export function EditorialStory() {
  useEffect(() => {
    // Inject Google Fonts for the editorial look
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const styles = {
    fontSerif: { fontFamily: '"Playfair Display", serif' },
    fontSans: { fontFamily: '"Inter", sans-serif' },
    bgCream: { backgroundColor: '#F9F8F6' },
    textDark: { color: '#1A1A1A' },
    textMuted: { color: '#666666' },
    borderMuted: { borderColor: '#E5E5E5' },
  };

  return (
    <div style={{ ...styles.bgCream, ...styles.textDark, ...styles.fontSans }} className="min-h-screen selection:bg-black selection:text-white">
      
      {/* 1. Minimal Nav */}
      <nav className="border-b" style={styles.borderMuted}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <span style={styles.fontSerif} className="text-2xl font-bold tracking-tight">AURA.</span>
            <div className="hidden md:flex gap-8 text-sm uppercase tracking-widest" style={styles.textMuted}>
              <a href="#" className="hover:text-black transition-colors">Work</a>
              <a href="#" className="hover:text-black transition-colors">Studio</a>
              <a href="#" className="hover:text-black transition-colors">Journal</a>
            </div>
          </div>
          <button className="hidden md:flex items-center gap-2 text-sm uppercase tracking-widest hover:opacity-70 transition-opacity">
            Start a project <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* 2. Hero */}
      <header className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="text-sm uppercase tracking-[0.2em] mb-8" style={styles.textMuted}>Customer Story</div>
          <h1 style={styles.fontSerif} className="text-5xl md:text-7xl lg:text-8xl leading-[1.1] mb-12">
            Redefining luxury hospitality through quiet minimalism.
          </h1>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm tracking-wider uppercase" style={styles.textMuted}>
            <span>Hospitality</span>
            <span>&middot;</span>
            <span>October 2023</span>
            <span>&middot;</span>
            <span>8 Min Read</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto">
          <div className="aspect-[16/9] w-full overflow-hidden">
            <img 
              src="/__mockup/images/editorial-hero.png" 
              alt="Luxurious minimalist living room" 
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000"
            />
          </div>
          <div className="text-xs text-right mt-4 uppercase tracking-widest" style={styles.textMuted}>
            Photography by Studio Aura
          </div>
        </div>
      </header>

      {/* 3. Summary / Standfirst */}
      <section className="py-20 px-6 max-w-3xl mx-auto">
        <p style={{ ...styles.fontSerif, fontSize: '1.75rem', lineHeight: '1.6' }} className="first-letter:float-left first-letter:text-7xl first-letter:pr-4 first-letter:font-bold first-letter:leading-[0.8] mb-16">
          When The Lumière Group approached us to reimagine their flagship property, the mandate was clear: strip away the excess to reveal the essence of true luxury. What followed was an eighteen-month journey into the fundamentals of space, light, and material.
        </p>
        
        {/* Inline Metric Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-y" style={styles.borderMuted}>
          <div>
            <div className="text-3xl mb-2" style={styles.fontSerif}>45k</div>
            <div className="text-xs uppercase tracking-widest" style={styles.textMuted}>Sq Ft Renovated</div>
          </div>
          <div>
            <div className="text-3xl mb-2" style={styles.fontSerif}>18</div>
            <div className="text-xs uppercase tracking-widest" style={styles.textMuted}>Months Duration</div>
          </div>
          <div>
            <div className="text-3xl mb-2" style={styles.fontSerif}>32%</div>
            <div className="text-xs uppercase tracking-widest" style={styles.textMuted}>Energy Reduction</div>
          </div>
          <div>
            <div className="text-3xl mb-2" style={styles.fontSerif}>12</div>
            <div className="text-xs uppercase tracking-widest" style={styles.textMuted}>Bespoke Fixtures</div>
          </div>
        </div>
      </section>

      {/* 4. The Challenge */}
      <section className="py-20 px-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-16 items-start">
        <div className="md:col-span-5 md:sticky top-10">
          <h2 style={styles.fontSerif} className="text-4xl mb-6">The Challenge</h2>
          <p className="text-lg leading-relaxed mb-6" style={styles.textMuted}>
            The existing structure, a brutalist monolith from the late 1970s, possessed strong architectural bones but felt oppressive and uninviting. The challenge was not to erase its history, but to soften its edges and introduce a human scale without compromising the building's inherent monumentality.
          </p>
          <p className="text-lg leading-relaxed" style={styles.textMuted}>
            Furthermore, the client required the hotel to remain partially operational during the renovation, necessitating a phased approach that demanded meticulous logistical choreography.
          </p>
        </div>
        <div className="md:col-span-7">
          <div className="aspect-[4/3] w-full overflow-hidden mb-4">
            <img 
              src="/__mockup/images/editorial-challenge.png" 
              alt="Architecture blueprints" 
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-sm italic" style={styles.textMuted}>
            Initial material studies focusing on warm travertines and brushed brass to counteract the raw concrete structure.
          </p>
        </div>
      </section>

      {/* 5. The Approach */}
      <section className="py-20 px-6 max-w-3xl mx-auto text-center">
        <h2 style={styles.fontSerif} className="text-4xl mb-12">The Approach</h2>
        <p className="text-lg leading-relaxed mb-16 text-left" style={styles.textMuted}>
          Our methodology centered on 'subtractive design'—removing superfluous adornments to let the materials speak for themselves. We introduced a restrained palette of European oak, honed limestone, and patinated bronze, materials chosen for how they age and interact with natural light throughout the day.
        </p>
        
        <blockquote className="my-20">
          <Quote className="w-12 h-12 mx-auto mb-8 opacity-20" />
          <p style={styles.fontSerif} className="text-3xl md:text-4xl leading-tight mb-8">
            "We didn't want to design a space; we wanted to design an atmosphere. The architecture should recede, leaving only the experience of calm."
          </p>
          <footer className="text-sm uppercase tracking-widest" style={styles.textMuted}>
            &mdash; Elena Rostova, Lead Architect
          </footer>
        </blockquote>
      </section>

      {/* 6. The Results */}
      <section className="py-24 px-6 bg-white border-y" style={styles.borderMuted}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 style={styles.fontSerif} className="text-4xl mb-6">The Impact</h2>
            <p className="text-lg leading-relaxed mb-8" style={styles.textMuted}>
              The completed spaces breathe with a new rhythm. By reorienting the primary public areas toward the courtyard garden and introducing vast expanses of glazing, we dissolved the boundary between interior and exterior.
            </p>
            <p className="text-lg leading-relaxed" style={styles.textMuted}>
              The reception, once a transactional thoroughfare, is now a serene lounge that encourages guests to linger. Post-renovation, the property has seen a dramatic shift not just in aesthetic perception, but in how guests utilize the common spaces.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="p-8 bg-[#F9F8F6]">
              <div className="text-4xl mb-4" style={styles.fontSerif}>+40%</div>
              <div className="text-sm uppercase tracking-widest mb-2 font-semibold">Dwell Time</div>
              <div className="text-sm" style={styles.textMuted}>Increase in average time guests spend in lobby areas.</div>
            </div>
            <div className="p-8 bg-[#F9F8F6]">
              <div className="text-4xl mb-4" style={styles.fontSerif}>98%</div>
              <div className="text-sm uppercase tracking-widest mb-2 font-semibold">Positive Sentiment</div>
              <div className="text-sm" style={styles.textMuted}>Guest satisfaction rating in post-stay design surveys.</div>
            </div>
            <div className="p-8 bg-[#F9F8F6]">
              <div className="text-4xl mb-4" style={styles.fontSerif}>2.5x</div>
              <div className="text-sm uppercase tracking-widest mb-2 font-semibold">F&B Revenue</div>
              <div className="text-sm" style={styles.textMuted}>Growth in lounge and bar revenue post-renovation.</div>
            </div>
            <div className="p-8 bg-[#F9F8F6]">
              <div className="text-4xl mb-4" style={styles.fontSerif}>Zero</div>
              <div className="text-sm uppercase tracking-widest mb-2 font-semibold">Operational Days Lost</div>
              <div className="text-sm" style={styles.textMuted}>Achieved through meticulous phased execution.</div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Testimonial */}
      <section className="py-0 flex flex-col md:flex-row min-h-[80vh]">
        <div className="w-full md:w-1/2 p-12 md:p-24 flex flex-col justify-center bg-[#1A1A1A] text-white">
          <Quote className="w-10 h-10 mb-10 opacity-30 text-white" />
          <p style={styles.fontSerif} className="text-3xl md:text-5xl leading-tight mb-12">
            "Aura didn't just redesign our property; they redefined our brand's physical manifestation. The restraint and elegance they brought to the project has elevated our entire guest experience."
          </p>
          <div>
            <div className="font-bold tracking-widest uppercase text-sm mb-1">Julian Vance</div>
            <div className="text-sm text-gray-400">CEO, The Lumière Group</div>
          </div>
        </div>
        <div className="w-full md:w-1/2 min-h-[50vh] relative">
          <img 
            src="/__mockup/images/editorial-testimonial.png" 
            alt="Julian Vance Portrait" 
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </section>

      {/* 8. Image Gallery */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 style={styles.fontSerif} className="text-3xl">Visual Documentation</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-8 flex flex-col gap-4">
            <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
              <img src="/__mockup/images/editorial-gallery-2.png" alt="Staircase" className="w-full h-full object-cover" />
            </div>
            <div className="text-sm italic text-right" style={styles.textMuted}>The central monolithic staircase redefined with ambient cove lighting.</div>
          </div>
          <div className="md:col-span-4 flex flex-col gap-4 md:mt-24">
            <div className="aspect-[3/4] w-full overflow-hidden bg-gray-100">
              <img src="/__mockup/images/editorial-gallery-1.png" alt="Details" className="w-full h-full object-cover" />
            </div>
            <div className="text-sm italic" style={styles.textMuted}>Custom brass joinery against honed Calacatta marble.</div>
          </div>
          <div className="md:col-span-12 flex flex-col gap-4 mt-8">
            <div className="aspect-[21/9] w-full overflow-hidden bg-gray-100">
              <img src="/__mockup/images/editorial-gallery-3.png" alt="Dining" className="w-full h-full object-cover" />
            </div>
            <div className="text-sm italic text-center" style={styles.textMuted}>The signature restaurant, bathed in natural light and anchored by bespoke lighting installations.</div>
          </div>
        </div>
      </section>

      {/* 9. Chapter 1 */}
      <section className="py-20 px-6 max-w-4xl mx-auto">
        <h3 className="text-sm uppercase tracking-widest mb-6 font-semibold" style={styles.textMuted}>Chapter 01</h3>
        <h2 style={styles.fontSerif} className="text-4xl mb-8">Collaborative Iteration</h2>
        <div className="aspect-[16/9] w-full overflow-hidden mb-8">
          <img src="/__mockup/images/editorial-chapter-1.png" alt="Team collaborating" className="w-full h-full object-cover" />
        </div>
        <p className="text-lg leading-relaxed" style={styles.textMuted}>
          The process required intensive collaboration not just with the client, but with local artisans and fabricators. We spent weeks in workshops refining the exact patina for the bronze cladding, ensuring it would reflect the warmth of the afternoon sun exactly as we envisioned. This hands-on approach is critical to achieving the level of detail that luxury demands.
        </p>
      </section>

      {/* 9. Chapter 2 */}
      <section className="py-20 px-6 max-w-4xl mx-auto border-t" style={styles.borderMuted}>
        <h3 className="text-sm uppercase tracking-widest mb-6 font-semibold" style={styles.textMuted}>Chapter 02</h3>
        <h2 style={styles.fontSerif} className="text-4xl mb-8">A New Standard</h2>
        <div className="aspect-[4/3] w-full overflow-hidden mb-8">
          <img src="/__mockup/images/editorial-chapter-2.png" alt="Finished lobby" className="w-full h-full object-cover" />
        </div>
        <p className="text-lg leading-relaxed" style={styles.textMuted}>
          Upon opening, the space was immediately recognized not merely as a renovation, but as a repositioning of the property within the city's luxury landscape. The meticulous attention to acoustics, the subtle programming of scent, and the tactile richness of every touchpoint coalesced to create an environment that feels simultaneously grounding and deeply elevated.
        </p>
      </section>

      {/* 10. Key Takeaways */}
      <section className="py-24 px-6 bg-[#1A1A1A] text-white">
        <div className="max-w-4xl mx-auto">
          <h2 style={styles.fontSerif} className="text-4xl mb-16 text-center">In Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="text-2xl mb-4 opacity-50" style={styles.fontSerif}>01.</div>
              <h4 className="text-lg font-semibold mb-3">Subtractive Design</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                True luxury often lies in what is removed. Stripping back to essential materials creates a stronger, more enduring aesthetic.
              </p>
            </div>
            <div>
              <div className="text-2xl mb-4 opacity-50" style={styles.fontSerif}>02.</div>
              <h4 className="text-lg font-semibold mb-3">Tactile Focus</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Visual design must be supported by tactile quality. How a surface feels dictates the emotional response to a space.
              </p>
            </div>
            <div>
              <div className="text-2xl mb-4 opacity-50" style={styles.fontSerif}>03.</div>
              <h4 className="text-lg font-semibold mb-3">Seamless Phasing</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Ambitious renovations can coexist with operational continuity when meticulously choreographed and communicated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 11. CTA Band */}
      <section className="py-32 px-6 text-center">
        <h2 style={styles.fontSerif} className="text-5xl mb-8">Discuss Your Vision.</h2>
        <p className="text-lg mb-10 max-w-xl mx-auto" style={styles.textMuted}>
          Our studio takes on a limited number of commissions per year to ensure absolute dedication to each project's distinct narrative.
        </p>
        <button className="bg-black text-white px-10 py-5 text-sm uppercase tracking-widest hover:bg-gray-800 transition-colors">
          Inquire Now
        </button>
      </section>

      {/* 12. Footer */}
      <footer className="border-t py-16 px-6" style={styles.borderMuted}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div style={styles.fontSerif} className="text-3xl font-bold mb-6">AURA.</div>
            <p className="max-w-xs text-sm leading-relaxed" style={styles.textMuted}>
              An architectural and interior design studio dedicated to creating spaces of enduring elegance and quiet consequence.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6">Inquiries</h4>
            <ul className="space-y-4 text-sm" style={styles.textMuted}>
              <li><a href="#" className="hover:text-black">New Projects</a></li>
              <li><a href="#" className="hover:text-black">Press & Media</a></li>
              <li><a href="#" className="hover:text-black">Careers</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6">Connect</h4>
            <div className="flex gap-4">
              <a href="#" className="text-gray-500 hover:text-black"><Instagram className="w-5 h-5" /></a>
              <a href="#" className="text-gray-500 hover:text-black"><Twitter className="w-5 h-5" /></a>
              <a href="#" className="text-gray-500 hover:text-black"><Linkedin className="w-5 h-5" /></a>
              <a href="#" className="text-gray-500 hover:text-black"><Facebook className="w-5 h-5" /></a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t flex flex-col md:flex-row items-center justify-between text-xs uppercase tracking-widest" style={{...styles.borderMuted, ...styles.textMuted}}>
          <div>&copy; {new Date().getFullYear()} Studio Aura. All rights reserved.</div>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-black">Privacy</a>
            <a href="#" className="hover:text-black">Terms</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
