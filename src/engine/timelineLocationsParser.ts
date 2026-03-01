// =============================================================================
// TIMELINE & LOCATIONS PARSER — Deterministic Extraction Engine
// =============================================================================
// Extracts timeline events and locations from graphic novel script text.
// Extends beyond the basic crossSlice extractors with comprehensive pattern
// matching for establishing shots, markdown timeline tables, CAPTION lines,
// issue headers, and character location inference.

import {
  ParsedProposal,
  ProposedNewEntity,
  ProposedEntityUpdate,
  ProposedTimelineEvent,
} from '../types/parserTypes';
import { Character, LocationEntry, LoreType } from '../types';
import { EntityState } from '../store/entityAdapter';
import { stripMarkdown } from '../utils/markdownStripper';

// ─── Constants ──────────────────────────────────────────────────────────────

// Location name length constraints
const MIN_LOCATION_NAME_LENGTH = 3; // Minimum characters for a valid location name
const MAX_LOCATION_NAME_LENGTH = 50; // Maximum to avoid capturing full sentences

// Timeline year range constraints (for sci-fi setting)
const MIN_REASONABLE_YEAR = 2000; // Earliest year to consider valid
const MAX_REASONABLE_YEAR = 2200; // Latest year for sci-fi timeline

// Context window for character location inference
const CONTEXT_WINDOW_SIZE = 3; // Lines before/after location mention to check for character names

// Place indicator keywords for location extraction
const PLACE_INDICATORS = new Set([
  'CENTER', 'CENTRE', 'ROOM', 'BUILDING', 'STREET', 'LAB', 'LABORATORY',
  'HOSPITAL', 'GARAGE', 'OFFICE', 'BUREAU', 'HEADQUARTERS', 'HQ', 'APARTMENT',
  'HOUSE', 'MANSION', 'CHURCH', 'TEMPLE', 'SCHOOL', 'STATION', 'WAREHOUSE',
  'PARK', 'ALLEY', 'BRIDGE', 'TOWER', 'PRISON', 'JAIL', 'COURT', 'COURTROOM',
  'DINER', 'BAR', 'RESTAURANT', 'CAFÉ', 'CAFE', 'MALL', 'SHOP', 'STORE',
  'MARKET', 'ARENA', 'STADIUM', 'LIBRARY', 'MUSEUM', 'HALL', 'HALLWAY',
  'CORRIDOR', 'BASEMENT', 'ROOFTOP', 'ROOF', 'BUNKER', 'CAVE', 'FOREST',
  'DOCK', 'PORT', 'HARBOR', 'HANGAR', 'FACILITY', 'THEATRE', 'THEATER',
  'BROWNSTONE', 'VOID', 'DIMENSION', 'REALM', 'COMMAND', 'BASE',
  'SITE', 'INTERSECTION', 'CROSSWALK', 'SIDEWALK', 'LOBBY', 
  'ELEVATOR', 'STUDIO', 'CLINIC',
]);

// Keywords suggesting dimensional/abstract locations
const DIMENSIONAL_KEYWORDS = ['dimension', 'realm', 'void', 'plane', 'space'];

// Keywords suggesting command centers
const COMMAND_CENTER_KEYWORDS = ['command', 'headquarters', 'hq', 'base', 'control'];

// Real-world location indicators
const REAL_WORLD_KEYWORDS = ['nyc', 'york', 'street', 'avenue', 'broadway', 'city'];

// Screenplay/comic keywords to filter out when detecting character names
const SPEAKER_NOISE_WORDS = new Set([
  'INT', 'EXT', 'CUT', 'FADE', 'DISSOLVE', 'SMASH', 'MATCH', 'CONTINUED',
  'CONT', 'ANGLE', 'CLOSE', 'WIDE', 'PAN', 'ZOOM', 'SFX', 'VO', 'OS', 'OC',
  'POV', 'INSERT', 'SUPER', 'TITLE', 'THE', 'AND', 'BUT', 'FOR', 'NOT',
  'WITH', 'FROM', 'PAGE', 'PANEL', 'SCENE', 'ACT', 'END', 'DAY', 'NIGHT',
  'MORNING', 'EVENING', 'LATER', 'CONTINUOUS', 'INTERCUT', 'FLASHBACK',
  'MONTAGE', 'BEGIN', 'RESUME', 'BACK', 'SAME', 'TIME', 'CAPTION', 'SETTING',
  'NARRATOR', 'NARRATION', 'DESCRIPTION', 'NOTE', 'ACTION', 'ESTABLISHING',
]);

// Action verbs for item/echo detection
const ITEM_ACTION_VERBS_TLP = [
  'holds', 'hold', 'holding', 'wields', 'wield', 'wielding',
  'carries', 'carry', 'carrying', 'grabs', 'grab', 'grabbing',
  'picks up', 'pick up', 'picking up', 'draws', 'draw', 'drawing',
  'clutches', 'clutch', 'clutching', 'brandishes', 'brandish', 'brandishing',
  'wears', 'wear', 'wearing', 'raises', 'raise', 'raising',
  'retrieves', 'retrieve', 'retrieving', 'activates', 'activate', 'activating',
];

// Significant object keywords for item detection
const ITEM_KEYWORDS_TLP = new Set([
  'SWORD', 'BLADE', 'KNIFE', 'DAGGER', 'AXE', 'HAMMER', 'SPEAR', 'BOW',
  'GUN', 'PISTOL', 'RIFLE', 'WEAPON', 'SHIELD', 'ARMOR', 'RING', 'AMULET',
  'PENDANT', 'NECKLACE', 'CROWN', 'STAFF', 'WAND', 'TOME', 'SCROLL',
  'MAP', 'KEY', 'ARTIFACT', 'RELIC', 'CRYSTAL', 'GEM', 'STONE', 'ORB',
  'DEVICE', 'GADGET', 'BADGE', 'VIAL', 'SERUM', 'SHARD', 'TALISMAN',
]);

// Articles/possessives that should not be used as item modifiers
const ARTICLE_WORDS_TLP = new Set(['a', 'an', 'the', 'his', 'her', 'its', 'their', 'my', 'your', 'our']);

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Generate a UUID with fallback for environments without crypto.randomUUID
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalize a name for comparison: lowercase, trim, collapse whitespace, strip articles
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/i, '');
}

/**
 * Convert string to title case
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if text contains a character name (word boundary match)
 */
function textContainsName(text: string, name: string): boolean {
  if (!text || !name) return false;
  const escaped = escapeRegex(name);
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

/**
 * Infer location type tags based on keywords in the location name
 */
function inferLocationTags(locationName: string): string[] {
  const lowerName = locationName.toLowerCase();
  const tags: string[] = [];

  if (DIMENSIONAL_KEYWORDS.some(kw => lowerName.includes(kw))) {
    tags.push('dimensional');
  }
  if (COMMAND_CENTER_KEYWORDS.some(kw => lowerName.includes(kw))) {
    tags.push('command_center');
  }
  if (REAL_WORLD_KEYWORDS.some(kw => lowerName.includes(kw))) {
    tags.push('real');
  }

  return tags;
}

/**
 * Check if a location already exists (fuzzy matching)
 * Returns the existing location ID if found, null otherwise
 */
function findExistingLocation(
  locationName: string,
  normalizedLocations: EntityState<LocationEntry>
): { id: string; name: string } | null {
  const normalized = normalizeName(locationName);

  for (const id of normalizedLocations.ids) {
    const loc = normalizedLocations.entities[id];
    const existingNormalized = normalizeName(loc.name);

    // Exact match
    if (normalized === existingNormalized) {
      return { id: loc.id, name: loc.name };
    }

    // Containment match (bidirectional)
    if (normalized.includes(existingNormalized) || existingNormalized.includes(normalized)) {
      return { id: loc.id, name: loc.name };
    }
  }

  return null;
}

// ─── Extraction Functions ───────────────────────────────────────────────────

interface ExtractedLocation {
  name: string;
  description: string;
  lineNumber: number;
  contextSnippet: string;
}

/**
 * Extract locations from script text.
 * Handles establishing shots, panel descriptions, slug-lines, and named patterns.
 */
function extractLocations(text: string): ExtractedLocation[] {
  // Strip Markdown before processing
  const normalizedText = stripMarkdown(text);
  const locations: Map<string, ExtractedLocation> = new Map();
  const lines = normalizedText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lineNumber = i + 1;

    // Skip empty lines
    if (!trimmedLine) continue;

    // Pattern 1: INT./EXT. slug-lines (e.g., "INT. APARTMENT - NIGHT")
    const slugMatch = trimmedLine.match(/^(INT\.|EXT\.)\s+([^-]+?)(?:\s+-\s+(.*))?$/i);
    if (slugMatch) {
      const locationName = slugMatch[2].trim();
      const timeOfDay = slugMatch[3] || '';
      const description = `${slugMatch[1]} ${timeOfDay}`.trim();
      
      if (locationName.length >= MIN_LOCATION_NAME_LENGTH) {
        const key = normalizeName(locationName);
        if (!locations.has(key)) {
          locations.set(key, {
            name: locationName,
            description,
            lineNumber,
            contextSnippet: trimmedLine.substring(0, 100),
          });
        }
      }
      continue;
    }

    // Pattern 2: Establishing shot patterns
    const establishingPatterns = [
      /(?:wide\s+)?establishing\s+shot[:\s]+(.+)/i,
      /wide\s+shot\s+of\s+(.+)/i,
      /aerial\s+shot\s*[—-]\s*(.+)/i,
      /exterior\s+establishing[:\s]+(.+)/i,
    ];

    for (const pattern of establishingPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const locationName = match[1].trim().replace(/\.$/, '');
        if (locationName.length >= MIN_LOCATION_NAME_LENGTH) {
          const key = normalizeName(locationName);
          if (!locations.has(key)) {
            locations.set(key, {
              name: locationName,
              description: `Establishing shot: ${locationName}`,
              lineNumber,
              contextSnippet: trimmedLine.substring(0, 100),
            });
          }
        }
        break;
      }
    }

    // Pattern 3: Interior/Exterior descriptions (with or without period)
    const interiorExteriorMatch = trimmedLine.match(
      /(?:Panel\s+\d+\s+)?(Interior|Exterior)[.\s]+([^.]+?)(?:\.|$)/i
    );
    if (interiorExteriorMatch) {
      const locationName = interiorExteriorMatch[2].trim();
      // Filter out lines that are too long (likely full sentences)
      if (locationName.length >= MIN_LOCATION_NAME_LENGTH && locationName.length <= MAX_LOCATION_NAME_LENGTH) {
        const key = normalizeName(locationName);
        if (!locations.has(key)) {
          locations.set(key, {
            name: locationName,
            description: `${interiorExteriorMatch[1]} location`,
            lineNumber,
            contextSnippet: trimmedLine.substring(0, 100),
          });
        }
      }
      continue;
    }

    // Pattern 4: Named location patterns (at the X, inside the X, the X building)
    const namedLocationPatterns = [
      /(?:at|in|inside|near|outside)\s+the\s+([A-Z][A-Za-z\s'-]+?)(?:\.|,|$)/,
      /the\s+([A-Z][A-Za-z\s'-]+?)\s+(?:building|theater|theatre|center|centre)/i,
    ];

    for (const pattern of namedLocationPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const locationName = match[1].trim();
        if (locationName.length >= MIN_LOCATION_NAME_LENGTH && locationName.length <= MAX_LOCATION_NAME_LENGTH) {
          const key = normalizeName(locationName);
          if (!locations.has(key)) {
            locations.set(key, {
              name: locationName,
              description: `Location mentioned: ${locationName}`,
              lineNumber,
              contextSnippet: trimmedLine.substring(0, 100),
            });
          }
        }
        break;
      }
    }

    // Pattern 5: All-caps phrases with place indicators
    const capsWords = trimmedLine.match(/\b[A-Z][A-Z\s'.,-]{2,}\b/g);
    if (capsWords) {
      for (const phrase of capsWords) {
        const cleanPhrase = phrase.trim();
        const words = cleanPhrase.split(/\s+/);
        const hasPlaceIndicator = words.some(word =>
          PLACE_INDICATORS.has(word.replace(/[,.-]/g, ''))
        );

        if (hasPlaceIndicator && cleanPhrase.length >= MIN_LOCATION_NAME_LENGTH && cleanPhrase.length <= MAX_LOCATION_NAME_LENGTH) {
          const key = normalizeName(cleanPhrase);
          if (!locations.has(key)) {
            locations.set(key, {
              name: cleanPhrase,
              description: `Location from caps: ${cleanPhrase}`,
              lineNumber,
              contextSnippet: trimmedLine.substring(0, 100),
            });
          }
        }
      }
    }
  }

  return Array.from(locations.values());
}

interface ExtractedTimelineEvent {
  year: number;
  description: string;
  lineNumber: number;
  contextSnippet: string;
  month?: string;
}

/**
 * Extract timeline events from script text.
 * Handles markdown tables, CAPTION lines, issue headers, and bare year references.
 */
function extractTimelineEvents(text: string): ExtractedTimelineEvent[] {
  // Strip Markdown before processing
  const normalizedText = stripMarkdown(text);
  const events: ExtractedTimelineEvent[] = [];
  const lines = normalizedText.split('\n');

  // Track if we're in a timeline table
  let inTimelineTable = false;
  let tableHeaderSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lineNumber = i + 1;

    // Pattern 1: Detect timeline table header
    if (/TIMELINE\s+OVERVIEW/i.test(trimmedLine)) {
      inTimelineTable = true;
      tableHeaderSeen = false;
      continue;
    }

    // Exit table if we've been in it and encounter a line that doesn't look like table data
    if (inTimelineTable && trimmedLine) {
      // Check if it's not a table row (doesn't start with year or pipe)
      if (!trimmedLine.match(/^(\d{4}|\|)/)) {
        inTimelineTable = false;
        tableHeaderSeen = false;
      }
    }

    // Skip empty lines but don't exit table
    if (!trimmedLine) {
      continue;
    }

    // Pattern 2: Parse markdown table rows in timeline table
    if (inTimelineTable) {
      // After Markdown stripping, table rows are converted to space-separated text
      // Original: |2005|Elias born|—|
      // After stripping: 2005 Elias born —
      
      // Check if line looks like table data (year followed by content)
      const tableDataMatch = trimmedLine.match(/^(\d{4})\s+(.+)/);
      if (tableDataMatch) {
        const year = parseInt(tableDataMatch[1], 10);
        const description = tableDataMatch[2].trim();
        
        // Skip placeholder markers
        if (description && description !== '—' && description !== '-' && year >= MIN_REASONABLE_YEAR && year <= MAX_REASONABLE_YEAR) {
          events.push({
            year,
            description,
            lineNumber,
            contextSnippet: trimmedLine.substring(0, 100),
          });
        }
        continue;
      }
      
      // Legacy: Handle original pipe-separated format if still present
      // Skip table header separator (|---|---|)
      if (/^\|[\s-:|]+\|$/.test(trimmedLine)) {
        tableHeaderSeen = true;
        continue;
      }

      // Skip column headers
      if (!tableHeaderSeen && /^\|\s*Year\s*\|/i.test(trimmedLine)) {
        continue;
      }

      // Parse data rows
      if (tableHeaderSeen && trimmedLine.startsWith('|')) {
        const cells = trimmedLine.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length >= 2) {
          const yearCell = cells[0];
          const eventCell = cells[1];

          // Extract year
          const yearMatch = yearCell.match(/(\d{4})/);
          if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            events.push({
              year,
              description: eventCell,
              lineNumber,
              contextSnippet: trimmedLine.substring(0, 100),
            });
          }
        }
        continue;
      }
    }

    // Pattern 3: CAPTION patterns (both quoted and unquoted)
    const captionPatterns = [
      // Quoted patterns with month and year: "CAPTION: "October 2025""
      /CAPTION:\s*"([A-Za-z]+)\s+(\d{4})(?:\s*[—-]\s*(.*))?"/i,
      // Quoted pattern with year only: "CAPTION: "2035 — description""
      /CAPTION:\s*"(\d{4})\s*[—-]\s*(.*)"/i,
      // Quoted pattern with just year: "CAPTION: "2035""
      /CAPTION:\s*"(\d{4})"/i,
      // Unquoted pattern with month and year: "CAPTION: October 2025"
      /CAPTION:\s*([A-Za-z]+)\s+(\d{4})(?:\s*[—-]\s*(.*))?$/i,
      // Unquoted pattern with year and description: "CAPTION: 2028 - description"
      /CAPTION:\s*(\d{4})\s*[—-]\s*(.*)$/i,
      // Unquoted pattern with just year: "CAPTION: 2028"
      /CAPTION:\s*(\d{4})$/i,
    ];

    for (const pattern of captionPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        let month: string | undefined;
        let year: number;
        let description: string;

        // Determine which pattern matched
        if (match[1] && /^[A-Za-z]+$/.test(match[1]) && match[2]) {
          // Has month (pattern 1 or 4)
          month = match[1].trim();
          year = parseInt(match[2], 10);
          description = match[3] ? match[3].trim() : `${month} ${year}`;
        } else if (match[1] && /^\d{4}$/.test(match[1])) {
          // Year only (patterns 2, 3, 5, or 6)
          year = parseInt(match[1], 10);
          description = match[2] ? match[2].trim() : `${year}`;
        } else {
          continue;
        }

        events.push({
          year,
          month,
          description,
          lineNumber,
          contextSnippet: trimmedLine.substring(0, 100),
        });
        break;
      }
    }

    // Pattern 3b: Setting header (e.g., "Setting: October 2025 | Pages: 22")
    const settingMatch = trimmedLine.match(/Setting:\s*([A-Za-z]+)\s+(\d{4})/i);
    if (settingMatch) {
      const month = settingMatch[1].trim();
      const year = parseInt(settingMatch[2], 10);
      events.push({
        year,
        month,
        description: `${month} ${year} (from Setting header)`,
        lineNumber,
        contextSnippet: trimmedLine.substring(0, 100),
      });
    }

    // Pattern 4: Issue header dates
    const issueHeaderMatch = trimmedLine.match(
      /###\s+Issue\s+#?[\d–-]+:\s*"[^"]*"\s*\|\s*(?:([A-Za-z]+)\s+)?(\d{4})(?:[–-](\d{4}))?/i
    );
    if (issueHeaderMatch) {
      const month = issueHeaderMatch[1];
      const startYear = parseInt(issueHeaderMatch[2], 10);
      const endYear = issueHeaderMatch[3] ? parseInt(issueHeaderMatch[3], 10) : null;

      const description = month ? `${month} ${startYear}` : `${startYear}`;
      events.push({
        year: startYear,
        month,
        description: `Issue epoch: ${description}`,
        lineNumber,
        contextSnippet: trimmedLine.substring(0, 100),
      });

      if (endYear && endYear !== startYear) {
        events.push({
          year: endYear,
          description: `Issue epoch: ${endYear}`,
          lineNumber,
          contextSnippet: trimmedLine.substring(0, 100),
        });
      }
      continue;
    }

    // Pattern 5: Bare year references
    const bareYearPatterns = [
      /(?:in|by|year)\s+(\d{4})/i,
      /(\d{4})\s*[—-]\s*[A-Za-z]/,
    ];

    for (const pattern of bareYearPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const year = parseInt(match[1], 10);
        // Only include if it looks like a reasonable year (sci-fi timeline range)
        if (year >= MIN_REASONABLE_YEAR && year <= MAX_REASONABLE_YEAR) {
          events.push({
            year,
            description: trimmedLine.substring(0, 50),
            lineNumber,
            contextSnippet: trimmedLine.substring(0, 100),
          });
        }
        break;
      }
    }
  }

  return events;
}

/**
 * Infer character location updates from script text.
 * When a location and character are mentioned in the same context, propose an update.
 */
function inferCharacterLocations(
  text: string,
  characters: Character[],
  extractedLocations: ExtractedLocation[]
): Array<{
  characterId: string;
  characterName: string;
  locationName: string;
  lineNumber: number;
  contextSnippet: string;
}> {
  const inferences: Array<{
    characterId: string;
    characterName: string;
    locationName: string;
    lineNumber: number;
    contextSnippet: string;
  }> = [];

  const lines = text.split('\n');

  // For each extracted location, check nearby lines for character mentions
  for (const location of extractedLocations) {
    const startLine = Math.max(0, location.lineNumber - CONTEXT_WINDOW_SIZE);
    const endLine = Math.min(lines.length, location.lineNumber + CONTEXT_WINDOW_SIZE);

    // Get context around the location mention
    const contextLines = lines.slice(startLine, endLine);
    const context = contextLines.join(' ');

    // Check if any character is mentioned in this context
    for (const char of characters) {
      if (textContainsName(context, char.name)) {
        inferences.push({
          characterId: char.id,
          characterName: char.name,
          locationName: location.name,
          lineNumber: location.lineNumber,
          contextSnippet: context.substring(0, 100),
        });
      }
    }
  }

  return inferences;
}

/**
 * Infer location region from inferred tags
 */
function inferRegionFromTags(tags: string[]): string {
  if (tags.includes('real')) return 'Earth';
  if (tags.includes('dimensional')) return 'Abstract';
  return '';
}

interface ExtractedCharacter {
  name: string;
  lineNumber: number;
  contextSnippet: string;
}

/**
 * Extract character names from script text using dialogue speaker patterns.
 * Detects ALL-CAPS speakers in both standalone and inline dialogue formats.
 */
function extractCharacters(text: string): ExtractedCharacter[] {
  const normalizedText = stripMarkdown(text);
  const characters: Map<string, ExtractedCharacter> = new Map();
  const lines = normalizedText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lineNumber = i + 1;

    if (!trimmedLine) continue;

    // Pattern 1: Standalone ALL-CAPS name (dialogue speaker on own line)
    const standaloneMatch = trimmedLine.match(/^([A-Z][A-Z\s'.,-]{2,29})$/);
    if (standaloneMatch) {
      const name = standaloneMatch[1].trim();
      if (!SPEAKER_NOISE_WORDS.has(name) && !PLACE_INDICATORS.has(name)) {
        const key = normalizeName(name);
        if (!characters.has(key)) {
          characters.set(key, { name, lineNumber, contextSnippet: trimmedLine.substring(0, 100) });
        }
      }
      continue;
    }

    // Pattern 2: Comic-style inline dialogue: NAME: "text" or NAME: text
    const inlineDialogueMatch = trimmedLine.match(/^([A-Z][A-Z\s'.,-]{1,29})(?:\s*\([^)]*\))?\s*:\s*.+/);
    if (inlineDialogueMatch) {
      const name = inlineDialogueMatch[1].trim();
      if (!SPEAKER_NOISE_WORDS.has(name) && !PLACE_INDICATORS.has(name)) {
        const key = normalizeName(name);
        if (!characters.has(key)) {
          characters.set(key, { name, lineNumber, contextSnippet: trimmedLine.substring(0, 100) });
        }
      }
    }
  }

  return Array.from(characters.values());
}

interface ExtractedItem {
  name: string;
  lineNumber: number;
  contextSnippet: string;
}

/**
 * Extract significant items/echoes from script text.
 * Detects items mentioned after action verbs (holds, wields, carries, etc.)
 * combined with known item type keywords.
 */
function extractItems(text: string): ExtractedItem[] {
  const normalizedText = stripMarkdown(text);
  const items: Map<string, ExtractedItem> = new Map();
  const lines = normalizedText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lineNumber = i + 1;

    if (!trimmedLine) continue;

    const lowerLine = trimmedLine.toLowerCase();

    for (const verb of ITEM_ACTION_VERBS_TLP) {
      const verbIdx = lowerLine.indexOf(verb);
      if (verbIdx !== -1) {
        const afterVerb = trimmedLine.substring(verbIdx + verb.length);
        const words = afterVerb.split(/\s+/);

        for (let wi = 0; wi < Math.min(words.length, 6); wi++) {
          const word = words[wi].replace(/[^A-Za-z]/g, '').toUpperCase();
          if (ITEM_KEYWORDS_TLP.has(word)) {
            // Include optional preceding adjective modifier (skip articles)
            const prevWord = wi > 0 ? words[wi - 1].replace(/[^A-Za-z]/g, '') : '';
            const useModifier = prevWord && !ARTICLE_WORDS_TLP.has(prevWord.toLowerCase());
            const itemName = (useModifier ? prevWord + ' ' : '') + words[wi].replace(/[^A-Za-z]/g, '');
            const cleanName = itemName.trim();
            if (cleanName.length >= MIN_LOCATION_NAME_LENGTH) { // reuse minimum-length constant (value: 3)
              const key = normalizeName(cleanName);
              if (!items.has(key)) {
                items.set(key, { name: cleanName, lineNumber, contextSnippet: trimmedLine.substring(0, 100) });
              }
            }
            break;
          }
        }
        break; // Only process the first matching verb per line
      }
    }
  }

  return Array.from(items.values());
}

// ─── Main Parser Function ───────────────────────────────────────────────────

export async function parseTimelineAndLocations(
  rawScriptText: string,
  existingState: {
    characters: Character[];
    normalizedLocations: EntityState<LocationEntry>;
    loreEntries: LocationEntry[];
  }
): Promise<ParsedProposal> {
  const startTime = Date.now();

  // Handle null/empty input
  if (!rawScriptText || rawScriptText.trim().length === 0) {
    return {
      meta: {
        parsedAt: new Date().toISOString(),
        rawScriptLength: 0,
        lineCount: 0,
        parseDurationMs: Date.now() - startTime,
        llmWasUsed: false,
        warnings: ['Empty or null input provided'],
      },
      newEntities: [],
      updatedEntities: [],
      newTimelineEvents: [],
    };
  }

  const lines = rawScriptText.split('\n');
  const lineCount = lines.length;
  const warnings: string[] = [];

  // ─── Extract Locations ──────────────────────────────────────────────────────

  const extractedLocations = extractLocations(rawScriptText);
  const newEntities: ProposedNewEntity[] = [];
  const updatedEntities: ProposedEntityUpdate[] = [];

  for (const loc of extractedLocations) {
    // Check if location already exists
    const existing = findExistingLocation(loc.name, existingState.normalizedLocations);

    if (existing) {
      // Propose an update to enrich the existing location
      const currentLocation = existingState.normalizedLocations.entities[existing.id];
      
      // Only propose update if we have new info and a valid description
      if (loc.description && currentLocation.description !== loc.description) {
        const enhancedDescription = currentLocation.description
          ? `${currentLocation.description}; ${loc.description}`
          : loc.description;
        
        updatedEntities.push({
          entityId: existing.id,
          entityType: 'location',
          entityName: existing.name,
          source: 'deterministic',
          confidence: 0.9,
          contextSnippet: loc.contextSnippet,
          lineNumber: loc.lineNumber,
          changeDescription: `Enrich description with: ${loc.description}`,
          updates: {
            description: enhancedDescription,
          },
        });
      }

      // Add warning for potential duplicate
      if (normalizeName(loc.name) !== normalizeName(existing.name)) {
        warnings.push(
          `'${loc.name}' may be the same as existing '${existing.name}'`
        );
      }
    } else {
      // Propose new location
      const tags = inferLocationTags(loc.name);
      
      newEntities.push({
        tempId: generateUUID(),
        entityType: 'location',
        name: toTitleCase(loc.name),
        source: 'deterministic',
        confidence: 1.0,
        contextSnippet: loc.contextSnippet,
        lineNumber: loc.lineNumber,
        suggestedDescription: loc.description,
        suggestedRegion: inferRegionFromTags(tags),
      });
    }
  }

  // ─── Extract Characters ────────────────────────────────────────────────────

  const extractedCharacters = extractCharacters(rawScriptText);
  const existingCharacterNames = new Set(
    existingState.characters.map(c => normalizeName(c.name))
  );

  for (const char of extractedCharacters) {
    const key = normalizeName(char.name);
    if (!existingCharacterNames.has(key)) {
      existingCharacterNames.add(key); // Prevent duplicates within this parse
      newEntities.push({
        tempId: generateUUID(),
        entityType: 'character',
        name: toTitleCase(char.name),
        source: 'deterministic',
        confidence: 0.9,
        contextSnippet: char.contextSnippet,
        lineNumber: char.lineNumber,
        suggestedRole: 'Supporting' as const,
        suggestedDescription: `Character introduced at line ${char.lineNumber}`,
      });
    }
  }

  // ─── Extract Items ─────────────────────────────────────────────────────────

  const extractedItems = extractItems(rawScriptText);
  const seenItemKeys = new Set<string>();

  for (const item of extractedItems) {
    const key = normalizeName(item.name);
    if (!seenItemKeys.has(key)) {
      seenItemKeys.add(key);
      newEntities.push({
        tempId: generateUUID(),
        entityType: 'item',
        name: toTitleCase(item.name),
        source: 'deterministic',
        confidence: 0.8,
        contextSnippet: item.contextSnippet,
        lineNumber: item.lineNumber,
        suggestedItemDescription: `Item detected in action at line ${item.lineNumber}`,
      });
    }
  }

  // ─── Extract Timeline Events ────────────────────────────────────────────────

  const extractedTimelineEvents = extractTimelineEvents(rawScriptText);
  const newTimelineEvents: ProposedTimelineEvent[] = [];

  for (const event of extractedTimelineEvents) {
    newTimelineEvents.push({
      tempId: generateUUID(),
      source: 'deterministic',
      confidence: 1.0,
      contextSnippet: event.contextSnippet,
      lineNumber: event.lineNumber,
      // Note: Using 'location' as entityType for epoch markers since TimelineEntityType
      // is limited to 'character' | 'location' | 'item'. These are global timeline events
      // not tied to specific entities (entityId is empty string).
      entityType: 'location',
      entityId: '', // No specific entity for epoch markers
      entityName: event.description,
      action: 'created',
      payload: {
        year: event.year,
        month: event.month,
        description: event.description,
      },
      description: event.month
        ? `${event.month} ${event.year}: ${event.description}`
        : `${event.year}: ${event.description}`,
    });
  }

  // ─── Infer Character Location Updates ───────────────────────────────────────

  const characterLocationInferences = inferCharacterLocations(
    rawScriptText,
    existingState.characters,
    extractedLocations
  );

  for (const inference of characterLocationInferences) {
    // Find the location ID
    const existing = findExistingLocation(inference.locationName, existingState.normalizedLocations);
    
    // Only propose if we can match to an existing or newly proposed location
    if (existing) {
      const character = existingState.characters.find(c => c.id === inference.characterId);
      
      // Only propose if location is different from current
      if (character && character.currentLocationId !== existing.id) {
        updatedEntities.push({
          entityId: inference.characterId,
          entityType: 'character',
          entityName: inference.characterName,
          source: 'deterministic',
          confidence: 0.85,
          contextSnippet: inference.contextSnippet,
          lineNumber: inference.lineNumber,
          changeDescription: `Move to ${existing.name}`,
          updates: {
            currentLocationId: existing.id,
          },
        });
      }
    }
  }

  // ─── Generate Preview Text ──────────────────────────────────────────────────

  const newLocationCount = newEntities.filter(e => e.entityType === 'location').length;
  const newCharacterCount = newEntities.filter(e => e.entityType === 'character').length;
  const newItemCount = newEntities.filter(e => e.entityType === 'item').length;
  const characterMoveCount = updatedEntities.filter(e => e.entityType === 'character').length;
  const timelineEventCount = newTimelineEvents.length;

  // Build preview warnings
  if (newLocationCount > 0 || timelineEventCount > 0 || characterMoveCount > 0 || newCharacterCount > 0 || newItemCount > 0) {
    const previewParts: string[] = [];
    
    if (newLocationCount > 0) {
      previewParts.push(`${newLocationCount} new location${newLocationCount === 1 ? '' : 's'}`);
    }
    if (newCharacterCount > 0) {
      previewParts.push(`${newCharacterCount} new character${newCharacterCount === 1 ? '' : 's'}`);
    }
    if (newItemCount > 0) {
      previewParts.push(`${newItemCount} new item${newItemCount === 1 ? '' : 's'}`);
    }
    if (timelineEventCount > 0) {
      previewParts.push(`${timelineEventCount} timeline event${timelineEventCount === 1 ? '' : 's'}`);
    }
    if (characterMoveCount > 0) {
      previewParts.push(`${characterMoveCount} character movement${characterMoveCount === 1 ? '' : 's'}`);
    }
    
    const previewSummary = `🧵 The loom senses new threads: ${previewParts.join(', ')}`;
    
    // Add specific highlights
    if (newLocationCount > 0) {
      const firstLoc = newEntities.find(e => e.entityType === 'location');
      if (firstLoc) {
        warnings.unshift(`📍 New location: ${firstLoc.name} (${firstLoc.suggestedDescription})`);
      }
    }
    if (newCharacterCount > 0) {
      const firstChar = newEntities.find(e => e.entityType === 'character');
      if (firstChar) {
        warnings.unshift(`👤 New character: ${firstChar.name}`);
      }
    }
    if (timelineEventCount > 0) {
      const years = extractedTimelineEvents.map(e => e.year);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      warnings.unshift(
        `📅 Timeline +${timelineEventCount} entries from ${minYear}–${maxYear}`
      );
    }
    if (characterMoveCount > 0 && updatedEntities.length > 0) {
      const firstMove = updatedEntities.find(u => u.entityType === 'character');
      if (firstMove) {
        warnings.unshift(`🚶 ${firstMove.entityName} ${firstMove.changeDescription}`);
      }
    }
    
    warnings.unshift(previewSummary);
  }

  // ─── Return Complete Proposal ───────────────────────────────────────────────

  const parseDurationMs = Date.now() - startTime;

  return {
    meta: {
      parsedAt: new Date().toISOString(),
      rawScriptLength: rawScriptText.length,
      lineCount,
      parseDurationMs,
      llmWasUsed: false,
      warnings,
    },
    newEntities,
    updatedEntities,
    newTimelineEvents,
  };
}
