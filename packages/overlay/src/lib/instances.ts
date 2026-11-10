/**
 * Shared components (spec P3-02): how many times a component is on the page, and where. Walks React's fiber tree
 * from the root and matches the component's type, so it counts instances even when they look nothing alike.
 */

interface FiberLike {
  type?: unknown;
  return?: FiberLike | null;
  child?: FiberLike | null;
  sibling?: FiberLike | null;
  stateNode?: unknown;
  alternate?: FiberLike | null;
}

const isElement = (n: unknown): n is Element => typeof Element !== 'undefined' && n instanceof Element;

/** The first DOM element a fiber renders (what you see of that instance). */
export function hostElementOf(fiber: FiberLike | null | undefined): Element | null {
  const stack: FiberLike[] = fiber ? [fiber] : [];
  while (stack.length) {
    const f = stack.shift()!;
    if (isElement(f.stateNode)) return f.stateNode;
    let c = f.child;
    const kids: FiberLike[] = [];
    while (c) { kids.push(c); c = c.sibling; }
    stack.unshift(...kids);
  }
  return null;
}

/**
 * Every instance of `fiber`'s component on the page, in tree order. Each instance appears once (a fiber and its
 * alternate are the same instance). `limit` stops a runaway walk on very large pages.
 */
export function instancesOf(fiber: FiberLike | null | undefined, limit = 50000): FiberLike[] {
  if (!fiber || typeof fiber.type !== 'function' && typeof fiber.type !== 'object') return [];
  const type = fiber.type;
  let root: FiberLike = fiber;
  while (root.return) root = root.return;
  // The fiber we hold may be the stale copy of the tree (React keeps two); the root knows the current one.
  const current = (root.stateNode as { current?: FiberLike } | null)?.current;
  if (current) root = current;
  const found: FiberLike[] = [];
  const stack: FiberLike[] = [root];
  let seen = 0;
  while (stack.length && seen++ < limit) {
    const f = stack.pop()!;
    if (f.type === type) found.push(f);
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  return found;
}
