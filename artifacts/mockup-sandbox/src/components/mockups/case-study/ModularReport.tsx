import React, { useState, useEffect } from "react";
import { ChevronRight, ArrowRight, CheckCircle2, ChevronDown, Download, Share2, PlayCircle, BarChart3, Database, Shield, Zap, Maximize2, MoveRight, Layers, FileText } from "lucide-react";

const THEME = {
  bg: "bg-[#F7F7F5]",
  fg: "text-[#111111]",
  primary: "bg-[#111111] text-white",
  card: "bg-white border border-[#E5E5E5]",
  accent: "text-[#4A4A4A]",
  highlight: "text-[#0055FF]",
  fontFamily: "'Inter', sans-serif"
};

// Layout wrapper injecting Google Font
export function ModularReport() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        html { scroll-behavior: smooth; }
      `}} />
      <div style={{ fontFamily: THEME.fontFamily }} className={`min-h-screen ${THEME.bg} ${THEME.fg} selection:bg-[#111] selection:text-white`}>
        <ReportLayout />
      </div>
    </>
  );
}

function ReportLayout() {
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("section[id]");
      let current = "hero";
      sections.forEach((section) => {
        const sectionTop = (section as HTMLElement).offsetTop;
        if (window.scrollY >= sectionTop - 200) {
          current = section.getAttribute("id") || "hero";
        }
      });
      setActiveSection(current);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { id: "hero", label: "Overview" },
    { id: "challenge", label: "01 The Challenge" },
    { id: "approach", label: "02 The Approach" },
    { id: "results", label: "03 Results" },
    { id: "testimonial", label: "04 Testimonial" },
    { id: "module-1", label: "05 Implementation" },
    { id: "module-2", label: "06 Scale" },
    { id: "module-3", label: "07 Optimization" },
    { id: "gallery", label: "08 Gallery" },
    { id: "takeaways", label: "09 Key Takeaways" }
  ];

  return (
    <div className="flex flex-col md:flex-row max-w-[1600px] mx-auto">
      
      {/* LEFT RAIL: Sticky TOC */}
      <aside className="w-full md:w-[280px] lg:w-[320px] md:h-screen md:sticky top-0 border-r border-[#E5E5E5] bg-[#F7F7F5] z-40 hidden md:flex flex-col">
        <div className="p-8 border-b border-[#E5E5E5] flex items-center gap-3">
          <div className="w-8 h-8 bg-[#111] rounded-sm flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight text-sm uppercase">Vanguard Systems</span>
        </div>
        
        <div className="p-8 flex-1 overflow-y-auto">
          <div className="text-[10px] font-semibold tracking-widest text-[#888] uppercase mb-6">Case Study Dossier</div>
          <nav className="flex flex-col gap-1">
            {navItems.map(item => (
              <a 
                key={item.id} 
                href={`#${item.id}`}
                className={`py-2 px-3 rounded-md text-sm transition-all duration-200 flex items-center gap-3 group
                  ${activeSection === item.id ? 'bg-white shadow-sm font-medium text-[#111]' : 'text-[#666] hover:bg-[#EAEAEA] hover:text-[#111]'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${activeSection === item.id ? 'bg-[#0055FF]' : 'bg-transparent group-hover:bg-[#CCC]'}`} />
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="p-8 border-t border-[#E5E5E5]">
          <button className="w-full py-3 bg-[#111] text-white text-sm font-medium rounded hover:bg-[#333] transition-colors flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </aside>

      {/* MOBILE NAV (hidden on desktop) */}
      <div className="md:hidden sticky top-0 bg-white border-b border-[#E5E5E5] z-50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#111]" />
          <span className="font-semibold text-sm">Vanguard</span>
        </div>
        <select 
          className="text-sm border border-[#E5E5E5] rounded p-2 bg-[#F7F7F5]"
          value={activeSection}
          onChange={(e) => {
            document.getElementById(e.target.value)?.scrollIntoView();
          }}
        >
          {navItems.map(item => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 bg-white">
        
        {/* Section 00: Overview / Hero */}
        <section id="hero" className="relative p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5]">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F0F4FF] text-[#0055FF] rounded-full text-xs font-semibold tracking-wide uppercase mb-8">
              <span className="w-2 h-2 rounded-full bg-[#0055FF] animate-pulse"></span>
              Enterprise Transformation
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
              How Globex scaled their data infrastructure by <span className="text-[#0055FF]">400%</span> in six months.
            </h1>
            
            <p className="text-xl md:text-2xl text-[#4A4A4A] font-light leading-relaxed mb-12 max-w-3xl">
              Faced with exponential user growth, Globex partnered with Vanguard to completely re-architect their legacy systems into a modular, highly-available data fabric.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-[#F7F7F5] rounded-xl border border-[#E5E5E5]">
              <div>
                <div className="text-3xl font-bold mb-1">400%</div>
                <div className="text-sm text-[#666]">Capacity Increase</div>
              </div>
              <div>
                <div className="text-3xl font-bold mb-1">99.999%</div>
                <div className="text-sm text-[#666]">Uptime Maintained</div>
              </div>
              <div>
                <div className="text-3xl font-bold mb-1">6mo</div>
                <div className="text-sm text-[#666]">Implementation Time</div>
              </div>
              <div>
                <div className="text-3xl font-bold mb-1">-$2.4M</div>
                <div className="text-sm text-[#666]">Infrastructure Cost</div>
              </div>
            </div>
          </div>
          
          <div className="mt-16 rounded-xl overflow-hidden aspect-[21/9] bg-[#EAEAEA]">
            <img src="/__mockup/images/vanguard-hero.png" alt="Architecture" className="w-full h-full object-cover" />
          </div>
        </section>

        {/* Section: Customer Fact Panel */}
        <section className="p-8 md:p-16 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="max-w-4xl flex flex-col md:flex-row gap-12">
            <div className="w-full md:w-1/3">
              <h3 className="text-sm font-semibold tracking-widest text-[#888] uppercase mb-4">The Client</h3>
              <div className="text-2xl font-bold mb-2">Globex Corp</div>
              <p className="text-[#666] text-sm">Global logistics and supply chain optimization platform.</p>
            </div>
            <div className="w-full md:w-2/3 grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-semibold tracking-widest text-[#888] uppercase mb-2">Industry</h3>
                <p className="font-medium">Logistics & Supply Chain</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold tracking-widest text-[#888] uppercase mb-2">Company Size</h3>
                <p className="font-medium">10,000+ Employees</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold tracking-widest text-[#888] uppercase mb-2">Headquarters</h3>
                <p className="font-medium">Seattle, WA</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold tracking-widest text-[#888] uppercase mb-2">Vanguard Products</h3>
                <p className="font-medium">Compute, Data Fabric, Shield</p>
              </div>
            </div>
          </div>
        </section>

        {/* 01 The Challenge */}
        <section id="challenge" className="p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5] relative group">
          <ModuleAffordance />
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-4xl font-light text-[#CCC]">01</span>
              <h2 className="text-3xl font-bold tracking-tight">The Challenge</h2>
            </div>
            <div className="prose prose-lg text-[#333]">
              <p className="lead text-xl text-[#111] mb-6">
                Legacy monoliths were cracking under the pressure of real-time global tracking.
              </p>
              <p className="mb-6">
                Globex's systems were originally designed for a batch-processing world. As they shifted to real-time IoT tracking for their global fleet, the data ingestion rate jumped from 10,000 events per second to over 250,000. 
              </p>
              <p>
                The resulting latency spikes meant that "real-time" dashboards were often delayed by up to 15 minutes, causing significant routing errors and customer dissatisfaction. They needed a paradigm shift, not just an upgrade.
              </p>
            </div>
          </div>
        </section>

        {/* 02 The Approach */}
        <section id="approach" className="p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5] relative group bg-[#111] text-white">
          <ModuleAffordance dark />
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-12">
              <span className="text-4xl font-light text-[#555]">02</span>
              <h2 className="text-3xl font-bold tracking-tight">The Approach</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="border-t border-[#333] pt-6">
                <Database className="w-8 h-8 text-[#0055FF] mb-4" />
                <h3 className="text-lg font-semibold mb-3">Decoupled Storage</h3>
                <p className="text-[#999] text-sm leading-relaxed">
                  Separated compute from storage to allow independent scaling during peak traffic events without over-provisioning hardware.
                </p>
              </div>
              <div className="border-t border-[#333] pt-6">
                <Zap className="w-8 h-8 text-[#0055FF] mb-4" />
                <h3 className="text-lg font-semibold mb-3">Event-Driven Architecture</h3>
                <p className="text-[#999] text-sm leading-relaxed">
                  Implemented Vanguard Fabric to process IoT streams in real-time, reducing end-to-end latency to sub-50ms.
                </p>
              </div>
              <div className="border-t border-[#333] pt-6">
                <Shield className="w-8 h-8 text-[#0055FF] mb-4" />
                <h3 className="text-lg font-semibold mb-3">Zero-Trust Security</h3>
                <p className="text-[#999] text-sm leading-relaxed">
                  Applied granular access controls across all microservices to ensure data integrity without sacrificing speed.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 03 Results */}
        <section id="results" className="p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5] relative group">
          <ModuleAffordance />
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-12">
              <span className="text-4xl font-light text-[#CCC]">03</span>
              <h2 className="text-3xl font-bold tracking-tight">The Impact</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-8 bg-white border border-[#E5E5E5] rounded-xl shadow-sm">
                <div className="text-5xl font-bold text-[#0055FF] mb-2">-98%</div>
                <h4 className="text-lg font-semibold mb-2">Latency Reduction</h4>
                <p className="text-[#666] text-sm">Dashboard delay dropped from 15 minutes to under 200 milliseconds globally.</p>
              </div>
              <div className="p-8 bg-white border border-[#E5E5E5] rounded-xl shadow-sm">
                <div className="text-5xl font-bold text-[#0055FF] mb-2">2.5M</div>
                <h4 className="text-lg font-semibold mb-2">Events Per Second</h4>
                <p className="text-[#666] text-sm">New peak ingestion capacity, fully tested and validated during Black Friday.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 04 Testimonial */}
        <section id="testimonial" className="p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5] bg-[#F0F4FF] relative group">
          <ModuleAffordance />
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8 flex justify-center">
              <div className="w-16 h-16 bg-[#0055FF] rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 11L8 15H11V18H5V15L7 11H5V6H10V11ZM19 11L17 15H20V18H14V15L16 11H14V6H19V11Z" fill="white"/>
                </svg>
              </div>
            </div>
            <blockquote className="text-2xl md:text-4xl font-medium tracking-tight text-[#111] leading-tight mb-8">
              "Vanguard didn't just give us a tool; they gave us a completely new operating model. The modular architecture means we can deploy new tracking features in days instead of months."
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#CCC] overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=sarah&backgroundColor=e5e5e5`} alt="Sarah Jenkins" className="w-full h-full" />
              </div>
              <div className="text-left">
                <div className="font-bold">Sarah Jenkins</div>
                <div className="text-sm text-[#666]">Chief Technology Officer, Globex</div>
              </div>
            </div>
          </div>
        </section>

        {/* 05, 06, 07: Repeatable Modules */}
        <div className="bg-[#FAFAFA]">
          <div className="p-8 md:p-16 lg:px-24 pt-16 pb-8 border-b border-[#E5E5E5]">
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#888]">
              <FileText className="w-4 h-4" /> Deep Dive Modules
            </div>
          </div>

          {/* Module 1 */}
          <section id="module-1" className="p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5] relative group bg-white">
            <ModuleAffordance />
            <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
              <div className="lg:w-1/2">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-2xl font-light text-[#CCC]">05</span>
                  <h3 className="text-2xl font-bold tracking-tight">Implementation Phase</h3>
                </div>
                <p className="text-[#4A4A4A] text-lg mb-6 leading-relaxed">
                  The migration strategy was designed to avoid any "big bang" risks. We started by mirroring the ingestion pipeline, running Vanguard Fabric in parallel with their legacy system to validate data consistency.
                </p>
                <ul className="space-y-3 text-[#4A4A4A]">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0" /> Zero downtime during migration</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0" /> 100% data consistency verified via dual-writes</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0" /> Incremental read-path cutover per region</li>
                </ul>
              </div>
              <div className="lg:w-1/2 w-full">
                <div className="aspect-square rounded-xl overflow-hidden bg-[#EAEAEA]">
                  <img src="/__mockup/images/vanguard-module-1.png" alt="Implementation" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </section>

          {/* Module 2 */}
          <section id="module-2" className="p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5] relative group bg-white">
            <ModuleAffordance />
            <div className="max-w-5xl mx-auto flex flex-col lg:flex-row-reverse gap-16 items-center">
              <div className="lg:w-1/2">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-2xl font-light text-[#CCC]">06</span>
                  <h3 className="text-2xl font-bold tracking-tight">Scale & Stress Testing</h3>
                </div>
                <p className="text-[#4A4A4A] text-lg mb-6 leading-relaxed">
                  Before finalizing the cutover, the new architecture was subjected to rigorous chaos engineering. We simulated regional network failures, massive traffic spikes, and cascading pod crashes.
                </p>
                <ul className="space-y-3 text-[#4A4A4A]">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0" /> Automated failover across 3 AWS regions</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0" /> Recovery time objective (RTO) under 10 seconds</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0" /> Sustained 5x synthetic traffic load with zero dropped events</li>
                </ul>
              </div>
              <div className="lg:w-1/2 w-full">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#EAEAEA]">
                  <img src="/__mockup/images/vanguard-module-2.png" alt="Scale Testing" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </section>

          {/* Module 3 */}
          <section id="module-3" className="p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5] relative group bg-white">
            <ModuleAffordance />
            <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
              <div className="lg:w-1/2">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-2xl font-light text-[#CCC]">07</span>
                  <h3 className="text-2xl font-bold tracking-tight">Continuous Optimization</h3>
                </div>
                <p className="text-[#4A4A4A] text-lg mb-6 leading-relaxed">
                  Post-launch, Vanguard's AI-driven resource allocator automatically tuned the cluster sizes based on predictive traffic models, drastically reducing infrastructure waste.
                </p>
                <ul className="space-y-3 text-[#4A4A4A]">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0" /> 40% reduction in baseline compute costs</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0" /> Spot instance utilization maximized for batch jobs</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0" /> Carbon footprint reduced by optimizing workload placement</li>
                </ul>
              </div>
              <div className="lg:w-1/2 w-full">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#EAEAEA]">
                  <img src="/__mockup/images/vanguard-module-3.png" alt="Optimization" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 08 Gallery */}
        <section id="gallery" className="p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5] relative group bg-[#111]">
          <ModuleAffordance dark />
          <div className="flex items-center gap-4 mb-12">
            <span className="text-4xl font-light text-[#555]">08</span>
            <h2 className="text-3xl font-bold tracking-tight text-white">Visual Artifacts</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="aspect-square bg-[#222] rounded-xl overflow-hidden group/img cursor-pointer relative">
              <img src="/__mockup/images/vanguard-gallery-1.png" className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105 opacity-80 group-hover/img:opacity-100" alt="Architecture Diagram" />
              <div className="absolute inset-0 border border-white/10 rounded-xl"></div>
            </div>
            <div className="aspect-square bg-[#222] rounded-xl overflow-hidden group/img cursor-pointer relative">
              <img src="/__mockup/images/vanguard-gallery-2.png" className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105 opacity-80 group-hover/img:opacity-100" alt="Team Session" />
              <div className="absolute inset-0 border border-white/10 rounded-xl"></div>
            </div>
            <div className="aspect-square bg-[#222] rounded-xl overflow-hidden group/img cursor-pointer relative">
              <img src="/__mockup/images/vanguard-gallery-3.png" className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105 opacity-80 group-hover/img:opacity-100" alt="Hardware Node" />
              <div className="absolute inset-0 border border-white/10 rounded-xl"></div>
            </div>
          </div>
        </section>

        {/* 09 Key Takeaways */}
        <section id="takeaways" className="p-8 md:p-16 lg:p-24 border-b border-[#E5E5E5] relative group">
          <ModuleAffordance />
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-12">
              <span className="text-4xl font-light text-[#CCC]">09</span>
              <h2 className="text-3xl font-bold tracking-tight">Key Takeaways</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-[#F0F4FF] rounded-lg flex items-center justify-center text-[#0055FF] font-bold">1</div>
                <div>
                  <h4 className="font-semibold mb-2 text-lg">Modularity Wins</h4>
                  <p className="text-[#666] text-sm">Monoliths aren't inherently bad, but they lack the agility required for real-time data processing at scale.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-[#F0F4FF] rounded-lg flex items-center justify-center text-[#0055FF] font-bold">2</div>
                <div>
                  <h4 className="font-semibold mb-2 text-lg">Measure First</h4>
                  <p className="text-[#666] text-sm">Running parallel pipelines before cutover eliminated blind spots and ensured zero data loss.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-[#F0F4FF] rounded-lg flex items-center justify-center text-[#0055FF] font-bold">3</div>
                <div>
                  <h4 className="font-semibold mb-2 text-lg">Automation Over Ops</h4>
                  <p className="text-[#666] text-sm">Investing in CI/CD and self-healing infrastructure paid off immediately during stress tests.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-[#F0F4FF] rounded-lg flex items-center justify-center text-[#0055FF] font-bold">4</div>
                <div>
                  <h4 className="font-semibold mb-2 text-lg">Security is Default</h4>
                  <p className="text-[#666] text-sm">Zero-trust architecture implemented at the pod level prevented cross-service lateral movement.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 10 CTA Band */}
        <section className="p-8 md:p-16 lg:p-24 bg-[#0055FF] text-white text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Ready to scale your architecture?</h2>
          <p className="text-xl text-white/80 font-light mb-10 max-w-2xl mx-auto">
            Book a technical consultation with our engineering team to review your current setup and identify optimization paths.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-white text-[#0055FF] font-semibold rounded hover:bg-white/90 transition-colors">
              Schedule Architecture Review
            </button>
            <button className="px-8 py-4 bg-transparent border border-white/30 text-white font-semibold rounded hover:bg-white/10 transition-colors">
              Read Technical Docs
            </button>
          </div>
        </section>

        {/* 11 Footer */}
        <footer className="p-8 md:p-16 bg-[#111] text-white/50 text-sm border-t border-[#333]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-white">
              <Layers className="w-5 h-5" />
              <span className="font-semibold tracking-wide">VANGUARD</span>
            </div>
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition-colors">Platform</a>
              <a href="#" className="hover:text-white transition-colors">Customers</a>
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
            </div>
            <div>
              &copy; {new Date().getFullYear()} Vanguard Systems Inc.
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}

// A subtle affordance to imply this section is a discrete module in a CMS
function ModuleAffordance({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`absolute top-4 right-4 md:top-8 md:right-8 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 items-center text-xs font-semibold uppercase tracking-widest ${dark ? 'text-white/40' : 'text-black/30'}`}>
      <div className="flex flex-col gap-0.5 cursor-grab">
        <div className={`w-4 h-[2px] ${dark ? 'bg-white/40' : 'bg-black/30'}`} />
        <div className={`w-4 h-[2px] ${dark ? 'bg-white/40' : 'bg-black/30'}`} />
        <div className={`w-4 h-[2px] ${dark ? 'bg-white/40' : 'bg-black/30'}`} />
      </div>
      Section Block
    </div>
  );
}
