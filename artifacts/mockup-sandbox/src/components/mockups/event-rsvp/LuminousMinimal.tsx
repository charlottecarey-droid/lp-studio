import React, { useState, useEffect } from "react";
import { ChevronDown, MapPin, Calendar, Clock, ArrowRight, CheckCircle2, Menu, X } from "lucide-react";

const BRAND_NAME = "Aura Summit";
const BRAND_COLOR = "#4f46e5"; // Indigo-600

export function LuminousMinimal() {
  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] font-sans antialiased overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * {
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .smooth-shadow {
          box-shadow: 0 20px 40px -15px rgba(0,0,0,0.05);
        }
      `}} />

      <Nav />
      <main>
        <Hero />
        <Countdown />
        <Overview />
        <Agenda />
        <Speakers />
        <Venue />
        <PhotoGallery />
        <Sponsors />
        <FAQ />
        <RSVPForm />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'}`}>
      <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          <span className="font-bold text-xl tracking-tight">{BRAND_NAME}</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#about" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">About</a>
          <a href="#agenda" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Agenda</a>
          <a href="#speakers" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Speakers</a>
          <a href="#rsvp" className="text-sm font-semibold bg-slate-900 text-white px-5 py-2.5 rounded-full hover:bg-indigo-600 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5">
            Register Now
          </a>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-slate-900" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-slate-100 shadow-lg p-6 flex flex-col gap-4 md:hidden">
          <a href="#about" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>About</a>
          <a href="#agenda" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Agenda</a>
          <a href="#speakers" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Speakers</a>
          <a href="#rsvp" className="text-lg font-semibold bg-indigo-600 text-white text-center py-3 rounded-xl mt-2" onClick={() => setMobileMenuOpen(false)}>
            Register Now
          </a>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 right-0 w-3/4 h-[800px] bg-indigo-50/50 rounded-bl-[100px] -z-10 translate-x-1/4 -translate-y-1/4 blur-3xl mix-blend-multiply"></div>
      <div className="absolute bottom-0 left-0 w-1/2 h-[500px] bg-blue-50/50 rounded-tr-[100px] -z-10 -translate-x-1/4 translate-y-1/4 blur-3xl mix-blend-multiply"></div>

      <div className="container mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold tracking-wider uppercase mb-8 border border-indigo-100">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Oct 12-14 • San Francisco
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
            Design the <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">future of work.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-lg font-light">
            Join visionary leaders and creators for three days of immersive keynotes, workshops, and luminous connections.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="#rsvp" className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-indigo-700 transition-all shadow-[0_10px_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_10px_40px_-5px_rgba(79,70,229,0.6)] hover:-translate-y-1">
              Secure Your Spot
              <ArrowRight size={18} />
            </a>
            <a href="#agenda" className="inline-flex items-center justify-center px-8 py-4 rounded-full text-base font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
              View Agenda
            </a>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100 to-transparent rounded-[2rem] transform translate-x-4 translate-y-4 -z-10"></div>
          <img 
            src="/__mockup/images/luminous-hero.png" 
            alt="Abstract geometric art" 
            className="w-full h-auto rounded-[2rem] shadow-2xl object-cover aspect-[4/3] md:aspect-square lg:aspect-[4/3]"
          />
        </div>
      </div>
    </section>
  );
}

function Countdown() {
  return (
    <section className="py-12 border-y border-slate-100 bg-white">
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-1">Registration Closes Soon</h3>
            <p className="text-slate-500 text-sm">Don't miss the flagship design event of the year.</p>
          </div>
          <div className="flex gap-4 md:gap-8">
            {[
              { label: 'Days', value: '14' },
              { label: 'Hours', value: '08' },
              { label: 'Mins', value: '45' },
              { label: 'Secs', value: '22' }
            ].map((unit, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="text-3xl md:text-5xl font-bold text-indigo-600 mb-1 font-mono tracking-tight">{unit.value}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{unit.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Overview() {
  return (
    <section id="about" className="py-24 bg-[#fafbfc]">
      <div className="container mx-auto px-6 md:px-12">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">Clarity through design.</h2>
          <p className="text-lg text-slate-600 font-light leading-relaxed">
            Aura Summit brings together the brightest minds in product, engineering, and design. We believe that luminous, minimalist thinking leads to maximal impact. Over three days, we'll strip away the noise and focus on what truly matters.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            { stat: "50+", label: "Visionary Speakers", desc: "Learn from industry pioneers." },
            { stat: "3", label: "Immersive Days", desc: "Workshops, keynotes, and mixers." },
            { stat: "1,200", label: "Attendees", desc: "A curated group of peers." },
          ].map((item, i) => (
            <div key={i} className="bg-white p-8 rounded-3xl smooth-shadow text-center border border-slate-50 hover:-translate-y-1 transition-transform duration-300">
              <div className="text-4xl font-extrabold text-indigo-600 mb-2">{item.stat}</div>
              <div className="text-lg font-semibold text-slate-900 mb-2">{item.label}</div>
              <div className="text-sm text-slate-500">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Agenda() {
  const [activeDay, setActiveDay] = useState(1);
  
  const schedule = [
    { time: "09:00 AM", title: "Registration & Morning Coffee", speaker: null, type: "break" },
    { time: "10:00 AM", title: "The Luminous Interface: Designing for Clarity", speaker: "Elena Rostova, VP Design", type: "keynote" },
    { time: "11:30 AM", title: "Whitespace as a Feature", speaker: "Marcus Chen", type: "session" },
    { time: "12:45 PM", title: "Networking Lunch", speaker: null, type: "break" },
    { time: "02:00 PM", title: "Panel: The Post-Screen Era", speaker: "Hosted by Sarah Jenkins", type: "panel" },
  ];

  return (
    <section id="agenda" className="py-24 bg-white">
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">Agenda</h2>
            <p className="text-lg text-slate-600 font-light">Carefully curated sessions to maximize your inspiration.</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-full w-fit">
            {[1, 2, 3].map(day => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  activeDay === day 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Day {day}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative border-l border-slate-200 ml-4 md:ml-[120px]">
            {schedule.map((item, i) => (
              <div key={i} className="relative pl-8 md:pl-12 py-6 group">
                {/* Timeline Dot */}
                <div className="absolute left-[-5px] top-10 w-2.5 h-2.5 rounded-full bg-slate-200 group-hover:bg-indigo-600 transition-colors"></div>
                
                <div className="flex flex-col md:flex-row gap-4 md:gap-12">
                  <div className="md:absolute md:left-[-120px] md:top-8 text-sm font-semibold text-indigo-600 bg-indigo-50 md:bg-transparent px-3 py-1 rounded-full md:p-0 w-fit">
                    {item.time}
                  </div>
                  <div className="bg-slate-50/50 hover:bg-slate-50 p-6 rounded-2xl flex-1 border border-slate-100 transition-colors">
                    <h4 className="text-xl font-semibold text-slate-900 mb-2">{item.title}</h4>
                    {item.speaker && (
                      <p className="text-slate-500 text-sm flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        {item.speaker}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Speakers() {
  const speakers = [
    { name: "Elena Rostova", role: "VP Design, Studio X", img: "https://i.pravatar.cc/300?img=44" },
    { name: "Marcus Chen", role: "Founder, Minimalist", img: "https://i.pravatar.cc/300?img=11" },
    { name: "Sarah Jenkins", role: "Head of Product, Vibe", img: "https://i.pravatar.cc/300?img=5" },
    { name: "David Alvord", role: "Creative Director", img: "https://i.pravatar.cc/300?img=33" },
    { name: "Maya Patel", role: "Author, 'The Calm Web'", img: "https://i.pravatar.cc/300?img=9" },
    { name: "James Wilson", role: "Lead Engineer, Core", img: "https://i.pravatar.cc/300?img=12" },
  ];

  return (
    <section id="speakers" className="py-24 bg-[#fafbfc]">
      <div className="container mx-auto px-6 md:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">Speakers</h2>
          <p className="text-lg text-slate-600 font-light">Industry leaders sharing their craft.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {speakers.map((s, i) => (
            <div key={i} className="group relative overflow-hidden rounded-3xl aspect-[4/5] bg-slate-100 cursor-pointer">
              <img src={s.img} alt={s.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute bottom-0 left-0 right-0 p-8 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <h3 className="text-2xl font-bold text-white mb-1">{s.name}</h3>
                <p className="text-white/80 text-sm font-medium">{s.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Venue() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">The Space</h2>
            <p className="text-lg text-slate-600 font-light mb-8 leading-relaxed">
              Hosted at the stunning Lumin Venue in downtown San Francisco. 
              A space designed to let natural light in and keep distractions out.
            </p>
            
            <div className="space-y-6 mb-10">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <MapPin className="text-indigo-600 w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Lumin Venue</h4>
                  <p className="text-slate-500">100 Bright St, San Francisco, CA 94105</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <Calendar className="text-indigo-600 w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">October 12-14, 2024</h4>
                  <p className="text-slate-500">Three days of immersive programming</p>
                </div>
              </div>
            </div>
            
            <img src="/__mockup/images/luminous-map.png" alt="Map" className="w-full max-w-md rounded-2xl border border-slate-100 shadow-sm" />
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative">
               <div className="absolute -inset-4 bg-slate-50 rounded-[2.5rem] -z-10"></div>
               <img src="/__mockup/images/luminous-venue.png" alt="Venue Interior" className="w-full rounded-[2rem] shadow-xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoGallery() {
  return (
    <section className="py-12 bg-slate-900 overflow-hidden">
      <div className="flex gap-4 px-4 overflow-x-auto snap-x hide-scrollbar pb-8 pt-4">
        {[
          "/__mockup/images/luminous-gallery-1.png",
          "/__mockup/images/luminous-gallery-2.png",
          "/__mockup/images/luminous-gallery-3.png",
        ].map((img, i) => (
          <img 
            key={i} 
            src={img} 
            alt="Gallery image" 
            className="h-64 md:h-80 w-auto rounded-2xl object-cover shrink-0 snap-center shadow-lg" 
          />
        ))}
      </div>
    </section>
  );
}

function Sponsors() {
  return (
    <section className="py-24 bg-white border-b border-slate-100">
      <div className="container mx-auto px-6 md:px-12 text-center">
        <p className="text-sm font-bold tracking-widest text-slate-400 uppercase mb-12">Supported by industry leaders</p>
        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          {/* Fictional Logos */}
          {['Nexus', 'Orbit', 'Vertex', 'Zephyr', 'Axiom'].map((brand, i) => (
            <div key={i} className="text-2xl font-black tracking-tighter text-slate-800">
              {brand}.
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    { q: "What's included in the ticket?", a: "Your ticket includes access to all keynotes, workshops, networking events, breakfast, lunch, and the evening mixer. Accommodation is not included." },
    { q: "Is there a virtual option?", a: "To maintain the intimacy and immersive nature of the event, Aura Summit is exclusively in-person." },
    { q: "Can I transfer my ticket?", a: "Yes, tickets can be transferred up to 14 days before the event. Please contact our support team." },
    { q: "Are there group discounts?", a: "We offer a 15% discount for groups of 3 or more from the same company. The discount is applied automatically at checkout." },
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="py-24 bg-[#fafbfc]">
      <div className="container mx-auto px-6 md:px-12 max-w-3xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">Questions?</h2>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <button 
                className="w-full px-6 py-6 text-left flex justify-between items-center focus:outline-none"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <span className="font-semibold text-slate-900">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
              </button>
              {openIdx === i && (
                <div className="px-6 pb-6 text-slate-600 font-light text-sm leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RSVPForm() {
  return (
    <section id="rsvp" className="py-32 bg-white relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-50 rounded-full blur-[100px] -z-10"></div>

      <div className="container mx-auto px-6 md:px-12">
        <div className="max-w-xl mx-auto bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Reserve Your Pass</h2>
            <p className="text-slate-500 font-light text-sm">Join 1,200+ leaders. Spots are strictly limited.</p>
          </div>

          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">First Name</label>
                <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 outline-none transition-all" placeholder="Jane" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last Name</label>
                <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 outline-none transition-all" placeholder="Doe" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Work Email</label>
              <input type="email" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 outline-none transition-all" placeholder="jane@company.com" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company</label>
              <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 outline-none transition-all" placeholder="Acme Inc." />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ticket Type</label>
              <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 outline-none transition-all appearance-none text-slate-700">
                <option>General Admission - $499</option>
                <option>VIP Pass - $899</option>
                <option>Virtual Only - $149</option>
              </select>
            </div>

            <div className="pt-4">
              <button className="w-full bg-slate-900 text-white font-semibold py-4 rounded-xl hover:bg-indigo-600 transition-colors shadow-md">
                Complete Registration
              </button>
              <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
                <CheckCircle2 size={14} className="text-emerald-500" /> Secure SSL payment
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-16 border-t border-slate-800">
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <span className="font-bold text-white tracking-tight">{BRAND_NAME}</span>
          </div>
          
          <div className="flex gap-8 text-sm">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Code of Conduct</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
        <div className="mt-12 text-center text-xs text-slate-600">
          &copy; {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
