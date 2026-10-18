/**
 * Plain names for what you selected, for cards and lists: “Book a demo” button, “Pricing” link, <StatCard />.
 * The code name (button#hero-primary-cta) stays in the hover tag, in prompts and in Details.
 */
export interface LabelFacts {
  tag: string;
  text?: string;
  ariaLabel?: string;
  alt?: string;
  title?: string;
  placeholder?: string;
  type?: string;
  role?: string;
}

const NOUNS: Record<string, string> = {
  a: 'link', button: 'button', img: 'image', picture: 'image', svg: 'graphic', video: 'video', canvas: 'canvas',
  textarea: 'text box', select: 'dropdown', label: 'label', form: 'form', table: 'table', tr: 'row', td: 'cell', th: 'cell',
  ul: 'list', ol: 'list', li: 'list item', nav: 'navigation', header: 'header', footer: 'footer', main: 'main area',
  section: 'section', article: 'article', aside: 'sidebar', p: 'paragraph', blockquote: 'quote', code: 'code',
  h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
  span: 'text', strong: 'text', em: 'text', small: 'text', div: 'box', dialog: 'dialog', hr: 'divider', iframe: 'embed',
};
const ROLES: Record<string, string> = { button: 'button', link: 'link', tab: 'tab', dialog: 'dialog', menuitem: 'menu item', checkbox: 'checkbox', switch: 'switch' };
const INPUTS: Record<string, string> = { checkbox: 'checkbox', radio: 'option', range: 'slider', submit: 'button', button: 'button', search: 'search box', file: 'file picker' };

/** The kind of thing, in words: button, link, heading, image… */
export function nounFor(f: Pick<LabelFacts, 'tag' | 'role' | 'type'>): string {
  if (f.role && ROLES[f.role]) return ROLES[f.role];
  if (f.tag === 'input') return INPUTS[f.type || ''] || 'field';
  return NOUNS[f.tag] || 'element';
}

const MAX = 32;
function shorten(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > MAX ? t.slice(0, MAX - 1).trimEnd() + '…' : t;
}

/** “Book a demo” button. Long text (a whole section) doesn't make a name, so those read as plain “Section”. */
export function plainLabel(f: LabelFacts): string {
  const noun = nounFor(f);
  const named = [f.ariaLabel, f.alt, f.title, f.placeholder].find((v) => v && v.trim());
  const text = f.text && f.text.replace(/\s+/g, ' ').trim();
  const name = named || (text && text.length <= 80 ? text : '');
  if (name) return `“${shorten(name)}” ${noun}`;
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

/** Library wrappers (motion.div, Primitive.button, Slot) are not what anyone meant to select. */
export function isWrapperName(name: string): boolean {
  return /^[a-z]/.test(name) || name.includes('.') || ['Slot', 'Fragment', 'Suspense', 'StrictMode', 'Provider'].includes(name) || /Provider$|Context$/.test(name);
}
