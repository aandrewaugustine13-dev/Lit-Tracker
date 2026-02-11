// =============================================================================
// COMIC SCRIPT PARSER — Regex-based Extraction Engine
// =============================================================================
// Pure function module that parses comic book script format (PANEL N: based)
// and extracts characters, locations, timeline events, and echoes (significant objects).
// This parser complements universalScriptParser.ts (screenplay format) and
// timelineLocationsParser.ts (timeline/location enrichment).

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface ParsedCharacter {
  name: string;
  age?: number;
  traits: string[];
  firstMention: number; // Line number
}

export interface ParsedLocation {
  name: string;
  year?: number;
  firstMention: number; // Line number
}

export interface ParsedTimelineEntry {
  year: number;
  context: string;
}

export interface ParsedEcho {
  name: string;
  type: 'object';
  firstMention: number; // Line number
}

export interface ComicParseResult {
  characters: ParsedCharacter[];
  locations: ParsedLocation[];
  timeline: ParsedTimelineEntry[];
  echoes: ParsedEcho[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

// Timeline year range constraints
const MIN_VALID_YEAR = 2000;
const MAX_VALID_YEAR = 2199;

// Maximum context snippet length
const MAX_CONTEXT_LENGTH = 100;

// Noise words to filter out (screenplay/panel keywords and common words)
const NOISE_WORDS = new Set([
  'PANEL', 'PAGE', 'SCENE', 'INT', 'EXT', 'CUT', 'FADE', 'DISSOLVE',
  'SMASH', 'MATCH', 'CONTINUED', 'CONT', 'ANGLE', 'CLOSE', 'WIDE',
  'PAN', 'ZOOM', 'SFX', 'VO', 'OS', 'OC', 'POV', 'INSERT', 'SUPER',
  'TITLE', 'THE', 'AND', 'BUT', 'FOR', 'NOT', 'WITH', 'FROM',
  'ACT', 'END', 'DAY', 'NIGHT', 'MORNING', 'EVENING', 'LATER',
  'CONTINUOUS', 'INTERCUT', 'FLASHBACK', 'MONTAGE', 'BEGIN',
  'RESUME', 'BACK', 'SAME', 'TIME', 'CAPTION', 'SETTING', 'SHOT',
  'ESTABLISHING', 'EXTERIOR', 'INTERIOR', 'TO', 'IN', 'ON', 'AT',
  'OF', 'A', 'AN', 'IS', 'ARE', 'WAS', 'WERE', 'BE', 'BEEN',
]);

// Location indicator keywords
const LOCATION_INDICATORS = new Set([
  'WAREHOUSE', 'ROOM', 'BUILDING', 'STREET', 'LAB', 'LABORATORY',
  'HOSPITAL', 'GARAGE', 'OFFICE', 'BUREAU', 'HEADQUARTERS', 'HQ',
  'APARTMENT', 'HOUSE', 'MANSION', 'CHURCH', 'TEMPLE', 'SCHOOL',
  'STATION', 'PARK', 'ALLEY', 'BRIDGE', 'TOWER', 'PRISON', 'JAIL',
  'COURT', 'COURTROOM', 'DINER', 'BAR', 'RESTAURANT', 'CAFÉ', 'CAFE',
  'MALL', 'SHOP', 'STORE', 'MARKET', 'ARENA', 'STADIUM', 'LIBRARY',
  'MUSEUM', 'HALL', 'HALLWAY', 'CORRIDOR', 'BASEMENT', 'ROOFTOP',
  'ROOF', 'BUNKER', 'CAVE', 'FOREST', 'DOCK', 'PORT', 'HARBOR',
  'HANGAR', 'FACILITY', 'CENTER', 'CENTRE', 'THEATRE', 'THEATER',
  'BASE', 'COMMAND', 'DIMENSION', 'REALM', 'VOID',
]);

// Action verbs that suggest object interaction (for echo extraction)
const ECHO_ACTION_VERBS = [
  'holds', 'hold', 'holding',
  'clutches', 'clutch', 'clutching',
  'wears', 'wear', 'wearing',
  'carries', 'carry', 'carrying',
  'grabs', 'grab', 'grabbing',
  'picks up', 'pick up', 'picking up',
  'draws', 'draw', 'drawing',
  'wields', 'wield', 'wielding',
  'takes', 'take', 'taking',
  'retrieves', 'retrieve', 'retrieving',
  'brandishes', 'brandish', 'brandishing',
  'raises', 'raise', 'raising',
  'drops', 'drop', 'dropping',
  'throws', 'throw', 'throwing',
  'catches', 'catch', 'catching',
];

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Normalize name for comparison: lowercase, trim, collapse whitespace
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if a word is a noise word
 */
function isNoiseWord(word: string): boolean {
  return NOISE_WORDS.has(word.toUpperCase());
}

/**
 * Check if text contains a location indicator
 */
function hasLocationIndicator(text: string): boolean {
  const words = text.toUpperCase().split(/\s+/);
  return words.some(word => LOCATION_INDICATORS.has(word.replace(/[,.-]/g, '')));
}

// ─── Main Parser Function ───────────────────────────────────────────────────

/**
 * Parse comic book script and extract characters, locations, timeline, and echoes.
 * 
 * @param scriptText - The comic script text to parse
 * @param format - Script format ('comic', 'screenplay', 'prose'). Only 'comic' is implemented.
 * @returns Parsed entities including characters, locations, timeline events, and echoes
 */
export function parseScript(
  scriptText: string,
  format: 'comic' | 'screenplay' | 'prose' = 'comic'
): ComicParseResult {
  console.log('[comicParser] Starting parse, format:', format);
  console.log('[comicParser] Script length:', scriptText.length);

  if (format !== 'comic') {
    console.warn('[comicParser] Only "comic" format is currently supported');
    return { characters: [], locations: [], timeline: [], echoes: [] };
  }

  const lines = scriptText.split('\n');
  console.log('[comicParser] Total lines:', lines.length);

  // Storage for extracted data
  const charactersMap = new Map<string, ParsedCharacter>();
  const locationsMap = new Map<string, ParsedLocation>();
  const timelineMap = new Map<number, ParsedTimelineEntry>();
  const echoesMap = new Map<string, ParsedEcho>();

  // Track current panel number
  let currentPanel = 0;

  // ═══ STEP 1: Split into panels and process line by line ═══
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lineNumber = i + 1;

    if (!trimmedLine) continue;

    // Detect PANEL N: headers
    const panelMatch = trimmedLine.match(/^PANEL\s+(\d+):/i);
    if (panelMatch) {
      currentPanel = parseInt(panelMatch[1], 10);
      console.log(`[comicParser] Panel ${currentPanel} detected at line ${lineNumber}`);
      continue;
    }

    // ═══ STEP 2: Extract characters ═══
    
    // Pattern 1: NAME (age) or NAME (age, trait1, trait2)
    // Example: ELIAS (30, DBS scar) or ZOEY (25) or DR. SARAH (45, scientist)
    const charWithAgeMatch = trimmedLine.match(/^([A-Z][A-Z\s'.-]+)\s*\((\d+)(?:,\s*(.+?))?\)/);
    if (charWithAgeMatch) {
      const name = charWithAgeMatch[1].trim();
      const age = parseInt(charWithAgeMatch[2], 10);
      const traitsStr = charWithAgeMatch[3];
      const traits = traitsStr ? traitsStr.split(',').map(t => t.trim()) : [];
      
      if (!isNoiseWord(name)) {
        const normalizedName = normalizeName(name);
        
        if (charactersMap.has(normalizedName)) {
          // Merge traits if character already exists
          const existing = charactersMap.get(normalizedName)!;
          const newTraits = traits.filter(t => !existing.traits.includes(t));
          if (newTraits.length > 0) {
            existing.traits.push(...newTraits);
            console.log(`[comicParser] Updated character ${name} with new traits:`, newTraits);
          }
        } else {
          charactersMap.set(normalizedName, {
            name,
            age,
            traits,
            firstMention: lineNumber,
          });
          console.log(`[comicParser] Found character: ${name}, age: ${age}, traits:`, traits);
        }
      }
    }

    // Pattern 2: NAME: "dialogue" (dialogue attribution)
    const dialogueMatch = trimmedLine.match(/^([A-Z][A-Z\s'.-]+):\s*"(.+)"/);
    if (dialogueMatch) {
      const name = dialogueMatch[1].trim();
      
      if (!isNoiseWord(name)) {
        const normalizedName = normalizeName(name);
        
        if (!charactersMap.has(normalizedName)) {
          charactersMap.set(normalizedName, {
            name,
            traits: [],
            firstMention: lineNumber,
          });
          console.log(`[comicParser] Found character (dialogue): ${name}`);
        }
      }
    }

    // ═══ STEP 3: Extract locations ═══
    
    // Pattern 1: ALL-CAPS LOCATION - YEAR
    // Example: WAREHOUSE - 2093 or S.T.A.R. LABS - 2100
    const locationYearMatch = trimmedLine.match(/^([A-Z][A-Z\s'.-]+)\s*-\s*(\d{4})$/);
    if (locationYearMatch) {
      const name = locationYearMatch[1].trim();
      const year = parseInt(locationYearMatch[2], 10);
      
      if (!isNoiseWord(name) && year >= MIN_VALID_YEAR && year <= MAX_VALID_YEAR) {
        const normalizedName = normalizeName(name);
        
        if (!locationsMap.has(normalizedName)) {
          locationsMap.set(normalizedName, {
            name,
            year,
            firstMention: lineNumber,
          });
          console.log(`[comicParser] Found location: ${name}, year: ${year}`);
        }
      }
    }

    // Pattern 2: Standalone ALL-CAPS line with location indicator
    const capsOnlyMatch = trimmedLine.match(/^([A-Z][A-Z\s'.-]+)$/);
    if (capsOnlyMatch && !locationYearMatch && !charWithAgeMatch && !dialogueMatch) {
      const name = capsOnlyMatch[1].trim();
      
      if (!isNoiseWord(name) && hasLocationIndicator(name)) {
        const normalizedName = normalizeName(name);
        
        if (!locationsMap.has(normalizedName)) {
          locationsMap.set(normalizedName, {
            name,
            firstMention: lineNumber,
          });
          console.log(`[comicParser] Found location (standalone): ${name}`);
        }
      }
    }

    // Pattern 3: Establishing shot patterns
    if (/establishing\s+shot/i.test(trimmedLine)) {
      console.log(`[comicParser] Establishing shot detected at line ${lineNumber}`);
      // Extract location from nearby lines if possible
      // For simplicity, we'll skip detailed extraction here
    }

    // ═══ STEP 4: Extract timeline entries ═══
    
    // Scan for 4-digit years in valid range
    const yearMatches = Array.from(trimmedLine.matchAll(/\b(2[0-1]\d{2})\b/g));
    for (const match of yearMatches) {
      const year = parseInt(match[1], 10);
      
      if (!timelineMap.has(year)) {
        timelineMap.set(year, {
          year,
          context: trimmedLine.substring(0, MAX_CONTEXT_LENGTH),
        });
        console.log(`[comicParser] Found timeline year: ${year}`);
      }
    }

    // ═══ STEP 5: Extract echoes (significant objects) ═══
    
    // Pattern: Action verb + ALL-CAPS object
    // Example: "holds a SCARAB PENDANT" → SCARAB PENDANT
    for (const verb of ECHO_ACTION_VERBS) {
      const verbPattern = new RegExp(`\\b${verb}\\b(.+)`, 'i');
      const verbMatch = trimmedLine.match(verbPattern);
      
      if (verbMatch) {
        const afterVerb = verbMatch[1];
        
        // Look for ALL-CAPS words after the verb (minimum 2 chars total)
        const capsMatches = Array.from(afterVerb.matchAll(/\b([A-Z][A-Z\s'.-]+)\b/g));
        
        for (const capsMatch of capsMatches) {
          let objectName = capsMatch[1].trim();
          
          // Clean up common article patterns
          objectName = objectName.replace(/^(A|AN|THE)\s+/, '');
          
          if (!isNoiseWord(objectName)) {
            const normalizedName = normalizeName(objectName);
            
            // Filter out if already identified as character or location
            if (!charactersMap.has(normalizedName) && !locationsMap.has(normalizedName)) {
              if (!echoesMap.has(normalizedName)) {
                echoesMap.set(normalizedName, {
                  name: objectName,
                  type: 'object',
                  firstMention: lineNumber,
                });
                console.log(`[comicParser] Found echo (via ${verb}): ${objectName}`);
              }
            }
          }
        }
      }
    }

    // Also look for inline "a/the CAPS" patterns (conservative)
    // Match "a/an/the" followed by 1-3 uppercase words
    const inlineCapsMatches = Array.from(trimmedLine.matchAll(/\b(?:a|an|the)\s+([A-Z]+(?:\s+[A-Z]+){0,2})(?=\s|[.,!?;:]|$)/gi));
    for (const match of inlineCapsMatches) {
      let objectName = match[1].trim();
      
      if (!isNoiseWord(objectName)) {
        const normalizedName = normalizeName(objectName);
        
        // Filter out if already identified as character or location
        if (!charactersMap.has(normalizedName) && !locationsMap.has(normalizedName)) {
          if (!echoesMap.has(normalizedName)) {
            echoesMap.set(normalizedName, {
              name: objectName,
              type: 'object',
              firstMention: lineNumber,
            });
            console.log(`[comicParser] Found echo (inline caps): ${objectName}`);
          }
        }
      }
    }
  }

  // Convert maps to arrays
  const result: ComicParseResult = {
    characters: Array.from(charactersMap.values()),
    locations: Array.from(locationsMap.values()),
    timeline: Array.from(timelineMap.values()),
    echoes: Array.from(echoesMap.values()),
  };

  console.log('[comicParser] Parse complete:');
  console.log(`  - ${result.characters.length} characters`);
  console.log(`  - ${result.locations.length} locations`);
  console.log(`  - ${result.timeline.length} timeline entries`);
  console.log(`  - ${result.echoes.length} echoes`);

  return result;
}

// ─── Self-Test Block ────────────────────────────────────────────────────────

// Only run tests if this file is executed directly (not imported)
if (typeof process !== 'undefined' && process.argv && process.argv[1] && 
    (process.argv[1].endsWith('comicScriptParser.ts') || process.argv[1].endsWith('comicScriptParser.js'))) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Running self-tests for comicScriptParser');
  console.log('═══════════════════════════════════════════════════════\n');

  // Test 1: Minimal script
  console.log('TEST 1: Minimal script');
  console.log('───────────────────────────────────────────────────────');
  const minimalScript = `PANEL 1:
WAREHOUSE - 2093

PANEL 2:
ELIAS (30) holds a SCARAB.`;

  const result1 = parseScript(minimalScript, 'comic');
  
  console.log('\nExpected:');
  console.log('  - 1 character: ELIAS, age 30');
  console.log('  - 1 location: WAREHOUSE, year 2093');
  console.log('  - 1 timeline entry: year 2093');
  console.log('  - 1 echo: SCARAB');
  
  console.log('\nActual:');
  console.log('  - Characters:', result1.characters);
  console.log('  - Locations:', result1.locations);
  console.log('  - Timeline:', result1.timeline);
  console.log('  - Echoes:', result1.echoes);
  
  // Validate
  let test1Pass = true;
  if (result1.characters.length !== 1 || result1.characters[0].name !== 'ELIAS' || result1.characters[0].age !== 30) {
    console.error('❌ TEST 1 FAILED: Character extraction incorrect');
    test1Pass = false;
  }
  if (result1.locations.length !== 1 || result1.locations[0].name !== 'WAREHOUSE' || result1.locations[0].year !== 2093) {
    console.error('❌ TEST 1 FAILED: Location extraction incorrect');
    test1Pass = false;
  }
  if (result1.timeline.length !== 1 || result1.timeline[0].year !== 2093) {
    console.error('❌ TEST 1 FAILED: Timeline extraction incorrect');
    test1Pass = false;
  }
  if (result1.echoes.length !== 1 || result1.echoes[0].name !== 'SCARAB') {
    console.error('❌ TEST 1 FAILED: Echo extraction incorrect');
    test1Pass = false;
  }
  
  if (test1Pass) {
    console.log('\n✅ TEST 1 PASSED');
  }

  // Test 2: Fuller script
  console.log('\n\nTEST 2: Fuller script');
  console.log('───────────────────────────────────────────────────────');
  const fullerScript = `PANEL 1:
WAREHOUSE - 2093
Establishing shot.

PANEL 2:
ELIAS (30, DBS scar) holds a SCARAB PENDANT.
ELIAS: "I should've burned this years ago."

PANEL 3:
ZOEY (25, scarred) enters.
ZOEY: "Too late for that."`;

  const result2 = parseScript(fullerScript, 'comic');
  
  console.log('\nExpected:');
  console.log('  - 2 characters: ELIAS (age 30, traits: ["DBS scar"]), ZOEY (age 25, traits: ["scarred"])');
  console.log('  - 1 location: WAREHOUSE (year 2093)');
  console.log('  - 1 timeline entry: year 2093');
  console.log('  - 1 echo: SCARAB PENDANT');
  
  console.log('\nActual:');
  console.log('  - Characters:', result2.characters);
  console.log('  - Locations:', result2.locations);
  console.log('  - Timeline:', result2.timeline);
  console.log('  - Echoes:', result2.echoes);
  
  // Validate
  let test2Pass = true;
  if (result2.characters.length !== 2) {
    console.error('❌ TEST 2 FAILED: Expected 2 characters, got', result2.characters.length);
    test2Pass = false;
  }
  
  const elias = result2.characters.find(c => c.name === 'ELIAS');
  if (!elias || elias.age !== 30 || !elias.traits.includes('DBS scar')) {
    console.error('❌ TEST 2 FAILED: ELIAS extraction incorrect');
    test2Pass = false;
  }
  
  const zoey = result2.characters.find(c => c.name === 'ZOEY');
  if (!zoey || zoey.age !== 25 || !zoey.traits.includes('scarred')) {
    console.error('❌ TEST 2 FAILED: ZOEY extraction incorrect');
    test2Pass = false;
  }
  
  if (result2.locations.length !== 1 || result2.locations[0].name !== 'WAREHOUSE' || result2.locations[0].year !== 2093) {
    console.error('❌ TEST 2 FAILED: Location extraction incorrect');
    test2Pass = false;
  }
  
  if (result2.timeline.length !== 1 || result2.timeline[0].year !== 2093) {
    console.error('❌ TEST 2 FAILED: Timeline extraction incorrect');
    test2Pass = false;
  }
  
  if (result2.echoes.length !== 1 || result2.echoes[0].name !== 'SCARAB PENDANT') {
    console.error('❌ TEST 2 FAILED: Echo extraction incorrect');
    test2Pass = false;
  }
  
  if (test2Pass) {
    console.log('\n✅ TEST 2 PASSED');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Self-tests complete');
  console.log('═══════════════════════════════════════════════════════\n');
}
