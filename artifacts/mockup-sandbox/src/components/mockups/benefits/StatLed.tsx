import React from "react";
import { Zap, TrendingUp, Clock } from "lucide-react";

const BENEFITS = [
  {
    stat: "3.5x",
    title: "Faster Deployment",
    description:
      "Launch new campaigns in days instead of weeks, eliminating developer bottlenecks and long QA cycles entirely.",
    icon: Zap,
  },
  {
    stat: "+42%",
    title: "Conversion Uplift",
    description:
      "Our performance-optimized blocks and automatic A/B testing systematically drive higher lead generation across all your pages.",
    icon: TrendingUp,
  },
  {
    stat: "15h",
    title: "Saved Per Week",
    description:
      "Free up your marketing team to focus on high-level strategy rather than wrestling with brittle code and rigid CMS limitations.",
    icon: Clock,
  },
];

export function StatLed() {
  return (
    <section className="w-full min-h-[800px] bg-white py-24 sm:py-32 flex items-center justify-center">
      <div className="container mx-auto px-4 md:px-8 max-w-[1200px]">
        <div className="mb-20 max-w-2xl">
          <span className="text-indigo-600 font-bold tracking-wider uppercase text-sm mb-4 block">
            Proven Outcomes
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 mb-6">
            Measurable impact, <br className="hidden md:block" />
            delivered by design.
          </h2>
          <p className="text-lg md:text-xl text-neutral-600">
            Don't just take our word for it. See the real numbers our platform
            delivers for marketing teams scaling their operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
          {BENEFITS.map((benefit, index) => (
            <div key={index} className="flex flex-col group">
              <div className="mb-6 transition-transform duration-500 ease-out group-hover:-translate-y-2">
                <div className="text-7xl lg:text-[7.5rem] leading-none font-extrabold tracking-tighter text-indigo-600 mb-2">
                  {benefit.stat}
                </div>
              </div>

              <div className="h-px w-full bg-neutral-200 mb-8 transition-colors duration-300 group-hover:bg-indigo-200" />

              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 transition-colors duration-300 group-hover:bg-indigo-100">
                  <benefit.icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-3">
                    {benefit.title}
                  </h3>
                  <p className="text-neutral-600 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
