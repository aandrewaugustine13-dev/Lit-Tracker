// =============================================================================
// UNIVERSAL SCRIPT PARSER — Two-Pass Extraction Engine
// =============================================================================
// Pure function module that parses script text in two passes:
// Pass 1 (Deterministic): Regex-based extraction of entities and timeline events
// Pass 2 (Optional LLM): Gemini API fallback for ambiguous cases
//
// Returns a ParsedProposal for user review before committing to the store.

import { Character, LocationEntry } from '../types';
import { Item } from '../types/lore';
import {
  ParsedProposal,
  ProjectConfig,
  ProposedNewEntity,
  ProposedEntityUpdate,
  ProposedTimelineEvent,
  LLMExtractionResponse,
} from '../types/parserTypes';
import { EntityState } from '../store/entityAdapter';
import { genId } from '../utils/helpers';

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

// Common screenplay direction keywords to filter out
const SCREENPLAY_KEYWORDS = new Set([
  'INT', 'EXT', 'CUT', 'FADE', 'DISSOLVE', 'SMASH', 'MATCH', 'CONTINUED',
  'CONT', 'ANGLE', 'CLOSE', 'WIDE', 'PAN', 'ZOOM', 'SFX', 'VO', 'OS', 'OC',
  'POV', 'INSERT', 'SUPER', 'TITLE', 'THE', 'AND', 'BUT', 'FOR', 'NOT',
  'WITH', 'FROM', 'PAGE', 'PANEL', 'SCENE', 'ACT', 'END', 'DAY', 'NIGHT',
  'MORNING', 'EVENING', 'LATER', 'CONTINUOUS', 'INTERCUT', 'FLASHBACK',
  'MONTAGE', 'BEGIN', 'RESUME', 'BACK', 'SAME', 'TIME',
]);

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

// Item keywords for detection
const ITEM_KEYWORDS = new Set([
  'SWORD', 'BLADE', 'DAGGER', 'KNIFE', 'GUN', 'PISTOL', 'RIFLE', 'WEAPON',
  'SHIELD', 'ARMOR', 'RING', 'AMULET', 'NECKLACE', 'PENDANT',
  'STAFF', 'WAND', 'SCEPTER', 'CRYSTAL', 'ORB', 'GEM', 'STONE',
  'POTION', 'ELIXIR', 'VIAL', 'FLASK',
  'SCROLL', 'BOOK', 'TOME', 'MANUSCRIPT', 'LETTER', 'NOTE',
  'MAP', 'COMPASS', 'KEY', 'LOCK',
  'CROWN', 'TIARA', 'HELMET', 'MASK',
  'ARTIFACT', 'RELIC', 'TALISMAN', 'CHARM',
  'BAG', 'POUCH', 'SATCHEL', 'BACKPACK',
  'CLOAK', 'ROBE', 'CAPE', 'HOOD',
]);

// Action verbs for item detection
const ITEM_ACTION_VERBS = [
  'holds', 'draws', 'picks up', 'picks', 'wields', 'carries', 'takes',
  'grabs', 'grasps', 'clutches', 'brandishes', 'lifts', 'retrieves',
  'holds up', 'raises', 'produces', 'pulls out', 'unsheathes',
];

// Maximum character name length
const MAX_CHARACTER_NAME_LENGTH = 30;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Normalize a name for comparison: lowercase, trim, collapse whitespace.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Convert string to title case.
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Build an entity index mapping normalized names to existing entities.
 */
function buildEntityIndex(
  characters: Character[],
  normalizedLocations: EntityState<LocationEntry>,
  normalizedItems: EntityState<Item>,
  knownEntityNames: string[]
): Map<string, { type: 'character' | 'location' | 'item'; id: string; name: string }> {
  const index = new Map();

  // Index characters
  for (const char of characters) {
    if (char.name) {
      index.set(normalizeName(char.name), {
        type: 'character',
        id: char.id,
        name: char.name,
      });
    }
  }

  // Index locations
  for (const id of normalizedLocations.ids) {
    const location = normalizedLocations.entities[id];
    if (location.name) {
      index.set(normalizeName(location.name), {
        type: 'location',
        id: location.id,
        name: location.name,
      });
    }
  }

  // Index items
  for (const id of normalizedItems.ids) {
    const item = normalizedItems.entities[id];
    if (item.name) {
      index.set(normalizeName(item.name), {
        type: 'item',
        id: item.id,
        name: item.name,
      });
    }
  }

  // Index known entity names (without IDs, just for deduplication)
  for (const name of knownEntityNames) {
    if (!index.has(normalizeName(name))) {
      index.set(normalizeName(name), {
        type: 'character', // Default to character for known names
        id: '',
        name,
      });
    }
  }

  return index;
}

// =============================================================================
// PASS 1 — DETERMINISTIC EXTRACTION
// =============================================================================

interface Pass1Result {
  newEntities: ProposedNewEntity[];
  updatedEntities: ProposedEntityUpdate[];
  newTimelineEvents: ProposedTimelineEvent[];
  ambiguousLines: Array<{ lineNumber: number; text: string }>;
  discoveredNames: Set<string>;
}

/**
 * Pass 1: Deterministic regex-based extraction.
 */
function runPass1(
  rawScriptText: string,
  config: ProjectConfig,
  entityIndex: Map<string, { type: 'character' | 'location' | 'item'; id: string; name: string }>,
  characters: Character[]
): Pass1Result {
  const newEntities: ProposedNewEntity[] = [];
  const updatedEntities: ProposedEntityUpdate[] = [];
  const newTimelineEvents: ProposedTimelineEvent[] = [];
  const ambiguousLines: Array<{ lineNumber: number; text: string }> = [];
  const discoveredNames = new Set<string>();

  const lines = rawScriptText.split('\n');
  let currentLocationName: string | null = null;
  let currentLocationId: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lineNumber = i + 1;

    if (!trimmedLine) continue;

    // ─── Slug-line detection ────────────────────────────────────────────────
    // Match: INT./EXT. LOCATION_TEXT - TIME_OF_DAY
    const slugMatch = trimmedLine.match(/^(INT\.|EXT\.)\s+([^-]+?)(?:\s+-\s+(.+))?$/i);
    if (slugMatch) {
      const locationText = slugMatch[2].trim();
      const timeOfDay = slugMatch[3]?.trim() || '';
      const normalizedLocName = normalizeName(locationText);

      if (entityIndex.has(normalizedLocName)) {
        const entity = entityIndex.get(normalizedLocName)!;
        if (entity.type === 'location') {
          currentLocationName = entity.name;
          currentLocationId = entity.id;
        }
      } else if (locationText.length >= 3) {
        // Propose new location
        const tempId = genId();
        newEntities.push({
          tempId,
          entityType: 'location',
          name: toTitleCase(locationText),
          source: 'deterministic',
          confidence: 0.95,
          contextSnippet: truncate(trimmedLine, 200),
          lineNumber,
          suggestedTimeOfDay: timeOfDay,
          suggestedDescription: `Location from slug-line: ${trimmedLine}`,
        });
        discoveredNames.add(normalizedLocName);
        currentLocationName = toTitleCase(locationText);
        currentLocationId = tempId;
      }
      continue;
    }

    // ─── Interior/Exterior detection ────────────────────────────────────────
    // Match: (Panel N )?(Interior|Exterior) LOCATION_TEXT
    const interiorExteriorMatch = trimmedLine.match(/(?:Panel\s+\d+\s+)?(Interior|Exterior)[.\s]+(.+)/i);
    if (interiorExteriorMatch) {
      const locationText = interiorExteriorMatch[2].trim().replace(/\.$/, '');
      const normalizedLocName = normalizeName(locationText);

      if (entityIndex.has(normalizedLocName)) {
        const entity = entityIndex.get(normalizedLocName)!;
        if (entity.type === 'location') {
          currentLocationName = entity.name;
          currentLocationId = entity.id;
        }
      } else if (locationText.length >= 3 && !discoveredNames.has(normalizedLocName)) {
        const tempId = genId();
        newEntities.push({
          tempId,
          entityType: 'location',
          name: toTitleCase(locationText),
          source: 'deterministic',
          confidence: 0.85,
          contextSnippet: truncate(trimmedLine, 200),
          lineNumber,
          suggestedDescription: `Location from interior/exterior: ${trimmedLine}`,
        });
        discoveredNames.add(normalizedLocName);
        currentLocationName = toTitleCase(locationText);
        currentLocationId = tempId;
      }
      continue;
    }

    // ─── Dialogue speaker detection ─────────────────────────────────────────
    // Match: All-caps name on own line, optionally followed by parenthetical
    const dialogueMatch = trimmedLine.match(/^([A-Z][A-Z\s'.,-]{0,29})(?:\s*\(.*?\))?$/);
    if (dialogueMatch && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      // Check if next line is indented or quoted (dialogue)
      const isDialogue = lines[i + 1].startsWith(' ') || nextLine.startsWith('"') || nextLine.startsWith("'");
      
      if (isDialogue) {
        const speakerName = dialogueMatch[1].trim();
        const normalizedSpeaker = normalizeName(speakerName);

        // Skip screenplay keywords
        if (SCREENPLAY_KEYWORDS.has(speakerName)) {
          continue;
        }

        const existingEntity = entityIndex.get(normalizedSpeaker);

        if (!existingEntity && !discoveredNames.has(normalizedSpeaker)) {
          // Propose new character
          newEntities.push({
            tempId: genId(),
            entityType: 'character',
            name: toTitleCase(speakerName),
            source: 'deterministic',
            confidence: 0.90,
            contextSnippet: truncate(`${trimmedLine}\n${nextLine}`, 200),
            lineNumber,
            suggestedRole: 'Supporting',
            suggestedDescription: 'Character identified from dialogue',
          });
          discoveredNames.add(normalizedSpeaker);
        } else if (existingEntity && existingEntity.type === 'character' && currentLocationId) {
          // Check if character's location differs from current location
          const char = characters.find(c => c.id === existingEntity.id);
          if (char && char.currentLocationId !== currentLocationId) {
            // Propose moved_to timeline event
            newTimelineEvents.push({
              tempId: genId(),
              source: 'deterministic',
              confidence: 0.75,
              contextSnippet: truncate(trimmedLine, 200),
              lineNumber,
              entityType: 'character',
              entityId: existingEntity.id,
              entityName: existingEntity.name,
              action: 'moved_to',
              payload: { locationId: currentLocationId, locationName: currentLocationName },
              description: `${existingEntity.name} moved to ${currentLocationName}`,
            });
          }
        }
      }
    }

    // ─── Known entity scanning ──────────────────────────────────────────────
    for (const knownName of config.knownEntityNames) {
      const escapedName = knownName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
      if (regex.test(trimmedLine)) {
        // Entity mentioned - could track mentions if needed
      }
    }

    // ─── Custom pattern matching ────────────────────────────────────────────
    for (const customPattern of config.customPatterns) {
      try {
        const regex = new RegExp(customPattern.pattern, 'i');
        const match = trimmedLine.match(regex);
        if (match) {
          const entityName = match[1] || match[0];
          const normalizedEntityName = normalizeName(entityName);

          if (!entityIndex.has(normalizedEntityName) && !discoveredNames.has(normalizedEntityName)) {
            newEntities.push({
              tempId: genId(),
              entityType: customPattern.entityType,
              name: toTitleCase(entityName),
              source: 'deterministic',
              confidence: 0.70,
              contextSnippet: truncate(trimmedLine, 200),
              lineNumber,
              suggestedDescription: `Matched custom pattern: ${customPattern.label}`,
            });
            discoveredNames.add(normalizedEntityName);
          }
        }
      } catch (error) {
        console.warn(`Invalid custom pattern: ${customPattern.pattern}`, error);
      }
    }

    // ─── Setting/Caption timeline ───────────────────────────────────────────
    const settingMatch = trimmedLine.match(/^Setting:\s*(.+)/i);
    if (settingMatch) {
      const dateText = settingMatch[1].trim();
      newTimelineEvents.push({
        tempId: genId(),
        source: 'deterministic',
        confidence: 0.95,
        contextSnippet: truncate(trimmedLine, 200),
        lineNumber,
        entityType: 'location',
        entityId: currentLocationId || '',
        entityName: currentLocationName || 'Unknown',
        action: 'updated',
        payload: { setting: dateText },
        description: `Setting: ${dateText}`,
      });
      continue;
    }

    const captionMatch = trimmedLine.match(/^CAPTION:\s*(\d{4}.+)/i);
    if (captionMatch) {
      const dateText = captionMatch[1].trim();
      newTimelineEvents.push({
        tempId: genId(),
        source: 'deterministic',
        confidence: 0.90,
        contextSnippet: truncate(trimmedLine, 200),
        lineNumber,
        entityType: 'location',
        entityId: currentLocationId || '',
        entityName: currentLocationName || 'Unknown',
        action: 'updated',
        payload: { caption: dateText },
        description: `Caption: ${dateText}`,
      });
      continue;
    }

    // ─── Item detection ─────────────────────────────────────────────────────
    const lowerLine = trimmedLine.toLowerCase();
    for (const verb of ITEM_ACTION_VERBS) {
      if (lowerLine.includes(verb)) {
        // Look for item keywords after the verb
        const afterVerb = lowerLine.slice(lowerLine.indexOf(verb) + verb.length);
        for (const itemKeyword of ITEM_KEYWORDS) {
          if (afterVerb.includes(itemKeyword.toLowerCase())) {
            // Extract noun phrase containing the item keyword
            const itemMatch = afterVerb.match(new RegExp(`(\\w+\\s+)?${itemKeyword.toLowerCase()}(\\s+\\w+)?`, 'i'));
            if (itemMatch) {
              const itemName = itemMatch[0].trim();
              const normalizedItemName = normalizeName(itemName);

              if (!entityIndex.has(normalizedItemName) && !discoveredNames.has(normalizedItemName)) {
                newEntities.push({
                  tempId: genId(),
                  entityType: 'item',
                  name: toTitleCase(itemName),
                  source: 'deterministic',
                  confidence: 0.70,
                  contextSnippet: truncate(trimmedLine, 200),
                  lineNumber,
                  suggestedItemDescription: `Item detected with action: ${verb}`,
                });
                discoveredNames.add(normalizedItemName);
                break; // Only detect one item per verb
              }
            }
          }
        }
      }
    }

    // ─── Collect ambiguous all-caps phrases ────────────────────────────────
    const capsWords = trimmedLine.match(/\b[A-Z][A-Z\s'.,-]{2,}\b/g);
    if (capsWords) {
      for (const phrase of capsWords) {
        const cleanPhrase = phrase.trim();
        if (
          !SCREENPLAY_KEYWORDS.has(cleanPhrase) &&
          !entityIndex.has(normalizeName(cleanPhrase)) &&
          !discoveredNames.has(normalizeName(cleanPhrase)) &&
          cleanPhrase.length >= 3 &&
          cleanPhrase.length <= MAX_CHARACTER_NAME_LENGTH
        ) {
          ambiguousLines.push({ lineNumber, text: trimmedLine });
          break; // Only add line once
        }
      }
    }
  }

  return {
    newEntities,
    updatedEntities,
    newTimelineEvents,
    ambiguousLines,
    discoveredNames,
  };
}

// =============================================================================
// PASS 2 — OPTIONAL LLM FALLBACK
// =============================================================================

/**
 * Pass 2: Optional LLM-based extraction for ambiguous cases.
 */
async function runPass2(
  rawScriptText: string,
  config: ProjectConfig,
  entityIndex: Map<string, { type: 'character' | 'location' | 'item'; id: string; name: string }>,
  pass1DiscoveredNames: Set<string>,
  geminiApiKey: string
): Promise<{
  newEntities: ProposedNewEntity[];
  updatedEntities: ProposedEntityUpdate[];
  newTimelineEvents: ProposedTimelineEvent[];
}> {
  try {
    // Build system prompt
    const existingEntityNames = Array.from(entityIndex.values()).map(e => e.name);
    const pass1Names = Array.from(pass1DiscoveredNames);

    const systemPrompt = `You are Lit-Tracker's narrative extraction engine. Your task is to analyze screenplay/script text and extract entities (characters, locations, items) and timeline events in strict JSON format.

CANON LOCKS (must respect):
${config.canonLocks.map((lock, i) => `${i + 1}. ${lock}`).join('\n') || 'None'}

EXISTING ENTITIES (do not re-create):
${existingEntityNames.join(', ') || 'None'}

PASS 1 DISCOVERIES (do not duplicate):
${pass1Names.join(', ') || 'None'}

OUTPUT SCHEMA:
{
  "newEntities": [
    {
      "name": "string",
      "entityType": "character" | "location" | "item",
      "confidence": 0-1,
      "contextSnippet": "string (max 200 chars)",
      "lineNumber": number (1-indexed),
      "suggestedRole": "Protagonist" | "Antagonist" | "Supporting" | "Minor" (optional, for characters),
      "suggestedDescription": "string" (optional),
      "suggestedRegion": "string" (optional, for locations),
      "suggestedTimeOfDay": "string" (optional, for locations),
      "suggestedHolderId": "string" (optional, for items),
      "suggestedItemDescription": "string" (optional, for items)
    }
  ],
  "updatedEntities": [
    {
      "entityId": "string (must exist in EXISTING ENTITIES)",
      "entityType": "character" | "location" | "item",
      "entityName": "string",
      "confidence": 0-1,
      "contextSnippet": "string (max 200 chars)",
      "lineNumber": number (1-indexed),
      "changeDescription": "string (brief description of change)",
      "updates": { "field": "value" }
    }
  ],
  "newTimelineEvents": [
    {
      "entityType": "character" | "location" | "item",
      "entityId": "string (must exist in EXISTING ENTITIES)",
      "entityName": "string",
      "action": "created" | "moved_to" | "acquired" | "dropped" | "status_changed" | "updated" | "deleted" | "relationship_changed",
      "payload": { "key": "value" },
      "description": "string (human-readable description)",
      "confidence": 0-1,
      "contextSnippet": "string (max 200 chars)",
      "lineNumber": number (1-indexed)
    }
  ]
}

RULES:
- Confidence must be between 0 and 1 (0.5-0.8 recommended for LLM extractions)
- Line numbers are 1-indexed
- Context snippets must be ≤200 characters
- Do not hallucinate - only extract what's clearly present in the text
- Do not duplicate entities already listed as EXISTING or PASS 1 DISCOVERIES
- Timeline events must reference existing entity IDs only
- Return empty arrays if no extractions found

Analyze the script text and return pure JSON (no markdown, no explanation).`;

    // Call Gemini API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    
    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [{ text: rawScriptText }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    const contentText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!contentText) {
      console.warn('No content in Gemini response');
      return { newEntities: [], updatedEntities: [], newTimelineEvents: [] };
    }

    // Parse JSON response
    const llmResponse: LLMExtractionResponse = JSON.parse(contentText);

    // Validate and convert to ProposedNewEntity[], etc.
    const newEntities: ProposedNewEntity[] = (llmResponse.newEntities || []).map(e => ({
      tempId: genId(),
      entityType: e.entityType,
      name: e.name,
      source: 'llm' as const,
      confidence: e.confidence,
      contextSnippet: e.contextSnippet,
      lineNumber: e.lineNumber,
      suggestedRole: e.suggestedRole,
      suggestedDescription: e.suggestedDescription,
      suggestedRegion: e.suggestedRegion,
      suggestedTimeOfDay: e.suggestedTimeOfDay,
      suggestedHolderId: e.suggestedHolderId,
      suggestedItemDescription: e.suggestedItemDescription,
    }));

    const updatedEntities: ProposedEntityUpdate[] = (llmResponse.updatedEntities || []).map(e => ({
      entityId: e.entityId,
      entityType: e.entityType,
      entityName: e.entityName,
      source: 'llm' as const,
      confidence: e.confidence,
      contextSnippet: e.contextSnippet,
      lineNumber: e.lineNumber,
      changeDescription: e.changeDescription,
      updates: e.updates,
    }));

    const newTimelineEvents: ProposedTimelineEvent[] = (llmResponse.newTimelineEvents || []).map(e => ({
      tempId: genId(),
      source: 'llm' as const,
      confidence: e.confidence,
      contextSnippet: e.contextSnippet,
      lineNumber: e.lineNumber,
      entityType: e.entityType,
      entityId: e.entityId,
      entityName: e.entityName,
      action: e.action,
      payload: e.payload,
      description: e.description,
    }));

    // Deduplicate against Pass 1 discoveries
    const filteredNewEntities = newEntities.filter(e => !pass1DiscoveredNames.has(normalizeName(e.name)));

    return {
      newEntities: filteredNewEntities,
      updatedEntities,
      newTimelineEvents,
    };
  } catch (error) {
    console.warn('Pass 2 (LLM) failed:', error);
    return { newEntities: [], updatedEntities: [], newTimelineEvents: [] };
  }
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

export interface ParseOptions {
  rawScriptText: string;
  config: ProjectConfig;
  characters: Character[];
  normalizedLocations: EntityState<LocationEntry>;
  normalizedItems: EntityState<Item>;
  geminiApiKey?: string;
  enableLLM?: boolean;
}

/**
 * Main entry point: Parse script text and return a ParsedProposal.
 */
export async function parseScriptAndProposeUpdates(options: ParseOptions): Promise<ParsedProposal> {
  const startTime = Date.now();
  const { rawScriptText, config, characters, normalizedLocations, normalizedItems, geminiApiKey, enableLLM } = options;

  const warnings: string[] = [];
  const lines = rawScriptText.split('\n');
  const lineCount = lines.length;

  // Build entity index
  const entityIndex = buildEntityIndex(
    characters,
    normalizedLocations,
    normalizedItems,
    config.knownEntityNames
  );

  // Pass 1: Deterministic extraction
  const pass1Result = runPass1(rawScriptText, config, entityIndex, characters);

  // Pass 2: Optional LLM extraction
  let pass2Result = { newEntities: [] as ProposedNewEntity[], updatedEntities: [] as ProposedEntityUpdate[], newTimelineEvents: [] as ProposedTimelineEvent[] };
  let llmWasUsed = false;

  if (enableLLM && geminiApiKey && pass1Result.ambiguousLines.length > 0) {
    try {
      pass2Result = await runPass2(rawScriptText, config, entityIndex, pass1Result.discoveredNames, geminiApiKey);
      llmWasUsed = true;
    } catch (error) {
      warnings.push(`LLM extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Merge results
  const allNewEntities = [...pass1Result.newEntities, ...pass2Result.newEntities];
  const allUpdatedEntities = [...pass1Result.updatedEntities, ...pass2Result.updatedEntities];
  const allNewTimelineEvents = [...pass1Result.newTimelineEvents, ...pass2Result.newTimelineEvents];

  const parseDurationMs = Date.now() - startTime;

  return {
    meta: {
      parsedAt: new Date().toISOString(),
      rawScriptLength: rawScriptText.length,
      lineCount,
      parseDurationMs,
      llmWasUsed,
      warnings,
    },
    newEntities: allNewEntities,
    updatedEntities: allUpdatedEntities,
    newTimelineEvents: allNewTimelineEvents,
  };
}
