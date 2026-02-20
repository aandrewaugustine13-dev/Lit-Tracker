/**
 * Pure TypeScript LLM-based Script Parser
 * Serverless implementation that calls LLM APIs directly to normalize comic scripts
 */

// ============= INTERFACES =============

export interface ParsedScript {
  pages: Page[];
  characters: Character[];
  lore_candidates: LoreCandidate[];
  overall_lore_summary?: string;
}

export interface Page {
  page_number: number;
  panels: Panel[];
}

export interface Panel {
  panel_number: number;
  description: string;
  dialogue: DialogueLine[];
  panel_id: string; // e.g., "p1-panel3"
}

export interface DialogueLine {
  character: string;
  text: string;
  type: 'spoken' | 'thought' | 'caption' | 'sfx';
}

export interface LoreCandidate {
  text: string;
  category: 'location' | 'timeline' | 'echo' | 'uncategorized' | 'faction' | 'event' | 'concept' | 'artifact' | 'rule' | 'item' | 'character';
  confidence: number; // 0.0 to 1.0
  panels: string[]; // panel_ids where this appears
  description?: string; // Optional description for the entity
  metadata?: Record<string, any>; // Optional metadata (ideology, leader, date, origin, etc.)
}

export interface Character {
  name: string;
  description?: string;
  panel_count: number;
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

// Providers that work directly from browser (no CORS issues)
export const BROWSER_COMPATIBLE_PROVIDERS = ['gemini', 'anthropic'] as const;

export const NORMALIZATION_PROMPT = `You are an expert comic script parser for a digital storyboard tool.

**PRIMARY MISSION (NON-NEGOTIABLE — DO THIS FIRST AND PERFECTLY)**:
Extract **EVERY SINGLE PANEL** from this 29-page graphic novel script. 
This script contains exactly 119 panels. You **must** output all 119. Do not summarize, combine, skip, or give only representative panels. Failure to output the full panel count will break the storyboard tool.

Follow the script’s explicit structure:
- Every "PAGE X" → one page object
- Every "Panel Y" → one panel object
- panel_number is **global and sequential** (1 to 119 across the entire script)
- page_number matches the PAGE header
- For "description": combine the [ARTIST NOTE] + any visual direction in the script. Be extremely detailed.
- For "dialogue": parse every spoken line, NARRATOR box, CAPTION, SFX. Correctly set "type":
  - "spoken" for character lines (JOHN:, SINDY:, etc.)
  - "caption" for NARRATOR: or plain narrator boxes
  - "sfx" for SFX: lines
  - "thought" if clearly a thought bubble (none in this script)

Only AFTER you have output the complete 119-panel structure, THEN extract characters and lore_candidates across multiple categories.

**Output ONLY valid JSON** — no markdown, no extra text.

{
  "pages": [
    {
      "page_number": 1,
      "panels": [
        {
          "panel_number": 1,
          "description": "Wide establishing shot, top third of page. Living room of a nice suburban Texas home. Clean, beige, 'LIVE LAUGH LOVE' décor. Massive flatscreen TV dominates one wall showing news. Through the window, orange apocalyptic sky with something burning.",
          "dialogue": [
            { "character": "NARRATOR", "text": "The difference between panic and preparation is branding.", "type": "caption" }
          ],
          "panel_id": "p1-panel1"
        },
        {
          "panel_number": 2,
          "description": "Close on TV screen. News broadcast. Aerial shot of I-5 in California — solid river of headlights flowing toward the ocean. Speedboat capsizing in corner. Passengers smiling and waving. Upbeat crawler at bottom.",
          "dialogue": [
            { "character": "CRAWLER", "text": "GREAT TRAVEL WEATHER! 75° AND SUNNY! WEST COAST MOBILIZATION AHEAD OF SCHEDULE!", "type": "caption" }
          ],
          "panel_id": "p1-panel2"
        }
        // ... continue for ALL 119 panels
      ]
    }
    // ... all other pages
  ],
  "characters": [
    // main characters with descriptions and panel_count
  ],
  "lore_candidates": [
    // rich lore across ALL categories as before
  ],
  "overall_lore_summary": "Brief summary..."
}

Now parse this script:`;

// ============= API CALL FUNCTIONS =============

async function callOpenAI(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
  return data.choices[0].message.content;
}

async function callAnthropic(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
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
      messages: [
        { role: 'user', content: `${prompt}\n\n${script}` },
      ],
      temperature: 0.1,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGemini(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${prompt}\n\n${script}` }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
      signal,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callGrok(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
  return data.choices[0].message.content;
}

async function callDeepSeek(
  prompt: string,
  script: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ============= HELPER FUNCTIONS =============

export function stripMarkdownFences(text: string): string {
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

export function validateAndClean(data: any): ParsedScript {
  // Ensure all required fields exist with safe defaults
  const validated: ParsedScript = {
    pages: Array.isArray(data.pages) ? data.pages : [],
    characters: Array.isArray(data.characters) ? data.characters : [],
    lore_candidates: Array.isArray(data.lore_candidates) ? data.lore_candidates : [],
    overall_lore_summary: data.overall_lore_summary || undefined,
  };

  // Validate and clean pages
  validated.pages = validated.pages.map((page, idx) => ({
    page_number: typeof page.page_number === 'number' ? page.page_number : idx + 1,
    panels: Array.isArray(page.panels)
      ? page.panels.map((panel, panelIdx) => ({
          panel_number: typeof panel.panel_number === 'number' ? panel.panel_number : panelIdx + 1,
          description: String(panel.description || ''),
          dialogue: Array.isArray(panel.dialogue)
            ? panel.dialogue.map((d) => ({
                character: String(d.character || 'UNKNOWN'),
                text: String(d.text || ''),
                type: (['spoken', 'thought', 'caption', 'sfx'].includes(d.type) ? d.type : 'spoken') as DialogueLine['type'],
              }))
            : [],
          panel_id: panel.panel_id || `p${page.page_number || idx + 1}-panel${panel.panel_number || panelIdx + 1}`,
        }))
      : [],
  }));

  // Validate and clean characters
  validated.characters = validated.characters.map((char) => ({
    name: String(char.name || 'UNKNOWN'),
    description: char.description ? String(char.description) : undefined,
    panel_count: typeof char.panel_count === 'number' && char.panel_count >= 0 ? char.panel_count : 0,
  }));

  // Validate and clean lore candidates
  const validCategories = ['location', 'timeline', 'echo', 'uncategorized', 'faction', 'event', 'concept', 'artifact', 'rule', 'item', 'character'];
  validated.lore_candidates = validated.lore_candidates.map((lore) => ({
    text: String(lore.text || ''),
    category: (validCategories.includes(lore.category) ? lore.category : 'uncategorized') as LoreCandidate['category'],
    confidence: typeof lore.confidence === 'number' ? Math.max(0, Math.min(1, lore.confidence)) : 0.5,
    panels: Array.isArray(lore.panels) ? lore.panels.map(String) : [],
    description: lore.description ? String(lore.description) : undefined,
    metadata: (lore.metadata && typeof lore.metadata === 'object') ? lore.metadata : undefined,
  })).filter((lore) => lore.text.length > 0); // Remove empty entries

  return validated;
}

// ============= PROXY FUNCTION =============

async function callViaProxy(
  prompt: string,
  script: string,
  provider: 'openai' | 'grok' | 'deepseek' | 'groq',
  apiKey: string,
  model: string,
  signal?: AbortSignal
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
  signal?: AbortSignal
): Promise<ParsedScript> {
  if (!rawScript || rawScript.trim().length === 0) {
    throw new Error('Script text cannot be empty');
  }

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key is required');
  }

  const selectedModel = model || DEFAULT_MODELS[provider];

  // Create AbortController with 2-minute timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, 120000);

  try {
    // Use the signal from either the provided controller or our timeout controller
    const effectiveSignal = signal || abortController.signal;
    let responseText: string;
    
    // Route CORS-blocked providers through proxy
    if (!BROWSER_COMPATIBLE_PROVIDERS.includes(provider as any)) {
      // TypeScript knows these are the proxy-compatible providers
      responseText = await callViaProxy(
        NORMALIZATION_PROMPT, 
        rawScript, 
        provider as 'openai' | 'grok' | 'deepseek' | 'groq', 
        apiKey, 
        selectedModel, 
        effectiveSignal
      );
    } else {
      // Direct calls for browser-compatible providers
      switch (provider) {
        case 'anthropic':
          responseText = await callAnthropic(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel, effectiveSignal);
          break;
        case 'gemini':
          responseText = await callGemini(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel, effectiveSignal);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    }

    clearTimeout(timeoutId);

    // Strip markdown fences if present
    const cleanedResponse = stripMarkdownFences(responseText.trim());

    // Parse JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      throw new Error(`Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Validate and clean the data
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
