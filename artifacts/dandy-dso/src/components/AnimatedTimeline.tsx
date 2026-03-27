import { useRef, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { motion, useInView } from "framer-motion";

interface TimelineStep {
  step: string;
  title: string;
  subtitle: string;
  desc: string;
  bullets: string[];
}

interface Props {
  steps: TimelineStep[];
  accentColor: string;
  bgColor: string;
  theme: "dark" | "light";
}

const AnimatedTimeline = ({ steps, accentColor, bgColor, theme }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const containerTop = rect.top;
      const containerHeight = rect.height;
      const viewportMid = window.innerHeight * 0.6;

      if (containerTop > viewportMid) {
        setLineHeight(0);
      } else {
        const progress = Math.min(1, Math.max(0, (viewportMid - containerTop) / containerHeight));
        setLineHeight(progress * 100);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const textPrimary = theme === "dark" ? "text-white" : "";
  const textSecondary = theme === "dark" ? "text-white/40" : "text-muted-foreground";
  const textTertiary = theme === "dark" ? "text-white/50" : "text-muted-foreground";
  const textBullet = theme === "dark" ? "text-white/60" : "text-muted-foreground";
  const titleStyle = theme === "dark" ? { color: "white" } : {};

  return (
    <div ref={containerRef} className="relative max-w-2xl mx-auto">
      {/* Background track */}
      <div
        className="absolute left-[18px] md:left-[22px] top-0 bottom-0 w-px"
        style={{ backgroundColor: theme === "dark" ? `${accentColor}15` : `${accentColor}20` }}
      />
      {/* Animated fill */}
      <div
        className="absolute left-[18px] md:left-[22px] top-0 w-px transition-[height] duration-100 ease-out"
        style={{ backgroundColor: accentColor, height: `${lineHeight}%` }}
      />

      <div className="space-y-14">
        {steps.map((s, i) => (
          <TimelineNode key={i} step={s} index={i} accentColor={accentColor} bgColor={bgColor} textPrimary={textPrimary} textSecondary={textSecondary} textTertiary={textTertiary} textBullet={textBullet} titleStyle={titleStyle} />
        ))}
      </div>
    </div>
  );
};

const TimelineNode = ({
  step, index, accentColor, bgColor, textPrimary, textSecondary, textTertiary, textBullet, titleStyle,
}: {
  step: TimelineStep; index: number; accentColor: string; bgColor: string;
  textPrimary: string; textSecondary: string; textTertiary: string; textBullet: string; titleStyle: React.CSSProperties;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex gap-5 md:gap-7"
    >
      {/* Node */}
      <div
        className="relative z-10 flex-shrink-0 w-[38px] h-[38px] md:w-[46px] md:h-[46px] rounded-full flex items-center justify-center text-xs font-bold"
        style={{ backgroundColor: accentColor, color: bgColor }}
      >
        {step.step}
      </div>
      {/* Content */}
      <div className="flex-1 pt-1 pb-2">
        <h3 className={`text-lg font-bold mb-0.5 ${textPrimary}`} style={titleStyle}>{step.title}</h3>
        <p className={`text-sm font-medium ${textSecondary} mb-3`}>{step.subtitle}</p>
        <p className={`text-sm ${textTertiary} leading-relaxed mb-5`}>{step.desc}</p>
        <ul className="space-y-2.5">
          {step.bullets.map((b, j) => (
            <li key={j} className={`flex items-start gap-2 text-sm ${textBullet}`}>
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accentColor }} /> {b}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

export default AnimatedTimeline;
