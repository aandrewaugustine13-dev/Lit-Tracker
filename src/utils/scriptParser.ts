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
  category: 'location' | 'timeline' | 'echo' | 'uncategorized';
  confidence: number; // 0.0 to 1.0
  panels: string[]; // panel_ids where this appears
}

export interface Character {
  name: string;
  description?: string;
  panel_count: number;
}

// ============= CONFIGURATION =============

export const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-pro',
  grok: 'grok-2-latest',
  deepseek: 'deepseek-chat',
};

export const NORMALIZATION_PROMPT = `You are a comic script parser. Parse the provided raw comic script text into structured JSON.

**Instructions:**
1. Extract all pages and panels with their descriptions and dialogue
2. Identify all characters with their descriptions
3. Extract lore candidates:
   - Locations: ALL CAPS multi-word strings or high-confidence location names
   - Timeline/Years: Text matching year patterns (e.g., "2025", "1999")
   - Echoes/Objects: Short ALL CAPS single-word strings (≤20 chars)
   - Uncategorized: Everything else that might be lore
4. Track which panels mention each lore item
5. Provide an overall lore summary if possible

**Output Format:**
Return ONLY valid JSON (no markdown fences) in this structure:
{
  "pages": [
    {
      "page_number": 1,
      "panels": [
        {
          "panel_number": 1,
          "description": "Panel description",
          "dialogue": [
            { "character": "CHARACTER", "text": "Dialogue text", "type": "spoken" }
          ],
          "panel_id": "p1-panel1"
        }
      ]
    }
  ],
  "characters": [
    { "name": "CHARACTER", "description": "Brief description", "panel_count": 5 }
  ],
  "lore_candidates": [
    { "text": "LOCATION NAME", "category": "location", "confidence": 0.9, "panels": ["p1-panel1"] }
  ],
  "overall_lore_summary": "Brief summary of the lore"
}

**Confidence Scoring:**
- 1.0: Explicit location/year in all caps
- 0.8-0.9: Strong contextual indicators
- 0.6-0.7: Moderate confidence
- 0.4-0.5: Weak indicators

Parse the following script:`;

// ============= API CALL FUNCTIONS =============

async function callOpenAI(
  prompt: string,
  script: string,
  apiKey: string,
  model: string
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
  model: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'user', content: `${prompt}\n\n${script}` },
      ],
      temperature: 0.1,
    }),
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
  model: string
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
  model: string
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
  model: string
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
  // Remove markdown code fences if present
  const fencePattern = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/;
  const match = text.match(fencePattern);
  return match ? match[1] : text;
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
  validated.lore_candidates = validated.lore_candidates.map((lore) => ({
    text: String(lore.text || ''),
    category: (['location', 'timeline', 'echo', 'uncategorized'].includes(lore.category) ? lore.category : 'uncategorized') as LoreCandidate['category'],
    confidence: typeof lore.confidence === 'number' ? Math.max(0, Math.min(1, lore.confidence)) : 0.5,
    panels: Array.isArray(lore.panels) ? lore.panels.map(String) : [],
  })).filter((lore) => lore.text.length > 0); // Remove empty entries

  return validated;
}

// ============= MAIN ENTRY POINT =============

export async function parseScriptWithLLM(
  rawScript: string,
  provider: 'openai' | 'anthropic' | 'gemini' | 'grok' | 'deepseek',
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
  const timeoutId = setTimeout(() => {
    if (signal && !signal.aborted) {
      throw new Error('Request timeout after 2 minutes');
    }
  }, 120000);

  try {
    let responseText: string;

    switch (provider) {
      case 'openai':
        responseText = await callOpenAI(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel);
        break;
      case 'anthropic':
        responseText = await callAnthropic(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel);
        break;
      case 'gemini':
        responseText = await callGemini(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel);
        break;
      case 'grok':
        responseText = await callGrok(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel);
        break;
      case 'deepseek':
        responseText = await callDeepSeek(NORMALIZATION_PROMPT, rawScript, apiKey, selectedModel);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
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
