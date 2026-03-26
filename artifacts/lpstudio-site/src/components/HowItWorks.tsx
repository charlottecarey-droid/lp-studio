import { useInView } from "@/hooks/useInView";

const steps = [
  {
    num: "01",
    title: "Build",
    desc: "Use the visual builder to drag and drop blocks, customize your layout, and set your brand styles. Go from idea to live page in under an hour.",
    detail: "Choose from 50+ conversion-optimized blocks. Drop them in, customize them, and preview in real time.",
  },
  {
    num: "02",
    title: "Test",
    desc: "Create variants, split your traffic, and let the data decide. Built-in A/B testing with automatic significance detection.",
    detail: "Define your winning metric — clicks, signups, purchases. LP Studio tracks everything and tells you when a winner is ready.",
  },
  {
    num: "03",
    title: "Optimize",
    desc: "Use heatmaps, scroll depth, and AI recommendations to keep improving. Smart Traffic routes visitors to the best variant automatically.",
    detail: "Continuous optimization runs in the background. Your pages get better while you focus on what's next.",
  },
];

export default function HowItWorks() {
  const { ref, inView } = useInView();
  return (
    <section id="how-it-works" className="px-6 py-20 md:py-28" style={{ background: "linear-gradient(180deg, #000 0%, #001f18 60%, #003A30 100%)" }}>
      <div
        ref={ref}
        className="max-w-6xl mx-auto"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: "rgba(199,231,56,0.08)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.18)" }}>
            How It Works
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            Three steps to <span style={{ color: "#C7E738" }}>peak performance.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            A repeatable system to launch fast, learn faster, and never stop improving.
          </p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.num} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-full w-full z-0" style={{ height: 1, background: "linear-gradient(90deg, rgba(199,231,56,0.3), transparent)", transform: "translateX(-50%) scaleX(0.6)" }} />
              )}
              <div
                className="relative rounded-2xl p-8 flex flex-col gap-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-4 mb-2">
                  <span
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "rgba(199,231,56,0.12)", color: "#C7E738", fontFamily: "Outfit, sans-serif" }}
                  >
                    {step.num}
                  </span>
                  <h3 className="text-2xl font-bold" style={{ fontFamily: "Outfit, sans-serif", color: "#C7E738" }}>{step.title}</h3>
                </div>
                <p className="text-white font-medium leading-snug">{step.desc}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
