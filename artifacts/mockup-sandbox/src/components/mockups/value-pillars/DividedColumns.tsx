import React from 'react';
import { Settings, BarChart2, Shield } from 'lucide-react';

export function DividedColumns() {
  return (
    <section className="w-full bg-[#FAFAFA] py-24 md:py-32 px-6 md:px-12 lg:px-24 font-sans">
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 md:mb-28 max-w-3xl text-center mx-auto">
          <span className="inline-block mb-5 text-xs font-bold tracking-[0.2em] text-[#B24B36] uppercase">
            Platform Capabilities
          </span>
          <h2 className="mb-6 text-4xl md:text-5xl lg:text-6xl font-serif text-slate-900 tracking-tight leading-tight">
            Designed for velocity.
            <br className="hidden md:block" /> Built for scale.
          </h2>
          <p className="text-lg md:text-xl text-slate-500 font-light max-w-2xl mx-auto leading-relaxed">
            Everything you need to orchestrate your team's workflow, without the complexity that usually comes with it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 relative">
          {/* Vertical dividers for desktop */}
          <div className="hidden md:block absolute top-0 bottom-0 left-[33.333%] w-[1px] bg-slate-200" />
          <div className="hidden md:block absolute top-0 bottom-0 left-[66.666%] w-[1px] bg-slate-200" />

          {/* Column 1 */}
          <div className="relative p-8 md:px-12 lg:px-16 md:py-8 group transition-all duration-500 hover:-translate-y-2">
            <div className="mb-10 inline-flex items-center justify-center p-4 bg-white shadow-sm border border-slate-100 rounded-2xl text-[#B24B36] group-hover:bg-[#B24B36] group-hover:text-white group-hover:border-[#B24B36] transition-all duration-500">
              <Settings className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <h3 className="mb-5 text-2xl font-serif text-slate-900 tracking-tight">
              Effortless setup
            </h3>
            <p className="text-slate-500 leading-relaxed font-light text-base md:text-lg">
              Get started and ship in minutes, no engineering required. Connect your data sources instantly and see value on day one.
            </p>
            {/* Horizontal divider for mobile */}
            <div className="block md:hidden absolute bottom-0 left-8 right-8 h-[1px] bg-slate-200" />
          </div>

          {/* Column 2 */}
          <div className="relative p-8 md:px-12 lg:px-16 md:py-8 group transition-all duration-500 hover:-translate-y-2">
            <div className="mb-10 inline-flex items-center justify-center p-4 bg-white shadow-sm border border-slate-100 rounded-2xl text-[#B24B36] group-hover:bg-[#B24B36] group-hover:text-white group-hover:border-[#B24B36] transition-all duration-500">
              <BarChart2 className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <h3 className="mb-5 text-2xl font-serif text-slate-900 tracking-tight">
              Clarity at a glance
            </h3>
            <p className="text-slate-500 leading-relaxed font-light text-base md:text-lg">
              Real-time insight and analytics that are actually easy to read. Turn complex datasets into clear, actionable narratives.
            </p>
            {/* Horizontal divider for mobile */}
            <div className="block md:hidden absolute bottom-0 left-8 right-8 h-[1px] bg-slate-200" />
          </div>

          {/* Column 3 */}
          <div className="relative p-8 md:px-12 lg:px-16 md:py-8 group transition-all duration-500 hover:-translate-y-2">
            <div className="mb-10 inline-flex items-center justify-center p-4 bg-white shadow-sm border border-slate-100 rounded-2xl text-[#B24B36] group-hover:bg-[#B24B36] group-hover:text-white group-hover:border-[#B24B36] transition-all duration-500">
              <Shield className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <h3 className="mb-5 text-2xl font-serif text-slate-900 tracking-tight">
              Reliability that scales
            </h3>
            <p className="text-slate-500 leading-relaxed font-light text-base md:text-lg">
              Enterprise-grade dependability from day one. As your team grows, our infrastructure seamlessly handles the increased load.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
