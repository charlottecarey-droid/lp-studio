import React, { useState } from "react";
import { ArrowRight, Check, Quote, Minus, BarChart3, TrendingUp, Users, Activity } from "lucide-react";

export function Split() {
  return (
    <div className="min-h-screen bg-[#f6f5ee] text-slate-800 font-sans selection:bg-[#c8e84e] selection:text-[#0d1f15]">
      {/* 1. Hero */}
      <section className="relative w-full h-[720px] flex overflow-hidden bg-[#0d1f15]">
        {/* Left Col */}
        <div className="w-[55%] h-full flex flex-col justify-between p-12 lg:p-20 z-10">
          <nav className="flex items-center justify-between">
            {/* Dandy Logo Placeholder */}
            <div className="text-white text-2xl font-bold tracking-tight">
              Dandy
            </div>
            <div className="px-4 py-1.5 rounded-full border border-white/20 text-white/80 text-xs font-medium uppercase tracking-wider">
              For {`{company_name}`}
            </div>
          </nav>
          
          <div className="max-w-2xl mt-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px w-8 bg-[#c8e84e]"></div>
              <span className="text-[#c8e84e] text-xs font-bold tracking-[0.2em] uppercase">
                The Business Case
              </span>
            </div>
            <h1 className="text-white text-5xl lg:text-6xl xl:text-7xl leading-[1.05] tracking-tight mb-8">
              Building the business case for {`{company_name}`}'s next chapter.
            </h1>
            <p className="text-white/70 text-lg md:text-xl font-light leading-relaxed max-w-xl mb-12">
              The DSO landscape is shifting from fragmented vendor management to centralized, digital-first clinical operations. Here is how leading groups are capitalizing on the change.
            </p>
            <div className="flex items-center gap-6">
              <button className="bg-[#c8e84e] hover:bg-[#b5d53c] text-[#0d1f15] px-8 py-4 text-sm font-semibold tracking-wide uppercase transition-colors duration-300">
                Schedule a working session
              </button>
              <button className="text-white/70 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors">
                Read the 5-min summary <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Col */}
        <div className="w-[45%] h-full absolute right-0 top-0">
          <img 
            src="/__mockup/images/dental-professional.png" 
            alt="Dental Professional"
            className="w-full h-full object-cover object-center mix-blend-luminosity opacity-80"
          />
          <div className="absolute inset-0 bg-[#0d1f15]/20 mix-blend-overlay"></div>
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0d1f15] to-transparent"></div>
        </div>
      </section>

      {/* 2. The Situation */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center gap-4 mb-16">
          <span className="text-black/40 text-xl italic">01</span>
          <h2 className="text-[#0f2a1c] text-4xl lg:text-5xl">The Situation</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-5">
            <p className="text-xl leading-relaxed text-slate-700 font-light">
              Scaling a DSO today requires more than just acquiring practices. It demands standardizing clinical quality across hundreds of chairs while managing capital expenditure. Fragmented labs, varying scanner ecosystems, and high remake rates are silently eroding gross margins and frustrating providers. The model must evolve.
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 flex flex-col justify-center gap-8">
            <div className="border-l-2 border-[#c8e84e] pl-6 py-1">
              <div className="text-3xl text-[#0f2a1c] mb-2">$40k+</div>
              <div className="text-sm font-medium uppercase tracking-wider text-slate-500">Average scanner capex per office</div>
            </div>
            <div className="border-l-2 border-[#c8e84e] pl-6 py-1">
              <div className="text-3xl text-[#0f2a1c] mb-2">5-7%</div>
              <div className="text-sm font-medium uppercase tracking-wider text-slate-500">Industry average remake rate</div>
            </div>
            <div className="border-l-2 border-[#c8e84e] pl-6 py-1">
              <div className="text-3xl text-[#0f2a1c] mb-2">4+</div>
              <div className="text-sm font-medium uppercase tracking-wider text-slate-500">Distinct lab vendors managed per clinic</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Signal */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center gap-4 mb-16">
          <span className="text-black/40 text-xl italic">02</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">The Signal</span>
            <ArrowRight className="w-4 h-4 text-[#c8e84e]" />
            <span className="text-[#0f2a1c] text-3xl">Dandy adoption is accelerating</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="text-[#c8e84e] mb-6"><TrendingUp className="w-8 h-8" /></div>
              <h3 className="text-4xl text-[#0f2a1c] mb-4">+312%</h3>
              <p className="text-slate-600 leading-relaxed">YoY growth in digital removables cases across enterprise partners.</p>
            </div>
          </div>
          <div className="bg-white p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="text-[#c8e84e] mb-6"><Users className="w-8 h-8" /></div>
              <h3 className="text-4xl text-[#0f2a1c] mb-4">1 in 3</h3>
              <p className="text-slate-600 leading-relaxed">New doctors ask for Dandy by name during the recruitment process.</p>
            </div>
          </div>
          <div className="bg-[#0f2a1c] p-10 shadow-sm flex flex-col justify-between text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 text-[#c8e84e] transform translate-x-4 -translate-y-4">
              <Quote className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className="text-xl italic leading-snug mb-8 text-white/90">
                "Our associates were demanding better tech. Bringing Dandy in immediately improved our retention and accelerated our digital transition without the upfront capex."
              </p>
              <div className="text-xs font-medium uppercase tracking-wider text-[#c8e84e]">
                VP of Operations, Top 50 DSO
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. The Cost of Inaction */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center gap-4 mb-16">
          <span className="text-black/40 text-xl italic">03</span>
          <h2 className="text-[#0f2a1c] text-4xl lg:text-5xl">The Cost of Inaction</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-16">
          <div>
            <div className="text-5xl text-[#0f2a1c] mb-4 border-b-2 border-black/5 pb-4">7%</div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-2">Remake Rate</h4>
            <p className="text-slate-500 text-sm leading-relaxed">The analog industry average, costing hours of unbillable chair time.</p>
          </div>
          <div>
            <div className="text-5xl text-[#0f2a1c] mb-4 border-b-2 border-black/5 pb-4">120+</div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-2">Lost Hours / Year</h4>
            <p className="text-slate-500 text-sm leading-relaxed">Per doctor, spent managing physical impressions and lab disputes.</p>
          </div>
          <div>
            <div className="text-5xl text-[#0f2a1c] mb-4 border-b-2 border-black/5 pb-4">$40k</div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-2">Scanner Capex</h4>
            <p className="text-slate-500 text-sm leading-relaxed">The upfront cost to digitize a single practice using traditional models.</p>
          </div>
          <div>
            <div className="text-5xl text-[#0f2a1c] mb-4 border-b-2 border-black/5 pb-4">4-6</div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-2">Vendor Count</h4>
            <p className="text-slate-500 text-sm leading-relaxed">Fragmented lab partners causing inconsistent quality and opaque data.</p>
          </div>
        </div>
      </section>

      {/* 5. The Dandy Difference */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-20">
            <span className="text-white/30 text-xl italic">04</span>
            <h2 className="text-white text-4xl lg:text-5xl">The Paradigm Shift</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            {/* The Old Way */}
            <div className="pb-16 lg:pb-0 lg:pr-16">
              <h3 className="text-white/50 text-sm font-bold tracking-[0.2em] uppercase mb-12 flex items-center gap-3">
                <Minus className="w-4 h-4" /> The Old Way
              </h3>
              <ul className="space-y-10">
                <li>
                  <div className="text-white/80 font-medium mb-2">Analog Impressions</div>
                  <div className="text-white/40 text-sm">Messy, uncomfortable for patients, prone to distortion and errors.</div>
                </li>
                <li>
                  <div className="text-white/80 font-medium mb-2">Fragmented Lab Network</div>
                  <div className="text-white/40 text-sm">Managing multiple local labs with varying quality standards and systems.</div>
                </li>
                <li>
                  <div className="text-white/80 font-medium mb-2">Opaque Operations</div>
                  <div className="text-white/40 text-sm">Zero visibility into remake rates, lab spend, or clinical performance at scale.</div>
                </li>
                <li>
                  <div className="text-white/80 font-medium mb-2">High Capital Expenditure</div>
                  <div className="text-white/40 text-sm">Purchasing expensive scanners outright and managing hardware lifecycles.</div>
                </li>
              </ul>
            </div>

            {/* With Dandy */}
            <div className="pt-16 lg:pt-0 lg:pl-16">
              <h3 className="text-[#c8e84e] text-sm font-bold tracking-[0.2em] uppercase mb-12 flex items-center gap-3">
                <Check className="w-4 h-4" /> With Dandy
              </h3>
              <ul className="space-y-10">
                <li>
                  <div className="text-white font-medium mb-2 text-lg">100% Digital Workflow</div>
                  <div className="text-white/70 text-sm">Best-in-class intraoral scanners provided, ensuring precise data capture.</div>
                </li>
                <li>
                  <div className="text-white font-medium mb-2 text-lg">Single Partner</div>
                  <div className="text-white/70 text-sm">One standardized platform for all indications, from crowns to clear aligners.</div>
                </li>
                <li>
                  <div className="text-white font-medium mb-2 text-lg">Real-Time Data Visibility</div>
                  <div className="text-white/70 text-sm">Enterprise dashboard tracking every metric across every practice and doctor.</div>
                </li>
                <li>
                  <div className="text-white font-medium mb-2 text-lg">Zero Capex Model</div>
                  <div className="text-white/70 text-sm">Scanners and training included with lab partnership. Immediate ROI.</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 6. The Math */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-4">
            <span className="text-black/40 text-xl italic">05</span>
            <h2 className="text-[#0f2a1c] text-4xl lg:text-5xl">The Math</h2>
          </div>
          <p className="text-slate-500 text-sm italic">Based on {`{practice_count}`} offices</p>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm p-8 lg:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 border-b border-slate-100 pb-12">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Number of Offices</label>
              <div className="text-2xl text-[#0f2a1c] border-b border-slate-300 pb-2">{`{practice_count}`}</div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Est. Monthly Case Volume</label>
              <div className="text-2xl text-[#0f2a1c] border-b border-slate-300 pb-2">~450</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-[#f9f8f4] p-6">
              <div className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-4">Gross Margin Uplift</div>
              <div className="text-3xl text-[#0f2a1c] text-[#0d1f15] mb-2">+12%</div>
              <p className="text-xs text-slate-500">Estimated annual improvement</p>
            </div>
            <div className="bg-[#f9f8f4] p-6">
              <div className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-4">Chair Hours Saved</div>
              <div className="text-3xl text-[#0f2a1c] mb-2">1,200+</div>
              <p className="text-xs text-slate-500">Across the network annually</p>
            </div>
            <div className="bg-[#f9f8f4] p-6">
              <div className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-4">Capex Avoided</div>
              <div className="text-3xl text-[#0f2a1c] mb-2">$850k</div>
              <p className="text-xs text-slate-500">By utilizing Dandy's scanner model</p>
            </div>
            <div className="bg-[#0d1f15] p-6 text-white">
              <div className="text-sm font-bold uppercase tracking-wider text-[#c8e84e] mb-4">Payback Period</div>
              <div className="text-3xl mb-2">Immediate</div>
              <p className="text-xs text-white/70">ROI realized in month one</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. The Proof */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center gap-4 mb-16">
          <span className="text-black/40 text-xl italic">06</span>
          <h2 className="text-[#0f2a1c] text-4xl lg:text-5xl">The Proof</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8">
            <Quote className="w-12 h-12 text-[#c8e84e] mb-8" />
            <h3 className="text-3xl lg:text-4xl text-[#0f2a1c] leading-tight mb-8">
              "Partnering with Dandy was the single highest ROI operational decision we made this year. We digitized 45 practices in 90 days with zero capex, and our doctors couldn't be happier with the clinical quality."
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 rounded-full overflow-hidden">
                {/* Avatar Placeholder */}
                <div className="w-full h-full bg-slate-300"></div>
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Dr. Sarah Jenkins</div>
                <div className="text-slate-500 text-xs">Chief Clinical Officer, Summit Smile Group (45 practices)</div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-4 space-y-12 lg:border-l lg:border-slate-200 lg:pl-12">
            <div>
              <p className="text-lg text-[#0f2a1c] italic leading-relaxed mb-6">
                "Our remake rate dropped from 6% to under 2% across the entire network in the first quarter."
              </p>
              <div>
                <div className="font-bold text-slate-900 text-sm">Michael Chang</div>
                <div className="text-slate-500 text-xs">COO, Pacific Coast DSO (28 practices)</div>
              </div>
            </div>
            <div className="w-12 h-px bg-slate-200"></div>
            <div>
              <p className="text-lg text-[#0f2a1c] italic leading-relaxed mb-6">
                "The enterprise dashboard finally gave us the visibility we needed to standardize care."
              </p>
              <div>
                <div className="font-bold text-slate-900 text-sm">Amanda Reyes</div>
                <div className="text-slate-500 text-xs">VP Operations, Heartland Dental Partners</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. The Plan */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-20">
          <span className="text-black/40 text-xl italic">07</span>
          <h2 className="text-[#0f2a1c] text-4xl lg:text-5xl">The Plan</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative">
          {/* Connecting line for desktop */}
          <div className="hidden lg:block absolute top-12 left-6 right-6 h-px bg-slate-200 z-0"></div>

          <div className="relative z-10">
            <div className="w-12 h-12 bg-[#f6f5ee] border-2 border-[#0f2a1c] rounded-full flex items-center justify-center text-xl text-[#0f2a1c] mb-6">01</div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">Scope</h4>
            <div className="text-xs text-[#c8e84e] font-bold bg-[#0d1f15] inline-block px-2 py-1 mb-4">Week 1</div>
            <p className="text-slate-600 text-sm leading-relaxed">Identify a 5-office pilot cohort. Baseline current metrics and align on success criteria.</p>
          </div>
          
          <div className="relative z-10">
            <div className="w-12 h-12 bg-[#f6f5ee] border-2 border-[#0f2a1c] rounded-full flex items-center justify-center text-xl text-[#0f2a1c] mb-6">02</div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">Onboard & Train</h4>
            <div className="text-xs text-[#c8e84e] font-bold bg-[#0d1f15] inline-block px-2 py-1 mb-4">Week 2-4</div>
            <p className="text-slate-600 text-sm leading-relaxed">Scanners delivered. White-glove clinical training for doctors and staff.</p>
          </div>

          <div className="relative z-10">
            <div className="w-12 h-12 bg-[#f6f5ee] border-2 border-[#0f2a1c] rounded-full flex items-center justify-center text-xl text-[#0f2a1c] mb-6">03</div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">Measure</h4>
            <div className="text-xs text-[#c8e84e] font-bold bg-[#0d1f15] inline-block px-2 py-1 mb-4">Month 2</div>
            <p className="text-slate-600 text-sm leading-relaxed">Track case acceptance, turnaround times, and remake rate improvements.</p>
          </div>

          <div className="relative z-10">
            <div className="w-12 h-12 bg-[#f6f5ee] border-2 border-[#0f2a1c] rounded-full flex items-center justify-center text-xl text-[#0f2a1c] mb-6">04</div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">Scale</h4>
            <div className="text-xs text-[#c8e84e] font-bold bg-[#0d1f15] inline-block px-2 py-1 mb-4">Month 3+</div>
            <p className="text-slate-600 text-sm leading-relaxed">Roll out the Dandy operating system organization-wide.</p>
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="bg-[#0d1f15] py-24 lg:py-32 px-12 lg:px-20 text-center">
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          <div className="w-16 h-1 bg-[#c8e84e] mb-12"></div>
          <h2 className="text-white text-4xl lg:text-6xl leading-tight mb-8">
            Let's build the business case for {`{company_name}`}.
          </h2>
          <p className="text-white/70 text-lg lg:text-xl font-light mb-12 max-w-xl">
            Schedule a consultative working session to map out the financial and clinical impact of standardizing on Dandy.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <button className="bg-[#c8e84e] hover:bg-[#b5d53c] text-[#0d1f15] px-10 py-5 text-sm font-bold tracking-wide uppercase transition-colors duration-300 w-full sm:w-auto">
              Schedule a working session
            </button>
            <a href="#" className="text-white/60 hover:text-white text-sm font-medium transition-colors underline underline-offset-4">
              or download the one-pager
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
