import React from "react";
import {
  LayoutTemplate,
  SplitSquareHorizontal,
  LineChart,
  Globe,
  Users,
  Search,
  MousePointer2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockupCTA } from "@/components/mockups/_shared/MockupCTA";

const SPOTLIGHT_FEATURE = {
  id: "builder",
  title: "Drag-and-drop visual builder",
  description:
    "Design stunning, high-converting landing pages without writing a single line of code. Our intuitive builder gives you pixel-perfect control over every element, backed by a robust block library.",
  icon: LayoutTemplate,
};

const SECONDARY_FEATURES = [
  {
    id: "testing",
    title: "Native A/B Testing",
    description:
      "Split traffic automatically and find your winning variations.",
    icon: SplitSquareHorizontal,
  },
  {
    id: "analytics",
    title: "Real-time Analytics",
    description:
      "Track page views, conversion rates, and bounce rates instantly.",
    icon: LineChart,
  },
  {
    id: "domains",
    title: "Custom Domains",
    description:
      "Publish pages directly to your own brand domains and subdomains.",
    icon: Globe,
  },
  {
    id: "collaboration",
    title: "Team Collaboration",
    description:
      "Invite teammates, manage roles, and review drafts together.",
    icon: Users,
  },
  {
    id: "seo",
    title: "Advanced SEO Tools",
    description:
      "Optimize metadata, generate sitemaps, and score high on search.",
    icon: Search,
  },
];

function BuilderMockup() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      {/* Top Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-100 px-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-neutral-200" />
          <div className="h-3 w-3 rounded-full bg-neutral-200" />
          <div className="h-3 w-3 rounded-full bg-neutral-200" />
        </div>
        <div className="h-6 w-32 rounded-md bg-neutral-100" />
        <div className="h-6 w-16 rounded-md bg-indigo-600" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 shrink-0 border-r border-neutral-100 bg-neutral-50/50 p-4">
          <div className="mb-4 h-4 w-20 rounded bg-neutral-200" />
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-md bg-white p-2 shadow-sm ring-1 ring-neutral-200/50">
              <div className="h-6 w-6 rounded bg-neutral-100" />
              <div className="h-3 flex-1 rounded bg-neutral-200" />
            </div>
            <div className="flex items-center gap-3 rounded-md p-2">
              <div className="h-6 w-6 rounded bg-neutral-200" />
              <div className="h-3 flex-1 rounded bg-neutral-200" />
            </div>
            <div className="flex items-center gap-3 rounded-md p-2">
              <div className="h-6 w-6 rounded bg-neutral-200" />
              <div className="h-3 flex-1 rounded bg-neutral-200" />
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-neutral-100/50 p-6">
          <div className="relative flex h-full w-full flex-col gap-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
            <div className="h-32 w-full rounded-md bg-neutral-50 border border-neutral-100" />
            <div className="flex gap-4">
              <div className="h-48 flex-1 rounded-md bg-neutral-50 border border-neutral-100" />
              <div className="h-48 flex-1 rounded-md bg-neutral-50 border border-neutral-100" />
            </div>
            <div className="absolute right-12 top-12 flex items-center justify-center">
              <MousePointer2 className="h-6 w-6 text-indigo-600 drop-shadow-md" />
              <div className="ml-1 rounded bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white shadow-sm">
                Editing
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-56 shrink-0 border-l border-neutral-100 bg-white p-4">
          <div className="mb-4 h-4 w-24 rounded bg-neutral-200" />
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-3 w-16 rounded bg-neutral-200" />
              <div className="h-8 w-full rounded border border-neutral-200 bg-neutral-50" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-16 rounded bg-neutral-200" />
              <div className="h-8 w-full rounded border border-neutral-200 bg-neutral-50" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 flex-1 rounded border border-neutral-200 bg-neutral-50" />
              <div className="h-8 flex-1 rounded border border-neutral-200 bg-neutral-50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SpotlightCards({ showCta = true }: { showCta?: boolean } = {}) {

  return (
    <section className="flex w-full justify-center bg-neutral-50 py-24">
      <div className="w-full max-w-[1280px] px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-sm font-semibold tracking-wider text-indigo-600 uppercase">
            Platform Capabilities
          </h2>
          <p className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
            Everything you need to launch and scale.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Spotlight Feature */}
          <div className="grid grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/50 md:grid-cols-2">
            <div className="flex flex-col justify-center p-10 md:p-16">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <SPOTLIGHT_FEATURE.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-4 text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
                {SPOTLIGHT_FEATURE.title}
              </h3>
              <p className="mb-8 text-lg text-neutral-600">
                {SPOTLIGHT_FEATURE.description}
              </p>
              <div>
                <Button className="bg-indigo-600 text-white hover:bg-indigo-700">
                  Try the builder <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative min-h-[400px] bg-neutral-100 p-8">
              <BuilderMockup />
            </div>
          </div>

          {/* Secondary Features Row */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-5">
            {SECONDARY_FEATURES.map((feature) => (
              <div
                key={feature.id}
                className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/50 transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-50 text-neutral-600">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h4 className="mb-2 font-semibold text-neutral-900">
                  {feature.title}
                </h4>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {showCta && (
          <div className="mt-20 border-t border-neutral-200 pt-16">
            <MockupCTA
              variant="link"
              accent="#4f46e5"
              accentText="#ffffff"
              ink="#0f172a"
              muted="#64748b"
              border="#e2e8f0"
              align="center"
              eyebrow="Ready when you are"
              heading="Launch your first page in minutes, not weeks."
              subheading="Everything from the visual builder to analytics is included — start free and upgrade only when you need to."
              primaryLabel="Try the builder"
              secondaryLabel="See all features"
            />
          </div>
        )}
      </div>
    </section>
  );
}
