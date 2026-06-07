import React from "react";
import { Check, Shield, Zap, Globe, Layers, MessageSquare, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockupCTA } from "@/components/mockups/_shared/MockupCTA";

const FEATURE_CATEGORIES = [
  {
    title: "Infrastructure & Security",
    features: [
      {
        id: "multi-tenant",
        name: "Multi-tenant Architecture",
        description: "Isolate customer data automatically with dedicated database schemas.",
        icon: Database,
      },
      {
        id: "rbac",
        name: "Role-based Access Control",
        description: "Granular permissions, custom roles, and comprehensive audit logs.",
        icon: Shield,
      },
    ],
  },
  {
    title: "Platform Capabilities",
    features: [
      {
        id: "whitelabel",
        name: "White-labeling Engine",
        description: "Custom domains, branding presets, and branded email delivery.",
        icon: Globe,
      },
      {
        id: "api",
        name: "API & Webhooks",
        description: "RESTful endpoints and real-time events for external systems.",
        icon: Zap,
      },
    ],
  },
  {
    title: "Experience & Support",
    features: [
      {
        id: "components",
        name: "Component Library",
        description: "Over 100+ accessible, pre-built components ready to deploy.",
        icon: Layers,
      },
      {
        id: "support",
        name: "Priority Support",
        description: "24/7 dedicated support team with 1-hour response SLA.",
        icon: MessageSquare,
      },
    ],
  },
];

export function ComparisonChecklist({ showCta = true }: { showCta?: boolean } = {}) {

  return (
    <section className="flex w-full min-h-[900px] flex-col items-center justify-center bg-white px-6 py-24">
      <div className="w-full max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-indigo-600">
            Platform Capabilities
          </h2>
          <h3 className="mb-6 text-3xl font-extrabold tracking-tight text-neutral-900 md:text-5xl">
            Everything you need to scale
          </h3>
          <p className="mx-auto max-w-2xl text-lg text-neutral-500">
            Stop worrying about the foundational pieces. We include all the enterprise-grade infrastructure and capabilities right out of the box.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] border-b border-neutral-200 bg-neutral-50 px-6 py-4 md:px-8">
            <div className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Feature & Description</div>
            <div className="hidden text-center text-sm font-semibold uppercase tracking-wider text-neutral-500 md:block">Included</div>
          </div>
          
          <div className="divide-y divide-neutral-100">
            {FEATURE_CATEGORIES.map((category, catIndex) => (
              <React.Fragment key={`cat-${catIndex}`}>
                <div className="bg-neutral-50/50 px-6 py-3 md:px-8">
                  <h4 className="text-sm font-semibold text-neutral-900">{category.title}</h4>
                </div>
                {category.features.map((feature) => (
                  <div
                    key={feature.id}
                    className="grid grid-cols-1 items-center gap-4 px-6 py-5 hover:bg-neutral-50 transition-colors md:grid-cols-[1fr_200px] md:px-8 md:py-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <feature.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-neutral-900">
                          {feature.name}
                        </h4>
                        <p className="mt-1 max-w-lg text-sm text-neutral-500 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:justify-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                        <Check className="h-5 w-5 stroke-[3]" />
                      </div>
                      <span className="text-sm font-medium text-neutral-600 md:hidden">Included in all plans</span>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-6 sm:flex-row sm:justify-between rounded-2xl bg-indigo-50 p-8 ring-1 ring-indigo-100">
          <div>
            <h4 className="text-lg font-semibold text-neutral-900">Need something bespoke?</h4>
            <p className="mt-1 text-sm text-neutral-600">Our engineering team can build custom modules for your enterprise.</p>
          </div>
          <Button className="shrink-0 bg-indigo-600 px-8 py-6 text-base text-white hover:bg-indigo-700">
            Contact Enterprise Sales
          </Button>
        </div>

        {showCta && (
          <div className="mt-20 border-t border-neutral-200 pt-16">
            <MockupCTA
              variant="form"
              accent="#4f46e5"
              accentText="#ffffff"
              ink="#0f172a"
              muted="#64748b"
              border="#e2e8f0"
              align="center"
              eyebrow="Stay in the loop"
              heading="Get the enterprise capabilities checklist."
              subheading="Drop your email and we'll send the full breakdown of what's included on every plan."
              primaryLabel="Send it to me"
              placeholder="you@company.com"
            />
          </div>
        )}
      </div>
    </section>
  );
}
