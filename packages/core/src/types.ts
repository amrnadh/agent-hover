export type ContextLevel = 'minimal' | 'standard' | 'full';

export interface SourceLocation {
  file: string;         // relative to project root
  absolutePath: string;
  startLine: number;
  endLine: number;
}

export interface PropInfo {
  name: string;
  type: string;         // TypeScript type as string
  required: boolean;
  defaultValue?: string;
}

export interface ImportInfo {
  name: string;           // imported name
  source: string;         // import path
  isDefault: boolean;
  isLocal: boolean;       // true if from project, not node_modules
}

export interface RelationshipInfo {
  parent?: { component: string; file: string; line: number };
  children: { component: string; file: string; line: number }[];
  siblings: { component: string; file: string; line: number }[];
  usedBy: { component: string; file: string; line?: number; route?: string }[];
}

export interface StyleInfo {
  approach: 'tailwind' | 'css-modules' | 'css-in-js' | 'styled-components' | 'inline' | 'none';
  classes?: string[];     // Tailwind classes
  styleFile?: string;     // CSS module file
}

export interface AssociatedFiles {
  testFile?: string;
  storyFile?: string;
  styleFile?: string;
}

export interface TokenEstimate {
  minimal: number;
  standard: number;
  full: number;
  current: number;
}

export interface ComponentContext {
  id: string;
  component: {
    name: string;
    type: 'function' | 'arrow' | 'class' | 'forwardRef' | 'memo';
    exportType: 'default' | 'named' | 'none';
  };
  source: SourceLocation & {
    code?: string;  // included at standard+ level
  };
  interface?: {
    props: PropInfo[];
    hooks: string[];
    refs: string[];
  };
  relationships?: RelationshipInfo;
  styling?: StyleInfo;
  computedStyles?: ComputedStyleInfo;
  imports?: ImportInfo[];
  associations?: AssociatedFiles;
  tokens: TokenEstimate;
  contextLevel: ContextLevel;
}

export interface PinEntry {
  id: string;
  context: ComponentContext;
  task?: string;
  order?: number;
  addedAt?: string;
}

export interface ElementComment {
  id: string;
  file?: string;
  line?: number;
  component?: string;
  selector?: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
}

export interface PinSet {
  pins: PinEntry[];
  relationships: {
    pinId: string;
    relation: string; // e.g. "parent of #2", "sibling of #1"
    targetPinId: string;
  }[];
  totalTokens: TokenEstimate;
}

export interface TaskContext {
  instruction: string;
  targets: {
    component: string;
    source: string;     // "file:line"
    relationship?: string;
  }[];
  context: string;      // formatted context string
  tokenCost: number;
  frozenFiles?: FrozenFileDirective[];
}

/**
 * A file/component that the AI agent MUST NOT modify.
 */
export interface FrozenFileDirective {
  file: string;
  component: string;
  reason?: string;
}

/**
 * A frozen component entry — components the developer has explicitly
 * locked to prevent AI agents from modifying them.
 */
export interface FreezeEntry {
  id: string;
  file: string;
  component: string;
  line: number;
  frozenAt: string; // ISO timestamp
}

/**
 * Computed CSS styles captured from the live browser runtime.
 * Contains only the ~25 most useful properties for AI debugging.
 */
export interface ComputedStyleInfo {
  // Box model
  width: string;
  height: string;
  padding: string;
  margin: string;
  border: string;
  // Layout
  display: string;
  position: string;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  gridTemplateColumns?: string;
  gap?: string;
  zIndex: string;
  overflow: string;
  // Visibility
  opacity: string;
  visibility: string;
  // Typography
  fontSize: string;
  lineHeight: string;
  color: string;
  backgroundColor: string;
  // Sizing
  maxWidth?: string;
  maxHeight?: string;
  minWidth?: string;
  minHeight?: string;
  // Bounding box (from getBoundingClientRect)
  boundingBox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/**
 * A screenshot snapshot of a component's rendered bounding box.
 * Captured from the browser overlay using dom-to-image.
 */
export interface ScreenshotSnapshot {
  id: string;                  // component identifier (file:componentName)
  label: 'before' | 'after';
  dataUrl: string;             // base64 PNG data URL
  timestamp: string;           // ISO timestamp
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  viewport: {
    width: number;
    height: number;
  };
}

/**
 * A visual diff comparing before/after screenshots of a component.
 * Generated client-side using pixel comparison on Canvas.
 */
export interface ScreenshotDiff {
  componentId: string;
  componentName: string;
  before: ScreenshotSnapshot;
  after: ScreenshotSnapshot;
  diffDataUrl: string;          // pixel-diff overlay PNG data URL
  changedPixelPercent: number;  // 0-100
  createdAt: string;            // ISO timestamp
}

export type TaskType = 'component-context' | 'dom-element' | 'pinned-stack' | 'note';
export type TaskStatus =
  | 'queued' | 'delivered' | 'in_progress'
  | 'done' | 'failed' | 'cancelled' | 'expired' | 'superseded';
export type Intent = 'fix' | 'restyle' | 'feature' | 'refactor' | 'explain' | 'test' | 'general';
export type Scope = 'instance' | 'component' | 'unspecified';

export interface AgentTaskTarget {
  component?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  selector?: string;
  hierarchy?: string[];
  instanceCount?: number;
}

export interface AgentTaskPayload {
  props?: unknown;
  hooks?: unknown;
  styles?: unknown;
  notes?: string[];
  source?: string;
  runtime?: unknown;
  pins?: Array<{ component: string; file: string; role: 'TARGET' | 'REFERENCE' | 'FROZEN' }>;
  goal?: string;
  screenshotId?: string;
  prompt?: string;
}

export interface AgentTaskResult {
  summary?: string;
  filesChanged?: string[];
  error?: string;
}

export interface AgentTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  supersedesKey?: string;
  intent?: Intent;
  scope?: Scope;
  instruction?: string;
  target: AgentTaskTarget;
  payload: AgentTaskPayload;
  tokenEstimate?: number;
  claimedBy?: string;
  checkpointId?: string;
  result?: AgentTaskResult;
}

export interface AgentPresence {
  client: string;
  version?: string;
  lastSeen: string;
}

