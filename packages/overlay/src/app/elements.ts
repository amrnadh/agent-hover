// Element references resolved once after the template is mounted. The 0.2 UI modules look up their own
// elements by id, so this stays empty; kept so the context shape is stable for legacy modules.

export function queryDom(_shadow: ShadowRoot) {
  return {} as Record<string, any>;
}

export type OverlayDom = ReturnType<typeof queryDom>;
