// =============================================================================
// DETERMINISTIC PARSER — Enrichment + Standalone modes
// =============================================================================
// Replaces: src/engine/comicScriptParser.ts, src/utils/smartFallbackParser.ts
// Mode A (enrichment): validates AI output, fills gaps, fixes counts
// Mode B (standalone): full regex parse when no API key or AI call failed
// Produces UnifiedParseResult — the single contract for all downstream consumers.

import {
  UnifiedParseResult,
  ProjectType,
  ParsedPage,
  ParsedPanel,
  ParsedCharacter,
  ParsedLoreEntry,
  ParsedTimelineEvent,
  Block,
  BlockType,
  LoreCategory,
} from './parserPipeline.types';

// ─── Format Patterns ─────────────────────────────────────────────────────────
// Each format gets a pattern config. ONE parser function switches on these,
// instead of four separate parser files.

interface FormatPatterns {
  pageBreak: RegExp;
  panelBreak: RegExp;
  dialogue: RegExp;
  artNote: RegExp;
  caption: RegExp;
  sfx: RegExp;
  thought: RegExp;
  ignore: RegExp;
  visualMarkers?: RegExp;
}

const COMIC_PATTERNS: FormatPatterns = {
  pageBreak: /^PAGE\s+(\d+)/i,
  panelBreak: /^Panel\s+(\d+)/i,
  dialogue: /^([A-Z][A-Z\s'.\-]+?)(?:\s*\([^)]*\))?\s*:\s*(.+)/,
  artNote: /^\[.*\]$|^ARTIST\s*NOTE/i,
  caption: /^CAPTION\s*: \s*(.+)/i,
  sfx: /^SFX\s*: \s*(.+)/i,
  thought: /^([A-Z][A-Z\s'.\-]+?)\s*\(thought(?:\s+caption)?\)\s*: \s*(.+)/i,
  ignore: /^\s*$/,  
  visualMarkers: /\[(ECHO|HITCH|OVERFLOW|SHATTERED|SPLIT)\]/i,
};

const SCREENPLAY_PATTERNS: FormatPatterns = {
  pageBreak: /^(INT|EXT|INT\/EXT)\.\s+(.+)/,
  panelBreak: /^\s*$/, // Blank lines separate beats
  dialogue: /^([A-Z][A-Z\s'.\-]{1,30})\s*(?:\(.*\))?\s*$/,
  artNote: /^(?![A-Z]{2,}\s*$)(?![A-Z]{2,}\s*\().[a-z]/,
  caption: /\(V\.O\.\)/i,
  sfx: /^SFX\s*: \s*(.+)/i,
  thought: /\(V\.O\.\)/i,
  ignore: /^(FADE|CUT|DISSOLVE|CONTINUED|\(CONTINUED\))/i,
};

const STAGE_PLAY_PATTERNS: FormatPatterns = {
  pageBreak: /^ACT\s+(ONE|TWO|THREE|FOUR|FIVE|I|II|III|IV|V)\b/i,
  panelBreak: /^SCENE\s+(\d+)/i,
  dialogue: /^([A-Z][A-Z\s'.\-]+?)\.\s+(.+)/,
  artNote: /^\(.*\)$|^\[.*\]$/,
  caption: /^NARRATOR\s*: \s*(.+)/i,
  sfx: /^SFX\s*: \s*(.+)/i,
  thought: /\(aside\)/i,
  ignore: /^\s*$/,  
};

const TV_SERIES_PATTERNS: FormatPatterns = {
  pageBreak: /^(COLD OPEN|TEASER|TAG|ACT\s+(ONE|TWO|THREE|FOUR|FIVE|I|II|III|IV|V))\b/i,
  panelBreak: /^(INT|EXT|INT\/EXT)\.\s+(.+)/,
  dialogue: /^([A-Z][A-Z\s'.\-]{1,30})\s*(?:\(.*\))?\s*$/,
  artNote: /^(?![A-Z]{2,}\s*$)(?![A-Z]{2,}\s*\().[a-z]/,
  caption: /\(V\.O\.\)/i,
  sfx: /^SFX\s*: \s*(.+)/i,
  thought: /\(V\.O\.\)/i,
  ignore: /^(SMASH CUT|MATCH CUT|CONTINUED|\(CONTINUED\))/i,
};

function getPatternsForType(projectType: ProjectType): FormatPatterns {
  switch (projectType) {
    case 'comic': return COMIC_PATTERNS;
    case 'screenplay': return SCREENPLAY_PATTERNS;
    case 'stage-play': return STAGE_PLAY_PATTERNS;
    case 'tv-series': return TV_SERIES_PATTERNS;
    default: return COMIC_PATTERNS;
  }
}

// ─── Format Detection ────────────────────────────────────────────────────────

function detectFormat(scriptText: string, declaredType: ProjectType): ProjectType {
  // Trust the user's declared type if provided
  if (declaredType) return declaredType;

  const first100Lines = scriptText.split('\n').slice(0, 100).join('\n');

  // Comic: PAGE/Panel headers
  if (/^PAGE\s+\d+/im.test(first100Lines) &&
      /^Panel\s+\d+/im.test(first100Lines)) return 'comic';

  // Screenplay: INT./EXT. sluglines
  if (/^(INT|EXT|INT\/EXT)\.\s/m.test(first100Lines)) return 'screenplay';

  // Stage play: ACT/SCENE with stage directions
  if (/^ACT\s+(ONE|TWO|I|II|III)/im.test(first100Lines) &&
      /^SCENE/im.test(first100Lines)) return 'stage-play';

  // TV: Act structure with sluglines
  if (/^(COLD OPEN|TEASER|ACT ONE)/im.test(first100Lines) &&
      /^(INT|EXT)\./m.test(first100Lines)) return 'tv-series';

  // Default to comic (most users)
  return 'comic';
}

// ─── Source Hash (sync fallback for deterministic path) ──────────────────────

function computeSourceHashSync(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ─── Noise / Keyword Filters ────────────────────────────────────────────────

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
  'NARRATION', 'NARRATOR', 'DESCRIPTION', 'NOTE', 'ACTION',
]);

const LOCATION_INDICATORS = new Set([
  'WAREHOUSE', 'ROOM', 'BUILDING', 'STREET', 'LAB', 'LABORATORY',
  'HOSPITAL', 'GARAGE', 'OFFICE', 'BUREAU', 'HEADQUARTERS', 'HQ',
  'APARTMENT', 'HOUSE', 'MANSION', 'CHURCH', 'TEMPLE', 'SCHOOL',
  'STATION', 'PARK', 'ALLEY', 'BRIDGE', 'TOWER', 'PRISON', 'JAIL',
  'COURT', 'COURTROOM', 'DINER', 'BAR', 'RESTAURANT', 'CAFE',
  'MALL', 'SHOP', 'STORE', 'MARKET', 'ARENA', 'STADIUM', 'LIBRARY',
  'MUSEUM', 'HALL', 'HALLWAY', 'CORRIDOR', 'BASEMENT', 'ROOFTOP',
  'ROOF', 'BUNKER', 'CAVE', 'FOREST', 'DOCK', 'PORT', 'HARBOR',
  'HANGAR', 'FACILITY', 'THEATRE', 'THEATER', 'STUDIO', 'CLINIC',
  'CENTER', 'CENTRE', 'LOBBY', 'ELEVATOR', 'SITE',
]);

// Organization/group keywords for faction detection
const FACTION_KEYWORDS = new Set([
  'DEPARTMENT', 'AGENCY', 'INSTITUTE', 'ORGANIZATION', 'ORDER', 'GUILD',
  'SQUAD', 'DIVISION', 'BUREAU', 'TEAM', 'FORCE', 'CORPS', 'GROUP',
  'UNION', 'COUNCIL', 'COMMITTEE', 'ALLIANCE', 'LEAGUE', 'SYNDICATE',
  'COLLECTIVE', 'SOCIETY', 'BROTHERHOOD', 'SISTERHOOD', 'ASSOCIATION',
  'FOUNDATION', 'MINISTRY', 'COMMAND', 'AUTHORITY',
]);

// Action verbs that suggest object interaction (for item/echo detection)
const ITEM_ACTION_VERBS = [
  'holds', 'hold', 'holding', 'wields', 'wield', 'wielding',
  'carries', 'carry', 'carrying', 'grabs', 'grab', 'grabbing',
  'picks up', 'pick up', 'picking up', 'draws', 'draw', 'drawing',
  'clutches', 'clutch', 'clutching', 'brandishes', 'brandish', 'brandishing',
  'wears', 'wear', 'wearing', 'raises', 'raise', 'raising',
  'retrieves', 'retrieve', 'retrieving', 'activates', 'activate', 'activating',
];

// Significant object keywords for item/artifact detection
const ITEM_OBJECT_KEYWORDS = new Set([
  'SWORD', 'BLADE', 'KNIFE', 'DAGGER', 'AXE', 'HAMMER', 'SPEAR',
  'GUN', 'PISTOL', 'RIFLE', 'WEAPON', 'SHIELD', 'ARMOR',
  'RING', 'AMULET', 'PENDANT', 'NECKLACE', 'CROWN', 'STAFF', 'WAND',
  'TOME', 'SCROLL', 'MAP', 'KEY', 'ARTIFACT', 'RELIC',
  'CRYSTAL', 'GEM', 'STONE', 'ORB', 'DEVICE', 'GADGET',
  'BADGE', 'VIAL', 'SERUM', 'SHARD', 'TALISMAN',
]);

// Articles/possessives that should not be used as item modifiers
const ARTICLE_WORDS = new Set(['a', 'an', 'the', 'his', 'her', 'its', 'their', 'my', 'your', 'our']);

function isNoiseWord(name: string): boolean {
  return NOISE_WORDS.has(name.trim().toUpperCase());
}

function hasLocationIndicator(text: string): boolean {
  const words = text.toUpperCase().split(/\s+/);
  return words.some(w => LOCATION_INDICATORS.has(w.replace(/[,.\-]/g, '')));
}

function hasFactionKeyword(text: string): boolean {
  const words = text.toUpperCase().split(/\s+/);
  return words.some(w => FACTION_KEYWORDS.has(w.replace(/[,.\-]/g, '')));
}

// ─── Non-Character Filter ────────────────────────────────────────────────────

const NON_CHARACTER_WORDS = new Set([
  'SIGN', 'BANNER', 'PLACARD', 'GRAFFITI', 'TEXT', 'SCREEN', 'DISPLAY',
  'RADIO', 'TV', 'TELEVISION', 'NEWS', 'BROADCAST', 'INTERCOM', 'PA',
  'SPEAKER', 'PHONE', 'RECORDING', 'VOICEMAIL', 'ANSWERING',
  'NEWSPAPER', 'LETTER', 'DOCUMENT', 'NOTE', 'POSTER', 'BILLBOARD', 'MARQUEE',
  'CROWD', 'CHANT', 'CHORUS', 'ALL', 'EVERYONE', 'VOICE', 'VOICES',
  'SFX', 'SOUND', 'MUSIC', 'SONG',
  'NARRATOR', 'CAPTION', 'TITLE', 'CRAWL', 'CRAWLER', 'CHYRON', 'SUPER',
  'MONITOR', 'COMPUTER', 'DEVICE', 'ALARM', 'SIREN', 'HORN',
  'ANNOUNCEMENT', 'ANNOUNCER', 'AUTOMATED', 'SYSTEM', 'GPS', 'AI',
]);

function isNonCharacterName(name: string): boolean {
  const upper = name.trim().toUpperCase();
  // Exact match
  if (NON_CHARACTER_WORDS.has(upper)) return true;
  // Any word in the name is a non-character word
  const words = upper.split(/[\s\-_\/]+/);
  if (words.some(w => NON_CHARACTER_WORDS.has(w))) return true;
  // Patterns that indicate non-characters
  if (/\b(ON|FROM|VIA)\s+(RADIO|TV|SCREEN|PHONE|INTERCOM)/.test(upper)) return true;
  if (/\(V\.?O\.\)|\(O\.?S\.\)|\(O\.?C\.\)/.test(upper)) return false; // V.O./O.S. = real character
  return false;
}

// ─── Standalone Parse (Mode B) ──────────────────────────────────────────────

/**
 * Full deterministic parse using regex patterns.
 * Used when no API key is available or AI call failed.
 */
export function deterministicParse(
  scriptText: string,
  projectType: ProjectType,
): UnifiedParseResult {
  const startTime = Date.now();
  const effectiveType = detectFormat(scriptText, projectType);
  const patterns = getPatternsForType(effectiveType);
  const warnings: string[] = [];
  const sourceHash = computeSourceHashSync(scriptText);

  const lines = scriptText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Accumulators
  const pages: ParsedPage[] = [];
  const characterMap = new Map<string, { count: number; pages: Set<number>; firstPage: number; description?: string }>();
  const loreMap = new Map<string, { category: LoreCategory; description: string; pages: Set<number>; confidence: number }>();
  const timeline: ParsedTimelineEvent[] = [];

  let currentPageNumber = 0;
  let currentPanels: ParsedPanel[] = [];
  let currentPanelNumber = 0;
  let currentBlocks: Block[] = [];
  let pendingDialogueSpeaker: string | null = null;

  // ── Helper: save current panel ───────────────────────────────────────��─
  const savePanel = () => {
    if (currentPanelNumber > 0 && currentBlocks.length > 0) {
      // Detect visual marker from blocks
      let visualMarker: string | undefined;
      for (const block of currentBlocks) {
        if (patterns.visualMarkers) {
          const markerMatch = block.text.match(patterns.visualMarkers);
          if (markerMatch) {
            visualMarker = markerMatch[1].toLowerCase();
            break;
          }
        }
      }

      currentPanels.push({
        panel_number: currentPanelNumber,
        blocks: [...currentBlocks],
        visual_marker: visualMarker,
      });
    }
    currentBlocks = [];
    pendingDialogueSpeaker = null;
  };

  // ── Helper: save current page ──────────────────────────────────────────
  const savePage = () => {
    savePanel();
    if (currentPageNumber > 0 && currentPanels.length > 0) {
      pages.push({
        page_number: currentPageNumber,
        panels: [...currentPanels],
      });
    }
    currentPanels = [];
  };

  // ── Helper: track character ────────────────────────────────────────────
  const trackCharacter = (name: string) => {
    const normalized = name.trim().toUpperCase();
    if (isNoiseWord(normalized) || normalized.length < 2) return;

    const existing = characterMap.get(normalized);
    if (existing) {
      existing.count++;
      if (currentPageNumber > 0) existing.pages.add(currentPageNumber);
    } else {
      const pagesSet = new Set<number>();
      if (currentPageNumber > 0) pagesSet.add(currentPageNumber);
      characterMap.set(normalized, {
        count: 1,
        pages: pagesSet,
        firstPage: currentPageNumber || 1,
      });
    }
  };

  // ── Main line-by-line parse ────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      pendingDialogueSpeaker = null;
      continue;
    }

    // Skip ignored lines
    if (patterns.ignore.test(trimmed) && trimmed.length > 0) {
      // Only skip if the ignore pattern is not just whitespace check
      if (trimmed.length > 0 && /^(FADE|CUT|DISSOLVE|CONTINUED|SMASH CUT|MATCH CUT|\(CONTINUED\))/.test(trimmed)) {
        continue;
      }
    }

    // Check for page break
    const pageMatch = trimmed.match(patterns.pageBreak);
    if (pageMatch) {
      savePage();
      // Extract page number - try numeric first, else increment
      const numStr = pageMatch[1];
      const parsed = parseInt(numStr, 10);
      currentPageNumber = isNaN(parsed) ? pages.length + 1 : parsed;
      currentPanelNumber = 0;

      // For screenplay/TV: extract location as lore
      if ((effectiveType === 'screenplay' || effectiveType === 'tv-series') && pageMatch[2]) {
        const locationName = pageMatch[2].replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS|LATER)\s*$/i, '').trim();
        if (locationName.length >= 3 && !loreMap.has(locationName.toUpperCase())) {
          loreMap.set(locationName.toUpperCase(), {
            category: 'location',
            description: locationName,
            pages: new Set([currentPageNumber]),
            confidence: 0.8,
          });
        }
      }
      continue;
    }

    // Check for panel break
    const panelMatch = trimmed.match(patterns.panelBreak);
    if (panelMatch && currentPageNumber > 0) {
      savePanel();
      const panelNumStr = panelMatch[1];
      const parsedPanel = parseInt(panelNumStr, 10);
      currentPanelNumber = isNaN(parsedPanel) ? currentPanels.length + 1 : parsedPanel;
      continue;
    }

    // If not in a panel yet but on a page, auto-create panel 1
    if (currentPageNumber > 0 && currentPanelNumber === 0) {
      currentPanelNumber = 1;
    }

    // Only process content if we're inside a panel
    if (currentPanelNumber === 0) continue;

    // Check for thought bubble
    const thoughtMatch = trimmed.match(patterns.thought);
    if (thoughtMatch && thoughtMatch.length >= 3) {
      const speaker = thoughtMatch[1].trim().toUpperCase();
      const text = thoughtMatch[2].trim();
      if (!isNoiseWord(speaker)) {
        trackCharacter(speaker);
        currentBlocks.push({ type: 'THOUGHT', text, speaker });
        continue;
      }
    }

    // Check for caption
    const captionMatch = trimmed.match(patterns.caption);
    if (captionMatch) {
      const text = captionMatch[1] || captionMatch[0];
      currentBlocks.push({ type: 'CAPTION', text: text.replace(/^CAPTION\s*: \s*/i, '').trim() });
      continue;
    }

    // Check for SFX
    const sfxMatch = trimmed.match(patterns.sfx);
    if (sfxMatch) {
      const text = sfxMatch[1] || sfxMatch[0];
      currentBlocks.push({ type: 'SFX', text: text.trim() });
      continue;
    }

    // Check for artist note
    if (patterns.artNote.test(trimmed)) {
      currentBlocks.push({ type: 'ART_NOTE', text: trimmed.replace(/^\[|\]$/g, '').trim() });
      continue;
    }

    // Check for dialogue
    const dialogueMatch = trimmed.match(patterns.dialogue);
    if (dialogueMatch) {
      const speaker = dialogueMatch[1].trim().toUpperCase();
      const text = dialogueMatch[2] ? dialogueMatch[2].trim() : '';

      if (!isNoiseWord(speaker)) {
        trackCharacter(speaker);

        if (text) {
          // Inline dialogue (SPEAKER: text)
          currentBlocks.push({ type: 'DIALOGUE', text, speaker });
        } else {
          // Speaker on own line, dialogue follows (screenplay style)
          pendingDialogueSpeaker = speaker;
        }
        continue;
      }
    }

    // Check for pending dialogue continuation
    if (pendingDialogueSpeaker && (line.startsWith('  ') || line.startsWith('\t'))) {
      trackCharacter(pendingDialogueSpeaker);
      currentBlocks.push({ type: 'DIALOGUE', text: trimmed, speaker: pendingDialogueSpeaker });
      continue;
    }

    // Check for location indicators in description lines
    if (hasLocationIndicator(trimmed) && trimmed.length <= 60) {
      const locName = trimmed.replace(/[.\-:]+$/, '').trim();
      if (locName.length >= 3 && !loreMap.has(locName.toUpperCase())) {
        loreMap.set(locName.toUpperCase(), {
          category: 'location',
          description: locName,
          pages: new Set([currentPageNumber]),
          confidence: 0.6,
        });
      }
    }

    // Check for faction/organization keywords in ALL-CAPS phrases
    const capsMatches = Array.from(trimmed.matchAll(/\b([A-Z][A-Z\s'.\-]{2,49})\b/g));
    for (const match of capsMatches) {
      const phrase = match[1].trim();
      if (!isNoiseWord(phrase) && !hasLocationIndicator(phrase) && hasFactionKeyword(phrase)) {
        const key = phrase.toUpperCase();
        if (!loreMap.has(key) && phrase.length >= 3 && phrase.length <= 60) {
          loreMap.set(key, {
            category: 'faction',
            description: phrase,
            pages: new Set([currentPageNumber]),
            confidence: 0.7,
          });
        }
      }
    }

    // Check for item interactions: action verb followed by a significant object keyword
    const lowerTrimmed = trimmed.toLowerCase();
    for (const verb of ITEM_ACTION_VERBS) {
      const verbIdx = lowerTrimmed.indexOf(verb);
      if (verbIdx !== -1) {
        const afterVerb = trimmed.substring(verbIdx + verb.length);
        const words = afterVerb.split(/\s+/);
        for (let wi = 0; wi < Math.min(words.length, 6); wi++) {
          const word = words[wi].replace(/[^A-Za-z]/g, '').toUpperCase();
          if (ITEM_OBJECT_KEYWORDS.has(word)) {
            // Include optional preceding adjective modifier (skip articles)
            const prevWord = wi > 0 ? words[wi - 1].replace(/[^A-Za-z]/g, '') : '';
            const useModifier = prevWord && !ARTICLE_WORDS.has(prevWord.toLowerCase());
            const itemName = (useModifier ? prevWord + ' ' : '') + words[wi].replace(/[^A-Za-z]/g, '');
            const cleanName = itemName.trim();
            const key = cleanName.toUpperCase();
            if (cleanName.length >= 3 && !loreMap.has(key)) {
              loreMap.set(key, {
                category: 'item',
                description: cleanName,
                pages: new Set([currentPageNumber]),
                confidence: 0.75,
              });
            }
            break;
          }
        }
        break; // Only process the first matching verb per line
      }
    }

    // Extract timeline years (4-digit years in range 2000-2199)
    const yearMatches = Array.from(trimmed.matchAll(/\b(2[0-1]\d{2})\b/g));
    for (const ym of yearMatches) {
      const year = parseInt(ym[1], 10);
      if (!timeline.some(t => t.name === 'Year ' + year)) {
        timeline.push({
          name: 'Year ' + year,
          description: trimmed.substring(0, 100),
          page: currentPageNumber,
          characters_involved: [],
        });
      }
    }

    // Default: treat as description / art note
    if (trimmed.length > 0) {
      pendingDialogueSpeaker = null;
      currentBlocks.push({ type: 'ART_NOTE', text: trimmed });
    }
  }

  // Save final page
  savePage();

  // ── Build characters array ─────────────────────────────────────────────
  const characters: ParsedCharacter[] = Array.from(characterMap.entries())
    .filter(([name, data]) => data.count > 0 && !isNonCharacterName(name))
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, data]) => ({
      name,
      pages_present: Array.from(data.pages).sort((a, b) => a - b),
      first_appearance_page: data.firstPage,
      lines_count: data.count,
      description: data.description,
    }));

  // ── Build lore array ───────────────────────────────────────────────────
  const lore: ParsedLoreEntry[] = Array.from(loreMap.entries()).map(([, data]) => ({
    name: data.description,
    category: data.category,
    description: data.description,
    pages: Array.from(data.pages).sort((a, b) => a - b),
    confidence: data.confidence,
  }));

  // ── Validation warnings ────────────────────────────────────────────────
  if (pages.length === 0) {
    warnings.push('No pages detected. Check that script uses recognized page/scene headers.');
  }
  if (characters.length === 0) {
    warnings.push('No characters detected. Check that dialogue follows NAME: text format.');
  }

  return {
    source_hash: sourceHash,
    project_type: effectiveType,
    warnings,
    pages,
    characters,
    lore,
    timeline,
    parser_source: 'deterministic',
    parse_duration_ms: Date.now() - startTime,
  };
}

// ─── Enrichment (Mode A) ────────────────────────────────────────────────────

/**
 * Validates AI output against the raw script and fills gaps.
 * Runs after a successful AI parse to cross-check and enrich.
 */
export function enrichParseResult(
  aiResult: UnifiedParseResult,
  scriptText: string,
  projectType: ProjectType,
): UnifiedParseResult {
  const warnings = [...aiResult.warnings];
  const effectiveType = detectFormat(scriptText, projectType);
  const patterns = getPatternsForType(effectiveType);

  // Run a lightweight deterministic pass to get ground truth
  const deterministicResult = deterministicParse(scriptText, projectType);

  // ── 1. Validate page/panel counts ──────────────────────────────────────
  if (deterministicResult.pages.length > 0 && aiResult.pages.length > 0) {
    const aiPageCount = aiResult.pages.length;
    const detPageCount = deterministicResult.pages.length;
    if (Math.abs(aiPageCount - detPageCount) > 2) {
      warnings.push(
        'Page count mismatch: AI found ' + aiPageCount + ' pages, deterministic found ' + detPageCount + '.',
      );
    }
  }

  // ── 2. Find characters the AI missed ───────────────────────────────────
  const aiCharNamesArray = aiResult.characters.map(c => c.name.toUpperCase());
  const missedCharacters: ParsedCharacter[] = [];

  for (const detChar of deterministicResult.characters) {
    const detName = detChar.name.toUpperCase();

    // Check if exact match OR substring match (e.g. "JOHN" vs "JOHN DOE")
    const isDuplicateOrSubstring = aiCharNamesArray.some(aiName =>
      aiName === detName || aiName.includes(detName) || detName.includes(aiName)
    );

    if (!isDuplicateOrSubstring && detChar.lines_count >= 2) {
      missedCharacters.push(detChar);
      warnings.push('AI missed character: ' + detChar.name + ' (added by deterministic pass).');
    }
  }

  const mergedCharacters = [...aiResult.characters, ...missedCharacters];

  // ── 2b. Filter out non-character speakers ────────────────────────────────
  const filteredCharacters = mergedCharacters.filter(char => {
    if (isNonCharacterName(char.name)) {
      warnings.push('Filtered non-character: "' + char.name + '"');
      return false;
    }
    return true;
  });

  // ── 3. Cross-check lines_count ─────────────────────────────────────────
  const detCharMap = new Map(deterministicResult.characters.map(c => [c.name.toUpperCase(), c]));

  for (const aiChar of filteredCharacters) {
    const detChar = detCharMap.get(aiChar.name.toUpperCase());
    if (detChar) {
      // If AI's count is wildly different, prefer deterministic
      if (detChar.lines_count > 0 && Math.abs(aiChar.lines_count - detChar.lines_count) > detChar.lines_count * 0.5) {
        warnings.push(
          'lines_count corrected for ' + aiChar.name + ': AI said ' + aiChar.lines_count + ', deterministic found ' + detChar.lines_count + '.',
        );
        aiChar.lines_count = detChar.lines_count;
      }

      // Merge pages_present
      const combinedPages = new Set([...aiChar.pages_present, ...detChar.pages_present]);
      aiChar.pages_present = Array.from(combinedPages).sort((a, b) => a - b);

      // Fix first_appearance_page if needed
      if (aiChar.pages_present.length > 0) {
        aiChar.first_appearance_page = aiChar.pages_present[0];
      }
    }
  }

  // ── 4. Add visual markers the AI missed ────────────────────────────────
  if (patterns.visualMarkers) {
    for (const page of aiResult.pages) {
      for (const panel of page.panels) {
        if (!panel.visual_marker) {
          // Check all blocks for visual marker text
          for (const block of panel.blocks) {
            const markerMatch = block.text.match(patterns.visualMarkers);
            if (markerMatch) {
              panel.visual_marker = markerMatch[1].toLowerCase();
              break;
            }
          }
        }
      }
    }
  }

  // ── 5. Merge lore entries ──────────────────────────────────────────────
  const aiLoreCategories = new Set(aiResult.lore.map(l => l.category));
  const additionalLore: ParsedLoreEntry[] = [];

  // If the AI found a healthy, diverse set of lore, trust it and skip deterministic lore.
  // This prevents the deterministic parser from flooding the results with locations.
  const hasGoodAiLore = aiLoreCategories.size >= 2;

  if (!hasGoodAiLore) {
    for (const detLore of deterministicResult.lore) {
      const detName = detLore.name.toUpperCase();

      // Type-aware duplicate check: only consider same-category entries as potential duplicates
      const isDuplicateOrSubstring = aiResult.lore.some(aiLore => {
        if (aiLore.category !== detLore.category) return false;
        const aiName = aiLore.name.toUpperCase();
        return aiName === detName || aiName.includes(detName) || detName.includes(aiName);
      });

      // Only add deterministic lore if it's not a duplicate AND it fills a category the AI missed
      if (!isDuplicateOrSubstring && !aiLoreCategories.has(detLore.category)) {
        additionalLore.push(detLore);
        warnings.push(`AI missed lore category '${detLore.category}': added ${detLore.name} from deterministic pass.`);
      }
    }
  } else {
    warnings.push('AI found diverse lore; skipped deterministic lore enrichment to prevent dilution.');
  }

  const mergedLore = [...aiResult.lore, ...additionalLore];

  // ── 5b. Check lore category diversity ────────────────────────────────────
  const loreCategories = new Set(mergedLore.map(l => l.category));
  if (loreCategories.size < 3 && mergedLore.length > 0) {
    warnings.push(
      'Low lore diversity: only ' + loreCategories.size + ' categories found (' +
      Array.from(loreCategories).join(', ') + '). Expected 4+.'
    );
  }

  // ── 6. Merge timeline events ───────────────────────────────────────────
  const aiTimelineNames = new Set(aiResult.timeline.map(t => t.name));
  const additionalTimeline: ParsedTimelineEvent[] = [];

  for (const detEvent of deterministicResult.timeline) {
    if (!aiTimelineNames.has(detEvent.name)) {
      additionalTimeline.push(detEvent);
    }
  }

  const mergedTimeline = [...aiResult.timeline, ...additionalTimeline];

  // ── Assemble enriched result ───────────────────────────────────────────
  return {
    ...aiResult,
    warnings,
    characters: filteredCharacters,
    lore: mergedLore,
    timeline: mergedTimeline,
    parser_source: 'ai+deterministic',
  };
}