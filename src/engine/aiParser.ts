// =============================================================================
// AI PARSER — Fresh rewrite. Single LLM call, format-aware prompt.
// =============================================================================
// Exports: aiParse, LLMProvider, AiParseOptions
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
} from './parserPipeline.types';

// ─── LLM Provider Type ──────────────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'gemini' | 'openai' | 'grok' | 'deepseek' | 'groq';

// ─── Default Models ─────────────────────────────────────────────────────────

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  grok: 'grok-2-latest',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
};

// ─── Options ─────────────────────────────────────────────────────────────────

export interface AiParseOptions {
  existingCharacters?: string[];
  canonLocks?: string[];
  extractionOnly?: boolean;
}

// ─── Format Context Prompts ──────────────────────────────────────────────────

const FORMAT_CONTEXTS: Record<ProjectType, string> = {
  comic: `
FORMAT: Comic book script.
STRUCTURE RULES:
- "PAGE X" headers define pages
- "Panel Y" or "PANEL Y" headers define panels within pages
- [ECHO], [HITCH], [OVERFLOW], [SHATTERED] are visual markers — preserve in visual_marker field
- ALL-CAPS NAME followed by colon = dialogue
- Artist notes in brackets or after "ARTIST NOTE:" = ART_NOTE blocks
- CAPTION: lines = CAPTION blocks
- SFX: lines = SFX blocks
- Panel numbering is PER-PAGE (resets each page)
CRITICAL: Count every PAGE and every Panel. Missing panels = parse failure.`,

  screenplay: `
FORMAT: Screenplay (film/TV feature).
STRUCTURE RULES:
- INT./EXT. slug lines define new scenes. Each scene = one page in output.
- Action/description paragraphs = ART_NOTE blocks (one block per paragraph)
- CHARACTER NAME (centered, all caps) followed by dialogue = DIALOGUE block
- Parentheticals (wryly), (beat), (O.S.), (V.O.) go in block meta
- FADE IN/OUT, CUT TO, DISSOLVE = ignore (transition markers, not content)
- Break long scenes into logical panels: each distinct beat of action = one panel
- (V.O.) and (O.S.) dialogue still gets a speaker
CRITICAL: Preserve ALL dialogue. Every speaking character must appear in characters[].`,

  'stage-play': `
FORMAT: Stage play.
STRUCTURE RULES:
- ACT/SCENE headers define pages (ACT I SCENE 1 = page 1, etc.)
- Stage directions in italics or parentheses = ART_NOTE blocks
- CHARACTER NAME. followed by dialogue = DIALOGUE block
- Stage directions embedded in dialogue (He crosses to the window) = ART_NOTE
- Entrances/exits are ART_NOTE blocks
- Break scenes into panels at natural beats: entrances, exits, major action shifts
CRITICAL: Stage plays are dialogue-heavy. Extract ALL lines.`,

  'tv-series': `
FORMAT: TV series episode.
STRUCTURE RULES:
- COLD OPEN, ACT ONE, etc. are act markers — each act = one page group
- INT./EXT. slug lines within acts define scenes
- Each scene = one page. Panels = beats within scene.
- Same dialogue rules as screenplay
- SMASH CUT, MATCH CUT = ignore
- (CONTINUED) = ignore
- TEASER and TAG sections are valid act markers
CRITICAL: Preserve act structure. Note act breaks in page metadata.`,
};

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildPrompt(projectType: ProjectType, options?: AiParseOptions): string {
  let prompt = `You are a script parser for Lit-Tracker. You perform a strict two-phase process.

PHASE 1: READ AND COMPREHEND
Read the entire script. Identify:
- All characters (names, roles, relationships)
- The central conflict and themes
- All settings/locations
- Significant objects, factions, concepts, rules
- The narrative arc and key events

PHASE 2: EXTRACT STRUCTURED DATA
Using your full comprehension, extract every piece of data into the JSON schema below. Do not skip anything.

CHARACTER RULES — READ CAREFULLY:
A character is a PERSON (or sentient being) who SPEAKS DIALOGUE TO OTHER CHARACTERS, MAKES DECISIONS, or PHYSICALLY ACTS in scenes. Apply this three-part test:
1. Does this entity have a BODY? (Can it walk, sit, gesture, make facial expressions?)
2. Does it speak TO another character in conversation?
3. Is it described with an age, appearance, or personality?
If the answer to ALL THREE is no, it is NOT a character.

The following are NEVER characters — do NOT put them in the characters[] array:
- Scene headings: INT., EXT., or any line starting with INT/EXT (these are LOCATIONS)
- Page/panel markers: PAGE, PANEL, PAGES, or any structural formatting labels
- On-screen text: NOTIFICATION, SCREEN, DISPLAY, MONITOR, SIGN, SIGN ON STAGE, BANNER, POSTER, MARQUEE, CHYRON
- File/data labels: FILE, FILE INFO, FOLDER, SEARCH, RESULT, QUERY, LOG, METADATA
- UI elements: CAPTION, CRAWL, CRAWLER, NOTIFICATION, POPUP, ALERT
- Environmental text: SIGN, PLACARD, GRAFFITI, BILLBOARD
- Audio sources without a body: VOICE (when disembodied/from a recording), RADIO, TV, PA, INTERCOM, BROADCAST, RECORDING, VOICEMAIL, ANNOUNCEMENT
- Groups: CROWD, CHORUS, ALL, EVERYONE, VOICES, MURMURS
- Formatting: NEXT, END, CONTINUED, SFX, SOUND, MUSIC
- Story markers: LOGLINE, NEXT (as in "NEXT ISSUE"), END ISSUE

A VENDOR calling out to customers IS a character (has a body, speaks to people).
A SIGN displaying text IS NOT a character (no body, doesn't converse).
A NOTIFICATION popup IS NOT a character (UI element, no body).
A VOICE from earbuds IS NOT a character unless identified as a specific person.
Scene headings like "EXT. CITY SQUARE" are LOCATIONS, never characters.

When in doubt: if you cannot describe what the entity LOOKS LIKE as a person, it is not a character.

When non-character sources "speak," use the appropriate block type (CRAWLER, CAPTION, SFX) — NOT DIALOGUE. Only actual characters get DIALOGUE blocks with a speaker field.

QUALITY CHECKLIST — MANDATORY (verify before responding):
□ Every character in characters[] passes the three-part test (body, speaks to others, described as a person)
□ NO scene headings (INT./EXT.), page markers, UI elements, signs, or file labels in characters[]
□ Characters[] count should be SMALL — most scripts have 3-8 real characters, rarely more than 12
□ Lore entries span AT LEAST 4 different categories
□ Timeline events cover the major story beats

LORE EXTRACTION RULES — THIS IS CRITICAL:
Returning only locations is FAILURE. Every script contains more than just places.

Expected minimum yield per category:
- 2-5 locations (settings, named places)
- 1-3 factions/organizations (any group, team, agency, order, crew)
- 1-3 events (battles, discoveries, deaths, meetings, rituals — past or present)
- 1-2 concepts (powers, abilities, phenomena, philosophies, technologies)
- 0-2 artifacts (named weapons, tools, relics, significant objects)
- 0-2 rules (world mechanics, constraints, established laws)
- 0-2 items (generic objects characters interact with)

COMMON LORE FAILURES TO AVOID:
✗ Only extracting locations — look at dialogue for faction mentions, event references
✗ Missing factions — if characters mention "the team," "the order," "the agency," that's a faction
✗ Missing events — references to past battles, deaths, meetings, discoveries are events
✗ Missing concepts — if a character uses a power, ability, or technology, that's a concept
✗ Missing artifacts — if a character wields a named weapon or important object, that's an artifact
✗ Ignoring dialogue — organizations, events, and artifacts are often mentioned in conversation, not just action

MANDATORY: Before finalizing JSON, count your lore categories. If fewer than 4 different categories, go back and extract more.`;

  if (options?.existingCharacters?.length) {
    prompt += '\n\nALREADY TRACKED CHARACTERS (do not re-extract, but include in characters_involved if relevant):\n' + options.existingCharacters.map(n => '- ' + n).join('\n');
  }

  if (options?.canonLocks?.length) {
    prompt += '\n\nCANON-LOCKED ENTITIES (do not modify these names or descriptions):\n' + options.canonLocks.map(n => '- ' + n).join('\n');
  }

  prompt += '\n\n' + FORMAT_CONTEXTS[projectType];

  if (options?.extractionOnly) {
    prompt += `

OUTPUT SCHEMA — Output ONLY valid JSON matching this exact structure. No markdown fences. No commentary. No explanation. Just the JSON.

{
  "characters": [
    {
      "name": "...",
      "role": "Protagonist",
      "description": "...",
      "pages_present": [1, 3, 5],
      "first_appearance_page": 1,
      "lines_count": 42,
      "notable_quotes": ["...", "..."]
    }
  ],
  "lore": [
    {
      "name": "...",
      "category": "faction",
      "description": "...",
      "pages": [2, 7],
      "confidence": 0.9,
      "related_characters": ["Elias"],
      "metadata": {}
    }
  ],
  "timeline": [
    {
      "name": "...",
      "description": "...",
      "page": 3,
      "characters_involved": ["Elias", "Maya"]
    }
  ]
}

DO NOT include a "pages" array. Only extract characters, lore, and timeline.

Valid lore categories: faction, location, event, concept, artifact, rule, item
Valid character roles: Protagonist, Antagonist, Supporting, Minor

Now parse this script:`;
  } else {
    prompt += `

OUTPUT SCHEMA — Output ONLY valid JSON matching this exact structure. No markdown fences. No commentary. No explanation. Just the JSON.

{
  "pages": [
    {
      "page_number": 1,
      "panels": [
        {
          "panel_number": 1,
          "blocks": [
            { "type": "ART_NOTE", "text": "..." },
            { "type": "DIALOGUE", "text": "...", "speaker": "CHARACTER" },
            { "type": "SFX", "text": "..." }
          ],
          "visual_marker": "echo",
          "aspect_hint": "wide"
        }
      ]
    }
  ],
  "characters": [
    {
      "name": "...",
      "role": "Protagonist",
      "description": "...",
      "pages_present": [1, 3, 5],
      "first_appearance_page": 1,
      "lines_count": 42,
      "notable_quotes": ["...", "..."]
    }
  ],
  "lore": [
    {
      "name": "...",
      "category": "faction",
      "description": "...",
      "pages": [2, 7],
      "confidence": 0.9,
      "related_characters": ["Elias"],
      "metadata": {}
    }
  ],
  "timeline": [
    {
      "name": "...",
      "description": "...",
      "page": 3,
      "characters_involved": ["Elias", "Maya"]
    }
  ]
}

Valid block types: ART_NOTE, DIALOGUE, CAPTION, NARRATOR, SFX, THOUGHT, CRAWLER, TITLE_CARD, OTHER
Valid lore categories: faction, location, event, concept, artifact, rule, item
Valid character roles: Protagonist, Antagonist, Supporting, Minor

Now parse this script:`;
  }

  return prompt;
}

// ─── Source Hash ──────────────────────────────────────────────────────────────

async function computeSourceHash(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// =============================================================================
// LLM CALLS — Each provider gets its own function
// =============================================================================

async function callGeminiDirect(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
): Promise<string> {
  console.log('[aiParser] Calling Gemini directly:', model);

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + '\n\n' + script }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error('Gemini API error: ' + response.status + ' - ' + error);
  }

  const data = await response.json();

  // Diagnostic: log the response shape so we can debug if something changes
  const parts = data.candidates?.[0]?.content?.parts;
  console.log('[aiParser] Gemini response:', JSON.stringify({
    candidateCount: data.candidates?.length,
    partsCount: parts?.length,
    partSummary: parts?.map((p: any, i: number) => ({
      index: i,
      hasText: !!p.text,
      isThought: !!p.thought,
      textLen: p.text?.length ?? 0,
    })),
  }));

  if (!parts || parts.length === 0) {
    throw new Error('Gemini returned no content parts');
  }

  // Gemini 2.5+ is a thinking model. When responseMimeType is set to
  // 'application/json', thinking is typically suppressed in the output.
  // But we handle it defensively in case thoughts leak through:
  // find all non-thought text parts, take the last one.
  const nonThoughtTextParts = parts.filter((p: any) => p.text && !p.thought);
  if (nonThoughtTextParts.length > 0) {
    return nonThoughtTextParts[nonThoughtTextParts.length - 1].text;
  }

  // Fallback: grab the last part that has any text at all
  const anyTextParts = parts.filter((p: any) => p.text);
  if (anyTextParts.length > 0) {
    return anyTextParts[anyTextParts.length - 1].text;
  }

  throw new Error('Gemini returned parts but none contained text');
}

async function callAnthropicDirect(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
): Promise<string> {
  console.log('[aiParser] Calling Anthropic directly:', model);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16384,
      messages: [{ role: 'user', content: prompt + '\n\n' + script }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('Anthropic API error: ' + response.status + ' - ' + error);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callViaProxy(
  prompt: string,
  script: string,
  provider: LLMProvider,
  apiKey: string,
  model: string,
): Promise<string> {
  console.log('[aiParser] Calling via proxy:', provider, model);

  const response = await fetch('/api/llm-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey, model, prompt, script }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error('LLM proxy error (' + provider + '): ' + response.status + ' - ' + errorBody);
  }

  const data = await response.json();
  if (data.error) throw new Error('LLM proxy returned error: ' + data.error);
  return data.text;
}

// ─── Router ──────────────────────────────────────────────────────────────────

async function callLLM(
  prompt: string,
  scriptText: string,
  provider: LLMProvider,
  apiKey: string,
): Promise<string> {
  const model = DEFAULT_MODELS[provider];

  if (provider === 'gemini') {
    return callGeminiDirect(prompt, scriptText, apiKey, model);
  }
  if (provider === 'anthropic') {
    return callAnthropicDirect(prompt, scriptText, apiKey, model);
  }

  return callViaProxy(prompt, scriptText, provider, apiKey, model);
}

// ─── Response Cleaning ───────────────────────────────────────────────────────

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();

  // Strip ```json ... ``` wrapping
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }

  // Strip any leading non-JSON preamble text
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0 && firstBrace < 100) {
    cleaned = cleaned.substring(firstBrace);
  }

  return cleaned.trim();
}

// ─── Validation Constants ────────────────────────────────────────────────────

const VALID_BLOCK_TYPES: Set<string> = new Set([
  'ART_NOTE', 'DIALOGUE', 'CAPTION', 'NARRATOR', 'SFX',
  'THOUGHT', 'CRAWLER', 'TITLE_CARD', 'OTHER',
]);

const VALID_LORE_CATEGORIES: Set<string> = new Set([
  'faction', 'location', 'event', 'concept', 'artifact', 'rule', 'item',
]);

const VALID_ROLES: Set<string> = new Set([
  'Protagonist', 'Antagonist', 'Supporting', 'Minor',
]);

const SPEAKER_REQUIRED_TYPES: Set<string> = new Set(['DIALOGUE', 'THOUGHT']);

// ─── Character Filter ────────────────────────────────────────────────────────
// Two tiers:
//   1. Exact match for short/ambiguous words (safe, no false positives on names)
//   2. Word-boundary regex for compound names like "STREET SIGN", "TV SCREEN"

const NON_CHARACTER_EXACT = new Set([
  'TV', 'PA', 'AI', 'ALL', 'END', 'NEXT', 'LOG', 'NEWS',
  'VOICE', 'PHONE', 'SPEAKER', 'HORN', 'SYSTEM', 'DEVICE', 'GPS',
  'SONG', 'MUSIC', 'NARRATOR', 'TITLE', 'SUPER',
  'FILE', 'FOLDER', 'SEARCH', 'RESULT', 'QUERY', 'METADATA',
  'ANNOUNCEMENT', 'ANNOUNCER', 'ANSWERING',
  'UNKNOWN', 'CONTINUED',
  'SIGN ON STAGE', 'FILE INFO', 'SEARCH RESULT', 'PA SYSTEM', 'GPS VOICE',
  'TITLE CARD',
]);

const NON_CHARACTER_PATTERNS: RegExp[] = [
  /\bINT\b|\bEXT\b/i,
  /^PAGES?\s+\d/i,
  /^PANEL\s+\d/i,
  /^(END|NEXT|CONTINUED|LOGLINE)\b/i,
  /\b(SFX|SOUND EFFECT)\b/i,
  /\b(SIGN|BANNER|POSTER|PLACARD|GRAFFITI|BILLBOARD|MARQUEE|CHYRON)\b/i,
  /\b(SCREEN|DISPLAY|MONITOR|NOTIFICATION|POPUP|ALERT)\b/i,
  /\b(RADIO|TELEVISION|BROADCAST|INTERCOM|VOICEMAIL|RECORDING)\b/i,
  /^TV\b/i,
  /\b(COMPUTER|ALARM|SIREN|AUTOMATED)\b/i,
  /\b(CROWD|CHORUS|EVERYONE|VOICES|MURMURS|CHANT)\b/i,
  /\b(CAPTION|CRAWL|CRAWLER)\b/i,
];

function isNonCharacter(name: string): boolean {
  const upper = name.trim().toUpperCase();
  if (NON_CHARACTER_EXACT.has(upper)) return true;
  if (NON_CHARACTER_PATTERNS.some(p => p.test(upper))) return true;
  return false;
}

// ─── Validate & Repair ──────────────────────────────────────────────────────

function validateAndRepair(
  raw: Record<string, unknown>,
  projectType: ProjectType,
  sourceHash: string,
  aiModel: string,
  warnings: string[],
  extractionOnly?: boolean,
): UnifiedParseResult {

  // ── Pages ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPages: any[] = Array.isArray(raw.pages) ? raw.pages : [];
  if (rawPages.length === 0 && !extractionOnly) {
    throw new Error('AI parse produced empty pages array - cannot recover.');
  }

  const seenPageNumbers = new Set<number>();
  const pages: ParsedPage[] = [];

  for (const rp of rawPages) {
    const pageNum = typeof rp.page_number === 'number' ? rp.page_number : pages.length + 1;
    if (seenPageNumbers.has(pageNum)) {
      warnings.push('Duplicate page_number ' + pageNum + ' - skipping.');
      continue;
    }
    seenPageNumbers.add(pageNum);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPanels: any[] = Array.isArray(rp.panels) ? rp.panels : [];
    const seenPanelNumbers = new Set<number>();
    const panels: ParsedPanel[] = [];

    for (const rpnl of rawPanels) {
      const panelNum = typeof rpnl.panel_number === 'number' ? rpnl.panel_number : panels.length + 1;
      if (seenPanelNumbers.has(panelNum)) {
        warnings.push('Page ' + pageNum + ': duplicate panel ' + panelNum + ' - skipping.');
        continue;
      }
      seenPanelNumbers.add(panelNum);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawBlocks: any[] = Array.isArray(rpnl.blocks) ? rpnl.blocks : [];
      const blocks: Block[] = [];

      for (const rb of rawBlocks) {
        const blockType: BlockType = VALID_BLOCK_TYPES.has(rb.type) ? rb.type : 'OTHER';
        if (!VALID_BLOCK_TYPES.has(rb.type)) {
          warnings.push('Page ' + pageNum + ' Panel ' + panelNum + ': unknown block type "' + rb.type + '" → OTHER');
        }
        const text = typeof rb.text === 'string' ? rb.text : '';
        const speaker = typeof rb.speaker === 'string' ? rb.speaker : undefined;
        if (SPEAKER_REQUIRED_TYPES.has(blockType) && !speaker) {
          warnings.push('Page ' + pageNum + ' Panel ' + panelNum + ': ' + blockType + ' block missing speaker.');
        }
        blocks.push({
          type: blockType,
          text,
          speaker,
          meta: rb.meta && typeof rb.meta === 'object' ? rb.meta as Record<string, unknown> : undefined,
        });
      }

      panels.push({
        panel_number: panelNum,
        blocks,
        visual_marker: typeof rpnl.visual_marker === 'string' ? rpnl.visual_marker : undefined,
        aspect_hint: typeof rpnl.aspect_hint === 'string' ? rpnl.aspect_hint : undefined,
      });
    }

    pages.push({ page_number: pageNum, panels });
  }

  // ── Characters ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawChars: any[] = Array.isArray(raw.characters) ? raw.characters : [];
  const characters: ParsedCharacter[] = rawChars.map((rc) => ({
    name: typeof rc.name === 'string' ? rc.name : 'UNKNOWN',
    role: VALID_ROLES.has(rc.role as string)
      ? (rc.role as ParsedCharacter['role'])
      : undefined,
    description: typeof rc.description === 'string' ? rc.description : undefined,
    pages_present: Array.isArray(rc.pages_present)
      ? (rc.pages_present as unknown[]).filter((n): n is number => typeof n === 'number')
      : [],
    first_appearance_page: typeof rc.first_appearance_page === 'number' ? rc.first_appearance_page : 1,
    lines_count: typeof rc.lines_count === 'number' ? rc.lines_count : 0,
    notable_quotes: Array.isArray(rc.notable_quotes)
      ? (rc.notable_quotes as unknown[]).filter((q): q is string => typeof q === 'string').slice(0, 2)
      : undefined,
  }));

  const filteredCharacters = characters.filter(c => {
    if (isNonCharacter(c.name)) {
      warnings.push('Filtered non-character: "' + c.name + '"');
      return false;
    }
    return true;
  });

  if (filteredCharacters.length === 0) {
    warnings.push('AI returned no valid characters after filtering.');
  }

  // ── Lore ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLore: any[] = Array.isArray(raw.lore) ? raw.lore : [];
  const lore: ParsedLoreEntry[] = rawLore
    .filter((rl) => typeof rl.name === 'string' && typeof rl.description === 'string')
    .map((rl) => ({
      name: rl.name as string,
      category: VALID_LORE_CATEGORIES.has(rl.category as string)
        ? (rl.category as ParsedLoreEntry['category'])
        : 'concept' as const,
      description: rl.description as string,
      pages: Array.isArray(rl.pages)
        ? (rl.pages as unknown[]).filter((n): n is number => typeof n === 'number')
        : [],
      confidence: typeof rl.confidence === 'number' ? Math.max(0, Math.min(1, rl.confidence)) : 0.5,
      related_characters: Array.isArray(rl.related_characters)
        ? (rl.related_characters as unknown[]).filter((s): s is string => typeof s === 'string')
        : undefined,
      metadata: rl.metadata && typeof rl.metadata === 'object'
        ? rl.metadata as Record<string, unknown>
        : undefined,
    }));

  if (lore.length === 0) {
    warnings.push('AI returned no lore entries.');
  }

  // ── Timeline ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTimeline: any[] = Array.isArray(raw.timeline) ? raw.timeline : [];
  const timeline: ParsedTimelineEvent[] = rawTimeline
    .filter((rt) => typeof rt.name === 'string')
    .map((rt) => ({
      name: rt.name as string,
      description: typeof rt.description === 'string' ? rt.description : '',
      page: typeof rt.page === 'number' ? rt.page : 0,
      characters_involved: Array.isArray(rt.characters_involved)
        ? (rt.characters_involved as unknown[]).filter((s): s is string => typeof s === 'string')
        : [],
    }));

  // ── Assemble ──
  return {
    source_hash: sourceHash,
    project_type: projectType,
    warnings,
    pages,
    characters: filteredCharacters,
    lore,
    timeline,
    parser_source: 'ai',
    ai_model: aiModel,
  };
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

export async function aiParse(
  scriptText: string,
  projectType: ProjectType,
  provider: LLMProvider,
  apiKey: string,
  options?: AiParseOptions,
): Promise<UnifiedParseResult> {
  const startTime = Date.now();
  const sourceHash = await computeSourceHash(scriptText);
  const aiModel = DEFAULT_MODELS[provider];
  const warnings: string[] = [];

  console.log('[aiParse] Starting. Provider:', provider, 'Model:', aiModel, 'extractionOnly:', !!options?.extractionOnly);

  const prompt = buildPrompt(projectType, options);

  const rawText = await callLLM(prompt, scriptText, provider, apiKey);
  console.log('[aiParse] Raw response length:', rawText.length, '| First 200 chars:', rawText.substring(0, 200));

  const cleanedText = stripMarkdownFences(rawText);
  console.log('[aiParse] Cleaned length:', cleanedText.length, '| Starts with:', cleanedText.substring(0, 50));

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    throw new Error(
      'AI response is not valid JSON. First 300 chars: ' + cleanedText.substring(0, 300),
    );
  }

  console.log('[aiParse] JSON parsed. Keys:', Object.keys(parsed));

  const result = validateAndRepair(parsed, projectType, sourceHash, aiModel, warnings, options?.extractionOnly);
  result.parse_duration_ms = Date.now() - startTime;

  console.log('[aiParse] Done.', {
    characters: result.characters.length,
    lore: result.lore.length,
    timeline: result.timeline.length,
    pages: result.pages.length,
    warnings: result.warnings.length,
    ms: result.parse_duration_ms,
  });

  return result;
}
