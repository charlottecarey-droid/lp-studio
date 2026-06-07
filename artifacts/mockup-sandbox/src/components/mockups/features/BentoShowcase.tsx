import React from "react";
import { Layout, Palette, Users, LineChart, Shield, Rocket } from "lucide-react";

export function BentoShowcase() {
  return (
    <section className="w-full bg-neutral-50 py-24">
      <div className="mx-auto w-full max-w-[1280px] px-8">
        {/* Header */}
        <div className="mb-16 max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-indigo-600">
            Platform Capabilities
          </h2>
          <p className="mb-6 text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
            Everything you need to build at scale.
          </p>
          <p className="text-lg text-neutral-600">
            A comprehensive suite of tools designed for modern marketing teams. 
            Build, test, and deploy without waiting on engineering.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-3 lg:gap-6">
          
          {/* Card 1: Visual Page Builder (Flagship) - 2x2 */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md md:col-span-2 md:row-span-2">
            <div className="relative z-10 mb-8 flex flex-col items-start gap-4">
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <Layout className="h-6 w-6" />
              </div>
              <div>
                <h3 className="mb-2 text-2xl font-bold text-neutral-900">
                  Visual Page Builder
                </h3>
                <p className="max-w-md text-neutral-600">
                  A truly WYSIWYG experience. Drag, drop, and configure components 
                  with a robust property panel. What you see is exactly what your customers get.
                </p>
              </div>
            </div>

            {/* UI Mockup: Builder Canvas */}
            <div className="relative mt-auto flex h-[280px] w-full overflow-hidden rounded-t-xl rounded-br-xl border border-b-0 border-r-0 border-neutral-200 bg-neutral-100 shadow-inner">
              {/* Left Sidebar */}
              <div className="w-48 shrink-0 border-r border-neutral-200 bg-white p-4">
                <div className="mb-4 h-3 w-16 rounded-full bg-neutral-200" />
                <div className="flex flex-col gap-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-6 w-full rounded-md bg-neutral-100" />
                  ))}
                </div>
              </div>
              {/* Canvas Area */}
              <div className="flex-1 p-6">
                <div className="h-full w-full rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
                  {/* Mock Page Content */}
                  <div className="mb-6 h-8 w-2/3 rounded-lg bg-neutral-100" />
                  <div className="mb-4 h-4 w-full rounded-full bg-neutral-100" />
                  <div className="mb-8 h-4 w-4/5 rounded-full bg-neutral-100" />
                  <div className="flex gap-4">
                    <div className="h-10 w-24 rounded-lg bg-indigo-600" />
                    <div className="h-10 w-24 rounded-lg bg-neutral-200" />
                  </div>
                </div>
              </div>
              {/* Right Sidebar - properties */}
              <div className="w-56 shrink-0 border-l border-neutral-200 bg-white p-4">
                <div className="mb-6 h-3 w-20 rounded-full bg-neutral-200" />
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="mb-2 h-2 w-12 rounded-full bg-neutral-200" />
                    <div className="h-8 w-full rounded-md border border-neutral-200 bg-neutral-50" />
                  </div>
                  <div>
                    <div className="mb-2 h-2 w-16 rounded-full bg-neutral-200" />
                    <div className="flex gap-2">
                      <div className="h-8 flex-1 rounded-md border border-neutral-200 bg-neutral-50" />
                      <div className="h-8 flex-1 rounded-md border border-neutral-200 bg-neutral-50" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Brand Assets */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-6">
              <div className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <Palette className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-neutral-900">
                Global Brand Sync
              </h3>
              <p className="text-sm text-neutral-600">
                Define your palettes, fonts, and logos once. Updates cascade across all your pages instantly.
              </p>
            </div>
            {/* UI Mockup: Swatches */}
            <div className="mt-auto flex items-center justify-center gap-2 pt-4">
              <div className="h-12 w-12 rounded-full bg-indigo-600 ring-4 ring-white shadow-md" />
              <div className="h-12 w-12 -translate-x-4 rounded-full bg-violet-500 ring-4 ring-white shadow-md" />
              <div className="h-12 w-12 -translate-x-8 rounded-full bg-sky-400 ring-4 ring-white shadow-md" />
              <div className="h-12 w-12 -translate-x-12 rounded-full bg-rose-400 ring-4 ring-white shadow-md" />
            </div>
          </div>

          {/* Card 3: Real-time Collab */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-6">
              <div className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-neutral-900">
                Real-time Collab
              </h3>
              <p className="text-sm text-neutral-600">
                See who's editing, leave comments on specific blocks, and never overwrite someone else's work.
              </p>
            </div>
            {/* UI Mockup: Cursors */}
            <div className="relative mt-auto flex h-[100px] w-full items-center justify-center rounded-xl bg-neutral-50 pt-4">
              <div className="absolute left-6 top-6 flex items-center gap-1">
                <div className="h-4 w-4 border-[6px] border-transparent border-b-rose-500 border-l-rose-500" style={{ transform: 'rotate(-45deg)' }} />
                <div className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">Sarah</div>
              </div>
              <div className="absolute bottom-6 right-8 flex items-center gap-1">
                <div className="h-4 w-4 border-[6px] border-transparent border-b-blue-500 border-l-blue-500" style={{ transform: 'rotate(-45deg)' }} />
                <div className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">David</div>
              </div>
            </div>
          </div>

          {/* Card 4: A/B Testing */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-6">
              <div className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <LineChart className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-neutral-900">
                A/B Testing Engine
              </h3>
              <p className="text-sm text-neutral-600">
                Test headlines, heroes, or entire page layouts. Automatic traffic routing and statistical significance.
              </p>
            </div>
            {/* UI Mockup: Chart */}
            <div className="mt-auto flex h-[100px] items-end justify-between gap-3 px-4 pt-4">
              <div className="w-full flex-1 rounded-t-md bg-neutral-200" style={{ height: '40%' }} />
              <div className="w-full flex-1 rounded-t-md bg-indigo-300" style={{ height: '65%' }} />
              <div className="w-full flex-1 rounded-t-md bg-indigo-600 shadow-sm" style={{ height: '90%' }} />
              <div className="w-full flex-1 rounded-t-md bg-neutral-200" style={{ height: '30%' }} />
            </div>
          </div>

          {/* Card 5: Role-based Access */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-6">
              <div className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-neutral-900">
                Role-based Access
              </h3>
              <p className="text-sm text-neutral-600">
                Granular permissions ensure the right people can edit, while protecting your core templates.
              </p>
            </div>
            {/* UI Mockup: User list */}
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-neutral-300" />
                  <div className="h-2 w-16 rounded-full bg-neutral-300" />
                </div>
                <div className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">Admin</div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-neutral-300" />
                  <div className="h-2 w-12 rounded-full bg-neutral-300" />
                </div>
                <div className="rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">Editor</div>
              </div>
            </div>
          </div>

          {/* Card 6: Instant Publishing */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-6">
              <div className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <Rocket className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-neutral-900">
                Instant Publishing
              </h3>
              <p className="text-sm text-neutral-600">
                Deploy to a global edge network in milliseconds. Changes are live instantly, with zero downtime.
              </p>
            </div>
            {/* UI Mockup: Progress / Success */}
            <div className="mt-auto flex flex-col items-center justify-center pt-6">
              <div className="flex w-full items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <div className="absolute inset-0 animate-ping rounded-full border border-emerald-500 opacity-20"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-emerald-900">Deployed Successfully</span>
                  <span className="text-[10px] text-emerald-700">Live on edge network</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
