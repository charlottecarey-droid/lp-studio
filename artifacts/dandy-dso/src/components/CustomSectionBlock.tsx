import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, X } from "lucide-react";
import type { SkinCustomSection } from "@/lib/microsite-skin-config";

interface Props {
  sec: SkinCustomSection;
  index: number;
  primaryColor: string;
  accentColor: string;
  headlineWeight: string;
  headlineSizeCls: string;
  fontFamily: string;
  theme: "dark" | "light";
}

const CustomSectionBlock = ({ sec, index, primaryColor, accentColor, headlineWeight, headlineSizeCls, fontFamily, theme }: Props) => {
  const [showVideo, setShowVideo] = useState(false);
  const isDark = theme === "dark";
  const textColor = isDark ? "#ffffff" : primaryColor;
  const subtextColor = isDark ? "rgba(255,255,255,0.5)" : "#6b7280";
  const borderClass = isDark ? "border-white/[0.06]" : "border-gray-100";
  const bg = isDark ? primaryColor : (index % 2 === 0 ? "#f9fafb" : "#ffffff");

  const handleButtonClick = () => {
    if (sec.buttonVideoUrl) setShowVideo(true);
    else if (sec.buttonUrl) window.open(sec.buttonUrl, "_blank");
  };

  return (
    <section className={`py-20 md:py-24 border-t ${borderClass}`} style={{ backgroundColor: bg }}>
      <div className="max-w-5xl mx-auto px-6">
        {sec.layout === "centered" ? (
          <div className="text-center">
            <h2 className={`${headlineWeight} ${headlineSizeCls} leading-tight mb-4`} style={{ fontFamily, color: textColor }}>{sec.headline}</h2>
            <p className="text-base max-w-2xl mx-auto mb-6 leading-relaxed" style={{ color: subtextColor }}>{sec.body}</p>
            {sec.imageUrl && <img src={sec.imageUrl} alt="" className={`mx-auto rounded-2xl border ${borderClass} max-h-72 object-cover mb-6`} />}
            {sec.buttonText && (
              <button onClick={handleButtonClick} style={{ backgroundColor: accentColor, color: isDark ? primaryColor : "#ffffff" }} className="px-8 py-3 rounded-lg font-semibold">
                {sec.buttonVideoUrl && <Play className="w-4 h-4 inline mr-2" />}{sec.buttonText}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {sec.layout === "left-image" && sec.imageUrl && <img src={sec.imageUrl} alt="" className={`rounded-2xl border ${borderClass} w-full h-auto object-cover`} />}
            <div className={sec.layout === "right-image" ? "md:order-1" : ""}>
              <h2 className={`${headlineWeight} text-2xl md:text-3xl leading-tight mb-4`} style={{ fontFamily, color: textColor }}>{sec.headline}</h2>
              <p className="text-base mb-6 leading-relaxed" style={{ color: subtextColor }}>{sec.body}</p>
              {sec.buttonText && (
                <button onClick={handleButtonClick} style={{ backgroundColor: accentColor, color: isDark ? primaryColor : "#ffffff" }} className="px-8 py-3 rounded-lg font-semibold">
                  {sec.buttonVideoUrl && <Play className="w-4 h-4 inline mr-2" />}{sec.buttonText}
                </button>
              )}
            </div>
            {sec.layout === "right-image" && sec.imageUrl && <img src={sec.imageUrl} alt="" className={`rounded-2xl border ${borderClass} w-full h-auto object-cover md:order-2`} />}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showVideo && sec.buttonVideoUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowVideo(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-4xl aspect-video mx-4" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowVideo(false)} className="absolute -top-10 right-0 text-white/60 hover:text-white"><X className="w-6 h-6" /></button>
              <iframe
                src={sec.buttonVideoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/").replace("vimeo.com/", "player.vimeo.com/video/")}
                className="w-full h-full rounded-xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Video"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default CustomSectionBlock;
