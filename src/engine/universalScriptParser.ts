// =============================================================================
// UNIVERSAL SCRIPT PARSER — Two-pass extraction engine
// =============================================================================
// Pass 1: Deterministic pattern matching for high-confidence extractions
// Pass 2: LLM-powered analysis for complex entity relationships and context

import {
  ParsedProposal,
  ProjectConfig,
  ProposedNewEntity,
  ProposedEntityUpdate,
  ProposedTimelineEvent,
  LLMExtractionResponse,
} from '../types/parserTypes';
import { Character, LocationEntry, Item, CharacterRole } from '../types';
import { EntityState } from '../store/entityAdapter';
import { parseScript as parseComicScript, ComicParseResult } from './comicScriptParser';

// ─── Parser Options ─────────────────────────────────────────────────────────

export interface ParseOptions {
  rawScriptText: string;
  config: ProjectConfig;
  characters: Character[];
  normalizedLocations: EntityState<LocationEntry>;
  normalizedItems: EntityState<Item>;
  geminiApiKey?: string;
  enableLLM?: boolean;
}

// ─── UUID Helper ────────────────────────────────────────────────────────────

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

// ─── Constants ──────────────────────────────────────────────────────────────

// Maximum script length sent to LLM (to avoid token limits and costs)
const MAX_LLM_SCRIPT_LENGTH = 8000;

// Common screenplay direction keywords to filter out
const SCREENPLAY_KEYWORDS = new Set([
  'INT', 'EXT', 'CUT', 'FADE', 'DISSOLVE', 'SMASH', 'MATCH', 'CONTINUED',
  'CONT', 'ANGLE', 'CLOSE', 'WIDE', 'PAN', 'ZOOM', 'SFX', 'VO', 'OS', 'OC',
  'POV', 'INSERT', 'SUPER', 'TITLE', 'THE', 'AND', 'BUT', 'FOR', 'NOT',
  'WITH', 'FROM', 'PAGE', 'PANEL', 'SCENE', 'ACT', 'END', 'DAY', 'NIGHT',
  'MORNING', 'EVENING', 'LATER', 'CONTINUOUS', 'INTERCUT', 'FLASHBACK',
  'MONTAGE', 'BEGIN', 'RESUME', 'BACK', 'SAME', 'TIME', 'CAPTION', 'SETTING',
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

const ITEM_ACTION_VERBS = new Set([
  'picks up', 'grabs', 'takes', 'acquires', 'finds', 'discovers',
  'drops', 'leaves', 'puts down', 'discards', 'loses',
  'gives', 'hands', 'passes', 'offers', 'presents',
]);

// Item keywords for detection
const ITEM_KEYWORDS = new Set([
  'SWORD', 'BLADE', 'KNIFE', 'DAGGER', 'AXE', 'HAMMER', 'SPEAR', 'BOW',
  'GUN', 'PISTOL', 'RIFLE', 'WEAPON', 'SHIELD', 'ARMOR', 'RING', 'AMULET',
  'PENDANT', 'NECKLACE', 'CROWN', 'STAFF', 'WAND', 'TOME', 'BOOK', 'SCROLL',
  'MAP', 'KEY', 'ARTIFACT', 'RELIC', 'CRYSTAL', 'GEM', 'STONE', 'ORB',
  'DEVICE', 'GADGET', 'TOOL', 'PHONE', 'LAPTOP', 'TABLET', 'DISK', 'DRIVE',
]);

// Maximum length for character names
const MAX_CHARACTER_NAME_LENGTH = 30;

// Threshold for triggering comic parser fallback (if Pass 1 finds fewer entities)
const MIN_ENTITIES_THRESHOLD = 3;

// Threshold for displaying low results warning
const LOW_RESULTS_THRESHOLD = 2;

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Normalize a name for comparison: lowercase, trim, collapse whitespace
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
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
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract a context snippet around a match position
 */
function extractContext(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(text.length, matchIndex + matchLength + 40);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

// ─── Entity Index Builder ───────────────────────────────────────────────────

interface EntityIndex {
  characters: Map<string, Character>;
  locations: Map<string, LocationEntry>;
  items: Map<string, Item>;
  knownNames: Set<string>;
}

function buildEntityIndex(
  characters: Character[],
  normalizedLocations: EntityState<LocationEntry>,
  normalizedItems: EntityState<Item>,
  config: ProjectConfig
): EntityIndex {
  const index: EntityIndex = {
    characters: new Map(),
    locations: new Map(),
    items: new Map(),
    knownNames: new Set(),
  };

  // Index characters
  for (const char of characters) {
    const normalized = normalizeName(char.name);
    index.characters.set(normalized, char);
    index.knownNames.add(normalized);
  }

  // Index locations
  for (const id of normalizedLocations.ids) {
    const loc = normalizedLocations.entities[id];
    const normalized = normalizeName(loc.name);
    index.locations.set(normalized, loc);
    index.knownNames.add(normalized);
  }

  // Index items
  for (const id of normalizedItems.ids) {
    const item = normalizedItems.entities[id];
    const normalized = normalizeName(item.name);
    index.items.set(normalized, item);
    index.knownNames.add(normalized);
  }

  // Add config known names
  for (const name of config.knownEntityNames) {
    index.knownNames.add(normalizeName(name));
  }

  return index;
}

// ─── Pass 1: Deterministic Extraction ───────────────────────────────────────

interface Pass1Result {
  newEntities: ProposedNewEntity[];
  updatedEntities: ProposedEntityUpdate[];
  timelineEvents: ProposedTimelineEvent[];
  ambiguousPhrases: string[];
  warnings: string[];
}

function runPass1(
  rawScriptText: string,
  config: ProjectConfig,
  entityIndex: EntityIndex
): Pass1Result {
  const result: Pass1Result = {
    newEntities: [],
    updatedEntities: [],
    timelineEvents: [],
    ambiguousPhrases: [],
    warnings: [],
  };

  const lines = rawScriptText.split('\n');
  let currentLocationName: string | null = null;
  let currentLocationId: string | null = null;
  const discoveredNames = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lineNumber = i + 1;

    if (!trimmedLine) continue;

    // ═══ 1. SLUG-LINE DETECTION ═══
    // Pattern: INT. LOCATION - TIME or EXT. LOCATION - TIME
    const slugMatch = trimmedLine.match(/^(INT\.|EXT\.)\s+([^-]+?)(?:\s+-\s+(.+))?$/i);
    if (slugMatch) {
      const locationName = slugMatch[2].trim();
      const timeOfDay = slugMatch[3]?.trim();
      const normalized = normalizeName(locationName);

      currentLocationName = locationName;

      if (entityIndex.locations.has(normalized)) {
        // Existing location
        currentLocationId = entityIndex.locations.get(normalized)!.id;
      } else if (!discoveredNames.has(normalized)) {
        // New location
        discoveredNames.add(normalized);
        result.newEntities.push({
          tempId: generateUUID(),
          entityType: 'location',
          name: toTitleCase(locationName),
          source: 'deterministic',
          confidence: 1.0,
          contextSnippet: trimmedLine.substring(0, 100),
          lineNumber,
          suggestedTimeOfDay: timeOfDay,
        });
      }
      continue;
    }

    // ═══ 2. INTERIOR/EXTERIOR DETECTION ═══
    // Pattern: Panel N Interior/Exterior LOCATION
    const interiorExteriorMatch = trimmedLine.match(/(?:Panel\s+\d+\s+)?(Interior|Exterior)[.\s]+(.+)/i);
    if (interiorExteriorMatch) {
      const locationName = interiorExteriorMatch[2].trim().replace(/\.$/, '');
      const normalized = normalizeName(locationName);

      currentLocationName = locationName;

      if (entityIndex.locations.has(normalized)) {
        currentLocationId = entityIndex.locations.get(normalized)!.id;
      } else if (!discoveredNames.has(normalized)) {
        discoveredNames.add(normalized);
        result.newEntities.push({
          tempId: generateUUID(),
          entityType: 'location',
          name: toTitleCase(locationName),
          source: 'deterministic',
          confidence: 0.9,
          contextSnippet: trimmedLine.substring(0, 100),
          lineNumber,
          suggestedRegion: interiorExteriorMatch[1],
        });
      }
      continue;
    }

    // ═══ 2b. COMIC-STYLE LOCATION WITH YEAR ═══
    // Pattern: LOCATION_NAME - YEAR
    const locationYearMatch = trimmedLine.match(/^([A-Z][A-Z\s'.-]+)\s*-\s*(\d{4})\s*$/);
    if (locationYearMatch) {
      const locationName = locationYearMatch[1].trim();
      const year = locationYearMatch[2].trim();
      const normalized = normalizeName(locationName);

      // Filter screenplay keywords
      if (SCREENPLAY_KEYWORDS.has(locationName)) {
        continue;
      }

      currentLocationName = locationName;

      if (entityIndex.locations.has(normalized)) {
        currentLocationId = entityIndex.locations.get(normalized)!.id;
      } else if (!discoveredNames.has(normalized)) {
        discoveredNames.add(normalized);
        result.newEntities.push({
          tempId: generateUUID(),
          entityType: 'location',
          name: toTitleCase(locationName),
          source: 'deterministic',
          confidence: 0.95,
          contextSnippet: trimmedLine.substring(0, 100),
          lineNumber,
        });
        currentLocationId = null; // Will be set once committed
      }

      // Also create a timeline event for the year
      result.timelineEvents.push({
        tempId: generateUUID(),
        source: 'deterministic',
        confidence: 1.0,
        contextSnippet: trimmedLine,
        lineNumber,
        entityType: 'location',
        entityId: currentLocationId || '',
        entityName: locationName,
        action: 'updated',
        payload: { year },
        description: `${locationName} in year ${year}`,
      });
      continue;
    }

    // ═══ 2c. STANDALONE LOCATION WITH INDICATORS ═══
    // Pattern: Standalone ALL-CAPS line containing location indicator keywords
    const standaloneLocationMatch = trimmedLine.match(/^([A-Z][A-Z\s'.-]+)$/);
    if (standaloneLocationMatch) {
      const locationName = standaloneLocationMatch[1].trim();
      const normalized = normalizeName(locationName);

      // Check if line contains location indicator keywords and isn't a screenplay keyword
      const words = locationName.split(/\s+/);
      const hasLocationIndicator = words.some(word => PLACE_INDICATORS.has(word.replace(/[,.-]/g, '')));

      if (hasLocationIndicator && !SCREENPLAY_KEYWORDS.has(locationName)) {
        currentLocationName = locationName;

        if (entityIndex.locations.has(normalized)) {
          currentLocationId = entityIndex.locations.get(normalized)!.id;
        } else if (!discoveredNames.has(normalized)) {
          discoveredNames.add(normalized);
          result.newEntities.push({
            tempId: generateUUID(),
            entityType: 'location',
            name: toTitleCase(locationName),
            source: 'deterministic',
            confidence: 0.85,
            contextSnippet: trimmedLine.substring(0, 100),
            lineNumber,
          });
        }
        continue;
      }
    }

    // ═══ 3. DIALOGUE SPEAKER DETECTION ═══
    // Pattern: ALL-CAPS name on its own line, possibly followed by indented dialogue
    const speakerMatch = trimmedLine.match(/^([A-Z][A-Z\s'.,-]{2,29})$/);
    if (speakerMatch) {
      const speakerName = speakerMatch[1].trim();
      const normalized = normalizeName(speakerName);

      // Filter screenplay keywords
      if (SCREENPLAY_KEYWORDS.has(speakerName)) {
        continue;
      }

      if (entityIndex.characters.has(normalized)) {
        // Existing character
        const character = entityIndex.characters.get(normalized)!;

        // If we know the current location and character's location differs, propose a moved_to event
        if (currentLocationId && character.currentLocationId !== currentLocationId) {
          result.timelineEvents.push({
            tempId: generateUUID(),
            source: 'deterministic',
            confidence: 0.8,
            contextSnippet: `${speakerName} at ${currentLocationName || 'location'}`,
            lineNumber,
            entityType: 'character',
            entityId: character.id,
            entityName: character.name,
            action: 'moved_to',
            payload: { locationId: currentLocationId, locationName: currentLocationName },
            description: `${character.name} → ${currentLocationName}`,
          });
        }
      } else if (!discoveredNames.has(normalized)) {
        // New character
        discoveredNames.add(normalized);
        result.newEntities.push({
          tempId: generateUUID(),
          entityType: 'character',
          name: toTitleCase(speakerName),
          source: 'deterministic',
          confidence: 0.95,
          contextSnippet: trimmedLine.substring(0, 100),
          lineNumber,
          suggestedRole: 'Supporting',
          suggestedDescription: `Character introduced in dialogue at line ${lineNumber}`,
        });
      }
      continue;
    }

    // ═══ 3b. COMIC-STYLE DIALOGUE DETECTION ═══
    // Pattern: NAME: "dialogue" or NAME: dialogue or NAME (modifier): dialogue
    const comicDialogueMatch = trimmedLine.match(/^([A-Z][A-Z\s'.-]+)(?:\s*\([^)]*\))?\s*:\s*(.+)/);
    if (comicDialogueMatch) {
      const speakerName = comicDialogueMatch[1].trim();
      const normalized = normalizeName(speakerName);

      // Filter screenplay keywords
      if (SCREENPLAY_KEYWORDS.has(speakerName)) {
        continue;
      }

      if (entityIndex.characters.has(normalized)) {
        // Existing character - check for location updates
        const character = entityIndex.characters.get(normalized)!;

        if (currentLocationId && character.currentLocationId !== currentLocationId) {
          result.timelineEvents.push({
            tempId: generateUUID(),
            source: 'deterministic',
            confidence: 0.8,
            contextSnippet: `${speakerName} at ${currentLocationName || 'location'}`,
            lineNumber,
            entityType: 'character',
            entityId: character.id,
            entityName: character.name,
            action: 'moved_to',
            payload: { locationId: currentLocationId, locationName: currentLocationName },
            description: `${character.name} → ${currentLocationName}`,
          });
        }
      } else if (!discoveredNames.has(normalized)) {
        // New character
        discoveredNames.add(normalized);
        result.newEntities.push({
          tempId: generateUUID(),
          entityType: 'character',
          name: toTitleCase(speakerName),
          source: 'deterministic',
          confidence: 0.9,
          contextSnippet: trimmedLine.substring(0, 100),
          lineNumber,
          suggestedRole: 'Supporting',
          suggestedDescription: `Character introduced in comic-style dialogue at line ${lineNumber}`,
        });
      }
      continue;
    }

    // ═══ 3c. INLINE CHARACTER WITH AGE/TRAITS ═══
    // Pattern: NAME (age, traits) at start of line
    const inlineCharMatch = trimmedLine.match(/^([A-Z][A-Z\s'.-]+)\s*\((\d+)(?:,\s*(.+))?\)/);
    if (inlineCharMatch) {
      const speakerName = inlineCharMatch[1].trim();
      const normalized = normalizeName(speakerName);
      const age = inlineCharMatch[2];
      const traits = inlineCharMatch[3];

      // Filter screenplay keywords
      if (SCREENPLAY_KEYWORDS.has(speakerName)) {
        continue;
      }

      if (!entityIndex.characters.has(normalized) && !discoveredNames.has(normalized)) {
        // New character with age/traits
        discoveredNames.add(normalized);
        const description = `Character introduced at line ${lineNumber}${age ? `, age ${age}` : ''}${traits ? `, traits: ${traits}` : ''}`;
        result.newEntities.push({
          tempId: generateUUID(),
          entityType: 'character',
          name: toTitleCase(speakerName),
          source: 'deterministic',
          confidence: 0.95,
          contextSnippet: trimmedLine.substring(0, 100),
          lineNumber,
          suggestedRole: 'Supporting',
          suggestedDescription: description,
        });
      }
      continue;
    }

    // ═══ 4. KNOWN ENTITY SCANNING ═══
    // Scan line for whole-word matches of known entity names
    for (const knownName of entityIndex.knownNames) {
      const escaped = escapeRegex(knownName);
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      const match = regex.exec(trimmedLine.toLowerCase());
      
      if (match) {
        // Entity is mentioned but no specific action needed (just tracking)
        // Could extend this to track "mentions" if desired
      }
    }

    // ═══ 5. CUSTOM PATTERN MATCHING ═══
    for (const customPattern of config.customPatterns) {
      try {
        const regex = new RegExp(customPattern.pattern, 'gi');
        let match: RegExpExecArray | null;
        
        while ((match = regex.exec(trimmedLine)) !== null) {
          const matchedText = match[0];
          const normalized = normalizeName(matchedText);
          
          if (!discoveredNames.has(normalized)) {
            discoveredNames.add(normalized);
            result.newEntities.push({
              tempId: generateUUID(),
              entityType: customPattern.entityType,
              name: toTitleCase(matchedText),
              source: 'deterministic',
              confidence: 0.85,
              contextSnippet: extractContext(trimmedLine, match.index, matchedText.length),
              lineNumber,
            });
          }
        }
      } catch (error) {
        result.warnings.push(`Invalid custom pattern "${customPattern.label}": ${error}`);
      }
    }

    // ═══ 6. SETTING/CAPTION TIMELINE EXTRACTION ═══
    // Pattern: Setting: <date>
    const settingMatch = trimmedLine.match(/^Setting:\s*(.+)/i);
    if (settingMatch) {
      const date = settingMatch[1].trim();
      result.timelineEvents.push({
        tempId: generateUUID(),
        source: 'deterministic',
        confidence: 1.0,
        contextSnippet: trimmedLine,
        lineNumber,
        entityType: 'location',
        entityId: currentLocationId || '',
        entityName: currentLocationName || 'Scene',
        action: 'updated',
        payload: { date },
        description: `Scene set at ${date}`,
      });
      continue;
    }

    // Pattern: CAPTION: <year>...
    const captionMatch = trimmedLine.match(/^CAPTION:\s*(\d{4}.+)/i);
    if (captionMatch) {
      const date = captionMatch[1].trim();
      result.timelineEvents.push({
        tempId: generateUUID(),
        source: 'deterministic',
        confidence: 1.0,
        contextSnippet: trimmedLine,
        lineNumber,
        entityType: 'location',
        entityId: currentLocationId || '',
        entityName: currentLocationName || 'Scene',
        action: 'updated',
        payload: { date },
        description: `Caption: ${date}`,
      });
      continue;
    }

    // ═══ 7. ITEM DETECTION ═══
    // Look for action verbs followed by item keywords
    const lowerLine = trimmedLine.toLowerCase();
    for (const verb of ITEM_ACTION_VERBS) {
      if (lowerLine.includes(verb)) {
        // Scan for item keywords after the verb
        const verbIndex = lowerLine.indexOf(verb);
        const afterVerb = trimmedLine.substring(verbIndex + verb.length);
        
        for (const itemKeyword of ITEM_KEYWORDS) {
          const itemRegex = new RegExp(`\\b(\\w+\\s+)?${itemKeyword}\\b`, 'i');
          const itemMatch = afterVerb.match(itemRegex);
          
          if (itemMatch) {
            const itemName = itemMatch[0].trim();
            const normalized = normalizeName(itemName);
            
            if (!entityIndex.items.has(normalized) && !discoveredNames.has(normalized)) {
              discoveredNames.add(normalized);
              result.newEntities.push({
                tempId: generateUUID(),
                entityType: 'item',
                name: toTitleCase(itemName),
                source: 'deterministic',
                confidence: 0.8,
                contextSnippet: extractContext(trimmedLine, verbIndex, verb.length + itemName.length),
                lineNumber,
                suggestedItemDescription: `Item detected in action: ${verb}`,
              });
            }
            break;
          }
        }
      }
    }

    // ═══ 8. AMBIGUOUS ALL-CAPS PHRASES ═══
    // Collect unmatched all-caps phrases for Pass 2
    const capsWords = trimmedLine.match(/\b[A-Z][A-Z\s'.,-]{2,}\b/g);
    if (capsWords) {
      for (const phrase of capsWords) {
        const cleanPhrase = phrase.trim();
        const normalized = normalizeName(cleanPhrase);
        
        if (
          !SCREENPLAY_KEYWORDS.has(cleanPhrase) &&
          !discoveredNames.has(normalized) &&
          !entityIndex.knownNames.has(normalized) &&
          cleanPhrase.length >= 3 &&
          cleanPhrase.length <= MAX_CHARACTER_NAME_LENGTH
        ) {
          result.ambiguousPhrases.push(cleanPhrase);
        }
      }
    }
  }

  return result;
}

// ─── Pass 2: Optional LLM Fallback ──────────────────────────────────────────

async function runPass2(
  rawScriptText: string,
  pass1Result: Pass1Result,
  config: ProjectConfig,
  entityIndex: EntityIndex,
  geminiApiKey: string
): Promise<{ newEntities: ProposedNewEntity[]; timelineEvents: ProposedTimelineEvent[]; warnings: string[] }> {
  const warnings: string[] = [];

  // Build system prompt
  const systemPrompt = `You are Lit-Tracker's narrative extraction engine. Your job is to analyze a screenplay/comic script and extract entities (characters, locations, items) and timeline events that were not caught by deterministic rules.

CANON LOCKS (DO NOT modify these):
${config.canonLocks.map(name => `- ${name}`).join('\n') || '(none)'}

EXISTING ENTITIES (DO NOT re-create these):
Characters: ${Array.from(entityIndex.characters.keys()).join(', ') || '(none)'}
Locations: ${Array.from(entityIndex.locations.keys()).join(', ') || '(none)'}
Items: ${Array.from(entityIndex.items.keys()).join(', ') || '(none)'}

ALREADY DISCOVERED IN PASS 1 (DO NOT duplicate):
${pass1Result.newEntities.map(e => `- ${e.entityType}: ${e.name}`).join('\n') || '(none)'}

AMBIGUOUS PHRASES TO ANALYZE:
${pass1Result.ambiguousPhrases.slice(0, 20).join(', ') || '(none)'}

TASK:
Analyze the script below and extract:
1. New entities (characters, locations, items) not already discovered
2. Timeline events that represent significant narrative moments

RESPONSE FORMAT (strict JSON):
{
  "newEntities": [
    {
      "name": "Entity Name",
      "type": "character" | "location" | "item",
      "confidence": 0.0-1.0,
      "context": "snippet of text",
      "lineNumber": 123,
      "suggestedRole": "Protagonist" | "Antagonist" | "Supporting" | "Minor" (for characters),
      "suggestedDescription": "brief description",
      "suggestedRegion": "region name" (for locations),
      "suggestedTimeOfDay": "day/night/etc" (for locations),
      "suggestedHolderId": "character id" (for items),
      "suggestedItemDescription": "description" (for items)
    }
  ],
  "entityUpdates": [],
  "timelineEvents": []
}

SCRIPT TO ANALYZE:
${rawScriptText.substring(0, MAX_LLM_SCRIPT_LENGTH)}`;

  // Warn if script was truncated
  if (rawScriptText.length > MAX_LLM_SCRIPT_LENGTH) {
    warnings.push(`Script truncated to ${MAX_LLM_SCRIPT_LENGTH} characters for LLM analysis (original: ${rawScriptText.length})`);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      warnings.push(`LLM API error: ${response.status} ${errorText}`);
      return { newEntities: [], timelineEvents: [], warnings };
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      warnings.push('LLM returned no content');
      return { newEntities: [], timelineEvents: [], warnings };
    }

    // Parse LLM response
    const llmResponse: LLMExtractionResponse = JSON.parse(textContent);

    // Convert to proposals
    const newEntities: ProposedNewEntity[] = llmResponse.newEntities.map(e => ({
      tempId: generateUUID(),
      entityType: e.type,
      name: e.name,
      source: 'llm' as const,
      confidence: e.confidence,
      contextSnippet: e.context,
      lineNumber: e.lineNumber,
      suggestedRole: e.suggestedRole,
      suggestedDescription: e.suggestedDescription,
      suggestedRegion: e.suggestedRegion,
      suggestedTimeOfDay: e.suggestedTimeOfDay,
      suggestedHolderId: e.suggestedHolderId,
      suggestedItemDescription: e.suggestedItemDescription,
    }));

    const timelineEvents: ProposedTimelineEvent[] = llmResponse.timelineEvents.map(e => ({
      tempId: generateUUID(),
      source: 'llm' as const,
      confidence: e.confidence,
      contextSnippet: e.context,
      lineNumber: e.lineNumber,
      entityType: e.entityType,
      entityId: e.entityId,
      entityName: e.entityName,
      action: e.action,
      payload: e.payload,
      description: e.description,
    }));

    return { newEntities, timelineEvents, warnings };
  } catch (error) {
    warnings.push(`LLM Pass 2 failed: ${error}`);
    return { newEntities: [], timelineEvents: [], warnings };
  }
}

// ─── Comic Parser Integration ──────────────────────────────────────────────

/**
 * Convert comic parser results to proposal objects.
 * Filters out entities that already exist in the entity index.
 */
function convertComicParserResults(
  comicResult: ComicParseResult,
  entityIndex: EntityIndex
): { newEntities: ProposedNewEntity[]; timelineEvents: ProposedTimelineEvent[] } {
  const newEntities: ProposedNewEntity[] = [];
  const timelineEvents: ProposedTimelineEvent[] = [];

  // Convert characters
  for (const char of comicResult.characters) {
    const normalized = normalizeName(char.name);
    if (!entityIndex.characters.has(normalized)) {
      const description = `Comic character${char.age ? `, age ${char.age}` : ''}${char.traits.length > 0 ? `, traits: ${char.traits.join(', ')}` : ''}`;
      newEntities.push({
        tempId: generateUUID(),
        entityType: 'character',
        name: toTitleCase(char.name),
        source: 'deterministic',
        confidence: 0.9,
        contextSnippet: `Character from comic parser (line ${char.firstMention})`,
        lineNumber: char.firstMention,
        suggestedRole: 'Supporting',
        suggestedDescription: description,
      });
    }
  }

  // Convert locations
  for (const loc of comicResult.locations) {
    const normalized = normalizeName(loc.name);
    if (!entityIndex.locations.has(normalized)) {
      newEntities.push({
        tempId: generateUUID(),
        entityType: 'location',
        name: toTitleCase(loc.name),
        source: 'deterministic',
        confidence: 0.9,
        contextSnippet: `Location from comic parser (line ${loc.firstMention})`,
        lineNumber: loc.firstMention,
      });
    }

    // Create timeline event if year is present
    if (loc.year) {
      timelineEvents.push({
        tempId: generateUUID(),
        source: 'deterministic',
        confidence: 1.0,
        contextSnippet: `${loc.name} - ${loc.year}`,
        lineNumber: loc.firstMention,
        entityType: 'location',
        entityId: '',
        entityName: loc.name,
        action: 'updated',
        payload: { year: loc.year },
        description: `${loc.name} in year ${loc.year}`,
      });
    }
  }

  // Convert echoes (items)
  for (const echo of comicResult.echoes) {
    const normalized = normalizeName(echo.name);
    if (!entityIndex.items.has(normalized)) {
      newEntities.push({
        tempId: generateUUID(),
        entityType: 'item',
        name: toTitleCase(echo.name),
        source: 'deterministic',
        confidence: 0.85,
        contextSnippet: `Item from comic parser (line ${echo.firstMention})`,
        lineNumber: echo.firstMention,
        suggestedItemDescription: `Item detected in comic script`,
      });
    }
  }

  // Convert timeline entries
  for (const entry of comicResult.timeline) {
    timelineEvents.push({
      tempId: generateUUID(),
      source: 'deterministic',
      confidence: 1.0,
      contextSnippet: entry.context,
      lineNumber: 0, // Comic parser doesn't track individual line numbers for timeline
      entityType: 'location',
      entityId: '',
      entityName: 'Scene',
      action: 'updated',
      payload: { year: entry.year },
      description: `Timeline: ${entry.year}`,
    });
  }

  return { newEntities, timelineEvents };
}

// ─── Main Export ────────────────────────────────────────────────────────────

export interface ParseScriptOptions {
  rawScriptText: string;
  config: ProjectConfig;
  characters: Character[];
  normalizedLocations: EntityState<LocationEntry>;
  normalizedItems: EntityState<Item>;
  geminiApiKey?: string;
  enableLLM?: boolean;
}

/**
 * Parse script text and propose entity/timeline updates.
 * Returns a complete proposal object ready for review.
 */
export async function parseScriptAndProposeUpdates(
  options: ParseScriptOptions
): Promise<ParsedProposal> {
  const startTime = Date.now();

  const entityIndex = buildEntityIndex(
    options.characters,
    options.normalizedLocations,
    options.normalizedItems,
    options.config
  );

  // Run Pass 1 (deterministic)
  const pass1Result = runPass1(options.rawScriptText, options.config, entityIndex);

  let llmWasUsed = false;
  const allWarnings = [...pass1Result.warnings];

  // ═══ COMIC PARSER INTEGRATION (Supplementary Pass) ═══
  // Detect if script contains comic format (PANEL indicators) or if Pass 1 found very few results
  const hasPanelFormat = /^Panel\s+\d+/im.test(options.rawScriptText);
  const pass1FoundFew = pass1Result.newEntities.length < MIN_ENTITIES_THRESHOLD;
  
  if (hasPanelFormat || pass1FoundFew) {
    try {
      console.log('[universalParser] Running comic parser as supplementary pass...');
      const comicResult = parseComicScript(options.rawScriptText, 'comic');
      const comicProposals = convertComicParserResults(comicResult, entityIndex);

      // Deduplicate against Pass 1 results by normalized name
      const existingNames = new Set(
        pass1Result.newEntities.map(e => normalizeName(e.name))
      );

      for (const entity of comicProposals.newEntities) {
        const normalized = normalizeName(entity.name);
        if (!existingNames.has(normalized)) {
          pass1Result.newEntities.push(entity);
          existingNames.add(normalized);
        }
      }

      // Add timeline events (these are typically unique)
      pass1Result.timelineEvents.push(...comicProposals.timelineEvents);

      console.log(`[universalParser] Comic parser added ${comicProposals.newEntities.length} entities, ${comicProposals.timelineEvents.length} timeline events`);
    } catch (error) {
      allWarnings.push(`Comic parser supplementary pass failed: ${error}`);
    }
  }

  // Run Pass 2 (optional LLM)
  if (options.enableLLM && options.geminiApiKey) {
    llmWasUsed = true;
    const pass2Result = await runPass2(
      options.rawScriptText,
      pass1Result,
      options.config,
      entityIndex,
      options.geminiApiKey
    );

    // Merge Pass 2 results (deduplicate by name)
    const existingNames = new Set(
      pass1Result.newEntities.map(e => normalizeName(e.name))
    );

    for (const entity of pass2Result.newEntities) {
      const normalized = normalizeName(entity.name);
      if (!existingNames.has(normalized)) {
        pass1Result.newEntities.push(entity);
        existingNames.add(normalized);
      }
    }

    pass1Result.timelineEvents.push(...pass2Result.timelineEvents);
    allWarnings.push(...pass2Result.warnings);
  }

  // ═══ EMPTY RESULTS FEEDBACK ═══
  const totalResults = pass1Result.newEntities.length + pass1Result.updatedEntities.length + pass1Result.timelineEvents.length;
  
  if (totalResults === 0) {
    allWarnings.push(
      'No entities or timeline events were detected. Make sure your script uses recognizable formatting: ' +
      'character names in ALL-CAPS (e.g., ELIAS or ELIAS: "dialogue"), ' +
      'locations with INT./EXT. prefixes or PANEL format, ' +
      'and item interactions with action verbs.'
    );
  } else if (totalResults <= LOW_RESULTS_THRESHOLD && !llmWasUsed) {
    allWarnings.push(
      `Only ${totalResults} item(s) detected. Consider checking your script formatting or enabling AI-assisted extraction (Pass 2) for better results.`
    );
  }

  const endTime = Date.now();
  const lines = options.rawScriptText.split('\n');

  return {
    meta: {
      parsedAt: new Date().toISOString(),
      rawScriptLength: options.rawScriptText.length,
      lineCount: lines.length,
      parseDurationMs: endTime - startTime,
      llmWasUsed,
      warnings: allWarnings,
    },
    newEntities: pass1Result.newEntities,
    updatedEntities: pass1Result.updatedEntities,
    newTimelineEvents: pass1Result.timelineEvents,
  };
}
