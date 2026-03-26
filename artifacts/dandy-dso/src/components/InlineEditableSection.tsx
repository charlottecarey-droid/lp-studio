import { useState, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { SectionStyleOverrides } from "@/lib/microsite-skin-config";
import InlineSectionToolbar from "./InlineSectionToolbar";

interface InlineEditableSectionProps {
  sectionId: string;
  sectionLabel?: string;
  styles?: SectionStyleOverrides;
  onUpdate: (patch: Partial<SectionStyleOverrides>) => void;
  onReset: () => void;
  children: React.ReactNode;
}

const InlineEditableSection = ({
  sectionId,
  sectionLabel,
  styles,
  onUpdate,
  onReset,
  children,
}: InlineEditableSectionProps) => {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const showToolbar = hovered || pinned;

  // Build style overrides
  const overrideStyle: React.CSSProperties = {};
  if (styles?.bgColor) overrideStyle.backgroundColor = styles.bgColor;
  if (styles?.textColor) overrideStyle.color = styles.textColor;
  if (styles?.fontFamily) overrideStyle.fontFamily = styles.fontFamily;
  if (styles?.paddingY !== undefined) {
    overrideStyle.paddingTop = `${styles.paddingY}rem`;
    overrideStyle.paddingBottom = `${styles.paddingY}rem`;
  }

  const hasOverrides = styles && Object.keys(styles).length > 0;

  return (
    <div
      ref={containerRef}
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      onClick={() => { if (showToolbar) setPinned(!pinned); }}
      style={overrideStyle}
    >
      {/* Hover outline */}
      <div
        className={`absolute inset-0 pointer-events-none z-[55] transition-all duration-200 rounded-sm ${
          showToolbar
            ? "ring-2 ring-inset ring-[hsl(210,100%,60%)]/40"
            : hasOverrides
              ? "ring-1 ring-inset ring-[hsl(210,100%,60%)]/15"
              : ""
        }`}
      />

      {/* Toolbar */}
      <AnimatePresence>
        {showToolbar && (
          <InlineSectionToolbar
            sectionId={sectionId}
            sectionLabel={sectionLabel}
            styles={styles}
            onUpdate={onUpdate}
            onReset={onReset}
          />
        )}
      </AnimatePresence>

      {children}
    </div>
  );
};

export default InlineEditableSection;
