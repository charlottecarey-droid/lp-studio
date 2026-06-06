/**
 * Drag-to-reorder helpers for property-panel item lists (benefit cards,
 * trust-bar stats, etc).
 *
 * Each panel owns a plain array of items with no stable id, so the list index
 * doubles as the sortable id. That's safe here because items are never added or
 * removed mid-drag — only reordered — and `onReorder` hands the panel the
 * old/new indices so it can splice its own array and preserve every field
 * (photo, value, label, alt text).
 *
 * Usage:
 *   <SortableItemList count={items.length} onReorder={reorder}>
 *     {items.map((item, i) => (
 *       <SortableItem key={i} index={i}>
 *         {(handle) => (
 *           <div>
 *             <button {...handle.attributes} {...handle.listeners}>drag</button>
 *             ...content...
 *           </div>
 *         )}
 *       </SortableItem>
 *     ))}
 *   </SortableItemList>
 */
import { type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemListProps {
  count: number;
  /** Called with the source and destination indices after a drag completes. */
  onReorder: (from: number, to: number) => void;
  children: ReactNode;
}

export function SortableItemList({ count, onReorder, children }: SortableItemListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = Number(active.id);
    const to = Number(over.id);
    if (Number.isNaN(from) || Number.isNaN(to)) return;
    onReorder(from, to);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={Array.from({ length: count }, (_, i) => String(i))}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Remap a set of item indices through a single reorder move so transient,
 * index-keyed UI state (e.g. "photo picker revealed") follows its item instead
 * of staying pinned to a position. Mirrors the splice in each panel's
 * `moveItem`: remove the element at `from`, then insert it at `to`.
 */
export function remapIndexSet(set: Set<number>, from: number, to: number): Set<number> {
  const next = new Set<number>();
  set.forEach(i => {
    if (i === from) {
      next.add(to);
    } else if (from < to && i > from && i <= to) {
      next.add(i - 1);
    } else if (from > to && i >= to && i < from) {
      next.add(i + 1);
    } else {
      next.add(i);
    }
  });
  return next;
}

interface DragHandleProps {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  isDragging: boolean;
}

interface SortableItemProps {
  index: number;
  children: (handle: DragHandleProps) => ReactNode;
}

export function SortableItem({ index, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(index),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative" as const,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}
