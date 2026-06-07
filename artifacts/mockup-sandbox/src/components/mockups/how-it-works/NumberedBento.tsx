import React from "react";
import { Plug, Palette, Wand2, BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockupCTA } from "@/components/mockups/_shared/MockupCTA";

export function NumberedBento({ showCta = true }: { showCta?: boolean } = {}) {

  return (
    <section className="w-full bg-neutral-50 py-24 text-neutral-900">
      <div className="mx-auto w-full max-w-7xl px-8">
        <div className="mb-16 max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold tracking-wider text-indigo-600 uppercase">
            How it works
          </h2>
          <h3 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
            From raw data to live campaigns in minutes.
          </h3>
          <p className="text-lg text-neutral-600">
            Stop waiting weeks for landing pages. Connect your systems once, define your rules, and let our engine build the rest.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Step 1 - Large Card */}
          <div className="group relative overflow-hidden rounded-3xl bg-white p-10 shadow-sm ring-1 ring-neutral-200/50 transition-all hover:shadow-md md:col-span-2">
            <div className="pointer-events-none absolute -bottom-10 -right-10 select-none text-[12rem] font-black leading-none text-neutral-50 transition-transform duration-500 group-hover:-translate-y-4 group-hover:-translate-x-4">
              1
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Plug className="h-7 w-7" />
              </div>
              <div className="max-w-md">
                <h4 className="mb-3 text-2xl font-bold">Connect your data</h4>
                <p className="text-neutral-600">
                  Link your CRM, CMS, and product databases in a few clicks. We automatically sync your inventory, pricing, and customer segments in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 - Small Card */}
          <div className="group relative overflow-hidden rounded-3xl bg-white p-10 shadow-sm ring-1 ring-neutral-200/50 transition-all hover:shadow-md md:col-span-1">
            <div className="pointer-events-none absolute -bottom-10 -right-10 select-none text-[12rem] font-black leading-none text-neutral-50 transition-transform duration-500 group-hover:-translate-y-4 group-hover:-translate-x-4">
              2
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Palette className="h-7 w-7" />
              </div>
              <div>
                <h4 className="mb-3 text-2xl font-bold">Map your brand</h4>
                <p className="text-neutral-600">
                  Upload your fonts, colors, and logos. Our engine ensures every generated page stays strictly on-brand.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 - Small Card */}
          <div className="group relative overflow-hidden rounded-3xl bg-white p-10 shadow-sm ring-1 ring-neutral-200/50 transition-all hover:shadow-md md:col-span-1">
            <div className="pointer-events-none absolute -bottom-10 -right-10 select-none text-[12rem] font-black leading-none text-neutral-50 transition-transform duration-500 group-hover:-translate-y-4 group-hover:-translate-x-4">
              3
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Wand2 className="h-7 w-7" />
              </div>
              <div>
                <h4 className="mb-3 text-2xl font-bold">Generate variants</h4>
                <p className="text-neutral-600">
                  Instantly spin up hundreds of personalized page variants tailored to different audiences and search intents.
                </p>
              </div>
            </div>
          </div>

          {/* Step 4 - Large Card */}
          <div className="group relative overflow-hidden rounded-3xl bg-indigo-600 p-10 text-white shadow-sm ring-1 ring-indigo-500 transition-all hover:shadow-md md:col-span-2">
            <div className="pointer-events-none absolute -bottom-10 -right-10 select-none text-[12rem] font-black leading-none text-indigo-500/50 transition-transform duration-500 group-hover:-translate-y-4 group-hover:-translate-x-4">
              4
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-white">
                <BarChart3 className="h-7 w-7" />
              </div>
              <div className="max-w-md">
                <h4 className="mb-3 text-2xl font-bold">Publish & track</h4>
                <p className="text-indigo-100">
                  Deploy to your domain with zero configuration. Watch conversions roll in through our built-in analytics dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 flex items-center justify-center">
          <Button size="lg" className="h-12 rounded-full bg-indigo-600 px-8 text-base text-white hover:bg-indigo-700">
            Start building for free <ArrowRight className="ml-2 h-5 w-5" />
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
              eyebrow="Skip the wait"
              heading="Turn your data into live campaigns today"
              subheading="Connect your systems once and let LP Studio generate hundreds of on-brand, personalized pages — no weeks-long backlog required."
              primaryLabel="Start building for free"
              secondaryLabel="Talk to sales"
            />
          </div>
        )}
      </div>
    </section>
  );
}
