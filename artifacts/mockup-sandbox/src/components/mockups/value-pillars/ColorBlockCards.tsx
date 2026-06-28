import React from "react";
import { ArrowRight, Zap, BarChart3, ShieldCheck } from "lucide-react";

export function ColorBlockCards() {
  const pillars = [
    {
      id: "setup",
      title: "Effortless setup",
      description: "Get started and ship in minutes. Zero engineering required to integrate into your existing workflow.",
      icon: Zap,
      image: "/__mockup/images/colorblock-setup.png",
      colorClass: "bg-[#E3F2FD]", // Light Blue
      textClass: "text-[#0D47A1]",
      titleClass: "text-[#0D47A1]",
      descClass: "text-[#1565C0]",
      iconBg: "bg-[#BBDEFB]",
    },
    {
      id: "clarity",
      title: "Clarity at a glance",
      description: "Real-time insight and analytics that are actually easy to read, bringing your key metrics into focus.",
      icon: BarChart3,
      image: "/__mockup/images/colorblock-clarity.png",
      colorClass: "bg-[#F3E5F5]", // Light Purple
      textClass: "text-[#4A148C]",
      titleClass: "text-[#4A148C]",
      descClass: "text-[#6A1B9A]",
      iconBg: "bg-[#E1BEE7]",
    },
    {
      id: "reliability",
      title: "Reliability that scales",
      description: "Enterprise-grade dependability from day one. Build with confidence knowing our infrastructure grows with you.",
      icon: ShieldCheck,
      image: "/__mockup/images/colorblock-reliability.png",
      colorClass: "bg-[#FBE9E7]", // Light Pink/Rose
      textClass: "text-[#880E4F]",
      titleClass: "text-[#880E4F]",
      descClass: "text-[#AD1457]",
      iconBg: "bg-[#F8BBD0]",
    },
  ];

  return (
    <section className="w-full bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600 tracking-wide uppercase">Core Values</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Everything you need. Nothing you don't.
          </p>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            A platform engineered to stay out of your way while delivering the power and performance your team demands.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <div className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.id}
                  className={`flex flex-col overflow-hidden rounded-3xl ${pillar.colorClass} shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden">
                    <img
                      src={pillar.image}
                      alt={pillar.title}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-8 sm:p-10">
                    <div>
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${pillar.iconBg} mb-6`}>
                        <Icon className={`h-6 w-6 ${pillar.textClass}`} aria-hidden="true" />
                      </div>
                      <h3 className={`text-xl font-bold leading-8 tracking-tight ${pillar.titleClass}`}>
                        {pillar.title}
                      </h3>
                      <p className={`mt-4 text-base leading-7 ${pillar.descClass}`}>
                        {pillar.description}
                      </p>
                    </div>
                    <div className="mt-8">
                      <a
                        href="#"
                        className={`inline-flex items-center text-sm font-semibold ${pillar.textClass} hover:opacity-80 transition-opacity`}
                      >
                        Learn more <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
