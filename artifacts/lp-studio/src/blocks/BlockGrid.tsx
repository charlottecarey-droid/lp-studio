import type { ReactNode } from "react";
import type { GridBlockProps } from "@/lib/block-types/container-blocks";
import { getBgStyle } from "@/lib/bg-styles";

interface Props {
  props: GridBlockProps;
  childrenSlot?: ReactNode;
  isBuilder?: boolean;
}

export function BlockGrid({ props, childrenSlot, isBuilder }: Props) {
  void isBuilder;
  const { columns = 3, mobileColumns = 1, gap = 1.5, backgroundStyle = "transparent" } = props;

  return (
    <div
      className="lp-grid"
      style={{
        ...getBgStyle(backgroundStyle),
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap}rem`,
        width: "100%",
        // Custom prop consumed by the inline <style> below.
        ["--lp-grid-mobile-cols" as string]: mobileColumns,
      }}
    >
      {childrenSlot}
      <style>{`
        @media (max-width: 640px) {
          .lp-grid {
            grid-template-columns: repeat(var(--lp-grid-mobile-cols, 1), minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}
