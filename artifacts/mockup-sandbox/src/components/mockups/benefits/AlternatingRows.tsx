import React from "react";
import { Zap, Layers, TrendingUp, CheckCircle2, ArrowRight, BarChart3, Users, LayoutDashboard } from "lucide-react";
import { MockupCTA } from "@/components/mockups/_shared/MockupCTA";

const BENEFITS = [
  {
    id: "launch",
    title: "Accelerate your launch cycles",
    description: "Go from idea to production in days, not months. Our platform removes the boilerplate so your engineering team can focus on what actually matters—building product.",
    icon: <Zap className="h-6 w-6 text-indigo-600" />,
    features: [
      "Zero-config deployment pipelines",
      "Automated infrastructure provisioning",
      "Built-in CI/CD with instant rollbacks"
    ],
    mockup: <WorkflowMockup />
  },
  {
    id: "knowledge",
    title: "Unify your team's knowledge",
    description: "Break down silos and bring everyone onto the same page. A single source of truth for your documentation, decisions, and system architecture.",
    icon: <Layers className="h-6 w-6 text-indigo-600" />,
    features: [
      "Real-time collaborative editing",
      "Automatic version history",
      "Cross-functional permission controls"
    ],
    mockup: <DocumentMockup />
  },
  {
    id: "scale",
    title: "Scale without the growing pains",
    description: "Built on enterprise-grade infrastructure that grows with you. Handle traffic spikes effortlessly without rewriting your entire backend.",
    icon: <TrendingUp className="h-6 w-6 text-indigo-600" />,
    features: [
      "Auto-scaling compute resources",
      "Global edge CDN distribution",
      "99.99% guaranteed uptime SLA"
    ],
    mockup: <AnalyticsMockup />
  }
];

function WorkflowMockup() {
  return (
    <div className="relative flex h-full min-h-[360px] w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Browser header */}
      <div className="flex h-12 items-center border-b border-neutral-100 bg-neutral-50/50 px-4">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-neutral-200" />
          <div className="h-3 w-3 rounded-full bg-neutral-200" />
          <div className="h-3 w-3 rounded-full bg-neutral-200" />
        </div>
      </div>
      {/* App Body */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="hidden w-48 flex-col gap-2 border-r border-neutral-100 bg-neutral-50/30 p-4 sm:flex">
          <div className="h-4 w-24 rounded bg-neutral-200" />
          <div className="mt-4 flex flex-col gap-3">
            <div className="h-3 w-full rounded bg-indigo-100" />
            <div className="h-3 w-5/6 rounded bg-neutral-100" />
            <div className="h-3 w-4/5 rounded bg-neutral-100" />
          </div>
        </div>
        {/* Main */}
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <div className="h-6 w-32 rounded-md bg-neutral-800" />
            <div className="h-8 w-24 rounded-md bg-indigo-600" />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {/* Column 1 */}
            <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-3">
              <div className="h-4 w-16 rounded bg-neutral-200" />
              <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-white p-3 shadow-sm">
                <div className="h-3 w-3/4 rounded bg-neutral-800" />
                <div className="h-2 w-1/2 rounded bg-neutral-300" />
                <div className="mt-2 flex justify-between">
                  <div className="h-5 w-5 rounded-full bg-neutral-200" />
                  <div className="h-4 w-12 rounded bg-indigo-100" />
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-white p-3 shadow-sm">
                <div className="h-3 w-full rounded bg-neutral-800" />
                <div className="h-2 w-2/3 rounded bg-neutral-300" />
              </div>
            </div>
            {/* Column 2 */}
            <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-3">
              <div className="h-4 w-20 rounded bg-neutral-200" />
              <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-white p-3 shadow-sm">
                <div className="h-3 w-4/5 rounded bg-neutral-800" />
                <div className="h-2 w-3/5 rounded bg-neutral-300" />
              </div>
            </div>
            {/* Column 3 */}
            <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-3">
              <div className="h-4 w-16 rounded bg-neutral-200" />
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-transparent">
                <div className="h-3 w-20 rounded bg-neutral-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentMockup() {
  return (
    <div className="relative flex h-full min-h-[360px] w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex h-14 items-center border-b border-neutral-100 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-50 text-indigo-600">
            <Layers className="h-4 w-4" />
          </div>
          <div className="h-4 w-32 rounded bg-neutral-800" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="h-7 w-7 rounded-full border-2 border-white bg-indigo-200" />
            <div className="h-7 w-7 rounded-full border-2 border-white bg-pink-200" />
            <div className="h-7 w-7 rounded-full border-2 border-white bg-amber-200" />
          </div>
          <div className="h-8 w-16 rounded-md bg-neutral-100" />
        </div>
      </div>
      <div className="flex flex-1 p-8">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <div className="h-8 w-3/4 rounded-md bg-neutral-800" />
          <div className="flex flex-col gap-3">
            <div className="h-3 w-full rounded bg-neutral-200" />
            <div className="h-3 w-[95%] rounded bg-neutral-200" />
            <div className="h-3 w-[90%] rounded bg-neutral-200" />
            <div className="h-3 w-[80%] rounded bg-neutral-200" />
          </div>
          <div className="my-2 h-48 w-full rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-neutral-200/50" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-3 w-[85%] rounded bg-neutral-200" />
            <div className="h-3 w-full rounded bg-neutral-200" />
            <div className="h-3 w-[70%] rounded bg-neutral-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsMockup() {
  return (
    <div className="relative flex h-full min-h-[360px] w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm p-6 gap-6">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-24 rounded bg-neutral-300" />
          <div className="h-8 w-32 rounded-md bg-neutral-800" />
        </div>
        <div className="h-8 w-24 rounded-md border border-neutral-200 bg-white" />
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <div className="h-3 w-16 rounded bg-neutral-400" />
            <div className="h-6 w-20 rounded bg-neutral-800" />
            <div className="h-2 w-24 rounded bg-indigo-200" />
          </div>
        ))}
      </div>

      <div className="flex-1 rounded-xl border border-neutral-100 bg-white p-4 flex items-end gap-2 pt-12">
        {[40, 25, 45, 30, 60, 50, 75, 65, 85, 70, 95, 90].map((height, i) => (
          <div key={i} className="flex-1 bg-indigo-100 rounded-t-sm relative group">
            <div 
              className="absolute bottom-0 w-full bg-indigo-500 rounded-t-sm transition-all duration-500" 
              style={{ height: `${height}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}


export function AlternatingRows({ showCta = true }: { showCta?: boolean } = {}) {

  return (
    <section className="w-full bg-white py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1280px] px-6 md:px-12">
        
        {/* Section Header */}
        <div className="mx-auto mb-20 max-w-3xl text-center md:mb-32">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-indigo-600">
            Why choose our platform
          </h2>
          <h3 className="mb-6 text-3xl font-bold tracking-tight text-neutral-900 md:text-5xl">
            Everything you need to scale, nothing you don't.
          </h3>
          <p className="text-lg text-neutral-600 md:text-xl">
            We've spent years building the foundation so you can focus on building the product. Experience the difference a truly unified platform makes.
          </p>
        </div>

        {/* Alternating Rows */}
        <div className="flex flex-col gap-24 md:gap-40">
          {BENEFITS.map((benefit, index) => {
            const isEven = index % 2 !== 0;
            
            return (
              <div 
                key={benefit.id} 
                className={`flex flex-col gap-12 md:gap-24 items-center ${
                  isEven ? "md:flex-row-reverse" : "md:flex-row"
                }`}
              >
                
                {/* Text Content */}
                <div className="flex flex-1 flex-col justify-center">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                    {benefit.icon}
                  </div>
                  <h4 className="mb-4 text-2xl font-bold tracking-tight text-neutral-900 md:text-4xl">
                    {benefit.title}
                  </h4>
                  <p className="mb-8 text-lg text-neutral-600">
                    {benefit.description}
                  </p>
                  
                  <ul className="mb-8 flex flex-col gap-4">
                    {benefit.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-500" />
                        <span className="text-neutral-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div>
                    <button className="group inline-flex items-center gap-2 font-medium text-indigo-600 hover:text-indigo-700">
                      Learn more about {benefit.title.split(' ')[0].toLowerCase()}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>

                {/* Visual Mockup */}
                <div className="w-full flex-1 md:w-1/2 relative">
                  {/* Decorative background blob */}
                  <div className="absolute inset-0 -m-8 rounded-[3rem] bg-indigo-50/50 opacity-0 md:opacity-100 pointer-events-none" />
                  <div className="relative">
                    {benefit.mockup}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {showCta && (
          <div className="mt-24 border-t border-neutral-200 pt-20 md:mt-40 md:pt-28">
            <MockupCTA
              variant="link"
              accent="#4f46e5"
              accentText="#ffffff"
              ink="#0f172a"
              muted="#64748b"
              border="#e2e8f0"
              align="center"
              eyebrow="One unified platform"
              heading="Ship faster, scale further"
              subheading="Bring design, engineering, and marketing onto the same canvas. See what a truly unified platform does for your launch velocity."
              primaryLabel="Get started free"
              secondaryLabel="Talk to sales"
            />
          </div>
        )}

      </div>
    </section>
  );
}
