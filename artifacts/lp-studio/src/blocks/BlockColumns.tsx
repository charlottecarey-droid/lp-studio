import type { ReactNode } from "react";
import type { ColumnsBlockProps } from "@/lib/block-types/container-blocks";
import { getBgStyle } from "@/lib/bg-styles";

interface Props {
  props: ColumnsBlockProps;
  /**
   * Pre-rendered children. CSS grid auto-flows each direct child into a
   * separate column cell, so a flat ReactNode (array of child renderers) is
   * sufficient — no per-cell wrapping required from the caller.
   */
  childrenSlot?: ReactNode;
  isBuilder?: boolean;
}

const ALIGN: Record<NonNullable<ColumnsBlockProps["align"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

export function BlockColumns({ props, childrenSlot, isBuilder }: Props) {
  const { columns = 2, gap = 1.5, align = "stretch", backgroundStyle = "transparent" } = props;

  return (
    <div
      style={{
        ...getBgStyle(backgroundStyle),
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap}rem`,
        alignItems: ALIGN[align],
        width: "100%",
        ...(isBuilder ? { outline: "1px dashed rgb(99 102 241 / 0.4)", outlineOffset: -2, padding: "0.5rem" } : {}),
      }}
      className="lp-columns"
      data-block-container="columns"
    >
      {childrenSlot}
      <style>{`
        @media (max-width: 640px) {
          .lp-columns { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
