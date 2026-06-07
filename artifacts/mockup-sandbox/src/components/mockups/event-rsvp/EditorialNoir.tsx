import React, { useState, useEffect } from "react";
import { ChevronDown, MapPin, Calendar, Clock, ArrowRight, Instagram, Twitter, Linkedin, Check } from "lucide-react";

// --- Theme Config ---
const theme = {
  colors: {
    bg: "#0a0a0a",
    surface: "#121212",
    surfaceHover: "#1a1a1a",
    border: "#2a2a2a",
    text: {
      primary: "#ffffff",
      secondary: "#a0a0a0",
      tertiary: "#666666",
    },
    accent: {
      main: "#d4af37", // Champagne Gold
      hover: "#b5952f",
      muted: "rgba(212, 175, 55, 0.1)",
    }
  }
};

// --- Components ---

function Button({ children, variant = "primary", className = "", ...props }: any) {
  const baseStyle = "inline-flex items-center justify-center px-8 py-4 text-sm tracking-[0.15em] uppercase transition-all duration-300 font-medium";
  const variants = {
    primary: "bg-[#d4af37] text-black hover:bg-[#b5952f]",
    outline: "border border-[#2a2a2a] text-white hover:border-[#d4af37] hover:text-[#d4af37]",
    ghost: "text-[#a0a0a0] hover:text-white"
  };

  return (
    <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// --- Sections ---

function Nav() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-50 px-8 py-6 flex items-center justify-between mix-blend-difference border-b border-white/10">
      <div className="font-serif text-2xl tracking-widest text-white uppercase">Aethel</div>
      <Button variant="outline" className="px-6 py-2 text-xs backdrop-blur-sm border-white/20 text-white hover:border-white hover:bg-white hover:text-black">
        Request Invite
      </Button>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex items-end pb-24 pt-32 px-8 overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <img src="/__mockup/images/noir-hero.png" alt="Hero background" className="w-full h-full object-cover opacity-60 mix-blend-luminosity scale-105 animate-slow-zoom" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
        <div className="lg:col-span-8">
          <div className="flex items-center gap-4 mb-6 text-[#d4af37] uppercase tracking-[0.2em] text-xs font-medium">
            <span className="w-8 h-[1px] bg-[#d4af37]" />
            The Inaugural Symposium
          </div>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[1.1] text-white mb-6">
            The Future of <br/><span className="text-[#a0a0a0] italic">Aesthetics</span> & Form.
          </h1>
          <p className="text-xl md:text-2xl text-[#a0a0a0] font-light max-w-2xl mb-12">
            An exclusive gathering of visionaries redefining the boundaries of design, architecture, and spatial experience.
          </p>
          <Button className="group">
            Secure Your Place
            <ArrowRight className="ml-3 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
        
        <div className="lg:col-span-4 flex flex-col gap-8 lg:text-right">
          <div>
            <div className="text-[#666666] uppercase tracking-widest text-xs mb-2">Date</div>
            <div className="text-white text-lg font-medium">October 24–26, 2025</div>
          </div>
          <div>
            <div className="text-[#666666] uppercase tracking-widest text-xs mb-2">Location</div>
            <div className="text-white text-lg font-medium">The Pendry, Manhattan<br/>New York City</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Countdown() {
  const [timeLeft, setTimeLeft] = useState({ days: 42, hours: 16, minutes: 24, seconds: 10 });

  return (
    <section className="py-24 bg-[#0a0a0a] border-b border-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-x divide-[#1a1a1a]">
          {[
            { label: "Days", value: timeLeft.days },
            { label: "Hours", value: timeLeft.hours },
            { label: "Minutes", value: timeLeft.minutes },
            { label: "Seconds", value: timeLeft.seconds },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center justify-center">
              <div className="font-serif text-5xl md:text-6xl text-white mb-2">{item.value}</div>
              <div className="text-[#666666] uppercase tracking-[0.2em] text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="py-32 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div>
          <h2 className="font-serif text-4xl lg:text-5xl text-white leading-tight mb-8">
            Beyond the surface.<br/>Into the <span className="italic text-[#d4af37]">substance</span>.
          </h2>
          <div className="space-y-6 text-[#a0a0a0] text-lg font-light leading-relaxed">
            <p>
              Aethel is not a conference. It is a collision of disciplines. For three days, we strip away the superfluous to examine the core of what makes design enduring.
            </p>
            <p>
              Through intimate dialogues, immersive installations, and unfiltered debates, we invite 250 practitioners to challenge the prevailing orthodoxies of their fields.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {[
            { stat: "250", label: "Exclusive Attendees" },
            { stat: "03", label: "Days of Immersion" },
            { stat: "12", label: "Keynote Dialogues" },
            { stat: "01", label: "Unforgettable Gala" },
          ].map((item, i) => (
            <div key={i} className="bg-[#121212] p-8 border border-[#1a1a1a]">
              <div className="font-serif text-4xl text-[#d4af37] mb-4">{item.stat}</div>
              <div className="text-white text-sm uppercase tracking-widest">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Agenda() {
  return (
    <section className="py-32 bg-[#121212]">
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <h2 className="font-serif text-4xl text-white">The Itinerary</h2>
          <div className="flex gap-4">
            <button className="px-6 py-2 border-b-2 border-[#d4af37] text-white uppercase tracking-widest text-xs">Day 01</button>
            <button className="px-6 py-2 border-b-2 border-transparent text-[#666666] hover:text-[#a0a0a0] uppercase tracking-widest text-xs transition-colors">Day 02</button>
            <button className="px-6 py-2 border-b-2 border-transparent text-[#666666] hover:text-[#a0a0a0] uppercase tracking-widest text-xs transition-colors">Day 03</button>
          </div>
        </div>

        <div className="space-y-0">
          {[
            { time: "09:00", title: "Registration & Espresso", desc: "Arrival at The Pendry. Credentials and morning refreshments." },
            { time: "10:30", title: "The Architecture of Silence", desc: "Opening keynote by Elena Rostova on the power of negative space in physical and digital environments.", tag: "Keynote" },
            { time: "12:00", title: "Materiality & Memory", desc: "A panel discussion on how tactical materials evoke generational nostalgia.", tag: "Panel" },
            { time: "14:00", title: "Luncheon at The Atrium", desc: "Curated multi-course dining experience." },
            { time: "16:00", title: "Algorithmic Brutalism", desc: "Exploring the intersection of generative AI and imposing structural forms.", tag: "Masterclass" },
            { time: "20:00", title: "The Noir Gala", desc: "Black-tie evening reception. Cocktails, immersive soundscapes, and shadows." },
          ].map((session, i) => (
            <div key={i} className="group relative flex flex-col md:flex-row gap-8 py-8 border-t border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors -mx-8 px-8">
              <div className="w-32 flex-shrink-0 text-[#a0a0a0] font-medium tracking-widest pt-1">
                {session.time}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-4 mb-2">
                  <h3 className="text-2xl font-serif text-white group-hover:text-[#d4af37] transition-colors">{session.title}</h3>
                  {session.tag && (
                    <span className="text-[10px] uppercase tracking-widest px-2 py-1 border border-[#2a2a2a] text-[#a0a0a0]">{session.tag}</span>
                  )}
                </div>
                <p className="text-[#a0a0a0] font-light max-w-2xl">{session.desc}</p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                <ArrowRight className="text-[#d4af37]" />
              </div>
            </div>
          ))}
          <div className="border-t border-[#1a1a1a]"></div>
        </div>
      </div>
    </section>
  );
}

function Speakers() {
  return (
    <section className="py-32 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-8">
        <div className="mb-16">
          <h2 className="font-serif text-4xl text-white mb-4">The Voices</h2>
          <p className="text-[#a0a0a0] max-w-xl font-light">Curators of culture. Provocateurs of thought. Meet the minds guiding the dialogue.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { img: "noir-speaker-1.png", name: "Elena Rostova", role: "Principal Architect, Studio ER" },
            { img: "noir-speaker-2.png", name: "Marcus Chen", role: "Creative Director, Voids" },
            { img: "noir-speaker-3.png", name: "Sarah Al-Fayed", role: "Industrial Designer" },
            { img: "noir-speaker-1.png", name: "Julian Vance", role: "Editor in Chief, Aethel" },
          ].map((speaker, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative aspect-[3/4] mb-6 overflow-hidden bg-[#121212]">
                <img src={`/__mockup/images/${speaker.img}`} alt={speaker.name} className="w-full h-full object-cover filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              <h3 className="font-serif text-xl text-white mb-1 group-hover:text-[#d4af37] transition-colors">{speaker.name}</h3>
              <p className="text-sm text-[#666666] uppercase tracking-widest">{speaker.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Venue() {
  return (
    <section className="py-32 bg-[#121212]">
      <div className="max-w-6xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="relative aspect-[4/3] w-full">
          <img src="/__mockup/images/noir-venue-map.png" alt="Map" className="w-full h-full object-cover border border-[#2a2a2a]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#d4af37] rounded-full shadow-[0_0_20px_rgba(212,175,55,0.5)]">
            <div className="absolute inset-0 border border-[#d4af37] rounded-full animate-ping" />
          </div>
        </div>
        
        <div>
          <h2 className="font-serif text-4xl text-white mb-8">The Pendry</h2>
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <MapPin className="text-[#d4af37] w-6 h-6 shrink-0 mt-1" />
              <div>
                <h4 className="text-white font-medium text-lg mb-1">Address</h4>
                <p className="text-[#a0a0a0] font-light">438 W 33rd St<br/>New York, NY 10001<br/>United States</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Calendar className="text-[#d4af37] w-6 h-6 shrink-0 mt-1" />
              <div>
                <h4 className="text-white font-medium text-lg mb-1">Arrival</h4>
                <p className="text-[#a0a0a0] font-light">Valet parking available at the 33rd Street entrance. Check-in begins at 9:00 AM on October 24th.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Clock className="text-[#d4af37] w-6 h-6 shrink-0 mt-1" />
              <div>
                <h4 className="text-white font-medium text-lg mb-1">Accommodation</h4>
                <p className="text-[#a0a0a0] font-light">A limited room block is available for attendees. Mention Aethel upon booking for preferred rates.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <section className="py-24 bg-[#0a0a0a] overflow-hidden">
      <div className="flex gap-4 px-4 w-[150vw] md:w-[120vw] lg:w-full lg:px-8 mx-auto -translate-x-10 lg:translate-x-0">
        {[
          { img: "noir-gallery-1.png", aspect: "aspect-[4/3]" },
          { img: "noir-gallery-2.png", aspect: "aspect-[3/4]" },
          { img: "noir-gallery-3.png", aspect: "aspect-[4/3]" },
        ].map((item, i) => (
          <div key={i} className={`relative flex-1 ${item.aspect} bg-[#121212] overflow-hidden opacity-60 hover:opacity-100 transition-opacity duration-500`}>
            <img src={`/__mockup/images/${item.img}`} alt="Gallery" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Sponsors() {
  return (
    <section className="py-24 bg-[#121212] border-t border-b border-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-8 text-center">
        <h3 className="text-[#666666] uppercase tracking-widest text-xs mb-12">In Partnership With</h3>
        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40">
          {["Vanguard", "Oblivion", "Kinetics", "Aura", "Syndicate"].map((sponsor, i) => (
            <div key={i} className="font-serif text-2xl tracking-wider text-white">{sponsor}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section className="py-32 bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-8">
        <h2 className="font-serif text-4xl text-white mb-16 text-center">Inquiries</h2>
        
        <div className="divide-y divide-[#1a1a1a]">
          {[
            { q: "What is the dress code?", a: "Daytime sessions require elevated minimalist attire (dark tones preferred). The Noir Gala on Saturday evening is strict black-tie." },
            { q: "Are tickets transferable?", a: "Invitations are non-transferable due to the curated nature of the attendee list. If you cannot attend, please notify our concierge." },
            { q: "Will sessions be recorded?", a: "No. Aethel is designed as a moment in time. No recordings will be published, encouraging unfiltered dialogue." },
            { q: "How do I secure accommodation?", a: "Upon RSVP confirmation, you will receive a secure link to access our room block at The Pendry." },
          ].map((faq, i) => (
            <details key={i} className="group py-6">
              <summary className="flex justify-between items-center cursor-pointer list-none text-xl font-serif text-white hover:text-[#d4af37] transition-colors">
                {faq.q}
                <ChevronDown className="w-5 h-5 text-[#666666] group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-4 text-[#a0a0a0] font-light leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function RSVP() {
  return (
    <section className="py-32 bg-black relative border-t border-[#1a1a1a]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.05)_0%,transparent_70%)] pointer-events-none" />
      
      <div className="max-w-3xl mx-auto px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="font-serif text-5xl text-white mb-6">Request Invitation</h2>
          <p className="text-[#a0a0a0] font-light text-lg">Attendance is strictly limited to 250 guests. Submissions will be reviewed by the committee.</p>
        </div>

        <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#666666]">First Name</label>
              <input type="text" className="w-full bg-transparent border-b border-[#2a2a2a] py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors" placeholder="Enter first name" />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#666666]">Last Name</label>
              <input type="text" className="w-full bg-transparent border-b border-[#2a2a2a] py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors" placeholder="Enter last name" />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-[#666666]">Corporate Email</label>
            <input type="email" className="w-full bg-transparent border-b border-[#2a2a2a] py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors" placeholder="name@company.com" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#666666]">Organization</label>
              <input type="text" className="w-full bg-transparent border-b border-[#2a2a2a] py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors" placeholder="Company name" />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#666666]">Title / Role</label>
              <input type="text" className="w-full bg-transparent border-b border-[#2a2a2a] py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors" placeholder="Your position" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-[#666666]">Dietary Requirements & Notes</label>
            <textarea rows={3} className="w-full bg-transparent border-b border-[#2a2a2a] py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors resize-none" placeholder="Any specifications we should be aware of..."></textarea>
          </div>

          <div className="pt-8">
            <Button className="w-full py-5">Submit Request</Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0a0a0a] pt-24 pb-12 border-t border-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <div className="font-serif text-3xl tracking-widest text-white uppercase mb-6">Aethel</div>
            <p className="text-[#666666] font-light max-w-sm">
              The premier symposium for the future of aesthetics, architecture, and design.
            </p>
          </div>
          
          <div>
            <h4 className="text-white text-sm uppercase tracking-widest mb-6">Contact</h4>
            <ul className="space-y-4 text-[#a0a0a0] font-light text-sm">
              <li>concierge@aethel.com</li>
              <li>+1 (212) 555-0199</li>
              <li>Press Inquiries</li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white text-sm uppercase tracking-widest mb-6">Social</h4>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full border border-[#2a2a2a] flex items-center justify-center text-[#a0a0a0] hover:text-[#d4af37] hover:border-[#d4af37] transition-all">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-[#2a2a2a] flex items-center justify-center text-[#a0a0a0] hover:text-[#d4af37] hover:border-[#d4af37] transition-all">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-[#2a2a2a] flex items-center justify-center text-[#a0a0a0] hover:text-[#d4af37] hover:border-[#d4af37] transition-all">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-[#1a1a1a] text-xs text-[#666666] uppercase tracking-widest">
          <div>© 2025 Aethel Symposium. All rights reserved.</div>
          <div className="flex gap-8 mt-4 md:mt-0">
            <a href="#" className="hover:text-[#a0a0a0]">Privacy Policy</a>
            <a href="#" className="hover:text-[#a0a0a0]">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function EditorialNoir() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#d4af37] selection:text-black font-sans antialiased overflow-x-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500&display=swap');
        
        :root {
          --font-serif: 'Playfair Display', serif;
          --font-sans: 'Inter', sans-serif;
        }
        
        .font-serif { font-family: var(--font-serif); }
        .font-sans { font-family: var(--font-sans); }
        
        .animate-slow-zoom {
          animation: slowZoom 20s ease-in-out infinite alternate;
        }
        
        @keyframes slowZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
      `}} />
      
      <Nav />
      <Hero />
      <Countdown />
      <About />
      <Agenda />
      <Speakers />
      <Venue />
      <Gallery />
      <Sponsors />
      <FAQ />
      <RSVP />
      <Footer />
    </div>
  );
}
