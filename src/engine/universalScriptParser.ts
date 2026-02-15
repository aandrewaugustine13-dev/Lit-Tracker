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
import { ParsedScript, LoreCandidate } from '../utils/scriptParser';

// ─── Parser Options ─────────────────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'gemini' | 'openai' | 'grok' | 'deepseek';

export interface ParseScriptOptions {
  rawScriptText: string;
  formattedScriptText?: string;
  config: ProjectConfig;
  characters: Character[];
  normalizedLocations: EntityState<LocationEntry>;
  normalizedItems: EntityState<Item>;
  llmApiKey?: string;
  llmProvider?: LLMProvider;
  /** @deprecated Use llmApiKey instead */
  geminiApiKey?: string;
  enableLLM?: boolean;
  externalLoreCandidates?: LoreCandidate[];
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
const MAX_LLM_SCRIPT_LENGTH = 100000;

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

// ─── Pass 2: LLM Helpers ────────────────────────────────────────────────────

/**
 * Strips markdown fences and extracts JSON from LLM responses
 */
function stripMarkdownAndExtractJSON(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
  cleaned = cleaned.replace(/\n?```\s*$/, '');
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) {
    cleaned = cleaned.substring(firstBrace);
  }
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastBrace + 1);
  }
  return cleaned;
}

async function callClaudeAPI(
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16384,
      messages: [{ role: 'user', content: systemPrompt }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Claude returned no content');

  return stripMarkdownAndExtractJSON(text);
}

async function callGeminiAPI(
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
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
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return text;
}

async function callOpenAIAPI(
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert story analyst. Return only valid JSON.' },
        { role: 'user', content: systemPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned no content');
  
  // Apply markdown stripping for consistency, even though json_object format should return clean JSON
  return stripMarkdownAndExtractJSON(text);
}

async function callGrokAPI(
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-beta',
      messages: [
        { role: 'system', content: 'You are an expert story analyst. Return only valid JSON.' },
        { role: 'user', content: systemPrompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Grok returned no content');
  
  return stripMarkdownAndExtractJSON(text);
}

async function callDeepSeekAPI(
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are an expert story analyst. Return only valid JSON.' },
        { role: 'user', content: systemPrompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('DeepSeek returned no content');
  
  return stripMarkdownAndExtractJSON(text);
}

async function runPass2(
  rawScriptText: string,
  pass1Result: Pass1Result,
  config: ProjectConfig,
  entityIndex: EntityIndex,
  apiKey: string,
  provider: LLMProvider = 'anthropic'
): Promise<{ newEntities: ProposedNewEntity[]; timelineEvents: ProposedTimelineEvent[]; warnings: string[] }> {
  const warnings: string[] = [];

  // Build system prompt for comprehension-first extraction
  const systemPrompt = `You are an editor and English teacher analyzing a story for Lit-Tracker. Your approach is to READ and COMPREHEND the story first, then extract world-building elements from your understanding.

⚠️ **CRITICAL REQUIREMENT**: You MUST extract entities from MULTIPLE types — not just locations. Every script contains characters, factions, events, concepts, artifacts, and more. Returning only locations is unacceptable and indicates incomplete analysis.

📊 **EXPECTED YIELD**: A typical script page will yield:
- 2-5 locations (settings, places)
- 1-3 characters (named people/beings)
- 1-2 factions/organizations (any groups mentioned)
- 1-3 events (battles, discoveries, deaths, meetings, past events)
- 1-2 concepts (powers, abilities, magic systems, phenomena)
- 0-2 artifacts (named weapons, tools, relics, important objects)
- 0-2 rules (world mechanics, constraints, established laws)
- 0-2 items (generic objects characters interact with)

PHASE 1: COMPREHENSION (Read and Understand First)
Before extracting any data, read this script naturally as an editor would:
- **Understand the plot**: What's happening? What's the conflict and stakes?
- **Understand the characters**: Who are they? What motivates them? How do they relate to each other? (Don't just look for ALL-CAPS names)
- **Understand the settings**: Where does the story take place? What's the atmosphere and significance of each location? (Don't just look for INT./EXT. markers)
- **Understand the themes**: What are the underlying themes, subtext, and emotional core?
- **Understand narrative importance**: Which objects, events, and concepts matter to the story's progression?

PHASE 2: EXTRACTION (Extract from Understanding)
Based on your comprehension, extract world-building elements with RICH descriptions that reflect your understanding:

ENTITY TYPES YOU CAN EXTRACT:
- "character": Named people/beings - describe their motivations, relationships, and role in the narrative
- "location": Named places - describe atmosphere, emotional tone, and narrative significance
- "faction": Organizations/groups - describe ideology, influence, and role in the conflict
- "event": Significant moments - describe impact, participants, consequences, and thematic weight
- "concept": Abstract ideas/powers - describe how they work, why they matter, and thematic implications
- "artifact": Named significant objects - describe origin, properties, symbolic meaning, and importance
- "rule": World rules/constraints - describe how they shape the story, exceptions, and implications
- "item": Generic objects - describe usage and narrative relevance

CANON LOCKS (DO NOT modify these):
${config.canonLocks.map(name => `- ${name}`).join('\n') || '(none)'}

EXISTING ENTITIES (DO NOT re-create):
Characters: ${Array.from(entityIndex.characters.keys()).join(', ') || '(none)'}
Locations: ${Array.from(entityIndex.locations.keys()).join(', ') || '(none)'}
Items: ${Array.from(entityIndex.items.keys()).join(', ') || '(none)'}

ALREADY DISCOVERED IN PASS 1 (DO NOT duplicate):
${pass1Result.newEntities.map(e => `- ${e.entityType}: ${e.name}`).join('\n') || '(none)'}

FORMAT-AGNOSTIC: This script may be in any format (prose, screenplay, comic script, natural writing). Read it naturally and identify entities based on narrative understanding, not formatting patterns.

EXTRACTION QUALITY: Because you understand the story, provide rich descriptions that include context, relationships, motivations, and narrative significance. Go beyond surface-level data extraction.

🚫 **COMMON MISTAKES TO AVOID**:
- ❌ **DO NOT extract only locations** - This is the most common failure. Every script has more than just places.
- ❌ **DO NOT skip events** just because they're implied - References to past battles, meetings, deaths are events
- ❌ **DO NOT miss factions** - If a character mentions "the team," "the agency," "the order," "the guild," "the crew," that's a faction
- ❌ **DO NOT miss concepts** - If a character uses a power, ability, or technique, that's a concept
- ❌ **DO NOT miss artifacts** - If a character wields a named weapon, tool, or important object, that's an artifact
- ❌ **DO NOT ignore dialogue** - Organizations, events, and artifacts are often mentioned in conversation

✅ **MANDATORY SELF-CHECK BEFORE RESPONDING**:
Before finalizing your JSON, you MUST verify this checklist. If you answer "NO" to any, go back and extract more:

□ **Did I extract at least 2 locations?** (settings, places)
□ **Did I extract characters?** (named people/beings not already in existing entities)
□ **Did I extract factions/organizations?** (any group, team, agency, order, guild, crew, council, etc.)
□ **Did I extract events?** (battles, discoveries, deaths, meetings, rituals - anything that happened)
□ **Did I extract concepts?** (powers, abilities, magic systems, phenomena, philosophies)
□ **Did I extract artifacts?** (named weapons, tools, relics, documents, significant objects)
□ **Did I check rules?** (world mechanics, constraints, laws, pacts)
□ **Did I check items?** (generic objects characters interact with)

If your newEntities array has ONLY locations, you have FAILED. Go back and look for other entity types.

**Critical reminder**: Most scripts contain entities across AT LEAST 4-6 different types. If you're returning fewer than 3 types, you're not analyzing thoroughly enough.

RESPONSE FORMAT (strict JSON, no markdown fences):
{
  "newEntities": [
    {
      "name": "Entity Name",
      "type": "character" | "location" | "faction" | "event" | "concept" | "artifact" | "rule" | "item",
      "confidence": 0.0-1.0,
      "context": "brief quote or context where this appears",
      "lineNumber": 0,
      "suggestedDescription": "Rich 2-3 sentence description including motivations/significance/relationships/atmosphere based on your comprehension",
      "suggestedRole": "Protagonist|Antagonist|Supporting|Minor (characters only)",
      "suggestedRegion": "region (locations only)",
      "suggestedTags": ["tag1", "tag2"]
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
    let textContent: string;
    
    switch (provider) {
      case 'gemini':
        textContent = await callGeminiAPI(systemPrompt, apiKey);
        break;
      case 'anthropic':
        textContent = await callClaudeAPI(systemPrompt, apiKey);
        break;
      case 'openai':
        textContent = await callOpenAIAPI(systemPrompt, apiKey);
        break;
      case 'grok':
        textContent = await callGrokAPI(systemPrompt, apiKey);
        break;
      case 'deepseek':
        textContent = await callDeepSeekAPI(systemPrompt, apiKey);
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    // Parse LLM response
    let llmResponse: LLMExtractionResponse;
    try {
      llmResponse = JSON.parse(textContent);
    } catch (jsonError) {
      console.error('[Pass2] JSON parse failed. Raw response (first 500 chars):', textContent.substring(0, 500));
      console.error('[Pass2] JSON parse error:', jsonError);
      warnings.push(`LLM returned invalid JSON. First 200 chars: ${textContent.substring(0, 200)}`);
      return { newEntities: [], timelineEvents: [], warnings };
    }

    // Convert to proposals (null-safe)
    const newEntities: ProposedNewEntity[] = (llmResponse.newEntities || []).map(e => ({
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
      suggestedTags: e.suggestedTags,
      suggestedIdeology: e.suggestedIdeology,
      suggestedLeader: e.suggestedLeader,
      suggestedDate: e.suggestedDate,
      suggestedOrigin: e.suggestedOrigin,
    }));

    // Log what the LLM found by type
    const typeCounts: Record<string, number> = {};
    newEntities.forEach(e => { typeCounts[e.entityType] = (typeCounts[e.entityType] || 0) + 1; });
    console.log('[Pass2] LLM extracted entities by type:', typeCounts);
    console.log('[Pass2] Entity names:', newEntities.map(e => `${e.entityType}:${e.name}`).join(', '));

    const timelineEvents: ProposedTimelineEvent[] = (llmResponse.timelineEvents || []).map(e => ({
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
    console.error('[Pass2] LLM extraction failed:', error);
    warnings.push(`LLM Pass 2 failed: ${error instanceof Error ? error.message : String(error)}`);
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

// ─── LLM Formatting Integration Helpers ─────────────────────────────────────

/**
 * Convert LoreCandidate objects from parseScriptWithLLM into ProposedNewEntity objects.
 * Maps lore candidate categories to entity types and creates timeline events for 'timeline' category.
 */
export function convertLoreCandidatesToProposedEntities(
  loreCandidates: LoreCandidate[],
  scriptText: string
): { newEntities: ProposedNewEntity[]; timelineEvents: ProposedTimelineEvent[] } {
  const newEntities: ProposedNewEntity[] = [];
  const timelineEvents: ProposedTimelineEvent[] = [];

  for (const lore of loreCandidates) {
    // Skip timeline category - will handle separately
    if (lore.category === 'timeline') {
      // Create a timeline event for temporal markers
      timelineEvents.push({
        tempId: generateUUID(),
        source: 'llm',
        confidence: lore.confidence,
        contextSnippet: lore.text,
        lineNumber: 0, // LLM doesn't provide line numbers
        entityType: 'character', // Default to character for timeline events
        entityId: '',
        entityName: 'Timeline',
        action: 'created',
        payload: { year: lore.text },
        description: `Timeline marker: ${lore.text}`,
      });
      continue;
    }

    // Map lore category to entity type
    let entityType: ProposedNewEntity['entityType'];
    switch (lore.category) {
      case 'location':
        entityType = 'location';
        break;
      case 'faction':
        entityType = 'faction';
        break;
      case 'event':
        entityType = 'event';
        break;
      case 'concept':
        entityType = 'concept';
        break;
      case 'artifact':
        entityType = 'artifact';
        break;
      case 'rule':
        entityType = 'rule';
        break;
      case 'item':
        entityType = 'item';
        break;
      case 'character':
        entityType = 'character';
        break;
      case 'echo':
        // Classify echo as artifact or item based on confidence
        entityType = lore.confidence > 0.7 ? 'artifact' : 'item';
        break;
      case 'uncategorized':
      default:
        // Best guess fallback
        entityType = 'concept';
        break;
    }

    // Build the proposed entity
    const proposedEntity: ProposedNewEntity = {
      tempId: generateUUID(),
      entityType,
      name: lore.text,
      source: 'llm',
      confidence: lore.confidence,
      contextSnippet: lore.description || lore.text,
      lineNumber: 0, // LLM doesn't provide line numbers from lore_candidates
      suggestedDescription: lore.description,
    };

    // Add metadata fields based on entity type
    if (lore.metadata) {
      if (entityType === 'location') {
        proposedEntity.suggestedRegion = lore.metadata.region;
        proposedEntity.suggestedTimeOfDay = lore.metadata.timeOfDay;
      } else if (entityType === 'faction') {
        proposedEntity.suggestedIdeology = lore.metadata.ideology;
        proposedEntity.suggestedLeader = lore.metadata.leader;
      } else if (entityType === 'event') {
        proposedEntity.suggestedDate = lore.metadata.date;
      } else if (entityType === 'concept' || entityType === 'artifact') {
        proposedEntity.suggestedOrigin = lore.metadata.origin;
      }
      
      // Add tags if present
      if (lore.metadata.tags && Array.isArray(lore.metadata.tags)) {
        proposedEntity.suggestedTags = lore.metadata.tags;
      }
    }

    newEntities.push(proposedEntity);
  }

  return { newEntities, timelineEvents };
}

/**
 * Reconstruct a clean, formatted script text from ParsedScript structure.
 * Uses standard formatting that the deterministic parser can easily recognize:
 * - PAGE N headers
 * - Panel N: description
 * - CHARACTER: "dialogue"
 * - INT./EXT. LOCATION format where appropriate
 */
export function reconstructFormattedScript(parsedScript: ParsedScript): string {
  const lines: string[] = [];

  for (const page of parsedScript.pages) {
    // Add page header (use page_number if available, otherwise use index)
    const pageNum = page.page_number || parsedScript.pages.indexOf(page) + 1;
    lines.push(`PAGE ${pageNum}`);
    lines.push('');

    for (const panel of page.panels) {
      // Add panel header with description (use panel_number if available, otherwise use index)
      const panelNum = panel.panel_number || page.panels.indexOf(panel) + 1;
      lines.push(`Panel ${panelNum}: ${panel.description}`);
      lines.push('');

      // Add dialogue
      for (const dialogue of panel.dialogue) {
        if (dialogue.type === 'thought') {
          lines.push(`${dialogue.character} (thinking)`);
          lines.push(`"${dialogue.text}"`);
        } else if (dialogue.type === 'caption') {
          lines.push(`CAPTION: ${dialogue.text}`);
        } else if (dialogue.type === 'sfx') {
          lines.push(`SFX: ${dialogue.text}`);
        } else {
          // spoken dialogue
          lines.push(`${dialogue.character}`);
          lines.push(`"${dialogue.text}"`);
        }
        lines.push('');
      }
    }

    lines.push(''); // Extra line between pages
  }

  return lines.join('\n');
}

// ─── Main Export ────────────────────────────────────────────────────────────

export interface ParseScriptOptions {
  rawScriptText: string;
  config: ProjectConfig;
  characters: Character[];
  normalizedLocations: EntityState<LocationEntry>;
  normalizedItems: EntityState<Item>;
  llmApiKey?: string;
  llmProvider?: LLMProvider;
  /** @deprecated Use llmApiKey instead */
  geminiApiKey?: string;
  enableLLM?: boolean;
  /** Optional pre-formatted script text (if AI formatting was already done) */
  formattedScriptText?: string;
  /** Optional external lore candidates to merge into the proposal */
  externalLoreCandidates?: LoreCandidate[];
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
  // Use formatted script text if provided, otherwise use raw text
  const scriptTextForPass1 = options.formattedScriptText || options.rawScriptText;
  const pass1Result = runPass1(scriptTextForPass1, options.config, entityIndex);

  let llmWasUsed = false;
  const allWarnings = [...pass1Result.warnings];

  // ═══ EXTERNAL LORE CANDIDATES INTEGRATION ═══
  // If external lore candidates were provided (from parseScriptWithLLM), merge them
  if (options.externalLoreCandidates && options.externalLoreCandidates.length > 0) {
    console.log(`[universalParser] Merging ${options.externalLoreCandidates.length} external lore candidates from AI formatting...`);
    const loreCandidateResult = convertLoreCandidatesToProposedEntities(
      options.externalLoreCandidates,
      options.rawScriptText
    );

    // Deduplicate against Pass 1 results by normalized name
    const existingNames = new Set(
      pass1Result.newEntities.map(e => normalizeName(e.name))
    );

    for (const entity of loreCandidateResult.newEntities) {
      const normalized = normalizeName(entity.name);
      if (!existingNames.has(normalized)) {
        pass1Result.newEntities.push(entity);
        existingNames.add(normalized);
      }
    }

    // Add timeline events
    pass1Result.timelineEvents.push(...loreCandidateResult.timelineEvents);
    
    // Mark that LLM was used (via formatting step)
    llmWasUsed = true;
  }

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
  // Resolve effective API key and provider (backwards compat)
  const effectiveApiKey = options.llmApiKey || options.geminiApiKey;
  const effectiveProvider: LLMProvider = options.llmProvider || (options.geminiApiKey ? 'gemini' : 'anthropic');

  // When LLM is enabled, make it the PRIMARY parser with deterministic as supplement
  // Initialize with Pass 1 results (used when LLM is disabled)
  let finalEntities = pass1Result.newEntities;
  let finalTimelineEvents = pass1Result.timelineEvents;

  if (options.enableLLM && effectiveApiKey) {
    llmWasUsed = true;
    const pass2Result = await runPass2(
      options.rawScriptText,
      pass1Result,
      options.config,
      entityIndex,
      effectiveApiKey,
      effectiveProvider
    );

    // ═══ AI-PRIMARY MERGE LOGIC ═══
    // When LLM is enabled, prioritize AI-sourced entities (richer descriptions from comprehension)
    // Pass 1 acts as supplementary validation to catch anything AI might have missed
    
    // Start with Pass 2 (AI) entities - these have richer descriptions
    finalEntities = [...pass2Result.newEntities];
    const llmNames = new Set(pass2Result.newEntities.map(e => normalizeName(e.name)));

    // Add Pass 1 entities that AI didn't find (supplementary)
    let supplementaryCount = 0;
    for (const entity of pass1Result.newEntities) {
      const normalized = normalizeName(entity.name);
      if (!llmNames.has(normalized)) {
        finalEntities.push(entity);
        supplementaryCount++;
      }
    }

    // Merge timeline events (both sources)
    finalTimelineEvents = [...pass2Result.timelineEvents, ...pass1Result.timelineEvents];
    allWarnings.push(...pass2Result.warnings);

    console.log(`[universalParser] AI-primary merge: ${pass2Result.newEntities.length} AI entities + ${supplementaryCount} supplementary deterministic entities`);
  }

  // ═══ EMPTY RESULTS FEEDBACK ═══
  const totalResults = finalEntities.length + pass1Result.updatedEntities.length + finalTimelineEvents.length;
  
  if (totalResults === 0) {
    if (llmWasUsed) {
      allWarnings.push(
        'No entities or timeline events were detected. The AI may need more context - try providing a longer script excerpt or enabling more detailed world-building in your story.'
      );
    } else {
      allWarnings.push(
        'No entities or timeline events were detected. Consider enabling AI-assisted extraction for better results with any script format, or ensure your script uses recognizable formatting: ' +
        'character names in ALL-CAPS (e.g., ELIAS or ELIAS: "dialogue"), ' +
        'locations with INT./EXT. prefixes or PANEL format, ' +
        'and item interactions with action verbs.'
      );
    }
  } else if (totalResults <= LOW_RESULTS_THRESHOLD && !llmWasUsed) {
    allWarnings.push(
      `Only ${totalResults} item(s) detected. Consider enabling AI-assisted extraction (which works with any script format) for better results.`
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
    newEntities: finalEntities,
    updatedEntities: pass1Result.updatedEntities,
    newTimelineEvents: finalTimelineEvents,
  };
}
