import { StateCreator } from 'zustand';
import { Character, LoreType, LocationEntry, EventEntry, LoreEntry, Panel, Page, Issue } from '../types';
import { genId, createDefaultEra } from '../utils/helpers';
import { stripMarkdown } from '../utils/markdownStripper';

// =============================================================================
// CROSS-SLICE — Cross-cutting actions that orchestrate updates across multiple slices
// =============================================================================

// ─── Name matching utilities ────────────────────────────────────────────────

/**
 * Normalize a name for comparison: lowercase, trim, collapse whitespace
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if a text block contains a character name.
 * Matches whole words only to avoid false positives (e.g., "May" in "maybe").
 */
function textContainsName(text: string, name: string): boolean {
  if (!text || !name) return false;
  const normalized = normalizeName(text);
  const nameNorm = normalizeName(name);
  // Word boundary match
  const escaped = nameNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(normalized);
}

/**
 * Find a character by name in an existing roster.
 * Returns the match or null. Handles case insensitivity.
 */
export function findCharacterByName(name: string, characters: Character[]): Character | null {
  const norm = normalizeName(name);
  return characters.find(c => normalizeName(c.name) === norm) || null;
}

/**
 * Find a lore entry by name in existing entries.
 */
export function findLoreByName(name: string, entries: LoreEntry[]): LoreEntry | null {
  const norm = normalizeName(name);
  return entries.find(e => normalizeName(e.name) === norm) || null;
}

// ─── Script Import → Character Seeding ──────────────────────────────────────

export interface ParsedCharacterInput {
  name: string;
  description?: string;
  lineCount: number;
  firstAppearance?: string;
}

export interface SeedResult {
  /** Characters that were newly created */
  created: Character[];
  /** Characters that already existed (matched by name) */
  existing: Character[];
  /** Map from parsed name → character ID (includes both created and existing) */
  nameToId: Map<string, string>;
}

/**
 * Given parsed characters from a script import, create Character dossiers
 * for any that don't already exist. Returns a map of name → ID for linking.
 */
export function seedCharactersFromScript(
  parsedCharacters: ParsedCharacterInput[],
  existingCharacters: Character[],
): SeedResult {
  const created: Character[] = [];
  const existing: Character[] = [];
  const nameToId = new Map<string, string>();

  for (const parsed of parsedCharacters) {
    const match = findCharacterByName(parsed.name, existingCharacters);

    if (match) {
      // Already exists — just map the name
      existing.push(match);
      nameToId.set(normalizeName(parsed.name), match.id);
    } else {
      // Create a new dossier
      const now = Date.now();
      const newChar: Character = {
        id: genId(),
        createdAt: now,
        updatedAt: now,
        name: parsed.name,
        role: guessRole(parsed),
        archetype: '',
        eras: [createDefaultEra('Default')],
        voice_profile: { samples: [], style: '' },
        smart_tags: { Status: 'Active' },
        gallery: [],
        loreEntryIds: [],
        description: parsed.description || parsed.firstAppearance || '',
      };
      created.push(newChar);
      nameToId.set(normalizeName(parsed.name), newChar.id);
    }
  }

  return { created, existing, nameToId };
}

/**
 * Guess a character's role based on their line count relative to others.
 */
function guessRole(parsed: ParsedCharacterInput): Character['role'] {
  // Simple heuristic — can be refined later
  if (parsed.lineCount >= 20) return 'Protagonist';
  if (parsed.lineCount >= 10) return 'Supporting';
  if (parsed.lineCount >= 3) return 'Supporting';
  return 'Minor';
}

// ─── Auto-linking panels to characters ──────────────────────────────────────

export interface AutoLinkResult {
  /** Panel ID → array of character IDs that should be linked */
  panelLinks: Map<string, string[]>;
  /** Total number of new links that would be added */
  newLinkCount: number;
}

/**
 * Scan all panels in an issue for character name mentions in prompts and dialogue.
 * Returns a map of suggested character links.
 */
export function autoLinkPanelsToCharacters(
  issue: Issue,
  characters: Character[],
): AutoLinkResult {
  const panelLinks = new Map<string, string[]>();
  let newLinkCount = 0;

  for (const page of issue.pages) {
    for (const panel of page.panels) {
      const matchedIds: string[] = [];

      for (const char of characters) {
        if (!char.name || char.name.length < 2) continue;

        // Check panel prompt
        const inPrompt = textContainsName(panel.prompt || '', char.name);

        // Check dialogue/text elements
        const inDialogue = panel.textElements.some(te =>
          textContainsName(te.content, char.name)
        );

        // Check notes
        const inNotes = textContainsName(panel.notes || '', char.name);

        if (inPrompt || inDialogue || inNotes) {
          // Only add if not already linked
          if (!panel.characterIds.includes(char.id)) {
            matchedIds.push(char.id);
            newLinkCount++;
          }
        }
      }

      if (matchedIds.length > 0) {
        panelLinks.set(panel.id, matchedIds);
      }
    }
  }

  return { panelLinks, newLinkCount };
}

// ─── Lore mention detection ─────────────────────────────────────────────────

export interface LoreMention {
  loreEntryId: string;
  loreEntryName: string;
  panelId: string;
  pageNumber: number;
  context: string; // snippet of text where the mention was found
}

/**
 * Scan panels for mentions of lore entry names.
 * Returns a list of detected mentions for review.
 */
export function detectLoreMentions(
  issue: Issue,
  loreEntries: LoreEntry[],
): LoreMention[] {
  const mentions: LoreMention[] = [];

  // Only scan entries with names >= 3 chars to avoid false positives
  const scannable = loreEntries.filter(e => e.name.length >= 3);

  for (const page of issue.pages) {
    for (const panel of page.panels) {
      const textBlocks = [
        panel.prompt || '',
        panel.notes || '',
        ...panel.textElements.map(te => te.content),
      ].filter(Boolean);

      const fullText = textBlocks.join(' ');

      for (const entry of scannable) {
        if (textContainsName(fullText, entry.name)) {
          // Find the context snippet
          const idx = fullText.toLowerCase().indexOf(entry.name.toLowerCase());
          const start = Math.max(0, idx - 30);
          const end = Math.min(fullText.length, idx + entry.name.length + 30);
          const context = (start > 0 ? '...' : '') + fullText.slice(start, end) + (end < fullText.length ? '...' : '');

          mentions.push({
            loreEntryId: entry.id,
            loreEntryName: entry.name,
            panelId: panel.id,
            pageNumber: page.number,
            context,
          });
        }
      }
    }
  }

  return mentions;
}

// ─── Batch operations ───────────────────────────────────────────────────────

/**
 * Apply auto-link results to panels, returning updated pages.
 */
export function applyAutoLinks(
  pages: Page[],
  panelLinks: Map<string, string[]>,
): Page[] {
  return pages.map(page => ({
    ...page,
    panels: page.panels.map(panel => {
      const newIds = panelLinks.get(panel.id);
      if (!newIds || newIds.length === 0) return panel;
      return {
        ...panel,
        characterIds: [...new Set([...panel.characterIds, ...newIds])],
      };
    }),
  }));
}

// ─── Script extraction (autoCreateFromScript) ───────────────────────────────

export interface ScriptExtractionResult {
  newCharacters: Character[];
  newLocations: LocationEntry[];
  newTimelineEvents: EventEntry[];
}

export interface CrossSlice {
  updateEntity: (id: string, data: Partial<Character>) => void;
  autoCreateFromScript: (text: string) => ScriptExtractionResult;
  deleteProjectCascade: (projectId: string) => void;
  deleteAllProjects: () => void;
}

// Helper to escape special regex characters in character names
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Common screenplay direction keywords to filter out
const SCREENPLAY_KEYWORDS = new Set([
  'INT', 'EXT', 'CUT', 'FADE', 'DISSOLVE', 'SMASH', 'MATCH', 'CONTINUED',
  'CONT', 'ANGLE', 'CLOSE', 'WIDE', 'PAN', 'ZOOM', 'SFX', 'VO', 'OS', 'OC',
  'POV', 'INSERT', 'SUPER', 'TITLE', 'THE', 'AND', 'BUT', 'FOR', 'NOT',
  'WITH', 'FROM', 'PAGE', 'PANEL', 'SCENE', 'ACT', 'END', 'DAY', 'NIGHT',
  'MORNING', 'EVENING', 'LATER', 'CONTINUOUS', 'INTERCUT', 'FLASHBACK',
  'MONTAGE', 'BEGIN', 'RESUME', 'BACK', 'SAME', 'TIME',
]);

// Maximum length for character names in screenplay format (reasonable limit for names)
const MAX_CHARACTER_NAME_LENGTH = 30;

// Place indicator keywords for location extraction
const PLACE_INDICATORS = new Set([
  'CENTER', 'CENTRE', 'ROOM', 'BUILDING', 'STREET', 'LAB', 'LABORATORY', 
  'HOSPITAL', 'GARAGE', 'OFFICE', 'BUREAU', 'HEADQUARTERS', 'HQ', 'APARTMENT', 
  'HOUSE', 'MANSION', 'CHURCH', 'TEMPLE', 'SCHOOL', 'STATION', 'WAREHOUSE', 
  'PARK', 'ALLEY', 'BRIDGE', 'TOWER', 'PRISON', 'JAIL', 'COURT', 'COURTROOM', 
  'DINER', 'BAR', 'RESTAURANT', 'CAFÉ', 'CAFE', 'MALL', 'SHOP', 'STORE', 
  'MARKET', 'ARENA', 'STADIUM', 'LIBRARY', 'MUSEUM', 'HALL', 'HALLWAY', 
  'CORRIDOR', 'BASEMENT', 'ROOFTOP', 'ROOF', 'BUNKER', 'CAVE', 'FOREST', 
  'DOCK', 'PORT', 'HARBOR', 'HANGAR', 'FACILITY',
]);

// Interface for raw timeline event extraction
interface RawTimelineEvent {
  date: string;
  context: string;
}

// Convert string to title case
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract location names from script text.
 * Looks for:
 * 1. Lines starting with INT. or EXT. (standard slug-lines)
 * 2. Sentences starting with Interior/Exterior (optionally preceded by Panel N)
 * 3. All-caps phrases containing place indicator words
 */
function extractLocations(text: string): string[] {
  // Strip Markdown before processing
  const normalizedText = stripMarkdown(text);
  const locations = new Set<string>();
  const lines = normalizedText.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 1. Check for INT./EXT. slug-lines (e.g., "INT. APARTMENT - NIGHT")
    const slugMatch = trimmedLine.match(/^(INT\.|EXT\.)\s+([^-]+?)(?:\s+-\s+.*)?$/i);
    if (slugMatch) {
      const location = slugMatch[2].trim();
      if (location.length >= 3) {
        locations.add(location);
      }
      continue;
    }

    // 2. Check for Interior/Exterior descriptions (e.g., "Panel 1 Interior apartment.")
    const interiorExteriorMatch = trimmedLine.match(/(?:Panel\s+\d+\s+)?(Interior|Exterior)[.\s]+(.+)/i);
    if (interiorExteriorMatch) {
      const location = interiorExteriorMatch[2].trim().replace(/\.$/, '');
      if (location.length >= 3) {
        locations.add(location);
      }
      continue;
    }

    // 3. Check for all-caps phrases with place indicators
    const capsWords = trimmedLine.match(/\b[A-Z][A-Z\s'.,-]{2,}\b/g);
    if (capsWords) {
      for (const phrase of capsWords) {
        const cleanPhrase = phrase.trim();
        // Check if phrase contains at least one place indicator
        const words = cleanPhrase.split(/\s+/);
        const hasPlaceIndicator = words.some(word => 
          PLACE_INDICATORS.has(word.replace(/[,.-]/g, ''))
        );
        
        if (hasPlaceIndicator && cleanPhrase.length >= 3) {
          locations.add(cleanPhrase);
        }
      }
    }

    // 4. Check for mixed-case descriptive locations with place indicators
    // Pattern: "Parking garage", "Construction site", "Hospital maternity ward"
    // Matches phrases like "Parking garage" or "Construction site"
    const mixedCaseWords = trimmedLine.match(/\b[A-Z][a-z]+(?:\s+[a-z]+)*(?:\s+[A-Z]?[a-z]+)*\b/g);
    if (mixedCaseWords) {
      for (const phrase of mixedCaseWords) {
        const cleanPhrase = phrase.trim();
        // Check if phrase contains at least one place indicator (case-insensitive)
        const words = cleanPhrase.toUpperCase().split(/\s+/);
        const hasPlaceIndicator = words.some(word => 
          PLACE_INDICATORS.has(word.replace(/[,.-]/g, ''))
        );
        
        if (hasPlaceIndicator && cleanPhrase.length >= 3 && cleanPhrase.length <= 50) {
          locations.add(cleanPhrase);
        }
      }
    }
  }

  return Array.from(locations);
}

/**
 * Extract timeline events from script text.
 * Looks for:
 * 1. Setting: <date>
 * 2. CAPTION: <year>...
 * Tracks current page/scene context for descriptive purposes.
 */
function extractTimeline(text: string): RawTimelineEvent[] {
  // Strip Markdown before processing
  const normalizedText = stripMarkdown(text);
  const events: RawTimelineEvent[] = [];
  const lines = normalizedText.split('\n');
  let currentContext = 'Script';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Track page/scene context
    const pageMatch = trimmedLine.match(/^Page\s+(\d+)/i);
    if (pageMatch) {
      currentContext = `Page ${pageMatch[1]}`;
      continue;
    }

    const sceneMatch = trimmedLine.match(/^Scene\s+(\d+)/i);
    if (sceneMatch) {
      currentContext = `Scene ${sceneMatch[1]}`;
      continue;
    }

    // Look for Setting: <date>
    const settingMatch = trimmedLine.match(/^Setting:\s*(.+)/i);
    if (settingMatch) {
      const date = settingMatch[1].trim();
      if (date) {
        events.push({ date, context: currentContext });
      }
      continue;
    }

    // Look for CAPTION: <year>...
    const captionMatch = trimmedLine.match(/^CAPTION:\s*(\d{4}.+)/i);
    if (captionMatch) {
      const date = captionMatch[1].trim();
      if (date) {
        events.push({ date, context: currentContext });
      }
    }

    // Look for bare CAPTION: with date/year (without requiring 4 digits at start)
    const bareCaptionMatch = trimmedLine.match(/^CAPTION:\s*(.+)/i);
    if (bareCaptionMatch && !captionMatch) {
      const dateText = bareCaptionMatch[1].trim();
      // Check if it contains a year or looks like a date
      if (dateText && (dateText.match(/\d{4}/) || dateText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i))) {
        events.push({ date: dateText, context: currentContext });
      }
    }

    // Look for table rows with year data (after Markdown stripping, table rows become space-separated)
    // Pattern: Lines that start with a 4-digit year followed by content
    const tableRowMatch = trimmedLine.match(/^(\d{4})\s+(.+)/);
    if (tableRowMatch) {
      const year = tableRowMatch[1];
      const description = tableRowMatch[2].trim();
      if (description && description !== '—' && description !== '-') {
        events.push({ date: `${year}: ${description}`, context: currentContext });
      }
    }
  }

  return events;
}

// NOTE: This slice needs access to the full LitStore type to read/write across all slices.
// The first generic parameter must be the complete LitStore intersection type.
// TypeScript will infer this when the slice is composed in index.ts.
export const createCrossSlice: StateCreator<any, [], [], CrossSlice> = (set, get) => ({
  /**
   * Updates a character and propagates name changes through all Ink Tracker content.
   * If data.name is provided and differs from the current name, it walks through
   * all ink projects → issues → pages → panels → textElements and replaces
   * occurrences of the old character name with the new name in textElement.content
   * using word-boundary regex matching (case-insensitive).
   */
  updateEntity: (id: string, data: Partial<Character>) => {
    const state = get();
    const character = state.characters.find((c: Character) => c.id === id);
    
    if (!character) {
      console.warn(`Character with id ${id} not found`);
      return;
    }

    // First, update the character record
    state.updateCharacter(id, data);

    // If name is being changed, propagate through ink tracker content
    if (data.name && data.name !== character.name) {
      const oldName = character.name;
      const newName = data.name;
      
      // Create a word-boundary regex for the old name (case-insensitive)
      const escapedOldName = escapeRegex(oldName);
      const nameRegex = new RegExp(`\\b${escapedOldName}\\b`, 'gi');

      // Clone the current ink state
      const inkState = state.inkState;
      const updatedInkState = {
        ...inkState,
        projects: inkState.projects.map((project: any) => ({
          ...project,
          issues: project.issues.map((issue: any) => ({
            ...issue,
            pages: issue.pages.map((page: any) => ({
              ...page,
              panels: page.panels.map((panel: any) => ({
                ...panel,
                textElements: panel.textElements.map((textElement: any) => {
                  // Replace old name with new name in the content
                  const updatedContent = textElement.content.replace(nameRegex, newName);
                  return {
                    ...textElement,
                    content: updatedContent,
                  };
                }),
              })),
            })),
          })),
        })),
      };

      // Push the updated ink state via inkDispatch
      state.inkDispatch({ type: 'HYDRATE', payload: updatedInkState });
    }
  },

  /**
   * Scans the provided script text for CAPITALIZED NAMES (standard screenplay convention),
   * LOCATIONS, and TIMELINE EVENTS. Filters out common screenplay direction keywords and 
   * compares found names against existing characters and lore entries (case-insensitive). 
   * For each new entity, creates a placeholder object and adds it to the appropriate store.
   * Returns a structured result containing all newly created entities.
   */
  autoCreateFromScript: (text: string): ScriptExtractionResult => {
    const state = get();
    
    // Strip Markdown formatting before extraction
    const normalizedText = stripMarkdown(text);
    
    // ===== CHARACTER EXTRACTION (existing logic) =====
    
    // Extract all-caps words/phrases using the specified regex pattern
    // Pattern matches sequences starting with uppercase letter, followed by 0-29 more chars (uppercase, space, period, apostrophe, hyphen)
    // Total length: 1 to MAX_CHARACTER_NAME_LENGTH characters
    const pattern = new RegExp(`\\b([A-Z][A-Z '.\\-]{0,${MAX_CHARACTER_NAME_LENGTH - 1}})\\b`, 'g');
    const matches = normalizedText.match(pattern) || [];
    
    // Create a set of unique capitalized names, filtering out screenplay keywords
    const uniqueNames = new Set<string>();
    matches.forEach((match) => {
      const trimmed = match.trim();
      // Filter out screenplay keywords
      if (!SCREENPLAY_KEYWORDS.has(trimmed)) {
        uniqueNames.add(trimmed);
      }
    });

    // Get existing character names (case-insensitive comparison)
    const existingNames = new Set(
      state.characters.map((c: Character) => c.name.toLowerCase())
    );

    // Create new characters for names that don't exist yet
    const newCharacters: Character[] = [];
    
    uniqueNames.forEach((name) => {
      const lowerName = name.toLowerCase();
      
      // Skip if character already exists
      if (existingNames.has(lowerName)) {
        return;
      }

      // Create a new character with placeholder data
      const newCharacter: Character = {
        id: crypto.randomUUID(),
        name: toTitleCase(name),
        role: 'Supporting',
        archetype: '',
        eras: [],
        voice_profile: {
          samples: [],
          style: '',
        },
        smart_tags: {
          source: 'auto-script-import',
        },
        gallery: [],
        loreEntryIds: [],
        description: 'Auto-created from script import',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add to the list
      newCharacters.push(newCharacter);
      
      // Add to existing names set to avoid duplicates in this batch
      existingNames.add(lowerName);
    });

    // ===== LOCATION EXTRACTION =====
    
    const extractedLocations = extractLocations(text);
    
    // Get existing location names (case-insensitive comparison)
    const existingLocationNames = new Set(
      state.loreEntries
        .filter((e: any) => e.type === LoreType.LOCATION)
        .map((e: any) => e.name.toLowerCase())
    );

    // Create new locations for names that don't exist yet
    const newLocations: LocationEntry[] = [];
    
    extractedLocations.forEach((locationName) => {
      const lowerName = locationName.toLowerCase();
      
      // Skip if location already exists
      if (existingLocationNames.has(lowerName)) {
        return;
      }

      // Create a new location entry
      const newLocation: LocationEntry = {
        id: crypto.randomUUID(),
        name: toTitleCase(locationName),
        type: LoreType.LOCATION,
        description: 'Auto-extracted from script import',
        tags: ['auto-extracted'],
        relatedEntryIds: [],
        characterIds: [],
        region: '',
        climate: '',
        importance: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add to the list
      newLocations.push(newLocation);
      
      // Add to existing names set to avoid duplicates in this batch
      existingLocationNames.add(lowerName);
    });

    // ===== TIMELINE EVENT EXTRACTION =====
    
    const extractedEvents = extractTimeline(text);
    
    // Get existing event dates (case-insensitive comparison)
    const existingEventDates = new Set(
      state.loreEntries
        .filter((e: any) => e.type === LoreType.EVENT)
        .map((e: any) => e.date?.toLowerCase() || '')
    );

    // Create new timeline events for dates that don't exist yet
    const newTimelineEvents: EventEntry[] = [];
    
    extractedEvents.forEach((event) => {
      const lowerDate = event.date.toLowerCase();
      
      // Skip if event already exists
      if (existingEventDates.has(lowerDate)) {
        return;
      }

      // Create a new event entry
      const newEvent: EventEntry = {
        id: crypto.randomUUID(),
        name: event.date,
        type: LoreType.EVENT,
        date: event.date,
        participants: '',
        consequences: '',
        description: `Timeline marker found at ${event.context}`,
        tags: ['timeline', 'auto-extracted'],
        relatedEntryIds: [],
        characterIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add to the list
      newTimelineEvents.push(newEvent);
      
      // Add to existing dates set to avoid duplicates in this batch
      existingEventDates.add(lowerDate);
    });

    // ===== COMMIT ALL NEW ENTITIES TO STORE =====
    
    if (newCharacters.length > 0 || newLocations.length > 0 || newTimelineEvents.length > 0) {
      set((prevState: any) => ({
        characters: [...prevState.characters, ...newCharacters],
        loreEntries: [...prevState.loreEntries, ...newLocations, ...newTimelineEvents],
      }));
    }

    return {
      newCharacters,
      newLocations,
      newTimelineEvents,
    };
  },

  /**
   * Cascading delete for a project. Removes the project and all associated data:
   * - Characters that are ONLY used in this project (not referenced by other projects)
   * - Relationships involving deleted characters
   * - Lore entries that reference deleted characters (or clean up characterIds references)
   * - Timeline entries
   * - The project itself from inkSlice
   */
  deleteProjectCascade: (projectId: string) => {
    const state = get();
    
    // Find the project being deleted
    const project = state.inkState.projects.find((p: any) => p.id === projectId);
    if (!project) {
      console.warn(`Project ${projectId} not found`);
      return;
    }

    // Step 1: Delete the project FIRST (moved from old Step 5)
    state.inkDispatch({ type: 'DELETE_PROJECT', id: projectId });

    // Step 2: Get updated ink state and collect ALL character IDs from remaining projects
    const updatedInkState = get().inkState;
    const remainingReferencedCharIds = new Set<string>();
    
    updatedInkState.projects.forEach((p: any) => {
      p.issues.forEach((issue: any) => {
        issue.pages.forEach((page: any) => {
          page.panels.forEach((panel: any) => {
            if (panel.characterIds && Array.isArray(panel.characterIds)) {
              panel.characterIds.forEach((charId: string) => {
                remainingReferencedCharIds.add(charId);
              });
            }
          });
        });
      });

      // Also check legacy project.characters if present
      if (p.characters && Array.isArray(p.characters)) {
        p.characters.forEach((char: any) => {
          if (char.id) {
            remainingReferencedCharIds.add(char.id);
          }
        });
      }
    });

    // Step 3: Filter global characters array - keep only referenced characters
    const updatedCharacters = state.characters.filter((char: Character) =>
      remainingReferencedCharIds.has(char.id)
    );

    // Determine which characters were deleted
    const characterIdsToDelete = state.characters
      .filter((char: Character) => !remainingReferencedCharIds.has(char.id))
      .map((char: Character) => char.id);

    // Step 4: Filter normalizedCharacters - keep only referenced characters
    const updatedNormalizedCharacters = {
      ...state.normalizedCharacters,
      entities: { ...state.normalizedCharacters.entities }
    };
    
    // Delete entities not in remainingReferencedCharIds
    if (updatedNormalizedCharacters.entities) {
      Object.keys(updatedNormalizedCharacters.entities).forEach(charId => {
        if (!remainingReferencedCharIds.has(charId)) {
          delete updatedNormalizedCharacters.entities[charId];
        }
      });
    }
    
    // Filter ids array
    if (updatedNormalizedCharacters.ids && Array.isArray(updatedNormalizedCharacters.ids)) {
      updatedNormalizedCharacters.ids = updatedNormalizedCharacters.ids.filter(
        (id: string) => remainingReferencedCharIds.has(id)
      );
    }

    // Step 5: Clean up loreEntries and normalizedLocations for deleted character IDs
    if (characterIdsToDelete.length > 0) {
      const characterIdsToDeleteSet = new Set(characterIdsToDelete);
      
      // Update lore entries to remove deleted character references
      let updatedLoreEntries = state.loreEntries;
      if (state.loreEntries && Array.isArray(state.loreEntries)) {
        updatedLoreEntries = state.loreEntries.map((entry: any) => {
          if (!entry.characterIds || entry.characterIds.length === 0) {
            return entry;
          }
          
          const remainingCharacterIds = entry.characterIds.filter(
            (charId: string) => !characterIdsToDeleteSet.has(charId)
          );
          
          if (remainingCharacterIds.length !== entry.characterIds.length) {
            return {
              ...entry,
              characterIds: remainingCharacterIds,
              updatedAt: Date.now(),
            };
          }
          
          return entry;
        });
      }

      // Update normalized locations
      const updatedNormalizedLocations = {
        ...state.normalizedLocations,
        entities: { ...state.normalizedLocations.entities }
      };
      if (state.normalizedLocations && state.normalizedLocations.ids && Array.isArray(state.normalizedLocations.ids)) {
        state.normalizedLocations.ids.forEach((id: string) => {
          const location = state.normalizedLocations.entities[id];
          if (location && location.characterIds && location.characterIds.length > 0) {
            const remainingCharacterIds = location.characterIds.filter(
              (charId: string) => !characterIdsToDeleteSet.has(charId)
            );
            
            if (remainingCharacterIds.length !== location.characterIds.length) {
              updatedNormalizedLocations.entities[id] = {
                ...location,
                characterIds: remainingCharacterIds,
                updatedAt: Date.now(),
              };
            }
          }
        });
      }

      // Clean up relationships array - remove relationships involving deleted characters
      const updatedRelationships = state.relationships.filter((rel: any) =>
        !characterIdsToDeleteSet.has(rel.fromId) && !characterIdsToDeleteSet.has(rel.toId)
      );

      // Apply all updates
      set((prevState: any) => ({
        characters: updatedCharacters,
        normalizedCharacters: updatedNormalizedCharacters,
        loreEntries: updatedLoreEntries,
        normalizedLocations: updatedNormalizedLocations,
        relationships: updatedRelationships,
      }));
    } else {
      // Even if no characters deleted, still update characters and normalizedCharacters
      set((prevState: any) => ({
        characters: updatedCharacters,
        normalizedCharacters: updatedNormalizedCharacters,
      }));
    }
  },

  /**
   * Nuclear delete: wipes ALL projects and ALL associated data across every slice.
   * Clears: projects, characters, relationships, lore entries, normalized stores,
   * timeline, parser state, and IndexedDB image cache.
   * Use with caution — this is irreversible.
   */
  deleteAllProjects: () => {
    const state = get();

    // Step 1: Nuke all Zustand-managed state across slices
    set((prevState: any) => ({
      // Character slice
      characters: [],
      relationships: [],
      activeCharacterId: null,
      activeEraId: null,
      isCharacterEditorOpen: false,
      isChatOpen: false,
      activeChatCharacterId: null,
      characterSearchTerm: '',

      // Lore slice
      loreEntries: [],
      activeLoreEntryId: null,
      isLoreEditorOpen: false,
      loreSearchTerm: '',
      loreFilterType: 'all',

      // Normalized stores
      normalizedCharacters: { ids: [], entities: {} },
      normalizedLocations: { ids: [], entities: {} },
      normalizedItems: { ids: [], entities: {} },
      timeline: prevState.timeline
        ? { ...prevState.timeline, entries: [] }
        : { entries: [] },

      // Parser slice
      parserStatus: 'idle',
      currentProposal: null,
      selectedNewEntityIds: [],
      selectedUpdateIds: [],
      selectedTimelineEventIds: [],
      parserErrorMessage: null,
      parsedScriptResult: null,
      rawScriptText: null,
    }));

    // Step 2: Reset ink state to a clean default via HYDRATE
    state.inkDispatch({
      type: 'HYDRATE',
      payload: {
        projects: [],
        activeProjectId: null,
        activeIssueId: null,
        activePageId: null,
      },
    });

    // Step 3: Clear the legacy ink_tracker_data from localStorage
    try {
      localStorage.removeItem('ink_tracker_data');
    } catch (e) {
      console.warn('Failed to clear ink_tracker_data from localStorage:', e);
    }

    // Step 4: Clear IndexedDB image cache
    try {
      const dbRequest = indexedDB.deleteDatabase('lit-tracker-images');
      dbRequest.onerror = () => console.warn('Failed to delete IndexedDB image cache');
      dbRequest.onsuccess = () => console.log('IndexedDB image cache cleared');
    } catch (e) {
      console.warn('Failed to clear IndexedDB:', e);
    }

    console.log('🔥 All projects and associated data deleted.');
  },
});
