import React from 'react';
import { BarChart3, CloudLightning, Layers, ShieldCheck, Users } from 'lucide-react';

export function BentoGrid() {
  return (
    <section className="w-full bg-neutral-50 py-24">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Platform capabilities</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Everything you need to scale operations.
          </p>
          <p className="mt-4 text-lg text-neutral-600">
            We've built the foundation so you can focus on what matters most—delivering value to your customers with zero friction.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-3 lg:grid-cols-3 lg:grid-rows-3">
          {/* Tile 1: Hero */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200/50 transition-all hover:shadow-md md:col-span-2 md:row-span-2">
            <div className="p-8 sm:p-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900">Visual Workflow Builder</h3>
              <p className="mt-2 max-w-md text-neutral-600">
                Drag and drop your way to complex automations. Our intuitive canvas lets you connect apps, databases, and APIs without writing a single line of code.
              </p>
            </div>
            {/* Mini mockup */}
            <div className="relative mt-auto h-48 w-full overflow-hidden bg-neutral-50 px-8 pt-8">
              <div className="absolute inset-x-8 top-8 rounded-t-xl border border-neutral-200 bg-white p-4 shadow-sm transition-transform duration-500 group-hover:-translate-y-2">
                <div className="flex items-center gap-4 border-b border-neutral-100 pb-4">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100" />
                  <div className="h-2 w-24 rounded-full bg-neutral-200" />
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-16 w-32 rounded-lg border border-neutral-200 bg-neutral-50" />
                  <div className="h-px w-8 bg-neutral-300" />
                  <div className="h-16 w-32 rounded-lg border border-indigo-200 bg-indigo-50" />
                </div>
              </div>
            </div>
          </div>

          {/* Tile 2 */}
          <div className="relative flex flex-col overflow-hidden rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200/50 transition-all hover:shadow-md">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CloudLightning className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Instant Deployments</h3>
            <p className="mt-2 text-neutral-600">
              Push your changes live in milliseconds to our globally distributed edge network.
            </p>
          </div>

          {/* Tile 3 */}
          <div className="relative flex flex-col overflow-hidden rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200/50 transition-all hover:shadow-md">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Multiplayer Sync</h3>
            <p className="mt-2 text-neutral-600">
              Work together in real-time. See cursors, leave comments, and ship faster as a team.
            </p>
          </div>

          {/* Tile 4 */}
          <div className="relative flex flex-col overflow-hidden rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200/50 transition-all hover:shadow-md">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Enterprise Security</h3>
            <p className="mt-2 text-neutral-600">
              SOC2 compliant, SSO, and granular RBAC out of the box for total peace of mind.
            </p>
          </div>

          {/* Tile 5 */}
          <div className="relative flex flex-col justify-center overflow-hidden rounded-3xl bg-indigo-950 p-8 shadow-sm ring-1 ring-indigo-900 transition-all hover:shadow-md md:col-span-2">
            <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
            <div className="relative z-10">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-900 text-indigo-300">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Advanced Telemetry</h3>
              <p className="mt-2 max-w-lg text-indigo-200">
                Track every interaction, monitor performance, and gain actionable insights with our built-in analytics engine. No third-party tools required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
