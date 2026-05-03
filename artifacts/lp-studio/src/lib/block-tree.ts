/**
 * Path-based helpers for the nested block tree. A path is an array of
 * direct-child indices: `[]` is the page root, `[2]` is the third top-level
 * block, `[2, 0]` is the first child of that block, etc.
 *
 * The tree is the existing `PageBlock[]` shape with an optional
 * `children?: PageBlock[]` on container blocks. Helpers always return a new
 * top-level array so React's referential-equality checks still work.
 */

import type { PageBlock, BlockType } from "./block-types";

export type BlockPath = number[];

/** Block types that own a `children: PageBlock[]` slot. */
export const CONTAINER_TYPES = new Set<BlockType>([
  "section",
  "columns",
  "grid",
  "stack",
]);

/** Block types that expose an optional secondary `children` slot
 *  (e.g. Hero overlay). Treated as containers for DnD purposes. */
export const OVERLAY_CONTAINER_TYPES = new Set<BlockType>([
  "hero",
  "full-bleed-hero",
  "bento-showcase",
]);

export function isContainerType(t: BlockType): boolean {
  return CONTAINER_TYPES.has(t) || OVERLAY_CONTAINER_TYPES.has(t);
}

/** Read a block at the given path. Returns undefined if any segment is OOB. */
export function getAtPath(blocks: PageBlock[], path: BlockPath): PageBlock | undefined {
  if (path.length === 0) return undefined;
  let cur: PageBlock | undefined = blocks[path[0]];
  for (let i = 1; i < path.length && cur; i++) {
    cur = cur.children?.[path[i]];
  }
  return cur;
}

/** Replace the block at `path` with the result of `mapper(prev)`. No-op if
 *  the path is invalid. Returns a new top-level array. */
export function setAtPath(
  blocks: PageBlock[],
  path: BlockPath,
  mapper: (prev: PageBlock) => PageBlock,
): PageBlock[] {
  if (path.length === 0) return blocks;
  const [head, ...rest] = path;
  if (head < 0 || head >= blocks.length) return blocks;
  const next = blocks.slice();
  if (rest.length === 0) {
    next[head] = mapper(next[head]);
  } else {
    const parent = next[head];
    const children = parent.children ?? [];
    const newChildren = setAtPath(children, rest, mapper);
    if (newChildren === children) return blocks;
    next[head] = { ...parent, children: newChildren };
  }
  return next;
}

/** Replace the children array at `path` (the parent path) with the result of
 *  `mapper(prev)`. Use `[]` for the page root. */
export function setChildrenAtPath(
  blocks: PageBlock[],
  parentPath: BlockPath,
  mapper: (prev: PageBlock[]) => PageBlock[],
): PageBlock[] {
  if (parentPath.length === 0) {
    const next = mapper(blocks);
    return next === blocks ? blocks : next;
  }
  return setAtPath(blocks, parentPath, (parent) => {
    const prevChildren = parent.children ?? [];
    const nextChildren = mapper(prevChildren);
    if (nextChildren === prevChildren) return parent;
    return { ...parent, children: nextChildren };
  });
}

/** Insert `block` into the parent at `parentPath`, at index `index`. */
export function insertAtPath(
  blocks: PageBlock[],
  parentPath: BlockPath,
  index: number,
  block: PageBlock,
): PageBlock[] {
  return setChildrenAtPath(blocks, parentPath, (children) => {
    const next = children.slice();
    const safeIdx = Math.max(0, Math.min(index, next.length));
    next.splice(safeIdx, 0, block);
    return next;
  });
}

/** Remove the block at `path`. Returns the new tree and the removed block (or undefined). */
export function removeAtPath(
  blocks: PageBlock[],
  path: BlockPath,
): { tree: PageBlock[]; removed: PageBlock | undefined } {
  if (path.length === 0) return { tree: blocks, removed: undefined };
  const removed = getAtPath(blocks, path);
  if (!removed) return { tree: blocks, removed: undefined };
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  const tree = setChildrenAtPath(blocks, parentPath, (children) => {
    const next = children.slice();
    next.splice(idx, 1);
    return next;
  });
  return { tree, removed };
}

/** Find the block with the given id anywhere in the tree (root or nested
 *  inside a container's children). O(n) over the full tree. Returns
 *  undefined if no block in the tree has that id. */
export function findBlockById(blocks: PageBlock[], id: string): PageBlock | undefined {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children && b.children.length > 0) {
      const sub = findBlockById(b.children, id);
      if (sub) return sub;
    }
  }
  return undefined;
}

/** Find the path of the block with the given id. O(n) over the full tree. */
export function findPathById(blocks: PageBlock[], id: string): BlockPath | undefined {
  function walk(arr: PageBlock[], prefix: BlockPath): BlockPath | undefined {
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      const here: BlockPath = [...prefix, i];
      if (b.id === id) return here;
      if (b.children && b.children.length > 0) {
        const sub = walk(b.children, here);
        if (sub) return sub;
      }
    }
    return undefined;
  }
  return walk(blocks, []);
}

/** Move the block at `fromPath` to be inserted at index `toIndex` of the
 *  container at `toParentPath`. Same-container reorder is handled correctly
 *  (the index is interpreted in the post-removal array). */
export function moveBlock(
  blocks: PageBlock[],
  fromPath: BlockPath,
  toParentPath: BlockPath,
  toIndex: number,
): PageBlock[] {
  if (fromPath.length === 0) return blocks;
  // Disallow moving an ancestor into its own descendant.
  if (
    toParentPath.length >= fromPath.length &&
    fromPath.every((seg, i) => toParentPath[i] === seg)
  ) {
    return blocks;
  }
  const { tree: removedTree, removed } = removeAtPath(blocks, fromPath);
  if (!removed) return blocks;

  // If we removed from the same parent and the source index was before the
  // target index, the target index needs to shift down by 1 to compensate.
  const fromParent = fromPath.slice(0, -1);
  const fromIdx = fromPath[fromPath.length - 1];
  const sameParent =
    fromParent.length === toParentPath.length &&
    fromParent.every((seg, i) => toParentPath[i] === seg);
  const adjusted = sameParent && fromIdx < toIndex ? toIndex - 1 : toIndex;

  return insertAtPath(removedTree, toParentPath, adjusted, removed);
}

/** Walk every block in the tree, calling `fn(block, path)` for each. */
export function walkTree(
  blocks: PageBlock[],
  fn: (block: PageBlock, path: BlockPath) => void,
): void {
  function walk(arr: PageBlock[], prefix: BlockPath) {
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      const here: BlockPath = [...prefix, i];
      fn(b, here);
      if (b.children && b.children.length > 0) walk(b.children, here);
    }
  }
  walk(blocks, []);
}

/** Collect every id in the tree (used to render Sortable contexts). */
export function collectIds(blocks: PageBlock[]): string[] {
  const ids: string[] = [];
  walkTree(blocks, (b) => ids.push(b.id));
  return ids;
}

/** Ensure container blocks have a `children: []` slot. Run once on load
 *  so legacy pages — which never had a children field — still expose
 *  drop targets. Non-container blocks are left untouched. */
export function normalizeTree(blocks: PageBlock[]): PageBlock[] {
  let changed = false;
  const next = blocks.map((b) => {
    const isContainer = CONTAINER_TYPES.has(b.type);
    let nb = b;
    if (isContainer && !Array.isArray(b.children)) {
      nb = { ...b, children: [] };
      changed = true;
    }
    if (Array.isArray(nb.children) && nb.children.length > 0) {
      const sub = normalizeTree(nb.children);
      if (sub !== nb.children) {
        nb = { ...nb, children: sub };
        changed = true;
      }
    }
    return nb;
  });
  return changed ? next : blocks;
}
