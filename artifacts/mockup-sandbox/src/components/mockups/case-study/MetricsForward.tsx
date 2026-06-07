import React from "react";
import { ArrowRight, CheckCircle2, ChevronRight, BarChart3, Database, Globe, Lock, Shield, Zap } from "lucide-react";

export function MetricsForward() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-cyan-300 selection:text-slate-900">
      <style dangerouslySetInnerHTML={{
        __html: `
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
          
          .font-display { font-family: 'Space Grotesk', sans-serif; }
          .font-body { font-family: 'Inter', sans-serif; }
          .font-mono { font-family: 'Space Mono', monospace; }
        `
      }} />

      {/* 1. Nav */}
      <nav className="sticky top-0 z-50 w-full bg-slate-950 text-white border-b border-white/10 backdrop-blur-md bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-400 rounded-sm flex items-center justify-center">
              <Zap className="w-5 h-5 text-slate-950" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Vectis</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-body text-sm font-medium text-slate-300">
            <a href="#" className="hover:text-white transition-colors">Products</a>
            <a href="#" className="hover:text-white transition-colors">Solutions</a>
            <a href="#" className="text-white transition-colors">Customers</a>
            <a href="#" className="hover:text-white transition-colors">Resources</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hidden md:block font-body text-sm font-medium text-slate-300 hover:text-white transition-colors">Contact Sales</a>
            <a href="#" className="bg-cyan-400 text-slate-950 px-5 py-2.5 rounded-full font-body font-semibold text-sm hover:bg-cyan-300 transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* 2. Hero Band */}
      <header className="bg-slate-950 text-white pt-24 pb-32 px-6 relative overflow-hidden">
        {/* Abstract background element */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl mb-20">
            <div className="flex items-center gap-3 mb-8">
              <span className="font-mono text-cyan-400 text-sm font-bold tracking-widest uppercase">Customer Story</span>
              <span className="w-8 h-[1px] bg-cyan-400/50" />
              <span className="font-mono text-slate-400 text-sm tracking-widest uppercase">Aura Logistics</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-8">
              How Aura Logistics scaled to 50M+ daily shipments with zero downtime.
            </h1>
            <p className="font-body text-xl text-slate-300 leading-relaxed max-w-2xl">
              Faced with exponential growth and an aging legacy infrastructure, Aura Logistics partnered with Vectis to rebuild their routing engine from the ground up—resulting in unprecedented throughput, massive cost savings, and a modern stack ready for the next decade.
            </p>
          </div>

          {/* 4-Metric Stat Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10">
            <div className="bg-slate-950/80 p-8 backdrop-blur-sm">
              <div className="font-mono text-4xl md:text-5xl font-bold text-white mb-2">99.99<span className="text-cyan-400">%</span></div>
              <div className="font-body text-sm font-medium text-slate-400 uppercase tracking-wide">Uptime Maintained</div>
            </div>
            <div className="bg-slate-950/80 p-8 backdrop-blur-sm">
              <div className="font-mono text-4xl md:text-5xl font-bold text-white mb-2">12<span className="text-cyan-400">x</span></div>
              <div className="font-body text-sm font-medium text-slate-400 uppercase tracking-wide">Throughput Increase</div>
            </div>
            <div className="bg-slate-950/80 p-8 backdrop-blur-sm">
              <div className="font-mono text-4xl md:text-5xl font-bold text-white mb-2">45<span className="text-cyan-400">%</span></div>
              <div className="font-body text-sm font-medium text-slate-400 uppercase tracking-wide">Reduction in AWS Costs</div>
            </div>
            <div className="bg-slate-950/80 p-8 backdrop-blur-sm">
              <div className="font-mono text-4xl md:text-5xl font-bold text-white mb-2">&lt;5<span className="text-cyan-400">ms</span></div>
              <div className="font-body text-sm font-medium text-slate-400 uppercase tracking-wide">P99 Latency</div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. At-a-glance / Customer Profile */}
      <section className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-12 md:gap-24">
          <div className="flex-1">
            <h3 className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">About the Company</h3>
            <p className="font-body text-slate-600 leading-relaxed">
              Aura Logistics is a global supply chain technology provider connecting over 100,000 merchants with last-mile delivery partners across 40 countries. Their platform orchestrates complex routing decisions in real-time.
            </p>
          </div>
          <div className="flex-[2] grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Industry</div>
              <div className="font-body font-semibold text-slate-900">Logistics & Supply Chain</div>
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Company Size</div>
              <div className="font-body font-semibold text-slate-900">2,500+ Employees</div>
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Headquarters</div>
              <div className="font-body font-semibold text-slate-900">Berlin, Germany</div>
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Products Used</div>
              <div className="font-body font-semibold text-slate-900 flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-slate-100 rounded text-xs">Vectis Stream</span>
                <span className="px-2 py-1 bg-slate-100 rounded text-xs">Vectis Compute</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. The Challenge */}
      <section className="py-24 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center border-b border-slate-200">
        <div className="lg:col-span-5">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">The Challenge: Scaling a legacy monolith in a hyper-growth market.</h2>
          <div className="font-body text-lg text-slate-600 space-y-6">
            <p>
              In 2021, Aura Logistics experienced a 300% surge in shipment volume. Their core routing engine, built on a Ruby on Rails monolith supported by a strained relational database, began to buckle under the pressure.
            </p>
            <p>
              "We were hitting hard limits on our database connections, and latency was spiking during peak hours," notes Sarah Chen, VP of Engineering. "We needed a complete architectural shift to event-driven microservices, but we couldn't afford to stop shipping features."
            </p>
            <ul className="space-y-4 pt-4">
              {[
                "Database locks causing cascading system failures",
                "Deployments taking 4+ hours with high risk of downtime",
                "Cloud infrastructure costs spiraling out of control"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-cyan-500 shrink-0" />
                  <span className="font-body text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100">
            <img 
              src="/__mockup/images/case-study-challenge.jpg" 
              alt="Server room infrastructure"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* 5. The Approach / Solution */}
      <section className="py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">The Approach: A phased migration to Vectis Stream.</h2>
            <p className="font-body text-lg text-slate-600">
              Rather than attempting a risky "big bang" rewrite, Aura used Vectis Stream to create an event bridge, safely routing traffic between their legacy monolith and new microservices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-xl flex items-center justify-center mb-6">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl font-bold mb-3">Event Sourcing</h3>
              <p className="font-body text-slate-600">
                Legacy database writes were tapped via CDC and streamed into Vectis, providing a single source of truth for new services.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl font-bold mb-3">Edge Compute</h3>
              <p className="font-body text-slate-600">
                Routing calculations were pushed to the edge using Vectis Compute, drastically reducing round-trip latency.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl font-bold mb-3">Zero-Downtime Cutover</h3>
              <p className="font-body text-slate-600">
                Traffic was gradually shifted using shadow reads, allowing the team to verify exact parity before full cutover.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. The Results */}
      <section className="py-24 px-6 max-w-7xl mx-auto border-b border-slate-200">
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-16 text-center">The Results</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="font-mono text-6xl font-bold text-slate-900 mb-4 tracking-tighter">50M+</div>
            <h3 className="font-display text-xl font-bold mb-2">Daily Shipments</h3>
            <p className="font-body text-slate-600">Processed seamlessly with zero dropped events, up from a hard cap of 12M previously.</p>
          </div>
          <div className="hidden md:block w-px h-full bg-slate-200 absolute left-1/3" />
          <div>
            <div className="font-mono text-6xl font-bold text-slate-900 mb-4 tracking-tighter">1.2ms</div>
            <h3 className="font-display text-xl font-bold mb-2">Average Latency</h3>
            <p className="font-body text-slate-600">For complex routing calculations, down from 85ms on the legacy infrastructure.</p>
          </div>
          <div className="hidden md:block w-px h-full bg-slate-200 absolute left-2/3" />
          <div>
            <div className="font-mono text-6xl font-bold text-slate-900 mb-4 tracking-tighter">45%</div>
            <h3 className="font-display text-xl font-bold mb-2">Cost Reduction</h3>
            <p className="font-body text-slate-600">Achieved by shifting compute to the edge and eliminating oversized database instances.</p>
          </div>
        </div>
      </section>

      {/* 7. Pull-quote / Testimonial */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row gap-12 items-center">
          <div className="w-48 h-48 md:w-64 md:h-64 shrink-0 rounded-full overflow-hidden border-4 border-cyan-500/30">
            <img 
              src="/__mockup/images/case-study-portrait.jpg" 
              alt="Sarah Chen"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <svg className="w-12 h-12 text-cyan-400 mb-6 opacity-50" fill="currentColor" viewBox="0 0 32 32">
              <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2h2V8h-2zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2h2V8h-2z" />
            </svg>
            <blockquote className="font-display text-2xl md:text-3xl font-medium leading-relaxed mb-8">
              "Moving to Vectis wasn't just an infrastructure upgrade; it fundamentally changed how fast our product teams can move. We no longer worry about scale—we just focus on shipping value to our merchants."
            </blockquote>
            <div>
              <div className="font-display font-bold text-lg">Sarah Chen</div>
              <div className="font-mono text-sm text-cyan-400 mt-1 uppercase tracking-wider">VP of Engineering, Aura Logistics</div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Image gallery */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100">
            <img src="/__mockup/images/case-study-gallery-1.jpg" alt="Aura Logistics office exterior" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100">
            <img src="/__mockup/images/case-study-gallery-2.jpg" alt="Aura Logistics team meeting" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100">
            <img src="/__mockup/images/case-study-gallery-3.jpg" alt="Aura Logistics engineer coding" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
        </div>
      </section>

      {/* 9. TWO repeatable "deep-dive" content sections */}
      <section className="py-24 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          {/* Deep Dive 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
            <div className="order-2 lg:order-1">
              <h2 className="font-display text-3xl font-bold mb-6">Deep Dive: Real-time driver telemetry.</h2>
              <div className="font-body text-slate-600 space-y-6">
                <p>
                  One of the most complex challenges Aura faced was processing location telemetry from over 40,000 drivers simultaneously. The previous system batched these updates every 30 seconds, leading to stale routing data and inaccurate ETAs.
                </p>
                <p>
                  By leveraging Vectis Stream's WebSockets integration, Aura transitioned to a true real-time model. Location pings are ingested instantly, evaluated against geofences using Edge Compute, and immediately dispatched to the routing algorithm.
                </p>
                <div className="pt-4 border-t border-slate-200">
                  <div className="font-mono text-sm text-slate-500 uppercase tracking-widest mb-2">Key Metric</div>
                  <div className="font-display text-2xl font-bold text-slate-900">100ms end-to-end telemetry latency</div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-200">
                <img src="/__mockup/images/case-study-deep-dive-1.jpg" alt="Team reviewing telemetry data" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {/* Deep Dive 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-200">
                <img src="/__mockup/images/case-study-deep-dive-2.jpg" alt="Data visualization dashboard" className="w-full h-full object-cover" />
              </div>
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold mb-6">Deep Dive: Unifying analytics across regions.</h2>
              <div className="font-body text-slate-600 space-y-6">
                <p>
                  As Aura expanded into new markets, regional teams stood up isolated data warehouses. This fragmentation made global reporting nearly impossible and delayed critical business decisions.
                </p>
                <p>
                  Vectis provided the connective tissue. Using our managed connectors, Aura aggregates transactional data from 14 different regional databases into a centralized Snowflake instance in real-time, enabling unified dashboards and predictive modeling.
                </p>
                <div className="pt-4 border-t border-slate-200">
                  <div className="font-mono text-sm text-slate-500 uppercase tracking-widest mb-2">Key Metric</div>
                  <div className="font-display text-2xl font-bold text-slate-900">Zero data replication lag</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Key Takeaways */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <h2 className="font-display text-3xl font-bold mb-12 text-center">Key Takeaways</h2>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-sm">
          <ul className="space-y-6">
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0 font-mono font-bold text-sm">1</div>
              <div>
                <h4 className="font-display font-bold text-lg mb-1">Adopt Event-Driven Architecture</h4>
                <p className="font-body text-slate-600">Transitioning from batch processing to event streaming enables real-time decisions and unlocks massive scale.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0 font-mono font-bold text-sm">2</div>
              <div>
                <h4 className="font-display font-bold text-lg mb-1">Push Compute to the Edge</h4>
                <p className="font-body text-slate-600">Offloading lightweight calculations (like geofencing) to edge nodes significantly reduces core server load and latency.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0 font-mono font-bold text-sm">3</div>
              <div>
                <h4 className="font-display font-bold text-lg mb-1">Migrate Phased, Not Big Bang</h4>
                <p className="font-body text-slate-600">Using CDC to dual-write allows for safe, verifiable migrations without pausing product development.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* 11. CTA Band */}
      <section className="bg-cyan-500 py-24 px-6 text-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-20" />
        
        <div className="max-w-3xl mx-auto relative z-10">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-950 mb-6">Ready to scale your infrastructure?</h2>
          <p className="font-body text-xl text-slate-900/80 mb-10 max-w-2xl mx-auto">
            Join Aura Logistics and hundreds of other industry leaders building the future on Vectis.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#" className="bg-slate-950 text-white px-8 py-4 rounded-full font-body font-semibold text-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </a>
            <a href="#" className="bg-white/20 text-slate-950 border border-slate-950/20 px-8 py-4 rounded-full font-body font-semibold text-lg hover:bg-white/30 transition-colors flex items-center justify-center">
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* 12. Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 bg-cyan-400 rounded-sm flex items-center justify-center">
                  <Zap className="w-3 h-3 text-slate-950" />
                </div>
                <span className="font-display font-bold text-lg text-white tracking-tight">Vectis</span>
              </div>
              <p className="font-body text-sm max-w-xs">
                The real-time data platform for modern applications. Scale effortlessly, process instantly.
              </p>
            </div>
            <div>
              <h4 className="font-mono text-xs font-bold text-white uppercase tracking-widest mb-4">Product</h4>
              <ul className="space-y-3 font-body text-sm">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Stream</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Compute</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Connectors</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-mono text-xs font-bold text-white uppercase tracking-widest mb-4">Resources</h4>
              <ul className="space-y-3 font-body text-sm">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Case Studies</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-mono text-xs font-bold text-white uppercase tracking-widest mb-4">Company</h4>
              <ul className="space-y-3 font-body text-sm">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Legal</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 font-body text-sm">
            <div>© {new Date().getFullYear()} Vectis Data Inc. All rights reserved.</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
