import React from "react";
import { ArrowRight, ArrowUpRight, BarChart, ChevronRight, Globe, Layout, LineChart, MessageSquare, MousePointerClick, Zap } from "lucide-react";

export function SplitMicrosite() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans antialiased selection:bg-zinc-200">
      
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-16 py-6 mix-blend-difference text-white">
        <div className="font-medium text-lg tracking-tight">LP Studio</div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium hidden md:inline-block opacity-80">Prepared for Vantage</span>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col lg:flex-row min-h-[100dvh]">
        {/* Left Content */}
        <div className="w-full lg:w-1/2 flex items-center p-8 md:p-16 lg:p-24 bg-white relative z-10">
          <div className="max-w-xl w-full">
            <div className="inline-block border border-zinc-200 px-3 py-1 text-xs font-medium tracking-wide uppercase text-zinc-500 mb-8">
              Enterprise Partnership
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.1] tracking-tight mb-6">
              Accelerate Vantage's move upmarket.
            </h1>
            <p className="text-lg md:text-xl text-zinc-500 leading-relaxed mb-10 font-light">
              We built LP Studio to help revenue teams like Vantage launch on-brand, highly personalized digital experiences at scale—without waiting on engineering.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium tracking-wide bg-zinc-900 text-white border border-zinc-900 hover:bg-zinc-800 transition-colors">
                Explore the platform
              </button>
              <button className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium tracking-wide bg-transparent text-zinc-900 border border-zinc-300 hover:border-zinc-900 transition-colors">
                Read the case study
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Image */}
        <div className="w-full lg:w-1/2 relative min-h-[50vh] lg:min-h-[100dvh]">
          <img 
            src="/__mockup/images/abm-split-hero.png" 
            alt="Modern architectural structure" 
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </section>

      <main className="max-w-[1600px] mx-auto border-l border-r border-zinc-200 bg-white">
        
        {/* Value Statement */}
        <section className="py-24 md:py-32 px-8 md:px-16 border-b border-zinc-200">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-4xl font-light leading-snug tracking-tight text-zinc-800">
              In a crowded market, generic touchpoints fail to convert. The fastest-growing enterprise teams win by making every buyer feel like a market of one.
            </h2>
          </div>
        </section>

        {/* Why Now */}
        <section className="flex flex-col lg:flex-row border-b border-zinc-200">
          <div className="w-full lg:w-1/2 p-8 md:p-16 border-b lg:border-b-0 lg:border-r border-zinc-200 flex flex-col justify-center">
            <div className="text-xs font-medium tracking-wide uppercase text-zinc-500 mb-6">The Shift</div>
            <h3 className="text-3xl font-normal tracking-tight mb-6">The enterprise bottleneck.</h3>
            <p className="text-zinc-500 leading-relaxed mb-6 font-light text-lg">
              As Vantage scales its enterprise motion, your sales and marketing teams need to create bespoke, highly-relevant experiences for target accounts. But custom pages require engineering cycles, causing campaigns to stall and opportunities to cool.
            </p>
            <p className="text-zinc-500 leading-relaxed font-light text-lg">
              LP Studio removes this friction, empowering go-to-market teams to spin up stunning, secure, and performant microsites in minutes.
            </p>
          </div>
          <div className="w-full lg:w-1/2 relative min-h-[400px]">
            <img 
              src="/__mockup/images/abm-split-whynow.png" 
              alt="Team collaboration space" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 md:py-32 px-8 md:px-16 border-b border-zinc-200">
          <div className="text-xs font-medium tracking-wide uppercase text-zinc-500 mb-16 text-center">Our Approach</div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {/* Step 1 */}
            <div className="p-8 md:p-12 border border-zinc-200 md:border-r-0 hover:bg-zinc-50 transition-colors">
              <div className="w-10 h-10 rounded-full border border-zinc-300 flex items-center justify-center text-sm font-medium mb-8">01</div>
              <h4 className="text-xl font-medium mb-4">Connect your brand</h4>
              <p className="text-zinc-500 font-light leading-relaxed">
                Ingest Vantage's exact typography, color palette, and component styles so every generated page is undeniably yours.
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="p-8 md:p-12 border border-zinc-200 md:border-r-0 hover:bg-zinc-50 transition-colors">
              <div className="w-10 h-10 rounded-full border border-zinc-300 flex items-center justify-center text-sm font-medium mb-8">02</div>
              <h4 className="text-xl font-medium mb-4">Deploy at scale</h4>
              <p className="text-zinc-500 font-light leading-relaxed">
                Enable field teams to generate personalized microsites, event hubs, and campaign pages without writing code.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 md:p-12 border border-zinc-200 hover:bg-zinc-50 transition-colors">
              <div className="w-10 h-10 rounded-full border border-zinc-300 flex items-center justify-center text-sm font-medium mb-8">03</div>
              <h4 className="text-xl font-medium mb-4">Measure & optimize</h4>
              <p className="text-zinc-500 font-light leading-relaxed">
                Track engagement down to the account level. Know exactly when target buyers are interacting with your content.
              </p>
            </div>
          </div>
        </section>

        {/* Use Cases Grid */}
        <section className="border-b border-zinc-200 bg-[#fafafa]">
          <div className="flex flex-col lg:flex-row">
            <div className="w-full lg:w-1/3 p-8 md:p-16 border-b lg:border-b-0 lg:border-r border-zinc-200 flex flex-col justify-between">
              <div>
                <h3 className="text-3xl font-normal tracking-tight mb-6">Designed for every motion.</h3>
                <p className="text-zinc-500 leading-relaxed font-light">
                  From highly targeted 1:1 account pages to scalable webinar hubs, deploy the exact experience your campaign demands.
                </p>
              </div>
              <div className="mt-12">
                <button className="inline-flex items-center text-sm font-medium group text-zinc-900">
                  View all capabilities
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            <div className="w-full lg:w-2/3 grid grid-cols-1 md:grid-cols-2">
              {[
                { title: "ABM Deal Rooms", icon: Layout, desc: "Bespoke 1:1 pages for your most valuable target accounts." },
                { title: "Event Hubs", icon: Globe, desc: "Registration, agenda, and follow-up hubs for field marketing." },
                { title: "Campaign Pages", icon: Zap, desc: "High-converting destination pages for paid media and outbound." },
                { title: "Partner Portals", icon: MessageSquare, desc: "Enable channel partners with co-branded resources and collateral." }
              ].map((item, idx) => (
                <div key={idx} className={`p-10 border-b border-zinc-200 ${idx % 2 === 0 ? 'md:border-r' : ''} bg-white hover:bg-zinc-50/50 transition-colors`}>
                  <item.icon className="w-6 h-6 text-zinc-400 mb-6" strokeWidth={1.5} />
                  <h4 className="text-lg font-medium mb-3">{item.title}</h4>
                  <p className="text-zinc-500 font-light text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-24 md:py-32 px-8 md:px-16 border-b border-zinc-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
            <div>
              <div className="text-xs font-medium tracking-wide uppercase text-zinc-500 mb-12">The Impact</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-16">
                <div className="border border-zinc-200 p-8">
                  <div className="text-4xl font-light mb-2">75%</div>
                  <div className="text-sm text-zinc-500">Faster time to market for campaign pages</div>
                </div>
                <div className="border border-zinc-200 p-8">
                  <div className="text-4xl font-light mb-2">3.2x</div>
                  <div className="text-sm text-zinc-500">Increase in account engagement rates</div>
                </div>
              </div>
              <figure className="pl-6 border-l-2 border-zinc-200">
                <blockquote className="text-xl md:text-2xl font-light leading-snug mb-6 text-zinc-800">
                  "LP Studio completely transformed how our sales team goes to market. What used to take three weeks of engineering time now takes a field marketer twenty minutes."
                </blockquote>
                <figcaption className="text-sm font-medium">
                  Sarah Jenkins <span className="text-zinc-500 font-normal">— VP Marketing, Sentinel Data</span>
                </figcaption>
              </figure>
            </div>
            <div className="relative border border-zinc-200 p-2 bg-[#fafafa]">
               <img 
                src="/__mockup/images/abm-split-casestudy.png" 
                alt="Workspace still life" 
                className="w-full h-full object-cover min-h-[300px]"
              />
            </div>
          </div>
        </section>

        {/* Resources */}
        <section className="py-24 md:py-32 px-8 md:px-16 border-b border-zinc-200 bg-[#fafafa]">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <h3 className="text-2xl font-normal tracking-tight mb-2">Recommended for Vantage</h3>
              <p className="text-zinc-500 font-light">Curated insights on scaling enterprise go-to-market.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { type: "Whitepaper", title: "The New Standard for Enterprise ABM", time: "12 min read" },
              { type: "Case Study", title: "How Datacorp accelerated deal velocity by 40%", time: "5 min read" },
              { type: "Webinar", title: "Scaling personalization without breaking brand", time: "45 min watch" }
            ].map((resource, i) => (
              <a key={i} href="#" className="group block border border-zinc-200 bg-white p-8 hover:border-zinc-400 transition-colors">
                <div className="flex justify-between items-start mb-12">
                  <span className="text-xs font-medium tracking-wide uppercase text-zinc-500">{resource.type}</span>
                  <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                </div>
                <h4 className="text-lg font-medium mb-4 pr-4">{resource.title}</h4>
                <span className="text-sm text-zinc-500 font-light">{resource.time}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-24 md:py-32 px-8 md:px-16 text-center bg-white">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-normal tracking-tight mb-6">Let's discuss your enterprise strategy.</h2>
            <p className="text-zinc-500 text-lg font-light leading-relaxed mb-12">
              Ready to see how LP Studio can accelerate Vantage's go-to-market motion? Schedule a tailored technical walkthrough.
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-12">
              <div className="flex items-center gap-4 text-left border border-zinc-200 p-4 min-w-[280px]">
                <img src="/__mockup/images/abm-split-contact1.png" alt="Elena Rodriguez" className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <div className="font-medium text-sm">Elena Rodriguez</div>
                  <div className="text-xs text-zinc-500">Strategic Accounts</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-left border border-zinc-200 p-4 min-w-[280px]">
                <img src="/__mockup/images/abm-split-contact2.png" alt="Marcus Chen" className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <div className="font-medium text-sm">Marcus Chen</div>
                  <div className="text-xs text-zinc-500">Solutions Engineer</div>
                </div>
              </div>
            </div>

            <button className="inline-flex items-center justify-center px-8 py-4 text-sm font-medium tracking-wide bg-zinc-900 text-white border border-zinc-900 hover:bg-zinc-800 transition-colors">
              Schedule your walkthrough
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-8 md:px-16 py-8 border-t border-zinc-200 bg-[#fafafa] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm font-medium tracking-tight">LP Studio</div>
          <div className="text-xs text-zinc-400 font-light">
            © {new Date().getFullYear()} LP Studio Inc. All rights reserved.
          </div>
        </footer>

      </main>
    </div>
  );
}
