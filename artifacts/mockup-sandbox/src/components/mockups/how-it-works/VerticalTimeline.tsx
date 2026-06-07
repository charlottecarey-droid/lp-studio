import React from "react";
import { Palette, Users, Zap, BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockupCTA } from "@/components/mockups/_shared/MockupCTA";

const STEPS = [
  {
    title: "Connect your brand",
    description: "Link your style guide or let our AI extract colors, typography, and voice directly from your domain in seconds.",
    icon: Palette,
  },
  {
    title: "Define your audience",
    description: "Select your target segment and campaign goals so our engine can assemble the right blocks and personalize the messaging.",
    icon: Users,
  },
  {
    title: "Generate campaigns",
    description: "Create dozens of perfectly on-brand, high-converting landing pages tailored to your ad groups with a single click.",
    icon: Zap,
  },
  {
    title: "Publish & measure",
    description: "Push directly to your custom subdomain and track conversion uplift instantly with our built-in analytics.",
    icon: BarChart3,
  },
];

export function VerticalTimeline({ showCta = true }: { showCta?: boolean } = {}) {

  return (
    <section className="w-full bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 max-w-2xl">
          <h2 className="text-base font-semibold leading-7 text-indigo-600 uppercase tracking-wide">
            How it works
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            From idea to published campaign in minutes
          </p>
          <p className="mt-4 text-lg leading-8 text-neutral-600">
            Skip the lengthy design cycles and developer bottlenecks. Our platform automates the heavy lifting so you can focus on strategy.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Connecting Rail */}
          <div className="absolute left-[27px] top-4 bottom-4 w-px bg-neutral-200" aria-hidden="true" />
          
          <div className="flex flex-col gap-12 sm:gap-16">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative flex items-start gap-8">
                  {/* Node */}
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-sm ring-8 ring-white z-10">
                    <span className="text-lg font-bold text-neutral-900">{index + 1}</span>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col pt-3 sm:pt-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="text-xl font-semibold text-neutral-900">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-base leading-7 text-neutral-600 max-w-xl">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 flex items-center gap-4">
          <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8">
            Start building for free
          </Button>
          <Button size="lg" variant="ghost" className="text-neutral-600 hover:text-neutral-900">
            View examples <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {showCta && (
          <div className="mt-20 border-t border-neutral-200 pt-16">
            <MockupCTA
              variant="link"
              align="center"
              accent="#4f46e5"
              accentText="#ffffff"
              ink="#0f172a"
              muted="#64748b"
              border="#e2e8f0"
              eyebrow="Ready when you are"
              heading="Launch your first on-brand campaign today"
              subheading="Connect your brand, pick an audience, and let LP Studio assemble high-converting pages in minutes — no design or dev cycles required."
              primaryLabel="Start building for free"
              secondaryLabel="View live examples"
            />
          </div>
        )}
      </div>
    </section>
  );
}
