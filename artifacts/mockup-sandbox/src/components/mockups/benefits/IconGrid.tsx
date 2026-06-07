import React from "react";
import { 
  Zap, 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Globe2, 
  Clock
} from "lucide-react";

export function IconGrid() {
  const benefits = [
    {
      icon: <Zap className="h-6 w-6 text-indigo-600" />,
      title: "Lightning fast execution",
      description: "Launch campaigns in minutes, not weeks. Our intuitive builder removes technical bottlenecks so your team can move at the speed of thought."
    },
    {
      icon: <BarChart3 className="h-6 w-6 text-indigo-600" />,
      title: "Data-driven optimization",
      description: "Stop guessing what works. Built-in A/B testing and real-time analytics ensure every page performs better than the last."
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-indigo-600" />,
      title: "Enterprise-grade security",
      description: "Rest easy knowing your brand assets and customer data are protected by bank-level encryption and compliance frameworks."
    },
    {
      icon: <Users className="h-6 w-6 text-indigo-600" />,
      title: "Seamless collaboration",
      description: "Bring your whole team together. Comment, review, and approve changes directly on the canvas without context switching."
    },
    {
      icon: <Globe2 className="h-6 w-6 text-indigo-600" />,
      title: "Global localization",
      description: "Scale your message worldwide. Automatically adapt content, currency, and layouts for different regions with a single click."
    },
    {
      icon: <Clock className="h-6 w-6 text-indigo-600" />,
      title: "24/7 automated scaling",
      description: "Handle viral traffic spikes effortlessly. Our edge network automatically distributes your pages globally for zero downtime."
    }
  ];

  return (
    <section className="w-full bg-white px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">
            Why choose LP Studio
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Everything you need to scale your marketing
          </p>
          <p className="mt-6 text-lg leading-8 text-neutral-600">
            We've eliminated the friction between design, engineering, and marketing. 
            Focus on your message, and let our platform handle the rest.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex flex-col">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                {benefit.icon}
              </div>
              <h3 className="text-lg font-semibold leading-8 text-neutral-900">
                {benefit.title}
              </h3>
              <p className="mt-2 text-base leading-7 text-neutral-600">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
