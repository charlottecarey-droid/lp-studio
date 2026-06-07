import React, { useState } from "react";
import {
  Paintbrush,
  Palette,
  Layers,
  Split,
  ListChecks,
  Sparkles,
  Route,
  DollarSign,
  MousePointerClick,
  MonitorSmartphone,
  Zap,
  BarChart3,
} from "lucide-react";

type Feature = {
  title: string;
  description: string;
  icon: React.ElementType;
};

type Category = {
  id: string;
  label: string;
  icon: React.ElementType;
  heading: string;
  subheading: string;
  features: Feature[];
  visual: React.ReactNode;
};

const CATEGORIES: Category[] = [
  {
    id: "design",
    label: "Design & Build",
    icon: MonitorSmartphone,
    heading: "Pixel-perfect control, zero code required.",
    subheading: "Empower your marketing team to build stunning pages without waiting on engineering.",
    features: [
      {
        title: "Visual Builder",
        description: "Drag-and-drop elements with real-time preview and precision layout controls.",
        icon: Paintbrush,
      },
      {
        title: "Global Styles",
        description: "Define typography, colors, and spacing once to ensure brand consistency.",
        icon: Palette,
      },
      {
        title: "Dynamic Blocks",
        description: "Create smart, reusable components that sync instantly when updated anywhere.",
        icon: Layers,
      },
    ],
    visual: (
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
        {/* Fake Browser Chrome */}
        <div className="flex h-12 w-full items-center gap-2 border-b border-neutral-200 bg-white px-4">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-neutral-200" />
            <div className="h-3 w-3 rounded-full bg-neutral-200" />
            <div className="h-3 w-3 rounded-full bg-neutral-200" />
          </div>
          <div className="ml-4 h-6 w-48 rounded bg-neutral-100" />
        </div>
        {/* Fake Canvas & Sidebar */}
        <div className="flex flex-1">
          <div className="flex w-16 flex-col items-center gap-4 border-r border-neutral-200 bg-white py-4">
            <div className="h-8 w-8 rounded bg-neutral-100" />
            <div className="h-8 w-8 rounded bg-neutral-100" />
            <div className="h-8 w-8 rounded bg-indigo-50" />
            <div className="h-8 w-8 rounded bg-neutral-100" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="w-full max-w-sm overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-[0_0_0_2px_rgba(79,70,229,0.1)]">
              <div className="h-32 bg-indigo-50" />
              <div className="p-6">
                <div className="mb-4 h-4 w-1/3 rounded-full bg-indigo-100" />
                <div className="mb-2 h-3 w-full rounded-full bg-neutral-100" />
                <div className="h-3 w-5/6 rounded-full bg-neutral-100" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="h-8 w-24 rounded bg-indigo-600" />
              <div className="h-8 w-24 rounded bg-neutral-200" />
            </div>
          </div>
          <div className="w-48 border-l border-neutral-200 bg-white p-4">
            <div className="mb-4 h-3 w-24 rounded bg-neutral-200" />
            <div className="mb-6 flex gap-2">
              <div className="h-8 w-8 rounded border border-indigo-200 bg-indigo-50" />
              <div className="h-8 w-8 rounded border border-neutral-200 bg-neutral-50" />
              <div className="h-8 w-8 rounded border border-neutral-200 bg-neutral-50" />
            </div>
            <div className="mb-4 h-3 w-16 rounded bg-neutral-200" />
            <div className="h-2 w-full rounded bg-neutral-100" />
            <div className="mt-2 h-2 w-4/5 rounded bg-neutral-100" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "conversion",
    label: "Conversion Optimization",
    icon: Zap,
    heading: "Turn more clicks into qualified pipeline.",
    subheading: "Deploy sophisticated experiments and smart forms to maximize your advertising ROI.",
    features: [
      {
        title: "A/B Testing",
        description: "Run multivariate experiments and automatically route traffic to the winning variant.",
        icon: Split,
      },
      {
        title: "Form Flows",
        description: "Build multi-step lead capture forms with conditional logic and progressive profiling.",
        icon: ListChecks,
      },
      {
        title: "Smart Personalization",
        description: "Swap headlines, imagery, and CTAs based on visitor firmographics.",
        icon: Sparkles,
      },
    ],
    visual: (
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className="flex w-full max-w-md items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 font-bold">A</div>
              <div>
                <div className="h-4 w-20 rounded bg-neutral-200" />
                <div className="mt-1 h-3 w-16 rounded bg-neutral-100" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-4 w-12 rounded bg-emerald-200 ml-auto" />
              <div className="mt-1 h-3 w-16 rounded bg-neutral-100" />
            </div>
          </div>
          
          <div className="flex w-full max-w-md items-center justify-between rounded-xl border-2 border-indigo-600 bg-indigo-50/50 p-4 shadow-sm relative">
            <div className="absolute -top-3 left-4 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              Winner
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">B</div>
              <div>
                <div className="h-4 w-20 rounded bg-neutral-800" />
                <div className="mt-1 h-3 w-16 rounded bg-neutral-200" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-4 w-16 rounded bg-emerald-400 ml-auto" />
              <div className="mt-1 h-3 w-16 rounded bg-neutral-200" />
            </div>
          </div>

          <div className="flex w-full max-w-md items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm opacity-50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 font-bold">C</div>
              <div>
                <div className="h-4 w-20 rounded bg-neutral-200" />
                <div className="mt-1 h-3 w-16 rounded bg-neutral-100" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-4 w-12 rounded bg-red-200 ml-auto" />
              <div className="mt-1 h-3 w-16 rounded bg-neutral-100" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "analytics",
    label: "Analytics & Attribution",
    icon: BarChart3,
    heading: "Measure what matters, prove your impact.",
    subheading: "Connect the dots between marketing activity and closed revenue with precision.",
    features: [
      {
        title: "Journey Tracking",
        description: "Map the complete path from initial ad click to final conversion event.",
        icon: Route,
      },
      {
        title: "Revenue Attribution",
        description: "Connect marketing touches directly to closed-won deals in your CRM.",
        icon: DollarSign,
      },
      {
        title: "Heatmaps",
        description: "Understand exactly where visitors engage, hesitate, and drop off your pages.",
        icon: MousePointerClick,
      },
    ],
    visual: (
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
        <div className="flex h-14 w-full items-center gap-4 border-b border-neutral-200 bg-white px-6">
          <div className="h-4 w-24 rounded bg-neutral-200" />
          <div className="h-4 w-24 rounded bg-indigo-100" />
          <div className="h-4 w-24 rounded bg-neutral-100" />
        </div>
        <div className="flex flex-1 p-6">
          <div className="flex w-full flex-col gap-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-end gap-2 h-40 w-full border-b border-neutral-100 pb-2">
              {[40, 60, 30, 80, 50, 90, 70, 100, 60, 85, 45, 75].map((height, i) => (
                <div 
                  key={i} 
                  className="flex-1 rounded-t-sm bg-indigo-600 transition-all hover:bg-indigo-500" 
                  style={{ height: `${height}%`, opacity: height / 100 * 0.7 + 0.3 }}
                />
              ))}
            </div>
            <div className="flex gap-4">
              <div className="flex-1 rounded-lg bg-neutral-50 p-4">
                <div className="mb-2 h-3 w-16 rounded bg-neutral-200" />
                <div className="h-6 w-24 rounded bg-neutral-800" />
              </div>
              <div className="flex-1 rounded-lg bg-indigo-50 p-4 border border-indigo-100">
                <div className="mb-2 h-3 w-20 rounded bg-indigo-200" />
                <div className="h-6 w-24 rounded bg-indigo-600" />
              </div>
              <div className="flex-1 rounded-lg bg-neutral-50 p-4">
                <div className="mb-2 h-3 w-16 rounded bg-neutral-200" />
                <div className="h-6 w-24 rounded bg-emerald-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export function TabbedCategories() {
  const [activeTabId, setActiveTabId] = useState(CATEGORIES[0].id);

  const activeCategory = CATEGORIES.find((c) => c.id === activeTabId) || CATEGORIES[0];

  return (
    <section className="w-full bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mb-16 max-w-3xl">
          <p className="mb-3 font-semibold text-indigo-600 tracking-wide uppercase text-sm">
            Platform Capabilities
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Everything you need to build at scale.
          </h2>
          <p className="mt-6 text-lg leading-8 text-neutral-600">
            A complete suite of tools designed to help marketing teams launch faster, iterate smarter, and drive more pipeline without writing code.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-12 flex flex-wrap gap-2 border-b border-neutral-200 pb-px">
          {CATEGORIES.map((category) => {
            const isActive = activeTabId === category.id;
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setActiveTabId(category.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {category.label}
              </button>
            );
          })}
        </div>

        {/* Active Tab Content */}
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 min-h-[500px]">
          
          {/* Features Column */}
          <div className="flex flex-col justify-center">
            <div className="mb-10">
              <h3 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl mb-4">
                {activeCategory.heading}
              </h3>
              <p className="text-lg text-neutral-600">
                {activeCategory.subheading}
              </p>
            </div>

            <dl className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-1">
              {activeCategory.features.map((feature, idx) => (
                <div key={idx} className="relative pl-12">
                  <dt className="text-lg font-semibold leading-7 text-neutral-900 mb-1">
                    <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                      <feature.icon className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                    </div>
                    {feature.title}
                  </dt>
                  <dd className="text-base leading-7 text-neutral-600">
                    {feature.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Visual Column */}
          <div className="relative h-[400px] lg:h-auto lg:min-h-[500px] rounded-2xl bg-neutral-100/50 p-2 sm:p-4 border border-neutral-100">
            {activeCategory.visual}
          </div>
          
        </div>
      </div>
    </section>
  );
}
