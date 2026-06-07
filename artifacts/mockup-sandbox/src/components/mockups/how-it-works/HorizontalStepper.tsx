import React from "react";
import { ArrowRight, UserPlus, Zap, Rocket, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockupCTA } from "@/components/mockups/_shared/MockupCTA";

const STEPS = [
  {
    id: 1,
    title: "Connect your tools",
    description: "Securely link your existing CRM and data sources in one click.",
    icon: <UserPlus className="h-5 w-5 text-indigo-600" />,
  },
  {
    id: 2,
    title: "Set your rules",
    description: "Define custom routing logic and scoring criteria without code.",
    icon: <Zap className="h-5 w-5 text-indigo-600" />,
  },
  {
    id: 3,
    title: "Go live instantly",
    description: "Launch your automated workflows and start routing leads immediately.",
    icon: <Rocket className="h-5 w-5 text-indigo-600" />,
  },
];

export function HorizontalStepper({ showCta = true }: { showCta?: boolean } = {}) {

  return (
    <section className="w-full bg-neutral-50 py-24 text-neutral-900">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-sm font-bold text-indigo-600 tracking-wider uppercase mb-3">
              How it works
            </h2>
            <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              From zero to automated in minutes
            </h3>
            <p className="text-lg text-neutral-600 mt-4 max-w-xl">
              We've eliminated the technical complexity so you can focus on building the perfect revenue engine.
            </p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
            Start free trial <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          {/* Progress Rail */}
          <div className="hidden md:block absolute top-8 left-0 w-full h-[2px] bg-neutral-200 -z-0"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 relative z-10">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center md:items-start text-center md:text-left relative group">
                <div className="flex items-center gap-4 mb-6 md:mb-8 w-full justify-center md:justify-start">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-neutral-100 shrink-0 transition-transform group-hover:scale-105 group-hover:shadow-md">
                    {step.icon}
                    <div className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 shadow-sm border-2 border-white">
                      {step.id}
                    </div>
                  </div>
                  {/* Mobile connector */}
                  {index < STEPS.length - 1 && (
                    <div className="md:hidden w-px h-12 bg-neutral-200 mx-auto my-2"></div>
                  )}
                </div>
                
                <h4 className="text-xl font-bold mb-2">{step.title}</h4>
                <p className="text-neutral-600 leading-relaxed pr-0 md:pr-6">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-neutral-200 flex flex-col md:flex-row items-center justify-center gap-4 text-sm text-neutral-500 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No credit card required
          </div>
          <span className="hidden md:inline text-neutral-300">•</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Cancel anytime
          </div>
          <span className="hidden md:inline text-neutral-300">•</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 14-day free trial
          </div>
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
              eyebrow="See it in action"
              heading="Watch your revenue engine go live in minutes"
              subheading="Book a quick walkthrough and we'll show you how to connect your tools, set your rules, and start routing leads automatically."
              primaryLabel="Book a demo"
              modalTitle="Book a demo"
              modalSubtitle="Pick a time that works — it takes 30 seconds."
            />
          </div>
        )}
      </div>
    </section>
  );
}
