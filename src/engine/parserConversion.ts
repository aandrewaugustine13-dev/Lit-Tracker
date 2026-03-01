// =============================================================================
// PARSER CONVERSION LAYER
// =============================================================================
// Converts UnifiedParseResult → app types used by Zustand store slices.
// This is the ONLY file that knows about both the pipeline contract
// (parserPipeline.types.ts) and the app's own types (src/types/index.ts,
// services/scriptParser.ts, services/parserTypes.ts).
//
// Replaces: inline toParseResult() in ScriptImportModal.tsx
//           convertParsedScriptToParseResult() in useInkLogic.ts

import {
  UnifiedParseResult,
  ParsedPage as UnifiedParsedPage,
  ParsedPanel as UnifiedParsedPanel,
  Block,
  BlockType,
  LoreCategory,
} from './parserPipeline.types';

import {
  Panel,
  Page,
  Issue,
  Character,
  LoreEntry,
  LoreType,
  AspectRatio,
  FactionEntry,
  LocationEntry,
  EventEntry,
  ConceptEntry,
  ArtifactEntry,
  RuleEntry,
} from '../types';

// Legacy types — used by SplitView, ScriptReparseModal, useInkLogic
// REMOVE these imports once Phase 4 updates those consumers
import type {
  ParseResult as LegacyParseResult,
  ParsedPage as LegacyParsedPage,
  ParsedPanel as LegacyParsedPanel,
  ParsedCharacter as LegacyParsedCharacter,
  VisualMarker,
  ParsedBubble,
} from '../services/scriptParser';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const genId = () => crypto.randomUUID();
const now = () => Date.now();

/**
 * Map a visual marker string from the unified result to the legacy VisualMarker union.
 */
function toVisualMarker(marker?: string): VisualMarker {
  const VALID: Set<string> = new Set([
    'standard', 'echo', 'hitch', 'overflow', 'shattered',
    'split', 'splash', 'inset', 'large', 'full-width',
  ]);
  if (marker && VALID.has(marker)) return marker as VisualMarker;
  return 'standard';
}

/**
 * Map an aspect_hint string to an AspectRatio enum value.
 */
function toAspectRatio(hint?: string): AspectRatio {
  switch (hint) {
    case 'wide': return AspectRatio.WIDE;
    case 'tall': return AspectRatio.TALL;
    case 'square': return AspectRatio.SQUARE;
    case 'portrait': return AspectRatio.PORTRAIT;
    default: return AspectRatio.WIDE;
  }
}

/**
 * Map a LoreCategory to the app's LoreType enum.
 * 'item' has no direct LoreType mapping — falls back to ARTIFACT.
 */
function toLoreType(category: LoreCategory): LoreType {
  switch (category) {
    case 'faction': return LoreType.FACTION;
    case 'location': return LoreType.LOCATION;
    case 'event': return LoreType.EVENT;
    case 'concept': return LoreType.CONCEPT;
    case 'artifact': return LoreType.ARTIFACT;
    case 'rule': return LoreType.RULE;
    case 'item': return LoreType.ARTIFACT; // closest match
    default: return LoreType.CONCEPT;
  }
}

// ─── For InkSlice — storyboard panels ────────────────────────────────────────

/**
 * Convert a UnifiedParseResult into an Issue ready for the ink store.
 * Each ParsedPage becomes a Page, each ParsedPanel becomes a Panel.
 */
export function toInkIssue(result: UnifiedParseResult, issueTitle: string): Issue {
  const pages: Page[] = result.pages.map((uPage) => {
    const panels: Panel[] = uPage.panels.map((uPanel, idx) => {
      // Build prompt from all blocks
      const descriptionParts: string[] = [];
      const dialogueParts: string[] = [];

      for (const block of uPanel.blocks) {
        if (block.type === 'ART_NOTE' || block.type === 'NARRATOR' || block.type === 'CAPTION') {
          descriptionParts.push(block.text);
        } else if (block.type === 'DIALOGUE' || block.type === 'THOUGHT') {
          dialogueParts.push(`${block.speaker || 'UNKNOWN'}: ${block.text}`);
        } else if (block.type === 'SFX') {
          descriptionParts.push(`[SFX: ${block.text}]`);
        }
      }

      const prompt = descriptionParts.join(' ').trim();

      // Build text elements from dialogue/thought/caption blocks
      const textElements = uPanel.blocks
        .filter(b => ['DIALOGUE', 'THOUGHT', 'CAPTION', 'SFX', 'CRAWLER'].includes(b.type))
        .map((block, tIdx) => ({
          id: genId(),
          type: blockTypeToTextElementType(block.type),
          content: block.speaker ? `${block.speaker}: ${block.text}` : block.text,
          x: 20,
          y: 20 + tIdx * 60,
          width: 200,
          height: 50,
          fontSize: 12,
          color: '#000000',
        }));

      return {
        id: genId(),
        prompt,
        aspectRatio: toAspectRatio(uPanel.aspect_hint),
        characterIds: [],       // Will be linked by crossSlice auto-link
        textElements,
        x: 40 + (idx % 3) * 400,
        y: 40 + Math.floor(idx / 3) * 480,
        width: 360,
        height: 420,
        scriptRef: {
          pageNumber: uPage.page_number,
          panelNumber: uPanel.panel_number,
          startOffset: 0,
          endOffset: 0,
          visualMarker: uPanel.visual_marker,
        },
      } satisfies Panel;
    });

    return {
      id: genId(),
      number: uPage.page_number,
      panels,
    } satisfies Page;
  });

  return {
    id: genId(),
    title: issueTitle,
    pages,
  };
}

function blockTypeToTextElementType(bt: BlockType): 'dialogue' | 'thought' | 'caption' | 'phone' {
  switch (bt) {
    case 'DIALOGUE': return 'dialogue';
    case 'THOUGHT': return 'thought';
    case 'CAPTION': return 'caption';
    case 'CRAWLER': return 'phone'; // closest mapping for screen text
    default: return 'caption';
  }
}

// ─── For CharacterSlice — character seeds ────────────────────────────────────

/**
 * Convert parsed characters to app Character objects suitable for
 * addCharacter() in characterSlice.
 */
export function toCharacterSeeds(result: UnifiedParseResult): Omit<Character, 'id' | 'createdAt' | 'updatedAt'>[] {
  return result.characters.map((pc) => ({
    name: pc.name,
    role: pc.role || 'Supporting',
    archetype: '',
    eras: [{
      id: genId(),
      name: 'Origin',
      visual_tags: [],
      age_appearance: '',
    }],
    voice_profile: { samples: pc.notable_quotes || [], style: '' },
    smart_tags: { source: result.parser_source },
    gallery: [],
    loreEntryIds: [],
    description: pc.description || `Appears on ${pc.pages_present.length} page(s), ${pc.lines_count} line(s).`,
    currentLocationId: null,
    status: 'Active',
    inventory: [],
    relationships: {},
  }));
}

// ─── For LoreSlice — lore entries ────────────────────────────────────────────

/**
 * Convert parsed lore to LoreEntry objects suitable for addLoreEntry() in loreSlice.
 */
export function toLoreEntries(result: UnifiedParseResult): LoreEntry[] {
  return result.lore.map((pl) => {
    const baseFields = {
      id: genId(),
      name: pl.name,
      type: toLoreType(pl.category),
      description: pl.description,
      tags: ['auto-extracted', pl.category],
      relatedEntryIds: [],
      characterIds: [],
      createdAt: now(),
      updatedAt: now(),
    };

    // Build type-specific fields
    switch (baseFields.type) {
      case LoreType.FACTION:
        return {
          ...baseFields,
          type: LoreType.FACTION,
          ideology: (pl.metadata?.ideology as string) || '',
          leader: (pl.metadata?.leader as string) || '',
          influence: (pl.metadata?.influence as number) || 5,
        } as FactionEntry;

      case LoreType.LOCATION:
        return {
          ...baseFields,
          type: LoreType.LOCATION,
          region: (pl.metadata?.region as string) || '',
          climate: (pl.metadata?.climate as string) || '',
          importance: (pl.metadata?.importance as string) || '',
        } as LocationEntry;

      case LoreType.EVENT:
        return {
          ...baseFields,
          type: LoreType.EVENT,
          date: (pl.metadata?.date as string) || '',
          participants: pl.related_characters?.join(', ') || '',
          consequences: (pl.metadata?.consequences as string) || '',
        } as EventEntry;

      case LoreType.CONCEPT:
        return {
          ...baseFields,
          type: LoreType.CONCEPT,
          origin: (pl.metadata?.origin as string) || '',
          rules: (pl.metadata?.rules as string) || '',
          complexity: (pl.metadata?.complexity as string) || 'Low',
        } as ConceptEntry;

      case LoreType.ARTIFACT:
        return {
          ...baseFields,
          type: LoreType.ARTIFACT,
          origin: (pl.metadata?.origin as string) || '',
          currentHolder: (pl.metadata?.currentHolder as string) || '',
          properties: (pl.metadata?.properties as string) || '',
        } as ArtifactEntry;

      case LoreType.RULE:
        return {
          ...baseFields,
          type: LoreType.RULE,
          scope: (pl.metadata?.scope as string) || '',
          exceptions: (pl.metadata?.exceptions as string) || '',
          canonLocked: (pl.metadata?.canonLocked as boolean) || false,
        } as RuleEntry;

      default:
        // Fallback to concept
        return {
          ...baseFields,
          type: LoreType.CONCEPT,
          origin: '',
          rules: '',
          complexity: 'Low',
        } as ConceptEntry;
    }
  });
}

// ─── For CrossSlice — timeline events ────────────────────────────────────────

export interface ConvertedTimelineEvent {
  name: string;
  description: string;
  page: number;
  characters_involved: string[];
}

/**
 * Timeline events pass through mostly unchanged since crossSlice
 * processes them with its own TimelineEntry format via createTimelineEntry().
 */
export function toTimelineEvents(result: UnifiedParseResult): ConvertedTimelineEvent[] {
  return result.timeline.map((te) => ({
    name: te.name,
    description: te.description,
    page: te.page,
    characters_involved: te.characters_involved,
  }));
}

// ─── LEGACY BRIDGE ───────────────────────────────────────────────────────────
// Converts UnifiedParseResult to the legacy ParseResult format used by:
//   - ScriptReparseModal.tsx
//   - SplitView.tsx
//   - useInkLogic.ts (handleScriptImport)
//
// DELETE this function once Phase 4 updates those consumers to use
// UnifiedParseResult directly.

/**
 * Convert UnifiedParseResult to the legacy ParseResult format.
 */
export function toLegacyParseResult(result: UnifiedParseResult): LegacyParseResult {
  const pages: LegacyParsedPage[] = result.pages.map((uPage) => ({
    pageNumber: uPage.page_number,
    panels: uPage.panels.map((uPanel) => {
      // Reconstruct description from ART_NOTE blocks
      const description = uPanel.blocks
        .filter(b => b.type === 'ART_NOTE' || b.type === 'NARRATOR')
        .map(b => b.text)
        .join(' ')
        .trim();

      // Convert blocks to bubbles
      const bubbles: ParsedBubble[] = uPanel.blocks
        .filter(b => ['DIALOGUE', 'THOUGHT', 'CAPTION', 'SFX', 'CRAWLER'].includes(b.type))
        .map((block) => ({
          type: blockTypeToLegacyBubbleType(block.type),
          text: block.text,
          character: block.speaker,
        }));

      // Collect artist notes
      const artistNotes = uPanel.blocks
        .filter(b => b.type === 'ART_NOTE')
        .map(b => b.text);

      return {
        panelNumber: uPanel.panel_number,
        description,
        bubbles,
        artistNotes,
        visualMarker: toVisualMarker(uPanel.visual_marker),
        aspectRatio: toAspectRatio(uPanel.aspect_hint),
      } as LegacyParsedPanel;
    }),
  }));

  const characters: LegacyParsedCharacter[] = result.characters.map((pc) => ({
    name: pc.name,
    description: pc.description,
    lineCount: pc.lines_count,
    firstAppearance: pc.pages_present.length > 0
      ? `Page ${pc.pages_present[0]}`
      : undefined,
  }));

  return {
    success: result.pages.length > 0,
    pages,
    characters,
    errors: result.warnings.filter(w => w.includes('failure') || w.includes('error')), 
    warnings: result.warnings,
  };
}

function blockTypeToLegacyBubbleType(
  bt: BlockType,
): 'dialogue' | 'caption' | 'thought' | 'sfx' | 'screen-text' | 'phone' {
  switch (bt) {
    case 'DIALOGUE': return 'dialogue';
    case 'THOUGHT': return 'thought';
    case 'CAPTION': return 'caption';
    case 'SFX': return 'sfx';
    case 'CRAWLER': return 'screen-text';
    default: return 'dialogue';
  }
}