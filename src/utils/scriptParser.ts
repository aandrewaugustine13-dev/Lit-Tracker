/**
 * Lit-Tracker LLM Script Parser (full rewrite)
 *
 * What changed in this rewrite:
 * - Preserved the existing provider call architecture (direct browser-compatible calls + proxy for CORS-blocked providers).
 * - Upgraded the normalization prompt to a strict two-phase contract:
 *   1) perfect comic panel extraction (119-panel target, global sequential panel numbering),
 *   2) deep, diverse lore + visual/ink analysis with explicit category coverage requirements.
 * - Added first-class Ink Tracker support via a new optional top-level key: `ink_elements`.
 * - Strengthened output validation/cleanup so malformed model responses are normalized safely
 *   while preserving rich metadata for lore and ink elements.
 */

// ============= INTERFACES =============

export interface ParsedScript {
  pages: Page[];
  characters: Character[];
  lore_candidates: LoreCandidate[];
  overall_lore_summary?: string;
  /** Optional comic-visual tracker payload for Ink Tracker. */
  ink_elements?: InkElement[];
}

export interface Page {
  page_number: number;
  panels: Panel[];
}

export interface Panel {
  /** Global sequential number across the whole script. */
  panel_number: number;
  description: string;
  dialogue: DialogueLine[];
  panel_id: string; // e.g. p12-panel57
}

export interface DialogueLine {
  character: string;
  text: string;
  type: 'spoken' | 'thought' | 'caption' | 'sfx';
}

export type LoreCategory =
  | 'location'
  | 'timeline'
  | 'echo'
  | 'uncategorized'
  | 'faction'
  | 'event'
  | 'concept'
  | 'artifact'
  | 'rule'
  | 'item'
  | 'character';

export interface LoreCandidate {
  text: string;
  category: LoreCategory;
  confidence: number; // 0.0-1.0
  panels: string[]; // panel_ids where this appears
  description?: string;
  metadata?: Record<string, any>;
}

export interface Character {
  name: string;
  description?: string;
  panel_count: number;
}

export type InkElementType =
  | 'recurring_prop'
  | 'sfx_style'
  | 'color_philosophy'
  | 'visual_motif'
  | 'composition_pattern'
  | 'character_design_progression'
  | 'rendering_direction'
  | 'lettering_direction'
  | 'cinematic_language'
  | 'other';

export interface InkElement {
  name: string;
  type: InkElementType;
  confidence: number; // 0.0-1.0
  panels: string[];
  description: string;
  metadata?: Record<string, any>;
}

// ============= CONFIGURATION =============

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
  grok: 'grok-2-latest',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
};

// Providers that work directly from browser without proxy/CORS failures.
export const BROWSER_COMPATIBLE_PROVIDERS = ['gemini', 'anthropic'] as const;

// ============= NORMALIZATION PROMPT =============

export const NORMALIZATION_PROMPT = `You are an expert comic script parser for Lit-Tracker, a digital storyboard + lore + ink tracking tool.

You must execute a strict TWO-PHASE workflow. Both phases are mandatory.

PHASE 1 — PANEL EXTRACTION (NON-NEGOTIABLE, DO FIRST, DO PERFECTLY)
- Parse this as a comic script with explicit PAGE and Panel structure.
- This script targets 119 panels total. Output AT LEAST 119 panels if present in source; never summarize or collapse.
- Every "PAGE X" => one page object.
- Every "Panel Y" => one panel object.
- panel_number must be GLOBAL and sequential across the entire script.
- page_number must match PAGE headers.
- Build rich, production-grade panel descriptions by combining artist notes + visual direction.
- Parse ALL dialogue-bearing lines and assign type correctly:
  - spoken: character dialogue lines
  - caption: narrator/caption/crawler/screen text boxes
  - sfx: onomatopoeia / SFX cues
  - thought: only explicit thought bubble/internal thought text

PHASE 2 — DEEP LORE + INK ANALYSIS (DO AFTER PANELS ARE COMPLETE)
Extract comprehensive worldbuilding and visual-language data.

A) lore_candidates (must be diverse)
- You MUST return candidates across 5-8+ categories, not only locations.
- Allowed categories: location, faction, event, concept, artifact, rule, item, character, timeline, echo, uncategorized.
- Use high-quality descriptions and useful metadata (participants, ideology, consequences, origin, symbolism, region, date, etc.).

B) ink_elements (comic visual tracker)
Extract recurring visual/ink signals that matter for production continuity.
Include elements such as:
- recurring props/items (e.g., VIP wristband, Orb)
- SFX style language and typography patterns (e.g., EC-comics-inspired impact words)
- color philosophy and lighting cues (e.g., bioluminescence, decay palettes)
- character design progression states (e.g., staged decay progression)
- composition/camera grammar (repeated shot logic, framing motifs)
- rendering/lettering directives that recur

For each ink element include:
- name
- type (one of: recurring_prop, sfx_style, color_philosophy, visual_motif, composition_pattern, character_design_progression, rendering_direction, lettering_direction, cinematic_language, other)
- confidence (0-1)
- panels (panel_ids)
- description
- metadata (optional)

OUTPUT RULES
- Output ONLY valid JSON (no markdown, no commentary).
- Do not omit required top-level keys.
- Never return partial representative panels.

Return exactly this shape:
{
  "pages": [
    {
      "page_number": 1,
      "panels": [
        {
          "panel_number": 1,
          "description": "...",
          "dialogue": [
            { "character": "NARRATOR", "text": "...", "type": "caption" }
          ],
          "panel_id": "p1-panel1"
        }
      ]
    }
  ],
  "characters": [
    { "name": "...", "description": "...", "panel_count": 0 }
  ],
  "lore_candidates": [
    { "text": "...", "category": "artifact", "confidence": 0.9, "panels": ["p1-panel1"], "description": "...", "metadata": {} }
  ],
  "ink_elements": [
    { "name": "...", "type": "visual_motif", "confidence": 0.9, "panels": ["p1-panel1"], "description": "...", "metadata": {} }
  ],
  "overall_lore_summary": "..."
}

MANDATORY SELF-CHECK BEFORE RESPONDING
- Did I extract the full panel set (target: 119)?
- Are panel_number values global + sequential?
- Did I include 5-8+ lore categories (not just locations)?
- Did I include meaningful ink_elements for visual continuity?
- Is the response strict valid JSON only?

If any check fails, fix it before returning.

Now parse this script:`;

// ============= API CALL FUNCTIONS =============

async function callOpenAI(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: script },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
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
      messages: [{ role: 'user', content: `${prompt}\n\n${script}` }],
      temperature: 0.1,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;
  if (!content) {
    throw new Error('Anthropic returned empty content');
  }
  return content;
}

async function callGemini(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\n\n${script}` }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callGrok(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: script },
      ],
      temperature: 0.1,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callDeepSeek(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: script },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ============= HELPER FUNCTIONS =============

export function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampConfidence(value: unknown, fallback = 0.5): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function normalizeLoreCategory(value: unknown): LoreCategory {
  const allowed: LoreCategory[] = [
    'location',
    'timeline',
    'echo',
    'uncategorized',
    'faction',
    'event',
    'concept',
    'artifact',
    'rule',
    'item',
    'character',
  ];
  return allowed.includes(value as LoreCategory) ? (value as LoreCategory) : 'uncategorized';
}

function normalizeInkType(value: unknown): InkElementType {
  const allowed: InkElementType[] = [
    'recurring_prop',
    'sfx_style',
    'color_philosophy',
    'visual_motif',
    'composition_pattern',
    'character_design_progression',
    'rendering_direction',
    'lettering_direction',
    'cinematic_language',
    'other',
  ];
  return allowed.includes(value as InkElementType) ? (value as InkElementType) : 'other';
}

export function validateAndClean(data: unknown): ParsedScript {
  const root = isObject(data) ? data : {};

  const pagesRaw = Array.isArray(root.pages) ? root.pages : [];
  const pages: Page[] = pagesRaw.map((page, pageIdx) => {
    const p = isObject(page) ? page : {};
    const pageNumber = typeof p.page_number === 'number' ? p.page_number : pageIdx + 1;
    const panelsRaw = Array.isArray(p.panels) ? p.panels : [];

    const panels: Panel[] = panelsRaw.map((panel, panelIdx) => {
      const pn = isObject(panel) ? panel : {};
      const panelNumber = typeof pn.panel_number === 'number' ? pn.panel_number : panelIdx + 1;
      const dialogueRaw = Array.isArray(pn.dialogue) ? pn.dialogue : [];

      const dialogue: DialogueLine[] = dialogueRaw.map((entry) => {
        const d = isObject(entry) ? entry : {};
        const rawType = d.type;
        const normalizedType: DialogueLine['type'] =
          rawType === 'spoken' || rawType === 'thought' || rawType === 'caption' || rawType === 'sfx'
            ? rawType
            : 'spoken';

        return {
          character: String(d.character ?? 'UNKNOWN'),
          text: String(d.text ?? ''),
          type: normalizedType,
        };
      });

      return {
        panel_number: panelNumber,
        description: String(pn.description ?? ''),
        dialogue,
        panel_id: String(pn.panel_id ?? `p${pageNumber}-panel${panelNumber}`),
      };
    });

    return { page_number: pageNumber, panels };
  });

  const charactersRaw = Array.isArray(root.characters) ? root.characters : [];
  const characters: Character[] = charactersRaw.map((character) => {
    const c = isObject(character) ? character : {};
    return {
      name: String(c.name ?? 'UNKNOWN'),
      description: c.description == null ? undefined : String(c.description),
      panel_count: typeof c.panel_count === 'number' && c.panel_count >= 0 ? c.panel_count : 0,
    };
  });

  const loreRaw = Array.isArray(root.lore_candidates) ? root.lore_candidates : [];
  const loreCandidates: LoreCandidate[] = loreRaw
    .map((candidate) => {
      const l = isObject(candidate) ? candidate : {};
      return {
        text: String(l.text ?? ''),
        category: normalizeLoreCategory(l.category),
        confidence: clampConfidence(l.confidence),
        panels: Array.isArray(l.panels) ? l.panels.map((panel) => String(panel)) : [],
        description: l.description == null ? undefined : String(l.description),
        metadata: isObject(l.metadata) ? l.metadata : undefined,
      };
    })
    .filter((candidate) => candidate.text.length > 0);

  const inkRaw = Array.isArray(root.ink_elements) ? root.ink_elements : [];
  const inkElements: InkElement[] = inkRaw
    .map((element) => {
      const i = isObject(element) ? element : {};
      return {
        name: String(i.name ?? ''),
        type: normalizeInkType(i.type),
        confidence: clampConfidence(i.confidence),
        panels: Array.isArray(i.panels) ? i.panels.map((panel) => String(panel)) : [],
        description: String(i.description ?? ''),
        metadata: isObject(i.metadata) ? i.metadata : undefined,
      };
    })
    .filter((element) => element.name.length > 0 && element.description.length > 0);

  const result: ParsedScript = {
    pages,
    characters,
    lore_candidates: loreCandidates,
    overall_lore_summary: root.overall_lore_summary == null ? undefined : String(root.overall_lore_summary),
  };

  if (inkElements.length > 0) {
    result.ink_elements = inkElements;
  }

  return result;
}

// ============= PROXY FUNCTION =============

async function callViaProxy(
  prompt: string,
  script: string,
  provider: 'openai' | 'grok' | 'deepseek' | 'groq',
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch('/api/llm-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      apiKey,
      model,
      prompt,
      script,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Proxy error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return data.text;
}

// ============= MAIN ENTRY POINT =============

export async function parseScriptWithLLM(
  rawScript: string,
  provider: 'openai' | 'anthropic' | 'gemini' | 'grok' | 'deepseek' | 'groq',
  apiKey: string,
  model?: string,
  signal?: AbortSignal,
): Promise<ParsedScript> {
  if (!rawScript || rawScript.trim().length === 0) {
    throw new Error('Script text cannot be empty');
  }

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key is required');
  }

  const selectedModel = model || DEFAULT_MODELS[provider];

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 120000);

  try {
    const effectiveSignal = signal || abortController.signal;
    let responseText: string;

    if (!BROWSER_COMPATIBLE_PROVIDERS.includes(provider as (typeof BROWSER_COMPATIBLE_PROVIDERS)[number])) {
      responseText = await callViaProxy(
        NORMALIZATION_PROMPT,
        rawScript,
        provider as 'openai' | 'grok' | 'deepseek' | 'groq',
        apiKey,
        selectedModel,
        effectiveSignal,
      );
    } else {
      switch (provider) {
        case 'openai':
          responseText = await callOpenAI(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel, effectiveSignal);
          break;
        case 'anthropic':
          responseText = await callAnthropic(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel, effectiveSignal);
          break;
        case 'gemini':
          responseText = await callGemini(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel, effectiveSignal);
          break;
        case 'grok':
          responseText = await callGrok(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel, effectiveSignal);
          break;
        case 'deepseek':
          responseText = await callDeepSeek(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel, effectiveSignal);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    }

    clearTimeout(timeoutId);

    const cleanedResponse = stripMarkdownFences(String(responseText || '').trim());

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      throw new Error(
        `Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      );
    }

    return validateAndClean(parsedData);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw error;
    }

    throw new Error(`Failed to parse script: ${String(error)}`);
  }
}
