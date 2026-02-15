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
};

export const NORMALIZATION_PROMPT = `You are a comic script parser. Parse the provided raw comic script text into structured JSON.

**Instructions:**
1. Extract all pages and panels with their descriptions and dialogue
2. Identify all characters with their descriptions
3. Extract lore candidates across ALL categories:
   - **Characters**: Only minor/background characters not worthy of main character list (protagonists go in 'characters' field)
   - **Locations**: Places, settings, buildings (ALL CAPS multi-word strings or high-confidence location names)
   - **Factions/Organizations**: Groups, teams, agencies, governments, organizations
   - **Events**: Significant narrative moments, battles, deaths, discoveries, ceremonies
   - **Concepts**: Abstract ideas, powers, abilities, magic systems, phenomena, philosophies
   - **Artifacts**: Named significant objects with narrative importance (legendary weapons, relics, ancient items)
   - **Rules**: Established world rules, constraints, laws of the universe, mechanics
   - **Items**: Generic trackable objects that characters interact with
   - **Timeline/Years**: Text matching year patterns (e.g., "2025", "1999") or temporal markers
   - **Echoes/Objects**: Short ALL CAPS single-word strings (≤20 chars) - classify as artifact or item based on context
   - **Uncategorized**: Everything else that might be lore

**IMPORTANT**: Do NOT focus exclusively on locations. Every script should have entities across multiple categories. 
Be especially thorough in extracting:
- Artifacts: Any named object, weapon, device, or item that has narrative significance
- Events: Any referenced past or future event, battle, incident, discovery, or turning point  
- Factions: Any named group, organization, team, or collective
- Concepts: Any named power, ability, phenomenon, or abstract idea
If in doubt about a category, include the entity with moderate confidence rather than omitting it.

4. Track which panels mention each lore item
5. For each lore candidate, provide optional metadata:
   - Characters: role, appearance
   - Factions: ideology, leader, influence level
   - Events: date, participants, consequences
   - Concepts/Artifacts: origin, properties, significance
   - Rules: scope, exceptions
6. Provide an overall lore summary if possible

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
    { 
      "text": "LOCATION NAME", 
      "category": "location", 
      "confidence": 0.9, 
      "panels": ["p1-panel1"],
      "description": "Brief description",
      "metadata": { "region": "North District", "timeOfDay": "night" }
    },
    {
      "text": "THE ORDER",
      "category": "faction",
      "confidence": 0.85,
      "panels": ["p1-panel2"],
      "description": "Secret organization",
      "metadata": { "ideology": "Preservation of ancient knowledge", "leader": "The Keeper" }
    },
    {
      "text": "The Great Awakening",
      "category": "event",
      "confidence": 0.9,
      "panels": ["p1-panel3"],
      "description": "When the powers first manifested",
      "metadata": { "date": "2020", "participants": "All awakened individuals" }
    },
    {
      "text": "Void Walking",
      "category": "concept",
      "confidence": 0.8,
      "panels": ["p1-panel4"],
      "description": "Ability to traverse the void between dimensions"
    },
    {
      "text": "SWORD OF DAWN",
      "category": "artifact",
      "confidence": 0.95,
      "panels": ["p1-panel5"],
      "description": "Legendary weapon that can cut through any material",
      "metadata": { "origin": "Forged by the First Smiths" }
    }
  ],
  "overall_lore_summary": "Brief summary of the lore"
}

**Note**: The above example shows one entity per category for brevity. In practice, you should extract ALL entities of ALL types. A typical script page might yield 2-5 locations, 1-3 artifacts, 1-3 events, 1-2 factions, etc. Do not stop at one per category.

**Confidence Scoring:**
- 1.0: Explicit entity clearly defined (e.g., organization name in dialogue, artifact with clear importance)
- 0.8-0.9: Strong contextual indicators (e.g., character acting as faction leader, event described in detail)
- 0.6-0.7: Moderate confidence (e.g., mentioned power or ability, referenced past event)
- 0.4-0.5: Weak indicators (e.g., possible concept, unclear reference)

**Category Guidelines:**
- Use "faction" for any group/organization with members
- Use "event" for past or present significant happenings
- Use "concept" for abstract ideas, powers, or phenomena  
- Use "artifact" for named unique objects of importance
- Use "rule" for explicit world mechanics or constraints
- Use "item" for generic objects characters use
- Use "character" for new characters not in main character list

**Self-Check Before Responding:**
Before finalizing your JSON, verify that your lore_candidates array includes entities from at least 3 different categories (not just locations). If you only found locations, re-read the script looking specifically for:
- Named objects or weapons (→ artifact)
- Referenced battles, deaths, or discoveries (→ event)  
- Groups or organizations (→ faction)
- Powers, magic systems, or phenomena (→ concept)
- World rules or constraints (→ rule)

Parse the following script:`;

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
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, 120000);

  try {
    // Use the signal from either the provided controller or our timeout controller
    const effectiveSignal = signal || abortController.signal;
    let responseText: string;

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
