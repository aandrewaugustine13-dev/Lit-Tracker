// =============================================================================
// LIT TRACKER — UNIFIED TYPE SYSTEM
// =============================================================================
// Merges types from: Ink Tracker, Character Tracker, Lore Tracker
// Cross-referencing is done via string IDs across all entities.

// ─── Navigation ─────────────────────────────────────────────────────────────

export type ModuleId = 'ink' | 'characters' | 'lore';

// ─── Shared ─────────────────────────────────────────────────────────────────

export interface EntityBase {
  id: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Characters (from Character Tracker) ────────────────────────────────────

export type CharacterRole = 'Protagonist' | 'Antagonist' | 'Supporting' | 'Minor';

export interface Era {
  id: string;
  name: string;
  visual_tags: string[];
  age_appearance: string;
  reference_image_id?: string;
}

export interface VoiceProfile {
  samples: string[];
  style: string;
}

export interface Character extends EntityBase {
  name: string;
  role: CharacterRole;
  archetype: string;
  eras: Era[];
  voice_profile: VoiceProfile;
  smart_tags: Record<string, string>;
  gallery: string[];
  // Cross-references
  loreEntryIds: string[];      // Links to lore entries
  // Legacy Ink Tracker compat
  description?: string;
  appearance?: CharacterAppearance;
  // CRM fields (optional for backward compatibility)
  currentLocationId?: string | null;
  status?: string;
  inventory?: string[];
  relationships?: Record<string, string>;
}

export interface CharacterAppearance {
  age?: string;
  gender?: string;
  ethnicity?: string;
  height?: string;
  build?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  skinTone?: string;
  facialFeatures?: string;
  distinguishingMarks?: string;
  clothing?: string;
  accessories?: string;
  additionalNotes?: string;
  customStylePrompt?: string;
}

export interface Relationship {
  id: string;
  fromId: string;
  toId: string;
  label: string;
}

export type CharacterViewType = 'grid' | 'graph' | 'writer';

// ─── Lore (from Lore Tracker) ───────────────────────────────────────────────

export enum LoreType {
  FACTION = 'faction',
  LOCATION = 'location',
  EVENT = 'event',
  CONCEPT = 'concept',
  ARTIFACT = 'artifact',
  RULE = 'rule',
}

export interface LoreBase extends EntityBase {
  name: string;
  type: LoreType;
  description: string;
  tags: string[];
  relatedEntryIds: string[];
  characterIds: string[];        // Cross-ref to characters
}

export interface FactionEntry extends LoreBase {
  type: LoreType.FACTION;
  ideology: string;
  leader: string;
  influence: number;
}

export interface LocationEntry extends LoreBase {
  type: LoreType.LOCATION;
  region: string;
  climate: string;
  importance: string;
}

export interface EventEntry extends LoreBase {
  type: LoreType.EVENT;
  date: string;
  participants: string;
  consequences: string;
}

export interface ConceptEntry extends LoreBase {
  type: LoreType.CONCEPT;
  origin: string;
  rules: string;
  complexity: string;
}

export interface ArtifactEntry extends LoreBase {
  type: LoreType.ARTIFACT;
  origin: string;
  currentHolder: string;
  properties: string;
}

export interface RuleEntry extends LoreBase {
  type: LoreType.RULE;
  scope: string;
  exceptions: string;
  canonLocked: boolean;
}

export type LoreEntry = FactionEntry | LocationEntry | EventEntry | ConceptEntry | ArtifactEntry | RuleEntry;

// ─── Ink / Storyboard (from Ink Tracker) ────────────────────────────────────
// These are kept as stubs so the Ink module can be dropped in later.

export enum AspectRatio {
  WIDE = 'wide',
  STD = 'std',
  SQUARE = 'square',
  TALL = 'tall',
  PORTRAIT = 'portrait',
}

export type TextElementType = 'dialogue' | 'thought' | 'caption' | 'phone';

export interface TextElement {
  id: string;
  type: TextElementType;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  tailDirection?: 'left' | 'right' | 'bottom' | 'none';
  rotation?: number;
  tailX?: number;
  tailY?: number;
  tailStyle?: 'pointy' | 'cloud' | 'none';
}

export interface Panel {
  id: string;
  prompt: string;
  imageUrl?: string;
  aspectRatio: AspectRatio;
  notes?: string;
  characterIds: string[];
  textElements: TextElement[];
  referencePanelId?: string;
  referenceStrength?: number;
  title?: string;
  promptHistory?: string[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scriptRef?: {
    pageNumber: number;
    panelNumber: number;
    startOffset: number;
    endOffset: number;
    visualMarker?: string;
  };
}

export interface Page {
  id: string;
  number: number;
  panels: Panel[];
}

export interface Issue {
  id: string;
  title: string;
  pages: Page[];
  scriptText?: string;
}

export type ImageProvider = 'gemini' | 'leonardo' | 'grok' | 'fal' | 'seaart' | 'openai';
export type PanelFrameStyle = 'opaque-black' | 'opaque-white' | 'translucent';
export type TextOverlayStyle = 'opaque' | 'semi-transparent' | 'border-only';

export interface InkProject {
  id: string;
  title: string;
  style: string;
  issueType: 'issue' | 'chapter';
  imageProvider: ImageProvider;
  projectType?: 'comic' | 'screenplay' | 'stage-play' | 'tv-series';
  geminiApiKey?: string;
  leonardoApiKey?: string;
  grokApiKey?: string;
  falApiKey?: string;
  seaartApiKey?: string;
  openaiApiKey?: string;
  customStylePrompt?: string;
  fluxModel?: string;
  panelFrameStyle?: PanelFrameStyle;
  textOverlayStyle?: TextOverlayStyle;
  issues: Issue[];
  // Legacy: ported components may reference this. In unified app, characters live in characterSlice.
  characters?: any[];
}

// ─── Ink App State (for reducer wrapper) ────────────────────────────────────

export interface InkAppState {
  projects: InkProject[];
  activeProjectId: string | null;
  activeIssueId: string | null;
  activePageId: string | null;
}

export interface AppStateWithHistory {
  past: InkAppState[];
  present: InkAppState;
  future: InkAppState[];
}

// ─── Unified Project / File Format ──────────────────────────────────────────

export interface LitProject {
  version: string;
  name: string;
  characters: Character[];
  relationships: Relationship[];
  loreEntries: LoreEntry[];
  inkProjects: InkProject[];
  lastSaved: number;
}

// ─── Backward Compatibility Aliases ─────────────────────────────────────────
// These allow ported Ink Tracker components to use their original type names
export type Project = InkProject;
export type AppState = InkAppState;

// ─── Re-export Lore CRM Types ───────────────────────────────────────────────
export * from './lore';
