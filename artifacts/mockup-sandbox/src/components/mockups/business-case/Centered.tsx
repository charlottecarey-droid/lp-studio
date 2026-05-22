import React from "react";
import { ArrowRight, Check, Quote, Minus, Activity, DollarSign, Clock, LayoutGrid } from "lucide-react";

export function Centered() {
  return (
    <div className="min-h-screen bg-[#f6f5ee] text-[#102818] font-sans antialiased selection:bg-[#c8e84e] selection:text-[#0d1f15]">
      {/* 1. Hero */}
      <section className="relative flex flex-col justify-center items-center text-center bg-[#0d1f15] text-[#f6f5ee] px-6 py-20 min-h-[760px] overflow-hidden">
        <div className="absolute top-0 w-full p-6 flex justify-between items-center max-w-7xl mx-auto">
          <div className="font-['Playfair_Display'] text-2xl tracking-tight font-semibold">Dandy</div>
          <div className="text-xs uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full text-[#c8e84e]">
            For {`{company_name}`}
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto flex flex-col items-center z-10 mt-16">
          <div className="w-12 h-[2px] bg-[#c8e84e] mb-8"></div>
          <h2 className="text-[#c8e84e] text-xs font-semibold tracking-[0.2em] uppercase mb-6">The Business Case</h2>
          <h1 className="font-['Playfair_Display'] text-5xl md:text-7xl font-medium leading-[1.1] mb-8 max-w-4xl">
            The case for {`{company_name}`} and Dandy, in plain numbers.
          </h1>
          <p className="text-[#f6f5ee]/70 text-lg md:text-xl max-w-2xl mb-12 font-light">
            A comprehensive analysis of how transitioning to a fully digital lab partner impacts clinical outcomes, operational efficiency, and EBITDA at scale.
          </p>
          <div className="flex flex-col items-center gap-6">
            <button className="bg-[#c8e84e] text-[#0d1f15] px-8 py-4 rounded-none font-medium hover:bg-[#d4f068] transition-colors flex items-center gap-2 text-sm uppercase tracking-wider">
              Schedule a working session <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#" className="text-[#f6f5ee]/50 hover:text-[#c8e84e] transition-colors text-sm underline underline-offset-4 decoration-[#f6f5ee]/30 hover:decoration-[#c8e84e]">
              Read the 5-min summary →
            </a>
          </div>
        </div>
      </section>

      {/* 2. The Situation */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-5">
            <h2 className="font-['Playfair_Display'] text-4xl mb-6 text-[#0d1f15]">The Situation</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              DSOs operating at scale are encountering a structural ceiling. Legacy workflows demand massive upfront CAPEX for intraoral scanners, while managing dozens of fragmented local labs creates inconsistent clinical quality and unpredictable costs.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Meanwhile, clinical recruitment and retention have never been more competitive. Doctors expect modern, digital-first workflows that reduce chair time and eliminate frustrating remakes.
            </p>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 border border-gray-200 flex flex-col justify-between">
              <div>
                <Activity className="w-6 h-6 text-[#c8e84e] mb-4" />
                <div className="text-sm font-semibold tracking-wider text-gray-500 uppercase mb-2">Scanner CAPEX</div>
              </div>
              <div>
                <div className="font-['Playfair_Display'] text-3xl mb-2 text-[#0d1f15]">$30k+</div>
                <div className="text-sm text-gray-600">Average upfront cost per office just for hardware.</div>
              </div>
            </div>
            <div className="bg-white p-8 border border-gray-200 flex flex-col justify-between">
              <div>
                <LayoutGrid className="w-6 h-6 text-[#c8e84e] mb-4" />
                <div className="text-sm font-semibold tracking-wider text-gray-500 uppercase mb-2">Vendor Sprawl</div>
              </div>
              <div>
                <div className="font-['Playfair_Display'] text-3xl mb-2 text-[#0d1f15]">4-6</div>
                <div className="text-sm text-gray-600">Average number of lab partners a typical DSO manages.</div>
              </div>
            </div>
            <div className="bg-white p-8 border border-gray-200 flex flex-col justify-between">
              <div>
                <Clock className="w-6 h-6 text-[#c8e84e] mb-4" />
                <div className="text-sm font-semibold tracking-wider text-gray-500 uppercase mb-2">Remake Rate</div>
              </div>
              <div>
                <div className="font-['Playfair_Display'] text-3xl mb-2 text-[#0d1f15]">6-8%</div>
                <div className="text-sm text-gray-600">Industry average, resulting in unbillable chair time.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-t border-[#0d1f15]/10 max-w-7xl mx-auto" />

      {/* 3. The Signal */}
      <section className="py-24 px-6 max-w-7xl mx-auto bg-[#0f2a1c] text-[#f6f5ee] my-24 -mx-6 lg:mx-auto lg:px-16">
        <div className="mb-16">
          <h2 className="text-[#c8e84e] text-xs font-semibold tracking-[0.2em] uppercase mb-4">THE SIGNAL →</h2>
          <h3 className="font-['Playfair_Display'] text-4xl md:text-5xl max-w-3xl leading-tight">
            Doctors are demanding a better standard of care.
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-white/20 p-8">
            <div className="text-5xl font-['Playfair_Display'] text-[#c8e84e] mb-4">+312%</div>
            <p className="text-lg">Growth in Dandy removables YoY across our DSO partners.</p>
          </div>
          <div className="border border-white/20 p-8">
            <div className="text-5xl font-['Playfair_Display'] text-[#c8e84e] mb-4">1 in 3</div>
            <p className="text-lg">New clinical hires ask for Dandy by name during recruitment.</p>
          </div>
          <div className="border border-white/20 p-8 bg-white/5 relative">
            <Quote className="w-8 h-8 text-[#c8e84e]/30 absolute top-6 left-6" />
            <p className="text-lg italic font-['Playfair_Display'] relative z-10 pt-4 mb-6">
              "We realized we were losing top producers because our legacy lab workflows were frustrating them."
            </p>
            <div className="text-sm font-semibold uppercase tracking-wider text-[#c8e84e]">VP of Clinical Ops</div>
          </div>
        </div>
      </section>

      {/* 4. The Cost of Inaction */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-['Playfair_Display'] text-4xl mb-6 text-[#0d1f15]">The Cost of Inaction</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Sticking with the status quo isn't neutral. It actively erodes margin and limits growth potential.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { num: "01", stat: "7.2%", label: "Average Remake Rate", desc: "Every remake costs an estimated $350 in unbillable chair time." },
            { num: "02", stat: "1,200", label: "Lost Chair Hours / Yr", desc: "Based on an average 10-office DSO relying on analog impressions." },
            { num: "03", stat: "$35k", label: "Scanner CAPEX", desc: "Upfront capital per office that could be deployed for growth." },
            { num: "04", stat: "12+", label: "Fragmented Vendors", desc: "Creating inconsistent quality and opaque unit economics." }
          ].map((item, idx) => (
            <div key={idx} className="relative pt-12 border-t-2 border-[#0d1f15]">
              <div className="absolute top-0 left-0 -mt-[14px] bg-[#f6f5ee] pr-4 font-['Playfair_Display'] text-xl text-gray-400 italic">
                {item.num}
              </div>
              <div className="font-['Playfair_Display'] text-5xl text-[#0d1f15] mb-2">{item.stat}</div>
              <div className="font-semibold text-sm tracking-wider uppercase mb-3 text-gray-500">{item.label}</div>
              <p className="text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. The Dandy Difference */}
      <section className="py-24 bg-white border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-['Playfair_Display'] text-4xl text-[#0d1f15]">The Paradigm Shift</h2>
          </div>
          
          <div className="grid grid-cols-12 gap-8 mb-8 border-b border-gray-200 pb-4">
            <div className="col-span-4 font-semibold text-sm uppercase tracking-wider text-gray-400">Category</div>
            <div className="col-span-4 font-semibold text-sm uppercase tracking-wider text-gray-400">The Old Way</div>
            <div className="col-span-4 font-semibold text-sm uppercase tracking-wider text-[#0d1f15]">With Dandy</div>
          </div>
          
          {[
            { cat: "Turnaround Time", old: "2-3 weeks, unpredictable", new: "5-7 days, guaranteed" },
            { cat: "First-Time-Right Rate", old: "~92% industry average", new: "99% digital precision" },
            { cat: "Doctor Experience", old: "Analog impressions, blind delivery", new: "100% digital, full case visibility" },
            { cat: "Data & Visibility", old: "Zero central oversight", new: "Real-time DSO analytics dashboard" },
            { cat: "Partnership Model", old: "Transactional vendor", new: "Strategic growth partner (Zero CAPEX)" }
          ].map((row, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 py-6 border-b border-gray-100 last:border-0 items-center">
              <div className="col-span-1 md:col-span-4 font-['Playfair_Display'] text-xl text-[#0d1f15]">{row.cat}</div>
              <div className="col-span-1 md:col-span-4 text-gray-500 flex items-start gap-2">
                <Minus className="w-4 h-4 mt-1 shrink-0" /> {row.old}
              </div>
              <div className="col-span-1 md:col-span-4 bg-[#f6f5ee] p-4 border-l-4 border-[#c8e84e] text-[#0d1f15] font-medium flex items-start gap-2">
                <Check className="w-4 h-4 mt-1 text-[#c8e84e] shrink-0" /> {row.new}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. The Math */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <h2 className="font-['Playfair_Display'] text-4xl mb-4 text-[#0d1f15]">The Math</h2>
          <p className="text-xl text-gray-600">
            Based on our analysis for <span className="font-semibold text-[#0d1f15]">{`{company_name}`}</span> across <span className="font-semibold text-[#0d1f15]">{`{practice_count}`}</span> offices.
          </p>
        </div>
        
        <div className="bg-[#0d1f15] text-[#f6f5ee] p-8 md:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 pb-12 border-b border-white/20">
            <div>
              <label className="block text-xs uppercase tracking-widest text-[#c8e84e] mb-2">Number of Offices</label>
              <div className="text-3xl font-['Playfair_Display'] border-b border-white/30 pb-2">{`{practice_count}`}</div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-[#c8e84e] mb-2">Est. Monthly Restorations</label>
              <div className="text-3xl font-['Playfair_Display'] border-b border-white/30 pb-2">1,450</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="text-gray-400 text-sm mb-2">Incremental Cases / Mo</div>
              <div className="text-4xl font-['Playfair_Display'] text-[#c8e84e]">+185</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-2">Chair Hours Saved / Yr</div>
              <div className="text-4xl font-['Playfair_Display'] text-[#c8e84e]">4,200</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-2">Est. Gross Margin Uplift</div>
              <div className="text-4xl font-['Playfair_Display'] text-[#c8e84e]">+14%</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-2">Payback Period</div>
              <div className="text-4xl font-['Playfair_Display'] text-[#c8e84e]">Immediate</div>
              <div className="text-xs mt-1 text-gray-500">(Zero CAPEX model)</div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. The Proof */}
      <section className="py-24 px-6 bg-[#eae8dd]">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-['Playfair_Display'] text-4xl mb-16 text-center text-[#0d1f15]">Trusted by industry leaders</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-7 bg-white p-10 md:p-16 border-t-4 border-[#c8e84e]">
              <Quote className="w-12 h-12 text-gray-200 mb-6" />
              <p className="font-['Playfair_Display'] text-2xl md:text-3xl leading-relaxed text-[#0d1f15] mb-8">
                "Dandy didn't just digitize our labs; they fundamentally changed our unit economics. We've eliminated scanner CAPEX entirely, reduced remakes to near-zero, and our doctors couldn't be happier. It's the most compelling ROI equation in dental right now."
              </p>
              <div>
                <div className="font-semibold text-lg">Dr. Sarah Jenkins</div>
                <div className="text-gray-500">Chief Clinical Officer, Summit Smile Group (42 offices)</div>
              </div>
            </div>
            
            <div className="md:col-span-5 flex flex-col gap-8">
              <div className="bg-white p-8">
                <p className="font-['Playfair_Display'] text-xl italic text-gray-700 mb-6">
                  "Rolling out Dandy across 80 locations took less time than a single traditional hardware procurement cycle. The training is phenomenal."
                </p>
                <div>
                  <div className="font-semibold text-sm">Marcus Thorne</div>
                  <div className="text-xs text-gray-500">VP Operations, Heartland Dental Partners</div>
                </div>
              </div>
              <div className="bg-white p-8">
                <p className="font-['Playfair_Display'] text-xl italic text-gray-700 mb-6">
                  "The real-time data visibility into lab spend and remake rates across all our clinics has been a game-changer for our finance team."
                </p>
                <div>
                  <div className="font-semibold text-sm">Elena Rostova</div>
                  <div className="text-xs text-gray-500">CFO, Pacific Coast DSO</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. The Plan */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="font-['Playfair_Display'] text-4xl mb-4 text-[#0d1f15]">The Activation Plan</h2>
          <p className="text-xl text-gray-600">A derisked, systematic approach to rolling out digital workflows.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { num: "01", title: "Scope Pilot", desc: "Select 5 representative offices to establish baseline metrics.", time: "Week 1" },
            { num: "02", title: "Onboard & Train", desc: "Scanner delivery and in-person clinical training by Dandy experts.", time: "Weeks 2-4" },
            { num: "03", title: "Measure Impact", desc: "Track case acceptance, turnaround times, and doctor satisfaction.", time: "Month 2" },
            { num: "04", title: "Org-wide Rollout", desc: "Phased deployment across all remaining practices.", time: "Month 3+" }
          ].map((step, idx) => (
            <div key={idx} className="relative">
              <div className="text-[#c8e84e] font-['Playfair_Display'] text-7xl font-bold opacity-30 mb-4">{step.num}</div>
              <h4 className="font-bold text-lg mb-2">{step.title}</h4>
              <p className="text-gray-600 text-sm mb-4 min-h-[60px]">{step.desc}</p>
              <div className="text-xs uppercase tracking-widest font-semibold border-t border-gray-200 pt-4">{step.time}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="bg-[#0d1f15] text-center py-32 px-6">
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          <h2 className="font-['Playfair_Display'] text-4xl md:text-6xl text-[#f6f5ee] mb-6 leading-tight">
            Let's build the business case for {`{company_name}`}.
          </h2>
          <p className="text-[#f6f5ee]/70 text-lg mb-10">
            Schedule a 45-minute working session with our enterprise team to run your specific numbers through our ROI model.
          </p>
          <div className="flex flex-col items-center gap-6">
            <button className="bg-[#c8e84e] text-[#0d1f15] px-8 py-4 rounded-none font-medium hover:bg-[#d4f068] transition-colors flex items-center gap-2 text-sm uppercase tracking-wider">
              Schedule a working session <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#" className="text-[#f6f5ee]/50 hover:text-[#c8e84e] transition-colors text-sm underline underline-offset-4 decoration-[#f6f5ee]/30 hover:decoration-[#c8e84e]">
              or download the one-pager
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Centered;