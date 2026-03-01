// =============================================================================
// UNIFIED PARSER PIPELINE — Type Definitions (The Contract)
// =============================================================================
// This is the single output format that both the AI parser and the
// deterministic parser produce. It replaces the three existing schemas:
//   - ParseResult / ParsedPage / ParsedPanel  (services/parserTypes.ts)
//   - ParsedScript / Page / Panel             (utils/scriptParser.ts)
//   - ComicParseResult / ParsedCharacter      (engine/comicScriptParser.ts)
//
// Every downstream consumer (inkSlice, characterSlice, loreSlice, crossSlice)
// receives data converted FROM this shape via parserConversion.ts.
//
// ─── Project Format ──────────────────────────────────────────────────────────

export type ProjectType = 'comic' | 'screenplay' | 'stage-play' | 'tv-series';

// ─── Block-level content (inside a panel) ────────────────────────────────────

export type BlockType =
  | 'ART_NOTE'    // Visual/artist directions
  | 'DIALOGUE'    // Spoken lines (requires speaker)
  | 'CAPTION'     // Narrator captions
  | 'NARRATOR'    // Voice-over / narrator
  | 'SFX'         // Sound effects
  | 'THOUGHT'     // Internal monologue (requires speaker)
  | 'CRAWLER'     // Screen text, news tickers
  | 'TITLE_CARD'  // Title cards, chapter headers
  | 'OTHER';      // Anything that doesn't fit

export interface Block {
  type: BlockType;
  text: string;
  speaker?: string;              // Required for DIALOGUE and THOUGHT
  meta?: Record<string, unknown>; // Visual markers, modifiers, parentheticals, etc.
}

// ─── Structural hierarchy ────────────────────────────────────────────────────

export interface ParsedPanel {
  panel_number: number;          // Sequential within page
  blocks: Block[];
  visual_marker?: string;        // 'echo' | 'hitch' | 'overflow' | 'shattered' | etc.
  aspect_hint?: string;          // AI suggestion: 'wide' | 'tall' | 'square' | etc.
}

export interface ParsedPage {
  page_number: number;
  panels: ParsedPanel[];
}

// ─── Character extraction ────────────────────────────────────────────────────

export interface ParsedCharacter {
  name: string;
  role?: 'Protagonist' | 'Antagonist' | 'Supporting' | 'Minor';
  description?: string;
  pages_present: number[];        // Which pages they appear on
  first_appearance_page: number;
  lines_count: number;
  notable_quotes?: string[];      // Max 2
}

// ─── Lore extraction ─────────────────────────────────────────────────────────

export type LoreCategory =
  | 'faction'
  | 'location'
  | 'event'
  | 'concept'
  | 'artifact'
  | 'rule'
  | 'item';

export interface ParsedLoreEntry {
  name: string;
  category: LoreCategory;
  description: string;
  pages: number[];                // Which pages it's referenced on
  confidence: number;             // 0.0 – 1.0
  related_characters?: string[];  // Character names linked to this entry
  metadata?: Record<string, unknown>; // Category-specific fields
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export interface ParsedTimelineEvent {
  name: string;
  description: string;
  page: number;
  characters_involved: string[];
}

// ─── The Contract ────────────────────────────────────────────────────────────

export interface UnifiedParseResult {
  // Metadata
  source_hash: string;            // Hash of input script for cache/dedup
  project_type: ProjectType;
  warnings: string[];

  // Storyboard structure
  pages: ParsedPage[];

  // Cross-module extractions
  characters: ParsedCharacter[];
  lore: ParsedLoreEntry[];
  timeline: ParsedTimelineEvent[];

  // Parser metadata
  parser_source: 'ai' | 'deterministic' | 'ai+deterministic';
  ai_model?: string;              // Which model was used
  parse_duration_ms?: number;
}