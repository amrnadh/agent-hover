// @ts-nocheck

/** React fiber detection and component hierarchy resolution (pure). */
// --- React 19 Fiber Detection ---
export function getFiberNode(el) {
  let curr = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    for (const key in curr) {
      if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
        return curr[key];
      }
    }
    curr = curr.parentElement;
  }
  return null;
}

// --- Element & Component Detection (Universal Selection) ---
function describeElement(el) {
  if (!el) return '';
  let desc = el.tagName.toLowerCase();
  if (el.id) {
    desc += '#' + el.id;
  } else if (el.className && typeof el.className === 'string') {
    const cls = el.className.trim().split(/\s+/).slice(0, 2);
    if (cls.length && cls[0]) desc += '.' + cls.join('.');
  }
  return desc;
}

/** React 19: the stack where this fiber's element was created (its JSX line), as text; '' before React 19. */
export function debugStackOf(fiber) {
  const s = fiber && fiber._debugStack;
  if (!s) return '';
  return typeof s === 'string' ? s : s.stack || '';
}

/**
 * React 19: where this element was written, then where the component that wrote it was used, and so on up the owner
 * chain (each is a creation stack). The first is the element's own JSX line.
 */
export function creationStacksOf(fiber) {
  const out = [];
  for (let f = fiber, n = 0; f && n < 4; n++, f = f._debugOwner) {
    const s = debugStackOf(f);
    if (s) out.push(s);
  }
  return out;
}

/**
 * React 19: a creation stack from inside `component`'s own render, taken from the first fiber it rendered (whose
 * owner is the component). Its first app frame is a line in the component's own file.
 */
export function renderStackOf(component) {
  if (!component) return '';
  const owners = new Set([component, component.alternate].filter(Boolean));
  const queue = [component.child];
  for (let n = 0; queue.length && n < 300; n++) {
    const f = queue.shift();
    if (!f) continue;
    if (owners.has(f._debugOwner) && f._debugStack) return debugStackOf(f);
    if (f.child) queue.push(f.child);
    if (f.sibling) queue.push(f.sibling);
  }
  return '';
}

export function buildHierarchyStack(el) {
  if (!el) return [];
  const stack = [];

  // 1. The exact DOM element under the cursor is ALWAYS level 0 (direct selection)
  const desc = describeElement(el);
  const textSnippet = el.textContent ? el.textContent.trim().slice(0, 35) : '';
  const fiber = getFiberNode(el);
  let leafSource = null;
  if (fiber && fiber._debugSource) {
    leafSource = {
      fileName: fiber._debugSource.fileName,
      lineNumber: fiber._debugSource.lineNumber,
      columnNumber: fiber._debugSource.columnNumber
    };
  }

  stack.push({
    name: desc,
    isDomElement: true,
    element: el,
    tagName: el.tagName.toLowerCase(),
    textPreview: textSnippet,
    source: leafSource,
    // React 19: where this element's JSX was written, and up the owner chain (mapped to files by the bridge).
    creationStacks: () => creationStacksOf(fiber),
    fiber: fiber
  });

  // 2. Walk fiber ancestry to find all React components containing this element
  if (fiber) {
    const seen = new Set();
    let curr = fiber;
    while (curr) {
      let name = null;
      let source = null;
      if (typeof curr.type === 'function') {
        name = curr.type.displayName || curr.type.name;
        source = curr._debugSource || null;
      } else if (curr.type && typeof curr.type === 'object') {
        const inner = curr.type.render || curr.type.type;
        if (typeof inner === 'function') {
          name = inner.displayName || inner.name;
          source = curr._debugSource || null;
        }
      }
      if (name && name !== 'Fragment' && !name.startsWith('_') && name !== 'Suspense' && name !== 'StrictMode') {
        const key = name + ':' + (source ? source.fileName + ':' + source.lineNumber : 'null');
        if (!seen.has(key)) {
          seen.add(key);
          const owner = curr;
          // React 19: found lazily (it walks the component's children) and only when the item is resolved.
          stack.push({ name, source, fiber: curr, isDomElement: false, element: el, renderStack: () => renderStackOf(owner) });
        }
      }
      curr = curr.return;
    }
  }
  return stack; // [leaf DOM element, innermost React component, ..., outermost App]
}

function getComponentStack(el) {
  return buildHierarchyStack(el).filter(x => !x.isDomElement);
}

function getBestComponent(stack) {
  if (!stack || stack.length === 0) return null;
  return stack[0];
}

export function getComponentInfo(el) {
  const stack = getComponentStack(el);
  return getBestComponent(stack);
}

// Collect all DOM nodes owned by a fiber
function collectFiberDomNodes(fiber) {
  const nodes = [];
  function walkFiber(f) {
    if (!f) return;
    if (f.stateNode && f.stateNode instanceof Element && f.stateNode !== document.body) {
      nodes.push(f.stateNode);
    } else {
      let child = f.child;
      while (child) {
        walkFiber(child);
        child = child.sibling;
      }
    }
  }
  let child = fiber.child;
  while (child) {
    walkFiber(child);
    child = child.sibling;
  }
  if (fiber.stateNode && fiber.stateNode instanceof Element && fiber.stateNode !== document.body) {
    nodes.push(fiber.stateNode);
  }
  return nodes;
}

// Compute the union bounding rect of all DOM nodes in a fiber subtree
export function getComponentBoundingRect(fiber) {
  const nodes = collectFiberDomNodes(fiber);
  if (nodes.length === 0) return null;
  let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity;
  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.top < top) top = r.top;
    if (r.left < left) left = r.left;
    if (r.bottom > bottom) bottom = r.bottom;
    if (r.right > right) right = r.right;
  }
  if (top === Infinity) return null;
  return { top, left, width: right - left, height: bottom - top };
}
