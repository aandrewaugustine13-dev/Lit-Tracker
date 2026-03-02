// =============================================================================
// AI PARSER — Single LLM call, format-aware prompt, UnifiedParseResult output
// =============================================================================
// Replaces: src/utils/scriptParser.ts (parseScriptWithLLM)
// Uses the existing api/llm-proxy.ts for provider routing.
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

// ─── Default Models (mirrors api/llm-proxy.ts) ──────────────────────────────

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
  grok: 'grok-2-latest',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
};

// ─── Options ─────────────────────────────────────────────────────────────────

export interface AiParseOptions {
  existingCharacters?: string[];  // Names to not re-extract
  canonLocks?: string[];          // Entities to not modify
}

// ─── Format Context Prompts ──────────────────────────────────────────────────
// Each project type gets a format-specific section injected into the prompt.

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

function buildPrompt(
  projectType: ProjectType,
  options?: AiParseOptions,
): string {
  // CONSTANT section
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
A character is a PERSON or SENTIENT BEING who acts in the story. The following are NOT characters and must NEVER appear in the characters[] array:
- Signs, placards, banners, graffiti, written text (use CRAWLER or CAPTION block type instead)
- Radio broadcasts, TV news, intercoms, PA systems, phone recordings (use CRAWLER block type with meta.source)
- Newspapers, letters, documents being read (use CAPTION block type)
- Sound effects, environmental noises (use SFX block type)
- Unnamed crowds, groups chanting (use CAPTION with meta.source = "crowd")

When non-character sources "speak," use the appropriate block type (CRAWLER, CAPTION, SFX) — NOT DIALOGUE. Only actual characters get DIALOGUE blocks with a speaker field.

QUALITY CHECKLIST — MANDATORY (verify before responding):
□ Every page in the script has a corresponding page object
□ Every panel/scene beat has a corresponding panel object
□ Every speaking character appears in the characters[] array
□ Only actual people/beings are in characters[] (no signs, radios, TVs)
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

  // Existing entities to skip
  if (options?.existingCharacters?.length) {
    prompt += '\n\nALREADY TRACKED CHARACTERS (do not re-extract, but include in characters_involved if relevant):\n' + options.existingCharacters.map(n => '- ' + n).join('\n');
  }

  if (options?.canonLocks?.length) {
    prompt += '\n\nCANON-LOCKED ENTITIES (do not modify these names or descriptions):\n' + options.canonLocks.map(n => '- ' + n).join('\n');
  }

  // FORMAT CONTEXT section
  prompt += '\n\n' + FORMAT_CONTEXTS[projectType];

  // OUTPUT SCHEMA section
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

  return prompt;
}

// ─── Source Hash ──────────────────────────────────────────────────────────────

async function computeSourceHash(text: string): Promise<string> {
  // Use SubtleCrypto if available (browser + modern Node), else simple fallback
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Simple DJB2 fallback for environments without SubtleCrypto
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ─── LLM Call via Proxy ──────────────────────────────────────────────────────
// Reuses the existing api/llm-proxy.ts Vercel function.

async function callLLM(
  prompt: string,
  scriptText: string,
  provider: LLMProvider,
  apiKey: string,
): Promise<string> {
  const model = DEFAULT_MODELS[provider];

  // Browser-compatible providers can be called directly
  if (provider === 'gemini') {
    return callGeminiDirect(prompt, scriptText, apiKey, model);
  }
  if (provider === 'anthropic') {
    return callAnthropicDirect(prompt, scriptText, apiKey, model);
  }

  // All other providers go through the Vercel proxy to avoid CORS
  const response = await fetch('/api/llm-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      apiKey,
      model,
      prompt,
      script: scriptText,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error('LLM proxy error (' + provider + '): ' + response.status + ' - ' + errorBody);
  }

  const data = await response.json();
  if (data.error) throw new Error('LLM proxy returned error: ' + data.error);
  return data.text;
}

// ─── Direct Provider Calls (browser-compatible) ──────────────────────────────

async function callGeminiDirect(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
): Promise<string> {
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
  return data.candidates[0].content.parts[0].text;
}

async function callAnthropicDirect(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
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

// ─── Response Cleaning ───────────────────────────────────────────────────────

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

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

/**
 * Validates and repairs the raw LLM JSON into a well-formed UnifiedParseResult.
 * Non-critical issues are repaired and logged as warnings.
 * Throws only if pages[] is empty or fundamentally malformed.
 */
function validateAndRepair(
  raw: Record<string, unknown>,
  projectType: ProjectType,
  sourceHash: string,
  aiModel: string,
  warnings: string[],
): UnifiedParseResult {
  // ── Pages ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPages: any[] = Array.isArray(raw.pages) ? raw.pages : [];
  if (rawPages.length === 0) {
    throw new Error('AI parse produced empty pages array - cannot recover.');
  }

  const seenPageNumbers = new Set<number>();
  const pages: ParsedPage[] = [];

  for (const rp of rawPages) {
    const pageNum = typeof rp.page_number === 'number' ? rp.page_number : pages.length + 1;

    if (seenPageNumbers.has(pageNum)) {
      warnings.push('Duplicate page_number ' + pageNum + ' - skipping duplicate.');
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
        warnings.push('Page ' + pageNum + ': duplicate panel_number ' + panelNum + ' - skipping.');
        continue;
      }
      seenPanelNumbers.add(panelNum);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawBlocks: any[] = Array.isArray(rpnl.blocks) ? rpnl.blocks : [];
      const blocks: Block[] = [];

      for (const rb of rawBlocks) {
        const blockType: BlockType = VALID_BLOCK_TYPES.has(rb.type) ? rb.type : 'OTHER';
        if (!VALID_BLOCK_TYPES.has(rb.type)) {
          warnings.push('Page ' + pageNum + ' Panel ' + panelNum + ': unknown block type "' + rb.type + '" mapped to OTHER');
        }

        const text = typeof rb.text === 'string' ? rb.text : '';
        const speaker = typeof rb.speaker === 'string' ? rb.speaker : undefined;

        // Validate speaker requirement
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

  // ── Characters ─────────────────────────────────────────────────────────
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

  if (characters.length === 0) {
    warnings.push('AI returned no characters - deterministic pass should fill these.');
  }

  // ── Lore ───────────────────────────────────────────────────────────────
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
    warnings.push('AI returned no lore entries - deterministic pass should extract these.');
  }

  // ── Timeline ───────────────────────────────────────────────────────────
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

  // ── Assemble ───────────────────────────────────────────────────────────
  return {
    source_hash: sourceHash,
    project_type: projectType,
    warnings,
    pages,
    characters,
    lore,
    timeline,
    parser_source: 'ai',
    ai_model: aiModel,
  };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Parse a script using a single LLM call with a format-aware prompt.
 * Returns UnifiedParseResult — the single contract all downstream code consumes.
 */
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

  // Build the format-aware prompt
  const prompt = buildPrompt(projectType, options);

  // Single LLM call
  const rawText = await callLLM(prompt, scriptText, provider, apiKey);

  // Clean response
  const cleanedText = stripMarkdownFences(rawText);

  // Parse JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    throw new Error(
      'AI response is not valid JSON. First 300 chars: ' + cleanedText.substring(0, 300),
    );
  }

  // Validate + repair
  const result = validateAndRepair(parsed, projectType, sourceHash, aiModel, warnings);

  // Attach timing
  result.parse_duration_ms = Date.now() - startTime;

  return result;
}
