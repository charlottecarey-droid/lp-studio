import React from "react";
import { ArrowRight, LayoutTemplate, MousePointerClick, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockupCTA } from "@/components/mockups/_shared/MockupCTA";

const STEPS = [
  {
    title: "Select a brand template",
    description: "Start with a high-converting baseline. Choose from dozens of battle-tested layouts designed specifically for B2B SaaS, then instantly apply your company's colors and fonts.",
    icon: LayoutTemplate,
  },
  {
    title: "Customize without code",
    description: "Drag, drop, and edit directly on the canvas. Our visual editor gives you complete control over spacing, typography, and content without writing a single line of CSS.",
    icon: MousePointerClick,
  },
  {
    title: "Publish and optimize",
    description: "Hit publish to deploy instantly to our global edge network. Track conversions, run A/B tests, and iterate rapidly based on real user data.",
    icon: Zap,
  },
];

export function AlternatingShowcase({ showCta = true }: { showCta?: boolean } = {}) {

  return (
    <section className="w-full bg-neutral-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-20">
          <p className="text-base font-semibold leading-7 text-indigo-600">How it works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            From idea to live page in minutes
          </h2>
          <p className="mt-6 text-lg leading-8 text-neutral-600">
            Skip the development backlog. Empower your marketing team to build, test, and scale landing pages independently.
          </p>
        </div>

        <div className="flex flex-col gap-24">
          {/* Step 1 */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="lg:w-1/2 flex flex-col items-start">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-6">
                <span className="font-bold text-xl">1</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-neutral-900 mb-4">{STEPS[0].title}</h3>
              <p className="text-lg leading-relaxed text-neutral-600 mb-8">{STEPS[0].description}</p>
              <ul className="flex flex-col gap-3 text-neutral-600">
                {["One-click brand import", "Mobile-responsive by default", "Accessible color palettes"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:w-1/2 w-full">
              <div className="relative aspect-[4/3] rounded-2xl bg-white shadow-xl ring-1 ring-neutral-900/5 overflow-hidden flex items-center justify-center">
                {/* Abstract UI Mockup */}
                <div className="w-full h-full bg-neutral-100 p-6 flex flex-col gap-4">
                  <div className="w-full h-8 bg-white rounded-md shadow-sm border border-neutral-200 flex items-center px-4 gap-4">
                     <div className="w-24 h-3 bg-neutral-200 rounded-full" />
                     <div className="w-16 h-3 bg-neutral-200 rounded-full" />
                     <div className="w-16 h-3 bg-neutral-200 rounded-full" />
                     <div className="ml-auto w-8 h-4 bg-indigo-100 rounded-md" />
                  </div>
                  <div className="flex-1 flex gap-4">
                    <div className="w-48 bg-white rounded-md shadow-sm border border-neutral-200 p-4 flex flex-col gap-3">
                       <div className="w-24 h-4 bg-neutral-800 rounded-full mb-2" />
                       <div className="w-full h-24 bg-neutral-100 rounded-md border border-neutral-200" />
                       <div className="w-full h-24 bg-indigo-50 border-2 border-indigo-500 rounded-md relative">
                          <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full" />
                       </div>
                       <div className="w-full h-24 bg-neutral-100 rounded-md border border-neutral-200" />
                    </div>
                    <div className="flex-1 bg-white rounded-md shadow-sm border border-neutral-200 p-8 flex flex-col gap-6 items-center">
                       <div className="w-3/4 h-8 bg-neutral-200 rounded-md" />
                       <div className="w-1/2 h-4 bg-neutral-200 rounded-full" />
                       <div className="w-full mt-4 h-32 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100">
                          <div className="w-16 h-8 bg-indigo-200 rounded-md" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
            <div className="lg:w-1/2 flex flex-col items-start">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-6">
                <span className="font-bold text-xl">2</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-neutral-900 mb-4">{STEPS[1].title}</h3>
              <p className="text-lg leading-relaxed text-neutral-600 mb-8">{STEPS[1].description}</p>
              <ul className="flex flex-col gap-3 text-neutral-600">
                {["Inline text editing", "Global component libraries", "Version history"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:w-1/2 w-full">
              <div className="relative aspect-[4/3] rounded-2xl bg-white shadow-xl ring-1 ring-neutral-900/5 overflow-hidden">
                <div className="absolute inset-0 bg-neutral-50 flex items-center justify-center p-8">
                    <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col">
                        <div className="h-10 bg-neutral-100 border-b border-neutral-200 flex items-center px-4 gap-2">
                           <div className="w-3 h-3 rounded-full bg-red-400" />
                           <div className="w-3 h-3 rounded-full bg-amber-400" />
                           <div className="w-3 h-3 rounded-full bg-green-400" />
                        </div>
                        <div className="p-6 flex flex-col gap-4 relative">
                            {/* Cursor */}
                            <div className="absolute top-12 left-1/3 w-4 h-4 text-indigo-600 z-10">
                                <MousePointerClick className="w-6 h-6 fill-indigo-600 text-white drop-shadow-md" />
                            </div>
                            <div className="w-1/3 h-4 bg-indigo-100 rounded-full mb-2" />
                            <div className="w-full h-8 bg-neutral-900 rounded-md border-2 border-indigo-500 relative">
                                <div className="absolute -top-3 -right-2 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">Editing</div>
                            </div>
                            <div className="w-2/3 h-4 bg-neutral-200 rounded-full mt-2" />
                            
                            <div className="flex gap-4 mt-6">
                               <div className="flex-1 h-10 bg-indigo-600 rounded-md" />
                               <div className="flex-1 h-10 bg-neutral-100 rounded-md" />
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="lg:w-1/2 flex flex-col items-start">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-6">
                <span className="font-bold text-xl">3</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-neutral-900 mb-4">{STEPS[2].title}</h3>
              <p className="text-lg leading-relaxed text-neutral-600 mb-8">{STEPS[2].description}</p>
              <ul className="flex flex-col gap-3 text-neutral-600">
                {["Instant edge deployment", "Built-in analytics", "SEO optimization tools"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:w-1/2 w-full">
              <div className="relative aspect-[4/3] rounded-2xl bg-white shadow-xl ring-1 ring-neutral-900/5 overflow-hidden flex flex-col">
                 <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
                    <div className="font-medium text-sm text-neutral-600">Performance Overview</div>
                    <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Live</div>
                 </div>
                 <div className="flex-1 p-6 flex flex-col gap-6 bg-white">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="border border-neutral-200 rounded-xl p-4 flex flex-col gap-1">
                          <div className="text-xs text-neutral-500 font-medium">Page Views</div>
                          <div className="text-2xl font-bold text-neutral-900">24,592</div>
                          <div className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                             12%
                          </div>
                       </div>
                       <div className="border border-neutral-200 rounded-xl p-4 flex flex-col gap-1">
                          <div className="text-xs text-neutral-500 font-medium">Conversion Rate</div>
                          <div className="text-2xl font-bold text-neutral-900">4.8%</div>
                          <div className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                             2.1%
                          </div>
                       </div>
                    </div>
                    <div className="flex-1 border border-neutral-200 rounded-xl p-4 flex items-end gap-2">
                       {/* Bar chart mockup */}
                       {[30, 45, 25, 60, 40, 75, 50, 85, 60, 95, 80, 100].map((h, i) => (
                           <div key={i} className="flex-1 bg-indigo-100 rounded-t-sm relative group cursor-pointer hover:bg-indigo-200 transition-colors" style={{ height: `${h}%` }}>
                              {i === 9 && <div className="absolute inset-0 bg-indigo-500 rounded-t-sm" />}
                           </div>
                       ))}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24 flex justify-center">
          <Button size="lg" className="h-12 px-8 text-base shadow-sm">
            Start building for free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {showCta && (
          <div className="mt-20 border-t border-neutral-200 pt-16">
            <MockupCTA
              variant="modal"
              modalKind="booking"
              align="center"
              accent="#4f46e5"
              accentText="#ffffff"
              ink="#0f172a"
              muted="#64748b"
              border="#e2e8f0"
              eyebrow="Get a guided tour"
              heading="See how fast your team can ship landing pages"
              subheading="Book a live walkthrough and watch a page go from brand template to published in minutes — no development backlog required."
              primaryLabel="Schedule a walkthrough"
              modalTitle="Schedule a walkthrough"
              modalSubtitle="Pick a time that works — it takes 30 seconds."
            />
          </div>
        )}
      </div>
    </section>
  );
}
