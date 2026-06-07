import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Calendar, MapPin, Clock, Users, Zap, CheckCircle2, 
  ChevronDown, ChevronUp, Star, LayoutGrid, Ticket, Building2, 
  ArrowUpRight, Plus, Minus
} from 'lucide-react';

// --- CONFIG & THEME ---
const THEME = {
  font: {
    heading: "'Space Grotesk', sans-serif",
    body: "'Inter', sans-serif",
    mono: "'Space Mono', monospace",
  },
  colors: {
    bg: '#0A0A0A',
    surface: '#121212',
    surfaceHover: '#1A1A1A',
    border: '#2A2A2A',
    primary: '#CCFF00', // Neon yellow/lime
    primaryHover: '#B3E600',
    text: {
      main: '#FFFFFF',
      muted: '#A0A0A0',
      dark: '#000000',
    }
  }
};

const BRAND = {
  name: 'FRAMEWORK',
  year: '25',
  tagline: 'The Future of System Architecture',
  date: 'October 12-14, 2025',
  location: 'San Francisco, CA',
  venue: 'The Midway / Pier 70'
};

// --- HELPER COMPONENTS ---

const Section = ({ id, className = "", children }: { id?: string, className?: string, children: React.ReactNode }) => (
  <section id={id} className={`w-full py-20 lg:py-32 ${className}`}>
    {children}
  </section>
);

const Container = ({ className = "", children }: { className?: string, children: React.ReactNode }) => (
  <div className={`max-w-7xl mx-auto px-6 md:px-12 ${className}`}>
    {children}
  </div>
);

const SectionHeader = ({ title, subtitle }: { title: string, subtitle?: string }) => (
  <div className="mb-16 md:mb-24">
    {subtitle && (
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-[1px] bg-[#CCFF00]" />
        <span className="text-[#CCFF00] font-mono text-sm tracking-wider uppercase">{subtitle}</span>
      </div>
    )}
    <h2 className="text-4xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: THEME.font.heading }}>
      {title}
    </h2>
  </div>
);

const Button = ({ 
  children, variant = 'primary', className = "", onClick, type = "button"
}: { 
  children: React.ReactNode, variant?: 'primary' | 'secondary' | 'outline', className?: string, onClick?: () => void, type?: "button" | "submit"
}) => {
  const baseStyle = "inline-flex items-center justify-center gap-2 px-8 py-4 font-mono text-sm uppercase tracking-wider transition-all duration-300 group font-bold";
  const variants = {
    primary: "bg-[#CCFF00] text-black hover:bg-white hover:text-black",
    secondary: "bg-white text-black hover:bg-[#CCFF00]",
    outline: "bg-transparent text-white border border-[#2A2A2A] hover:border-[#CCFF00] hover:text-[#CCFF00]"
  };
  
  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

// --- PAGE SECTIONS ---

const Nav = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#2A2A2A]">
    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Zap className="w-6 h-6 text-[#CCFF00]" />
        <span className="text-xl font-bold tracking-tighter" style={{ fontFamily: THEME.font.heading }}>
          {BRAND.name}<span className="text-[#CCFF00]">{BRAND.year}</span>
        </span>
      </div>
      <div className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-wider text-[#A0A0A0]">
        <a href="#about" className="hover:text-white transition-colors">About</a>
        <a href="#agenda" className="hover:text-white transition-colors">Agenda</a>
        <a href="#speakers" className="hover:text-white transition-colors">Speakers</a>
        <a href="#pricing" className="hover:text-white transition-colors">Tickets</a>
      </div>
      <Button variant="primary" className="!py-2 !px-6 hidden sm:flex" onClick={() => document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth' })}>
        Register Now
      </Button>
    </div>
  </nav>
);

const Hero = () => (
  <div className="relative pt-20 lg:min-h-screen flex flex-col lg:flex-row border-b border-[#2A2A2A]">
    {/* Left: Branding & Info */}
    <div className="w-full lg:w-[60%] p-6 md:p-12 lg:p-20 flex flex-col justify-center border-r-0 lg:border-r border-[#2A2A2A] relative overflow-hidden bg-[#0A0A0A]">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#CCFF00]/5 rounded-full blur-[120px] pointer-events-none translate-x-1/2 -translate-y-1/2" />
      
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#121212] border border-[#2A2A2A] rounded-full text-xs font-mono text-[#A0A0A0] mb-8">
          <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
          REGISTRATION NOW OPEN
        </div>
        
        <h1 className="text-6xl md:text-8xl lg:text-[7rem] font-bold leading-[0.9] tracking-tighter mb-8" style={{ fontFamily: THEME.font.heading }}>
          BUILD THE<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-[#CCFF00]">FRAMEWORK</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-[#A0A0A0] max-w-xl mb-12 font-light">
          {BRAND.tagline}. Join 2,000+ engineers, designers, and product leaders building the next generation of software.
        </p>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 border-t border-[#2A2A2A] pt-12">
          <div>
            <div className="text-[#CCFF00] mb-2"><Calendar className="w-6 h-6" /></div>
            <div className="font-bold mb-1" style={{ fontFamily: THEME.font.heading }}>OCT 12-14</div>
            <div className="text-sm text-[#A0A0A0] font-mono">2025</div>
          </div>
          <div>
            <div className="text-[#CCFF00] mb-2"><MapPin className="w-6 h-6" /></div>
            <div className="font-bold mb-1" style={{ fontFamily: THEME.font.heading }}>SAN FRANCISCO</div>
            <div className="text-sm text-[#A0A0A0] font-mono">The Midway</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="text-[#CCFF00] mb-2"><Users className="w-6 h-6" /></div>
            <div className="font-bold mb-1" style={{ fontFamily: THEME.font.heading }}>2,000+</div>
            <div className="text-sm text-[#A0A0A0] font-mono">Attendees</div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Right: Visual / Registration Card */}
    <div className="w-full lg:w-[40%] relative min-h-[500px] lg:min-h-0 bg-[#121212]">
      <div className="absolute inset-0 z-0">
        <img 
          src="/__mockup/images/framework-hero.png" 
          alt="Conference Stage" 
          className="w-full h-full object-cover opacity-50 grayscale mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-l from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
      </div>
      
      {/* Sticky RSVP Card */}
      <div className="absolute inset-0 z-10 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] p-8 shadow-2xl backdrop-blur-xl group hover:border-[#CCFF00]/50 transition-colors duration-500">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-sm font-mono text-[#CCFF00] mb-2">EARLY BIRD PASS</div>
              <div className="text-4xl font-bold" style={{ fontFamily: THEME.font.heading }}>$499</div>
              <div className="text-sm text-[#A0A0A0] line-through">$899 Standard</div>
            </div>
            <Ticket className="w-8 h-8 text-[#2A2A2A] group-hover:text-[#CCFF00] transition-colors" />
          </div>
          
          <ul className="space-y-4 mb-8">
            {['All 3 days of keynotes & tracks', 'Access to recorded sessions', 'Exclusive networking events', 'Lunch & beverages included'].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[#A0A0A0]">
                <CheckCircle2 className="w-5 h-5 text-[#CCFF00] shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          
          <Button className="w-full" onClick={() => document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth' })}>
            Secure Your Spot <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
          <div className="mt-4 text-center text-xs font-mono text-[#A0A0A0]">
            Prices increase in 14 days
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CountdownBar = () => {
  const [timeLeft, setTimeLeft] = useState({ d: 45, h: 12, m: 30, s: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { d, h, m, s } = prev;
        if (s > 0) s--;
        else { s = 59; if (m > 0) m--; else { m = 59; if (h > 0) h--; else { h = 23; if (d > 0) d--; } } }
        return { d, h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="border-b border-[#2A2A2A] bg-[#121212] py-4 overflow-hidden relative flex items-center">
      {/* Marquee effect */}
      <div className="flex whitespace-nowrap animate-[marquee_20s_linear_infinite] opacity-20 pointer-events-none absolute inset-0 items-center">
        {[...Array(10)].map((_, i) => (
          <span key={i} className="text-4xl font-bold px-4" style={{ fontFamily: THEME.font.heading }}>
            TICKETS SELLING FAST • LIMITED CAPACITY • 
          </span>
        ))}
      </div>
      
      <Container className="relative z-10 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-[#A0A0A0] font-mono text-sm">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>CAPACITY ALMOST REACHED</span>
        </div>
        
        <div className="flex items-center gap-6 font-mono">
          {[
            { label: 'DAYS', value: timeLeft.d },
            { label: 'HRS', value: timeLeft.h },
            { label: 'MIN', value: timeLeft.m },
            { label: 'SEC', value: timeLeft.s }
          ].map((unit, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="text-2xl font-bold text-white">{unit.value.toString().padStart(2, '0')}</div>
              <div className="text-[10px] text-[#A0A0A0]">{unit.label}</div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
};

const ValueProps = () => {
  const props = [
    { title: "Deep Technical Dives", desc: "No fluff, no marketing pitches. Pure technical sessions led by engineers who built the systems you use daily.", icon: <LayoutGrid className="w-8 h-8" /> },
    { title: "Hands-on Workshops", desc: "Bring your laptop. Build alongside experts in 2-hour focused workshops covering the latest frameworks.", icon: <Zap className="w-8 h-8" /> },
    { title: "High-Signal Networking", desc: "Curated peer groups, roundtables, and intimate dinners to connect you with the right people.", icon: <Users className="w-8 h-8" /> },
  ];

  return (
    <Section id="about" className="bg-[#0A0A0A] border-b border-[#2A2A2A]">
      <Container>
        <SectionHeader subtitle="Why Attend" title="Beyond the surface." />
        <div className="grid md:grid-cols-3 gap-8">
          {props.map((prop, i) => (
            <div key={i} className="p-8 border border-[#2A2A2A] bg-[#121212] hover:border-[#CCFF00] transition-colors group">
              <div className="text-[#A0A0A0] group-hover:text-[#CCFF00] transition-colors mb-6">
                {prop.icon}
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ fontFamily: THEME.font.heading }}>{prop.title}</h3>
              <p className="text-[#A0A0A0] leading-relaxed">{prop.desc}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};

const Agenda = () => {
  const [activeDay, setActiveDay] = useState(1);
  
  const schedule = {
    1: [
      { time: "09:00 AM", title: "Registration & Breakfast", type: "General", speaker: "" },
      { time: "10:00 AM", title: "Keynote: The Post-Serverless Era", type: "Keynote", speaker: "Dr. Sarah Chen" },
      { time: "11:30 AM", title: "Building Local-First Applications", type: "Track A", speaker: "Marcus Reynolds" },
      { time: "11:30 AM", title: "State Machines in Production", type: "Track B", speaker: "Elena Rostova" },
      { time: "01:00 PM", title: "Lunch Break", type: "General", speaker: "" },
      { time: "02:30 PM", title: "WebAssembly Beyond the Browser", type: "Track A", speaker: "David Kim" },
    ],
    2: [
      { time: "09:30 AM", title: "Keynote: The AI-Assisted Developer", type: "Keynote", speaker: "Alex Vance" },
      { time: "11:00 AM", title: "React Server Components Deep Dive", type: "Track A", speaker: "Sarah Chen" },
      { time: "02:00 PM", title: "Workshop: Building Your First Agent", type: "Workshop", speaker: "Team" },
    ],
    3: [
      { time: "10:00 AM", title: "Closing Keynote: What's Next?", type: "Keynote", speaker: "Industry Panel" },
      { time: "12:00 PM", title: "Farewell Brunch", type: "General", speaker: "" },
    ]
  };

  return (
    <Section id="agenda" className="bg-[#121212] border-b border-[#2A2A2A]">
      <Container>
        <SectionHeader subtitle="Schedule" title="Three days of intensity." />
        
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Tabs */}
          <div className="lg:w-1/4 flex flex-row lg:flex-col gap-4 overflow-x-auto pb-4 lg:pb-0 hide-scrollbar">
            {[1, 2, 3].map(day => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`text-left px-6 py-4 border transition-all whitespace-nowrap font-mono uppercase tracking-wider ${
                  activeDay === day 
                    ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]' 
                    : 'border-[#2A2A2A] text-[#A0A0A0] hover:border-white hover:text-white'
                }`}
              >
                <div className="text-xs mb-1">Oct {day + 11}</div>
                <div className="text-xl font-bold">Day {day}</div>
              </button>
            ))}
          </div>
          
          {/* Schedule List */}
          <div className="lg:w-3/4 space-y-4">
            {schedule[activeDay as keyof typeof schedule].map((item, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-4 sm:gap-8 p-6 border border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#4A4A4A] transition-colors group">
                <div className="sm:w-32 font-mono text-[#CCFF00] shrink-0 pt-1">
                  {item.time}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono px-2 py-1 bg-[#2A2A2A] text-[#A0A0A0] rounded-sm">
                      {item.type}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold mb-2 group-hover:text-[#CCFF00] transition-colors" style={{ fontFamily: THEME.font.heading }}>
                    {item.title}
                  </h4>
                  {item.speaker && (
                    <div className="text-[#A0A0A0] text-sm flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#2A2A2A]" />
                      {item.speaker}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
};

const Speakers = () => {
  const speakers = [
    { name: "Dr. Sarah Chen", role: "VP Engineering, CloudScale", img: "/__mockup/images/framework-speaker1.png" },
    { name: "Marcus Reynolds", role: "Creator of LocalDB", img: "/__mockup/images/framework-speaker2.png" },
    { name: "Elena Rostova", role: "Principal Architect, Nexus", img: "/__mockup/images/framework-speaker3.png" },
    { name: "David Kim", role: "Lead Dev, Wasm Foundation", img: "/__mockup/images/framework-speaker4.png" },
  ];

  return (
    <Section id="speakers" className="bg-[#0A0A0A] border-b border-[#2A2A2A]">
      <Container>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 md:mb-24 gap-8">
          <SectionHeader title="The Architects." subtitle="Speakers" />
          <Button variant="outline" className="mb-4">View All Speakers</Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {speakers.map((speaker, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative aspect-square mb-6 overflow-hidden border border-[#2A2A2A] bg-[#121212]">
                <img 
                  src={speaker.img} 
                  alt={speaker.name} 
                  className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                />
                <div className="absolute inset-0 border-[4px] border-transparent group-hover:border-[#CCFF00] transition-colors duration-500 pointer-events-none z-10" />
              </div>
              <h4 className="text-xl font-bold mb-1 group-hover:text-[#CCFF00] transition-colors" style={{ fontFamily: THEME.font.heading }}>
                {speaker.name}
              </h4>
              <p className="text-sm text-[#A0A0A0] font-mono">{speaker.role}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};

const Venue = () => (
  <Section className="py-0 border-b border-[#2A2A2A] bg-[#121212]">
    <div className="flex flex-col lg:flex-row">
      <div className="w-full lg:w-1/2 p-6 md:p-12 lg:p-24 flex flex-col justify-center">
        <SectionHeader subtitle="The Venue" title="The Midway." />
        <p className="text-xl text-[#A0A0A0] mb-8 font-light">
          A dynamic, multi-room complex located in San Francisco's Dogpatch neighborhood. Industrial architecture meets bleeding-edge production.
        </p>
        <ul className="space-y-6 font-mono text-sm">
          <li className="flex items-start gap-4">
            <Building2 className="w-6 h-6 text-[#CCFF00]" />
            <div>
              <div className="text-white mb-1">Address</div>
              <div className="text-[#A0A0A0]">900 Marin St<br/>San Francisco, CA 94124</div>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <MapPin className="w-6 h-6 text-[#CCFF00]" />
            <div>
              <div className="text-white mb-1">Getting There</div>
              <div className="text-[#A0A0A0]">15 min from SFO<br/>Muni T-Third Line</div>
            </div>
          </li>
        </ul>
      </div>
      <div className="w-full lg:w-1/2 min-h-[500px] relative border-l-0 lg:border-l border-[#2A2A2A]">
        <img 
          src="/__mockup/images/framework-venue.png" 
          alt="Venue Interior" 
          className="absolute inset-0 w-full h-full object-cover grayscale mix-blend-luminosity opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-[#121212] via-transparent to-transparent" />
      </div>
    </div>
  </Section>
);

const GalleryAndSponsors = () => (
  <Section className="bg-[#0A0A0A] border-b border-[#2A2A2A] overflow-hidden">
    {/* Sponsors */}
    <div className="border-b border-[#2A2A2A] pb-20 mb-20">
      <Container>
        <p className="text-center font-mono text-sm text-[#A0A0A0] uppercase tracking-widest mb-12">
          Backed by industry leaders
        </p>
        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-50 grayscale">
          {['Vercel', 'Stripe', 'Supabase', 'Linear', 'Raycast'].map((sponsor, i) => (
            <div key={i} className="text-2xl font-bold font-mono tracking-tighter">{sponsor}</div>
          ))}
        </div>
      </Container>
    </div>

    {/* Gallery */}
    <div className="flex gap-4 px-4 overflow-x-auto hide-scrollbar pb-8">
      {[
        "/__mockup/images/framework-gallery1.png",
        "/__mockup/images/framework-hero.png",
        "/__mockup/images/framework-gallery2.png"
      ].map((src, i) => (
        <div key={i} className={`shrink-0 w-[80vw] md:w-[60vw] lg:w-[40vw] aspect-video border border-[#2A2A2A] bg-[#121212] relative overflow-hidden group ${i % 2 === 0 ? 'mt-8' : ''}`}>
          <img 
            src={src} 
            alt="Event Gallery" 
            className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 scale-105 group-hover:scale-100"
          />
        </div>
      ))}
    </div>
  </Section>
);

const Pricing = () => {
  const tiers = [
    {
      name: "Standard",
      price: "899",
      desc: "Full access to the 3-day conference experience.",
      features: ["All keynotes & track sessions", "Breakfast & Lunch included", "Access to sponsor floor", "Official afterparty access"],
      highlight: false
    },
    {
      name: "Premium",
      price: "1499",
      desc: "For those who want deep access and comfort.",
      features: ["Everything in Standard", "Reserved front-row seating", "VIP Speaker Lounge access", "Exclusive dinner with speakers", "Fast-track registration"],
      highlight: true
    }
  ];

  return (
    <Section id="pricing" className="bg-[#121212] border-b border-[#2A2A2A]">
      <Container>
        <SectionHeader subtitle="Tickets" title="Secure your access." />
        
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier, i) => (
            <div key={i} className={`p-8 md:p-12 border flex flex-col ${
              tier.highlight 
                ? 'border-[#CCFF00] bg-[#0A0A0A] relative' 
                : 'border-[#2A2A2A] bg-[#0A0A0A]'
            }`}>
              {tier.highlight && (
                <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#CCFF00] text-black font-mono text-xs font-bold px-3 py-1 uppercase tracking-wider">
                  Recommended
                </div>
              )}
              
              <div className="mb-8 border-b border-[#2A2A2A] pb-8">
                <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: THEME.font.heading }}>{tier.name}</h3>
                <p className="text-[#A0A0A0] text-sm mb-6 h-10">{tier.desc}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl text-[#A0A0A0]">$</span>
                  <span className="text-6xl font-bold tracking-tighter" style={{ fontFamily: THEME.font.heading }}>{tier.price}</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-12 flex-1">
                {tier.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${tier.highlight ? 'text-[#CCFF00]' : 'text-[#A0A0A0]'}`} />
                    <span className="text-sm text-white">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                variant={tier.highlight ? 'primary' : 'outline'} 
                className="w-full"
                onClick={() => document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Select {tier.name}
              </Button>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};

const FAQ = () => {
  const faqs = [
    { q: "Is there a virtual attendance option?", a: "No, FRAMEWORK is designed to be an immersive, in-person experience. We will release recorded sessions to attendees after the event." },
    { q: "Can I transfer my ticket?", a: "Yes, ticket transfers are allowed up to 14 days before the event. Please email our support team to process the transfer." },
    { q: "Do you offer diversity scholarships?", a: "Yes, we have allocated 50 scholarship tickets. Applications open next month. Subscribe to our newsletter for updates." },
    { q: "What's the refund policy?", a: "Full refunds are available until 30 days prior to the event. After that, no refunds will be issued but transfers are permitted." }
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section className="bg-[#0A0A0A] border-b border-[#2A2A2A]">
      <Container>
        <div className="flex flex-col lg:flex-row gap-16">
          <div className="lg:w-1/3">
            <SectionHeader subtitle="FAQ" title="Got questions?" />
            <p className="text-[#A0A0A0]">Need something else? Reach out to <br/><a href="#" className="text-white hover:text-[#CCFF00] underline underline-offset-4 decoration-[#2A2A2A] hover:decoration-[#CCFF00] transition-colors">hello@framework.dev</a></p>
          </div>
          
          <div className="lg:w-2/3 space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-[#2A2A2A] bg-[#121212]">
                <button 
                  className="w-full flex items-center justify-between p-6 text-left"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                >
                  <span className="font-bold text-lg" style={{ fontFamily: THEME.font.heading }}>{faq.q}</span>
                  {openIndex === i ? <Minus className="w-5 h-5 text-[#CCFF00]" /> : <Plus className="w-5 h-5 text-[#A0A0A0]" />}
                </button>
                {openIndex === i && (
                  <div className="px-6 pb-6 text-[#A0A0A0] leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
};

const RsvpForm = () => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <Section id="rsvp" className="bg-[#121212] border-b border-[#2A2A2A] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#CCFF00]/5 rounded-full blur-[120px] pointer-events-none" />
      
      <Container className="relative z-10">
        <div className="max-w-3xl mx-auto border border-[#2A2A2A] bg-[#0A0A0A] p-8 md:p-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tighter" style={{ fontFamily: THEME.font.heading }}>
              JOIN THE <span className="text-[#CCFF00]">REVOLUTION</span>
            </h2>
            <p className="text-[#A0A0A0]">Complete your registration below. Payment will be collected securely on the next step.</p>
          </div>

          {submitted ? (
            <div className="text-center py-12 border border-[#CCFF00]/30 bg-[#CCFF00]/5">
              <CheckCircle2 className="w-16 h-16 text-[#CCFF00] mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">Registration Started</h3>
              <p className="text-[#A0A0A0]">Check your email for the payment link to secure your spot.</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#A0A0A0]">First Name</label>
                  <input required type="text" className="w-full bg-[#121212] border border-[#2A2A2A] px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#A0A0A0]">Last Name</label>
                  <input required type="text" className="w-full bg-[#121212] border border-[#2A2A2A] px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors" />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-[#A0A0A0]">Work Email</label>
                <input required type="email" className="w-full bg-[#121212] border border-[#2A2A2A] px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors" />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-[#A0A0A0]">Company</label>
                <input required type="text" className="w-full bg-[#121212] border border-[#2A2A2A] px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors" />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-[#A0A0A0]">Select Pass</label>
                <select className="w-full bg-[#121212] border border-[#2A2A2A] px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors appearance-none">
                  <option value="standard">Standard Pass - $899</option>
                  <option value="premium">Premium Pass - $1499</option>
                </select>
              </div>

              <div className="pt-6">
                <Button type="submit" className="w-full !py-6 text-lg">
                  Continue to Payment <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </form>
          )}
        </div>
      </Container>
    </Section>
  );
};

const Footer = () => (
  <footer className="bg-[#0A0A0A] py-12 border-t flex flex-col" style={{ borderColor: THEME.colors.primary }}>
    <Container className="w-full">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
        <div className="flex items-center gap-2">
          <Zap className="w-8 h-8 text-[#CCFF00]" />
          <span className="text-3xl font-bold tracking-tighter" style={{ fontFamily: THEME.font.heading }}>
            {BRAND.name}<span className="text-[#CCFF00]">{BRAND.year}</span>
          </span>
        </div>
        
        <div className="flex gap-8 font-mono text-sm uppercase tracking-wider text-[#A0A0A0]">
          <a href="#" className="hover:text-white transition-colors">Twitter</a>
          <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
          <a href="#" className="hover:text-white transition-colors">Code of Conduct</a>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[#A0A0A0] font-mono border-t border-[#2A2A2A] pt-8">
        <div>© 2025 Framework Events LLC. All rights reserved.</div>
        <div className="flex items-center gap-2">
          Designed for <span className="text-white">Builders</span>
        </div>
      </div>
    </Container>
  </footer>
);

export function SplitConference() {
  return (
    <div className="min-h-screen text-white selection:bg-[#CCFF00] selection:text-black overflow-x-hidden" style={{ backgroundColor: THEME.colors.bg, fontFamily: THEME.font.body }}>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      
      {/* Global minimal styles injected via styled-jsx approach for isolation */}
      <style dangerouslySetInnerHTML={{__html: `
        html { scroll-behavior: smooth; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}} />

      <Nav />
      <Hero />
      <CountdownBar />
      <ValueProps />
      <Agenda />
      <Speakers />
      <Venue />
      <GalleryAndSponsors />
      <Pricing />
      <FAQ />
      <RsvpForm />
      <Footer />
    </div>
  );
}
