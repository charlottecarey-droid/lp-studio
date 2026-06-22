import React from "react";
import { ArrowRight, ChevronRight, PlayCircle, BarChart3, Users, Zap, CheckCircle2, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShowcaseMicrosite() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] font-sans selection:bg-[#E5E0D8] selection:text-[#1A1A1A]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[#FAF9F6]" />
          </div>
          <span className="font-medium text-sm tracking-tight text-white mix-blend-difference">LP Studio</span>
        </div>
        <div className="pointer-events-auto">
          <Button variant="ghost" className="rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 hover:text-white border border-white/20 text-sm h-10 px-6 font-medium">
            Contact Team
          </Button>
        </div>
      </nav>

      {/* Hero Section - Full Bleed Image with Offset Content */}
      <header className="relative h-[90vh] min-h-[600px] w-full overflow-hidden bg-[#2A2A2A]">
        <img 
          src="/__mockup/images/abm-show-hero.png" 
          alt="Modern architecture" 
          className="absolute inset-0 w-full h-full object-cover object-center opacity-90 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-20 z-10 flex flex-col items-start justify-end h-full">
          <div className="max-w-2xl bg-[#FAF9F6]/95 backdrop-blur-xl p-8 md:p-12 rounded-[2rem] shadow-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E5E0D8] text-[#1A1A1A] text-xs font-semibold tracking-wide mb-6 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]"></span>
              Prepared for Vantage
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.1] tracking-tight mb-6 text-[#1A1A1A]">
              Accelerate your revenue engine, beautifully.
            </h1>
            <p className="text-lg md:text-xl text-[#4A4A4A] mb-8 leading-relaxed max-w-xl">
              Launch on-brand, personalized campaign pages and microsites in minutes. We've built the foundation for Vantage to scale its go-to-market motions without compromising design.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button className="rounded-full bg-[#1A1A1A] hover:bg-[#333333] text-white h-14 px-8 text-base font-medium transition-transform hover:scale-[1.02]">
                Explore the approach
              </Button>
              <Button variant="ghost" className="rounded-full bg-transparent hover:bg-[#E5E0D8] text-[#1A1A1A] h-14 px-8 text-base font-medium">
                Watch demo <PlayCircle className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Value Statement */}
      <section className="py-24 md:py-32 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium leading-tight tracking-tight text-[#1A1A1A]">
            You shouldn't have to choose between speed and quality. Vantage deserves digital experiences that build trust instantly, deployed at the speed of sales.
          </h2>
        </div>
      </section>

      {/* Why Now */}
      <section className="py-20 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto bg-white rounded-[3rem] overflow-hidden shadow-sm border border-[#E5E0D8]/50">
          <div className="grid lg:grid-cols-2 gap-0">
            <div className="p-12 md:p-20 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF9F6] text-[#1A1A1A] text-xs font-semibold tracking-wide mb-8 uppercase border border-[#E5E0D8]">
                The Opportunity
              </div>
              <h3 className="text-3xl md:text-4xl font-semibold leading-tight mb-6">
                The buyer journey has shifted to digital-first.
              </h3>
              <p className="text-[#4A4A4A] text-lg leading-relaxed mb-8">
                Your buyers are doing 80% of their research before they ever speak to sales. The static PDFs and generic landing pages of the past are no longer enough to win the modern enterprise deal. It's time for a tailored, premium approach.
              </p>
              <ul className="space-y-4 mb-10">
                {[
                  "Personalized buyer experiences convert 3x higher",
                  "Consistent brand design builds instant credibility",
                  "Self-serve content hubs accelerate deal cycles"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[#1A1A1A] font-medium">
                    <CheckCircle2 className="w-6 h-6 text-[#1A1A1A] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div>
                <Button variant="link" className="px-0 text-[#1A1A1A] font-medium hover:no-underline group">
                  Read our latest buyer report 
                  <span className="inline-block transition-transform group-hover:translate-x-1"><ArrowRight className="ml-2 w-4 h-4" /></span>
                </Button>
              </div>
            </div>
            <div className="relative h-[400px] lg:h-auto hidden md:block">
              <img 
                src="/__mockup/images/abm-show-why.png" 
                alt="Team collaboration" 
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="mb-16 md:mb-24">
          <h2 className="text-3xl md:text-4xl font-semibold leading-tight mb-6">A frictionless approach.</h2>
          <p className="text-lg text-[#4A4A4A] max-w-2xl">Deploying high-end campaigns doesn't require months of engineering time. We've streamlined the process for revenue teams.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-[#E5E0D8] hidden md:block -z-10" />
          
          {[
            {
              step: "01",
              title: "Connect your data",
              desc: "Seamlessly integrate with your CRM and MAP to pull in account data, intent signals, and audience segments."
            },
            {
              step: "02",
              title: "Select your template",
              desc: "Choose from a library of premium, brand-approved templates designed for specific go-to-market motions."
            },
            {
              step: "03",
              title: "Launch & measure",
              desc: "Publish your campaign in one click and track engagement down to the individual buyer level."
            }
          ].map((item, i) => (
            <div key={i} className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-[2rem] p-10 relative group hover:border-[#1A1A1A]/20 transition-colors duration-300">
              <div className="w-16 h-16 rounded-full bg-white border border-[#E5E0D8] flex items-center justify-center text-xl font-semibold mb-8 shadow-sm group-hover:scale-110 transition-transform duration-300">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold mb-4">{item.title}</h3>
              <p className="text-[#4A4A4A] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 px-6 md:px-12 lg:px-20 bg-[#1A1A1A] text-white rounded-t-[3rem]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-semibold leading-tight mb-6 text-[#FAF9F6]">Built for every motion.</h2>
              <p className="text-lg text-white/70">From 1:1 account pages to massive event hubs, create digital destinations that look custom-coded.</p>
            </div>
            <Button className="rounded-full bg-white text-[#1A1A1A] hover:bg-[#E5E0D8] h-12 px-6 font-medium shrink-0 w-fit">
              View all capabilities
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "ABM Microsites",
                desc: "Highly personalized 1:1 or 1:few destinations for target accounts.",
                icon: <Users className="w-6 h-6" />
              },
              {
                title: "Campaign Pages",
                desc: "High-converting landing pages for paid social and email campaigns.",
                icon: <Zap className="w-6 h-6" />
              },
              {
                title: "Webinar & Content Hubs",
                desc: "Beautiful resource centers to host your best on-demand content.",
                icon: <BarChart3 className="w-6 h-6" />
              },
              {
                title: "Event Portals",
                desc: "Immersive registration and agenda pages for field marketing.",
                icon: <ChevronRight className="w-6 h-6" />
              }
            ].map((useCase, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-[2rem] p-10 hover:bg-white/10 transition-colors cursor-pointer group flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-8 text-white group-hover:bg-white group-hover:text-[#1A1A1A] transition-colors">
                  {useCase.icon}
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-[#FAF9F6]">{useCase.title}</h3>
                <p className="text-white/60 leading-relaxed mb-8 flex-grow">{useCase.desc}</p>
                <div className="flex items-center text-sm font-medium text-white/80 group-hover:text-white transition-colors mt-auto">
                  Explore <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof / Case Study */}
      <section className="py-24 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="bg-[#E5E0D8]/40 rounded-[3rem] overflow-hidden">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="p-12 md:p-20 pr-0">
              <h2 className="text-3xl md:text-4xl font-semibold leading-tight mb-12 text-[#1A1A1A]">
                "LP Studio completely transformed how we go to market. We're launching campaigns 75% faster, and they look like they were built by a premium design agency."
              </h2>
              
              <div className="flex items-center gap-4 mb-12">
                <div className="w-14 h-14 rounded-full bg-[#1A1A1A] flex items-center justify-center overflow-hidden">
                  <span className="text-white font-medium text-lg">SJ</span>
                </div>
                <div>
                  <div className="font-semibold text-[#1A1A1A]">Sarah Jenkins</div>
                  <div className="text-[#4A4A4A] text-sm">VP of Demand Gen, Enterprise Tech</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-[#1A1A1A]/10">
                <div>
                  <div className="text-4xl md:text-5xl font-semibold text-[#1A1A1A] mb-2 tracking-tight">3x</div>
                  <div className="text-[#4A4A4A] text-sm font-medium uppercase tracking-wider">More variations</div>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-semibold text-[#1A1A1A] mb-2 tracking-tight">42%</div>
                  <div className="text-[#4A4A4A] text-sm font-medium uppercase tracking-wider">Engagement Lift</div>
                </div>
              </div>
            </div>
            <div className="h-full min-h-[500px] p-6 lg:p-0 lg:pr-6 pb-6 lg:pb-6">
              <div className="w-full h-full rounded-[2rem] overflow-hidden relative">
                <img 
                  src="/__mockup/images/abm-show-case-study.png" 
                  alt="Case study" 
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-20 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <h2 className="text-3xl font-semibold mb-12">Curated for you</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "The Enterprise Guide to Digital Experience",
              type: "Ebook",
              tag: "Strategy"
            },
            {
              title: "How Top Teams Structure Campaign Operations",
              type: "Webinar",
              tag: "Operations"
            },
            {
              title: "Design Systems in Go-to-Market",
              type: "Article",
              tag: "Design"
            }
          ].map((resource, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="aspect-[4/3] bg-white border border-[#E5E0D8] rounded-[2rem] p-8 flex flex-col justify-between mb-6 transition-all duration-300 group-hover:shadow-md group-hover:border-[#1A1A1A]/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0">
                  <div className="w-10 h-10 rounded-full bg-[#FAF9F6] flex items-center justify-center border border-[#E5E0D8]">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#E5E0D8] text-[#4A4A4A] text-xs font-semibold uppercase tracking-wider w-fit">
                  {resource.type}
                </div>
                <h3 className="text-xl font-semibold text-[#1A1A1A] leading-snug">{resource.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA / Let's Talk */}
      <section className="py-24 md:py-32 px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto bg-white border border-[#E5E0D8] rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-gradient-to-b from-[#E5E0D8]/30 to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-semibold leading-tight mb-6 text-[#1A1A1A] tracking-tight">
              Ready to elevate your campaigns?
            </h2>
            <p className="text-xl text-[#4A4A4A] mb-12 max-w-2xl mx-auto">
              Our team is ready to show you how LP Studio can integrate with your existing tech stack and brand guidelines.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button className="rounded-full bg-[#1A1A1A] hover:bg-[#333333] text-white h-14 px-10 text-base font-medium transition-transform hover:scale-[1.02] w-full sm:w-auto">
                Book a consultation
              </Button>
              <Button variant="outline" className="rounded-full bg-white border-[#E5E0D8] text-[#1A1A1A] hover:bg-[#FAF9F6] h-14 px-10 text-base font-medium w-full sm:w-auto">
                Send us an email
              </Button>
            </div>
            
            <div className="mt-16 pt-10 border-t border-[#E5E0D8] flex flex-col items-center justify-center">
              <p className="text-sm font-medium text-[#4A4A4A] mb-4 uppercase tracking-wider">Your Dedicated Team</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#E5E0D8] flex items-center justify-center overflow-hidden">
                  <span className="text-[#1A1A1A] font-semibold text-sm">MC</span>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-[#1A1A1A]">Marcus Chen</div>
                  <div className="text-sm text-[#4A4A4A]">Enterprise Solutions</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-10 text-center border-t border-[#E5E0D8]">
        <p className="text-sm text-[#4A4A4A]">© {new Date().getFullYear()} LP Studio. Designed for Vantage.</p>
      </footer>
    </div>
  );
}
