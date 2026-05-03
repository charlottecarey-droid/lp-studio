import type { ReactNode } from "react";
import type { StackBlockProps } from "@/lib/block-types/container-blocks";
import { getBgStyle } from "@/lib/bg-styles";

interface Props {
  props: StackBlockProps;
  childrenSlot?: ReactNode;
  isBuilder?: boolean;
}

const ALIGN: Record<NonNullable<StackBlockProps["align"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

export function BlockStack({ props, childrenSlot, isBuilder }: Props) {
  void isBuilder;
  const { gap = 1, align = "stretch", backgroundStyle = "transparent" } = props;
  return (
    <div
      style={{
        ...getBgStyle(backgroundStyle),
        display: "flex",
        flexDirection: "column",
        gap: `${gap}rem`,
        alignItems: ALIGN[align],
        width: "100%",
      }}
    >
      {childrenSlot}
    </div>
  );
}
