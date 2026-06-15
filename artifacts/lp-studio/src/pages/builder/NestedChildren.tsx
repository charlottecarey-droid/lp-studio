/**
 * Recursive child chrome for the WYSIWYG builder canvas.
 *
 * `NestedChild` wraps each PageBlock child of a container with:
 *   - selection click target
 *   - delete affordance on hover
 *   - useSortable handle (so the child participates in the root DndContext)
 *
 * `EmptyContainerSlot` renders a `useDroppable` placeholder shown when a
 * container has zero children, so users can drop blocks into the slot.
 *
 * Both are rendered by `BuilderEditor` via the `renderChild` /
 * `renderEmptySlot` props on `BlockRenderer`.
 */
import { type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageBlock } from "@/lib/block-types";
import type { BlockPath } from "@/lib/block-tree";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import type { BrandConfig } from "@/lib/brand-config";
import type { CtaConfig } from "@/lib/cta/ctaConfig";

type ParentLayout = "stack" | "grid";

interface NestedChildProps {
  child: PageBlock;
  parentPath: BlockPath;
  index: number;
  brand: BrandConfig;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onInsertAfter: () => void;
  /** Called when the user clicks the top-of-container insert chip. Only the
   *  child at index 0 renders this chip; pass undefined to skip. */
  onInsertBefore?: () => void;
  onBlockChange: (updated: PageBlock) => void;
  /** Page-level default CTA, so nested blocks preview their PRIMARY button
   *  following the Page CTA (matching the published page). */
  pageCta?: CtaConfig | null;
  renderChild: (c: PageBlock, i: number, parentPath: BlockPath, parentLayout?: ParentLayout) => ReactNode;
  renderEmptySlot: (parentPath: BlockPath, parentLayout?: ParentLayout) => ReactNode;
  renderTailSlot?: (parentPath: BlockPath, parentLayout?: ParentLayout) => ReactNode;
  /** Layout of the *parent* container.
   *  - "stack" (default): vertical flow, render before/after insert chips.
   *  - "grid": parent is a CSS-grid container (grid/columns block). Insert
   *    chips would steal grid cells and shove children to the right column,
   *    so we omit them entirely. */
  parentLayout?: ParentLayout;
}

export function NestedChild({
  child,
  parentPath,
  index,
  brand,
  isSelected,
  onSelect,
  onDelete,
  onInsertAfter,
  onInsertBefore,
  onBlockChange,
  pageCta,
  renderChild,
  renderEmptySlot,
  renderTailSlot,
  parentLayout = "stack",
}: NestedChildProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: child.id,
  });
  const childPath: BlockPath = [...parentPath, index];
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const showChips = parentLayout !== "grid";

  return (
    <>
      {showChips && index === 0 && onInsertBefore && (
        <NestedInsertChip onClick={onInsertBefore} />
      )}
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "relative group/nested",
          isSelected && "outline outline-2 outline-primary outline-offset-[-2px]",
        )}
        data-nested-child={child.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <div className="absolute -left-7 top-1 z-30 opacity-0 group-hover/nested:opacity-100 transition-opacity flex flex-col gap-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1 rounded bg-popover border border-border shadow-sm cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded bg-popover border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive"
            title="Delete block"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <BlockRenderer
          block={child}
          brand={brand}
          onBlockChange={onBlockChange}
          animationsEnabled={false}
          isBuilder
          pageCta={pageCta}
          path={childPath}
          renderChild={renderChild}
          renderEmptySlot={renderEmptySlot}
          renderTailSlot={renderTailSlot}
        />
      </div>
      {showChips && <NestedInsertChip onClick={onInsertAfter} />}
    </>
  );
}

function NestedInsertChip({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-center justify-center py-1 opacity-30 hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow"
        title="Insert block here"
      >
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

interface EmptyContainerSlotProps {
  parentPath: BlockPath;
  onInsert: () => void;
  label?: string;
  parentLayout?: ParentLayout;
}

/**
 * Thin "drop here" slot rendered after the last child of a non-empty
 * container so users can drop a block at the end (the standard sortable
 * "before the over" semantics never resolves to "after the last item").
 * Reuses the same `container:<parentPath>` droppable id as
 * `EmptyContainerSlot` so `handleDragEnd` treats both identically (append).
 */
export function TailDropSlot({ parentPath, parentLayout }: { parentPath: BlockPath; parentLayout?: ParentLayout }) {
  const id = `container:${parentPath.join(".")}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  // In grid containers, span the full row so this drop zone occupies its
  // own row instead of stealing a single cell that would otherwise hold a
  // child.
  const gridSpanStyle = parentLayout === "grid" ? { gridColumn: "1 / -1" } : undefined;
  return (
    <div
      ref={setNodeRef}
      data-tail-slot={id}
      style={gridSpanStyle}
      className={cn(
        "h-3 -mt-1 rounded transition-colors",
        isOver ? "bg-primary/30 ring-1 ring-primary" : "bg-transparent",
      )}
    />
  );
}

export function EmptyContainerSlot({ parentPath, onInsert, label, parentLayout }: EmptyContainerSlotProps) {
  const id = `container:${parentPath.join(".")}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const gridSpanStyle = parentLayout === "grid" ? { gridColumn: "1 / -1" } : undefined;
  return (
    <div
      ref={setNodeRef}
      data-empty-slot={id}
      style={gridSpanStyle}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-6 px-4 text-xs transition-colors",
        isOver
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onInsert();
      }}
    >
      <span className="font-medium">{label ?? "Drop a block here"}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInsert();
        }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold"
      >
        <Plus className="w-3 h-3" /> Add block
      </button>
    </div>
  );
}
