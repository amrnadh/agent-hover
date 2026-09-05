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
  imports?: ImportInfo[];
  associations?: AssociatedFiles;
  tokens: TokenEstimate;
  contextLevel: ContextLevel;
}

export interface PinEntry {
  id: string;
  context: ComponentContext;
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
}
