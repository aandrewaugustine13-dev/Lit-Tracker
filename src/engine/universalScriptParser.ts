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

// ─── Constants from crossSlice ──────────────────────────────────────────────

const SCREENPLAY_KEYWORDS = new Set([
  'INT', 'EXT', 'CUT', 'FADE', 'DISSOLVE', 'SMASH', 'MATCH', 'CONTINUED',
  'CONT', 'ANGLE', 'CLOSE', 'WIDE', 'PAN', 'ZOOM', 'SFX', 'VO', 'OS', 'OC',
  'POV', 'INSERT', 'SUPER', 'TITLE', 'THE', 'AND', 'BUT', 'FOR', 'NOT',
  'WITH', 'FROM', 'PAGE', 'PANEL', 'SCENE', 'ACT', 'END', 'DAY', 'NIGHT',
  'MORNING', 'EVENING', 'LATER', 'CONTINUOUS', 'INTERCUT', 'FLASHBACK',
  'MONTAGE', 'BEGIN', 'RESUME', 'BACK', 'SAME', 'TIME',
]);

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

// ─── Helper Functions ───────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getContextSnippet(text: string, index: number, length: number = 60): string {
  const start = Math.max(0, index - length);
  const end = Math.min(text.length, index + length);
  const snippet = text.slice(start, end);
  return (start > 0 ? '...' : '') + snippet + (end < text.length ? '...' : '');
}

function getLineNumber(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

// ─── Pass 1: Deterministic Extraction ───────────────────────────────────────

interface Pass1Result {
  newEntities: ProposedNewEntity[];
  updatedEntities: ProposedEntityUpdate[];
  newTimelineEvents: ProposedTimelineEvent[];
  currentLocation: string | null;
}

function pass1DeterministicExtraction(
  text: string,
  config: ProjectConfig,
  characters: Character[],
  normalizedLocations: EntityState<LocationEntry>,
  normalizedItems: EntityState<Item>
): Pass1Result {
  const lines = text.split('\n');
  const newEntities: ProposedNewEntity[] = [];
  const updatedEntities: ProposedEntityUpdate[] = [];
  const newTimelineEvents: ProposedTimelineEvent[] = [];
  
  const existingCharacterNames = new Set(characters.map(c => normalizeName(c.name)));
  const existingLocationNames = new Set(
    normalizedLocations.ids.map(id => normalizeName(normalizedLocations.entities[id].name))
  );
  const existingItemNames = new Set(
    normalizedItems.ids.map(id => normalizeName(normalizedItems.entities[id].name))
  );
  
  const knownEntityNamesSet = new Set(config.knownEntityNames.map(normalizeName));
  const canonLocksSet = new Set(config.canonLocks.map(normalizeName));
  
  let currentLocation: string | null = null;
  let currentCharIndex = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmedLine = line.trim();
    
    if (!trimmedLine) continue;

    // 1. Detect slug-lines (INT./EXT. locations)
    const slugMatch = trimmedLine.match(/^(INT\.|EXT\.)\s+([^-]+?)(?:\s+-\s+.*)?$/i);
    if (slugMatch) {
      const locationName = slugMatch[2].trim();
      currentLocation = locationName;
      
      if (!existingLocationNames.has(normalizeName(locationName)) &&
          !canonLocksSet.has(normalizeName(locationName))) {
        newEntities.push({
          tempId: crypto.randomUUID(),
          entityType: 'location',
          name: toTitleCase(locationName),
          source: 'deterministic',
          confidence: 0.95,
          contextSnippet: trimmedLine,
          lineNumber: lineIdx + 1,
          suggestedRegion: slugMatch[1].toUpperCase() === 'INT.' ? 'Interior' : 'Exterior',
        });
        existingLocationNames.add(normalizeName(locationName));
      }
      continue;
    }

    // 2. Detect Interior/Exterior descriptions
    const interiorExteriorMatch = trimmedLine.match(/(?:Panel\s+\d+\s+)?(Interior|Exterior)[.\s]+(.+)/i);
    if (interiorExteriorMatch) {
      const locationName = interiorExteriorMatch[2].trim().replace(/\.$/, '');
      currentLocation = locationName;
      
      if (locationName.length >= 3 &&
          !existingLocationNames.has(normalizeName(locationName)) &&
          !canonLocksSet.has(normalizeName(locationName))) {
        newEntities.push({
          tempId: crypto.randomUUID(),
          entityType: 'location',
          name: toTitleCase(locationName),
          source: 'deterministic',
          confidence: 0.9,
          contextSnippet: trimmedLine,
          lineNumber: lineIdx + 1,
          suggestedRegion: interiorExteriorMatch[1],
        });
        existingLocationNames.add(normalizeName(locationName));
      }
      continue;
    }

    // 3. Detect dialogue speakers (all-caps name + indented next line)
    const speakerMatch = trimmedLine.match(/^([A-Z][A-Z '.'-]{1,29})$/);
    if (speakerMatch && lineIdx + 1 < lines.length) {
      const nextLine = lines[lineIdx + 1];
      // Check if next line is indented (dialogue)
      if (nextLine && nextLine.match(/^\s{2,}/)) {
        const speakerName = speakerMatch[1].trim();
        
        if (!SCREENPLAY_KEYWORDS.has(speakerName) &&
            !existingCharacterNames.has(normalizeName(speakerName)) &&
            !canonLocksSet.has(normalizeName(speakerName))) {
          newEntities.push({
            tempId: crypto.randomUUID(),
            entityType: 'character',
            name: toTitleCase(speakerName),
            source: 'deterministic',
            confidence: 0.9,
            contextSnippet: trimmedLine + ' / ' + nextLine.trim().slice(0, 40) + '...',
            lineNumber: lineIdx + 1,
            suggestedRole: 'Supporting',
            suggestedDescription: `Character with dialogue starting at line ${lineIdx + 1}`,
          });
          existingCharacterNames.add(normalizeName(speakerName));
        }
      }
      continue;
    }

    // 4. Detect known entity mentions (for timeline events)
    for (const char of characters) {
      const charNameLower = normalizeName(char.name);
      if (normalizeName(trimmedLine).includes(charNameLower)) {
        // Check for movement to current location
        if (currentLocation && char.currentLocationId !== currentLocation) {
          const locationEntity = normalizedLocations.ids
            .map(id => normalizedLocations.entities[id])
            .find(loc => normalizeName(loc.name) === normalizeName(currentLocation!));
          
          if (locationEntity) {
            newTimelineEvents.push({
              tempId: crypto.randomUUID(),
              source: 'deterministic',
              confidence: 0.85,
              contextSnippet: trimmedLine,
              lineNumber: lineIdx + 1,
              entityType: 'character',
              entityId: char.id,
              entityName: char.name,
              action: 'moved_to',
              payload: { locationId: locationEntity.id },
              description: `${char.name} moved to ${locationEntity.name}`,
            });
          }
        }
      }
    }

    // 5. Detect custom patterns
    for (const pattern of config.customPatterns) {
      try {
        const regex = new RegExp(pattern.pattern, 'gi');
        let match;
        while ((match = regex.exec(trimmedLine)) !== null) {
          const entityName = match[1] || match[0];
          
          if (pattern.entityType === 'character' &&
              !existingCharacterNames.has(normalizeName(entityName)) &&
              !canonLocksSet.has(normalizeName(entityName))) {
            newEntities.push({
              tempId: crypto.randomUUID(),
              entityType: 'character',
              name: toTitleCase(entityName),
              source: 'deterministic',
              confidence: 0.8,
              contextSnippet: trimmedLine,
              lineNumber: lineIdx + 1,
              suggestedDescription: `Matched custom pattern: ${pattern.label}`,
            });
            existingCharacterNames.add(normalizeName(entityName));
          } else if (pattern.entityType === 'location' &&
                     !existingLocationNames.has(normalizeName(entityName)) &&
                     !canonLocksSet.has(normalizeName(entityName))) {
            newEntities.push({
              tempId: crypto.randomUUID(),
              entityType: 'location',
              name: toTitleCase(entityName),
              source: 'deterministic',
              confidence: 0.8,
              contextSnippet: trimmedLine,
              lineNumber: lineIdx + 1,
            });
            existingLocationNames.add(normalizeName(entityName));
          } else if (pattern.entityType === 'item' &&
                     !existingItemNames.has(normalizeName(entityName)) &&
                     !canonLocksSet.has(normalizeName(entityName))) {
            newEntities.push({
              tempId: crypto.randomUUID(),
              entityType: 'item',
              name: toTitleCase(entityName),
              source: 'deterministic',
              confidence: 0.8,
              contextSnippet: trimmedLine,
              lineNumber: lineIdx + 1,
              suggestedItemDescription: `Matched custom pattern: ${pattern.label}`,
            });
            existingItemNames.add(normalizeName(entityName));
          }
        }
      } catch (error) {
        console.warn(`Invalid regex pattern: ${pattern.pattern}`, error);
      }
    }

    // 6. Detect Setting/Caption timeline markers
    const settingMatch = trimmedLine.match(/^Setting:\s*(.+)/i);
    if (settingMatch) {
      const date = settingMatch[1].trim();
      newTimelineEvents.push({
        tempId: crypto.randomUUID(),
        source: 'deterministic',
        confidence: 1.0,
        contextSnippet: trimmedLine,
        lineNumber: lineIdx + 1,
        entityType: 'location',
        entityId: '',
        entityName: 'Story Timeline',
        action: 'created',
        payload: { date },
        description: `Timeline marker: ${date}`,
      });
      continue;
    }

    const captionMatch = trimmedLine.match(/^CAPTION:\s*(\d{4}.+)/i);
    if (captionMatch) {
      const date = captionMatch[1].trim();
      newTimelineEvents.push({
        tempId: crypto.randomUUID(),
        source: 'deterministic',
        confidence: 1.0,
        contextSnippet: trimmedLine,
        lineNumber: lineIdx + 1,
        entityType: 'location',
        entityId: '',
        entityName: 'Story Timeline',
        action: 'created',
        payload: { date },
        description: `Caption timeline: ${date}`,
      });
      continue;
    }

    // 7. Detect item action verbs
    const lineLower = trimmedLine.toLowerCase();
    for (const verb of ITEM_ACTION_VERBS) {
      if (lineLower.includes(verb)) {
        // Try to extract item name after verb
        const verbIndex = lineLower.indexOf(verb);
        const afterVerb = trimmedLine.slice(verbIndex + verb.length).trim();
        const itemMatch = afterVerb.match(/^(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        
        if (itemMatch) {
          const itemName = itemMatch[1];
          
          if (!existingItemNames.has(normalizeName(itemName)) &&
              !canonLocksSet.has(normalizeName(itemName))) {
            newEntities.push({
              tempId: crypto.randomUUID(),
              entityType: 'item',
              name: itemName,
              source: 'deterministic',
              confidence: 0.75,
              contextSnippet: trimmedLine,
              lineNumber: lineIdx + 1,
              suggestedItemDescription: `Item mentioned with action verb: ${verb}`,
            });
            existingItemNames.add(normalizeName(itemName));
          }
        }
      }
    }
  }

  return {
    newEntities,
    updatedEntities,
    newTimelineEvents,
    currentLocation,
  };
}

// ─── Pass 2: LLM Extraction ─────────────────────────────────────────────────

async function pass2LLMExtraction(
  text: string,
  config: ProjectConfig,
  characters: Character[],
  normalizedLocations: EntityState<LocationEntry>,
  normalizedItems: EntityState<Item>,
  pass1Result: Pass1Result,
  geminiApiKey: string
): Promise<{
  newEntities: ProposedNewEntity[];
  updatedEntities: ProposedEntityUpdate[];
  newTimelineEvents: ProposedTimelineEvent[];
}> {
  try {
    // Build context for LLM
    const existingCharacterNames = characters.map(c => c.name);
    const existingLocationNames = normalizedLocations.ids.map(id => normalizedLocations.entities[id].name);
    const existingItemNames = normalizedItems.ids.map(id => normalizedItems.entities[id].name);
    const canonLocks = config.canonLocks;
    const pass1Discoveries = pass1Result.newEntities.map(e => e.name);

    const systemPrompt = `You are a script analysis AI. Analyze the following screenplay/script and extract:

1. NEW ENTITIES (characters, locations, items) not in the existing lists
2. UPDATES to existing entities (new details, state changes)
3. TIMELINE EVENTS (character movements, item transfers, status changes)

CONTEXT:
- Existing characters: ${existingCharacterNames.join(', ') || 'none'}
- Existing locations: ${existingLocationNames.join(', ') || 'none'}
- Existing items: ${existingItemNames.join(', ') || 'none'}
- Canon locks (don't modify): ${canonLocks.join(', ') || 'none'}
- Pass 1 discoveries: ${pass1Discoveries.join(', ') || 'none'}

RULES:
- Don't duplicate Pass 1 discoveries
- Don't modify canon-locked entities
- Focus on implicit information (character relationships, emotional states, subtle movements)
- Provide confidence scores (0.0-1.0) for each extraction
- Include line numbers and context snippets

Return JSON matching this structure:
{
  "newEntities": [
    {
      "name": "string",
      "entityType": "character|location|item",
      "confidence": 0.0-1.0,
      "contextSnippet": "string",
      "lineNumber": number,
      "suggestedRole": "Protagonist|Antagonist|Supporting|Minor" (characters only),
      "suggestedDescription": "string" (optional),
      "suggestedRegion": "string" (locations only),
      "suggestedItemDescription": "string" (items only)
    }
  ],
  "updatedEntities": [
    {
      "entityName": "string",
      "entityType": "character|location|item",
      "confidence": 0.0-1.0,
      "contextSnippet": "string",
      "lineNumber": number,
      "changeDescription": "string",
      "updates": { "key": "value" }
    }
  ],
  "newTimelineEvents": [
    {
      "entityName": "string",
      "entityType": "character|location|item",
      "action": "created|moved_to|acquired|dropped|status_changed|updated|deleted|relationship_changed",
      "confidence": 0.0-1.0,
      "contextSnippet": "string",
      "lineNumber": number,
      "payload": { "key": "value" },
      "description": "string"
    }
  ]
}

SCRIPT:
${text.slice(0, 8000)}`; // Limit to avoid token overflow

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: systemPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No response from Gemini API');
    }

    // Parse JSON response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }

    const llmResponse: LLMExtractionResponse = JSON.parse(jsonMatch[0]);

    // Convert LLM response to ProposedEntity format
    const newEntities: ProposedNewEntity[] = llmResponse.newEntities.map(e => ({
      tempId: crypto.randomUUID(),
      entityType: e.entityType as any,
      name: e.name,
      source: 'llm' as const,
      confidence: e.confidence,
      contextSnippet: e.contextSnippet,
      lineNumber: e.lineNumber,
      suggestedRole: e.suggestedRole,
      suggestedDescription: e.suggestedDescription,
      suggestedRegion: e.suggestedRegion,
      suggestedItemDescription: e.suggestedItemDescription,
    }));

    const updatedEntities: ProposedEntityUpdate[] = llmResponse.updatedEntities.map(e => {
      const entity = 
        characters.find(c => normalizeName(c.name) === normalizeName(e.entityName)) ||
        normalizedLocations.ids.map(id => normalizedLocations.entities[id]).find(l => normalizeName(l.name) === normalizeName(e.entityName)) ||
        normalizedItems.ids.map(id => normalizedItems.entities[id]).find(i => normalizeName(i.name) === normalizeName(e.entityName));

      return {
        entityId: entity?.id || '',
        entityType: e.entityType as any,
        entityName: e.entityName,
        source: 'llm' as const,
        confidence: e.confidence,
        contextSnippet: e.contextSnippet,
        lineNumber: e.lineNumber,
        changeDescription: e.changeDescription,
        updates: e.updates,
      };
    });

    const newTimelineEvents: ProposedTimelineEvent[] = llmResponse.newTimelineEvents.map(e => {
      const entity = 
        characters.find(c => normalizeName(c.name) === normalizeName(e.entityName)) ||
        normalizedLocations.ids.map(id => normalizedLocations.entities[id]).find(l => normalizeName(l.name) === normalizeName(e.entityName)) ||
        normalizedItems.ids.map(id => normalizedItems.entities[id]).find(i => normalizeName(i.name) === normalizeName(e.entityName));

      return {
        tempId: crypto.randomUUID(),
        source: 'llm' as const,
        confidence: e.confidence,
        contextSnippet: e.contextSnippet,
        lineNumber: e.lineNumber,
        entityType: e.entityType as any,
        entityId: entity?.id || '',
        entityName: e.entityName,
        action: e.action as any,
        payload: e.payload,
        description: e.description,
      };
    });

    return {
      newEntities,
      updatedEntities,
      newTimelineEvents,
    };
  } catch (error) {
    console.error('Pass 2 LLM extraction failed:', error);
    // Return empty results on error (graceful degradation)
    return {
      newEntities: [],
      updatedEntities: [],
      newTimelineEvents: [],
    };
  }
}

// ─── Main Parser Function ───────────────────────────────────────────────────

export async function parseScriptAndProposeUpdates(
  options: ParseOptions
): Promise<ParsedProposal> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // Validate input
  if (!options.rawScriptText || options.rawScriptText.trim().length === 0) {
    throw new Error('Script text is empty');
  }

  const lineCount = options.rawScriptText.split('\n').length;

  // Pass 1: Deterministic extraction
  const pass1Result = pass1DeterministicExtraction(
    options.rawScriptText,
    options.config,
    options.characters,
    options.normalizedLocations,
    options.normalizedItems
  );

  let pass2Result = {
    newEntities: [] as ProposedNewEntity[],
    updatedEntities: [] as ProposedEntityUpdate[],
    newTimelineEvents: [] as ProposedTimelineEvent[],
  };

  let llmWasUsed = false;

  // Pass 2: LLM extraction (optional)
  if (options.enableLLM && options.geminiApiKey) {
    try {
      pass2Result = await pass2LLMExtraction(
        options.rawScriptText,
        options.config,
        options.characters,
        options.normalizedLocations,
        options.normalizedItems,
        pass1Result,
        options.geminiApiKey
      );
      llmWasUsed = true;
    } catch (error) {
      warnings.push(`LLM extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Merge results (Pass 1 + Pass 2, avoiding duplicates)
  const allNewEntities = [...pass1Result.newEntities];
  const existingNames = new Set(allNewEntities.map(e => normalizeName(e.name)));

  for (const entity of pass2Result.newEntities) {
    if (!existingNames.has(normalizeName(entity.name))) {
      allNewEntities.push(entity);
      existingNames.add(normalizeName(entity.name));
    }
  }

  const allUpdatedEntities = [...pass1Result.updatedEntities, ...pass2Result.updatedEntities];
  const allTimelineEvents = [...pass1Result.newTimelineEvents, ...pass2Result.newTimelineEvents];

  const parseDurationMs = Date.now() - startTime;

  return {
    meta: {
      parsedAt: new Date().toISOString(),
      rawScriptLength: options.rawScriptText.length,
      lineCount,
      parseDurationMs,
      llmWasUsed,
      warnings,
    },
    newEntities: allNewEntities,
    updatedEntities: allUpdatedEntities,
    newTimelineEvents: allTimelineEvents,
  };
}
