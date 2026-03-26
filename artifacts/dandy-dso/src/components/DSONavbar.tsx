import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone } from "lucide-react";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import DemoModal from "./DemoModal";

const navLinks = [
  { label: "Lab Services", href: "#solutions" },
  { label: "Solutions", href: "#dashboard" },
  { label: "Pricing", href: "#contact" },
  { label: "Results", href: "#results" },
];

const DSONavbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[hsla(152,45%,5%,0.95)] backdrop-blur-lg shadow-lg shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 flex items-center justify-between h-[56px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-primary-foreground"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <a href="https://www.meetdandy.com" className="hover:opacity-80 transition-opacity">
              <img src={dandyLogoWhite} alt="Dandy" className="h-[18px] w-auto" />
            </a>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    const id = link.href.replace("#", "");
                    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-[14px] font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-5">
            <a href="tel:3158599362" className="flex items-center gap-1.5 text-[13px] text-primary-foreground/60 hover:text-primary-foreground/90 transition-colors">
              <Phone className="w-3.5 h-3.5" />
              (315)-859-9362
            </a>
            <button
              onClick={() => document.getElementById("waste-calculator")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center justify-center rounded-full px-5 py-2 text-[13px] font-semibold tracking-wider uppercase transition-all duration-300 border border-primary-foreground/15 text-primary-foreground/50 hover:text-primary-foreground/80 hover:border-primary-foreground/25"
            >
              CALCULATE ROI
            </button>
            <button
              onClick={() => setDemoOpen(true)}
              className="inline-flex items-center justify-center rounded-full px-5 py-2 text-[13px] font-semibold tracking-wider uppercase transition-all duration-300 bg-accent-warm text-accent-warm-foreground hover:brightness-110"
            >
              GET PRICING
            </button>
          </div>

        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            {/* Slide-in panel from left */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-[360px] bg-primary shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 h-[56px] border-b border-primary-foreground/10">
                <img src={dandyLogoWhite} alt="Dandy" className="h-[18px] w-auto" />
                <button onClick={() => setMobileOpen(false)} className="text-primary-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2 p-6">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      setMobileOpen(false);
                      const id = link.href.replace("#", "");
                      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 300);
                    }}
                    className="text-lg font-medium text-primary-foreground py-3 px-3 rounded-lg hover:bg-primary-foreground/5 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="border-t border-primary-foreground/10 my-3" />
                <a href="tel:3158599362" className="flex items-center gap-2 text-sm text-primary-foreground/70 px-3 py-2">
                  <Phone className="w-4 h-4" />
                  (315)-859-9362
                </a>
                <button
                  onClick={() => { setMobileOpen(false); setTimeout(() => document.getElementById("waste-calculator")?.scrollIntoView({ behavior: "smooth" }), 300); }}
                  className="mt-2 inline-flex items-center justify-center rounded-full border border-primary-foreground/15 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50 hover:text-primary-foreground/80 w-full"
                >
                  CALCULATE ROI
                </button>
                <button
                  onClick={() => { setDemoOpen(true); setMobileOpen(false); }}
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-accent-warm px-6 py-3 text-sm font-semibold uppercase tracking-wider text-accent-warm-foreground w-full"
                >
                  GET PRICING
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};

export default DSONavbar;
