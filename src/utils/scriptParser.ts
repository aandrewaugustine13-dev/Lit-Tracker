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

export const NORMALIZATION_PROMPT = `You are an editor and English teacher analyzing a story. Your task is to read and comprehend the narrative, then extract world-building elements from your understanding.

⚠️ **CRITICAL REQUIREMENT**: You MUST return entities from MULTIPLE categories — not just locations. A typical script will contain characters, factions, events, concepts, artifacts, and more. Returning only locations is unacceptable and indicates you haven't fully analyzed the narrative.

📊 **EXPECTED YIELD**: A typical script page will yield:
- 2-5 locations (settings, places)
- 1-3 characters (minor/background characters, not main protagonists)
- 1-2 factions/organizations (any groups mentioned)
- 1-3 events (battles, discoveries, deaths, meetings, past events referenced)
- 1-2 concepts (powers, abilities, magic systems, phenomena)
- 0-2 artifacts (named weapons, tools, relics, important objects)
- 0-2 rules (world mechanics, constraints, established laws)
- 0-2 items (generic objects characters interact with)

**PHASE 1: COMPREHENSION (Read and Understand First)**
Before extracting any data, read the story naturally to understand:
- **Plot & Narrative Arc**: What's happening? What's the conflict? What are the stakes?
- **Characters**: Who are they? What are their motivations, relationships, and roles in the story? (Don't rely on ALL-CAPS formatting)
- **Settings**: Where does the story take place? What's the atmosphere and significance of each location? (Don't rely on INT./EXT. markers)
- **Themes & Subtext**: What are the underlying themes? What's the emotional core?
- **Narrative Elements**: What objects, events, and concepts are important to the story's progression?

**PHASE 2: EXTRACTION (Extract from Understanding)**
Based on your comprehension of the story, now extract:

1. **Pages and panels** with their descriptions and dialogue (adapt to whatever format the text uses - prose, screenplay, comic script, or natural writing)
2. **Characters** with rich descriptions including their motivations, relationships, and role in the narrative
3. **Lore candidates** across ALL categories:
   - **Characters**: Minor/background characters (protagonists go in 'characters' field) - describe their role in the story
   - **Locations**: Places and settings - describe atmosphere, significance, and narrative importance
   - **Factions/Organizations**: Groups, teams, agencies - describe ideology, influence, and role in conflict
   - **Events**: Significant narrative moments - describe impact, participants, and consequences
   - **Concepts**: Abstract ideas, powers, abilities - describe how they work and their significance
   - **Artifacts**: Named significant objects - describe origin, properties, and narrative importance
   - **Rules**: Established world rules - describe scope, implications, and exceptions
   - **Items**: Generic trackable objects - describe usage and importance
   - **Timeline/Years**: Temporal markers
   - **Uncategorized**: Everything else that might be lore

**FORMAT-AGNOSTIC APPROACH**: 
This text may be in any format - prose, screenplay, comic script, or natural writing. Don't rely on specific formatting patterns like ALL-CAPS character names, INT./EXT. location markers, or Panel indicators. Read naturally and identify entities based on narrative understanding.

**EXTRACTION QUALITY GUIDELINES**:
- **Richer Descriptions**: Since you understand the story, provide detailed descriptions that include:
  - Characters: Motivations, relationships, character arc, role in narrative
  - Locations: Atmosphere, emotional tone, significance to plot, narrative function
  - Factions: Ideology, influence level, role in conflict, relationship to protagonists
  - Events: Emotional impact, consequences, participants, thematic significance
  - Concepts: How they work, why they matter to the story, thematic implications
  - Artifacts: Origin story, powers/properties, symbolic meaning, narrative importance
  - Rules: How they constrain/enable the story, exceptions, implications
  
- **Track panels** where each lore item appears
- **Provide metadata** for each lore candidate based on your understanding:
  - Characters: role, appearance, motivations
  - Factions: ideology, leader, influence level, relationship dynamics
  - Events: date, participants, consequences, emotional weight
  - Concepts/Artifacts: origin, properties, significance, thematic meaning
  - Rules: scope, exceptions, narrative implications
- **Provide an overall lore summary** that synthesizes your understanding of the world-building

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
    // LOCATIONS - Settings and places
    { 
      "text": "The Crimson Tavern", 
      "category": "location", 
      "confidence": 0.9, 
      "panels": ["p1-panel1"],
      "description": "A dimly lit underground bar where rebels gather to plan",
      "metadata": { "region": "Old Quarter", "atmosphere": "tense" }
    },
    {
      "text": "Shadow District",
      "category": "location",
      "confidence": 0.85,
      "panels": ["p1-panel2"],
      "description": "The dangerous eastern sector controlled by gangs"
    },
    // CHARACTERS - Minor/background characters
    {
      "text": "Marcus the Informant",
      "category": "character",
      "confidence": 0.8,
      "panels": ["p1-panel1"],
      "description": "A nervous information broker who sells secrets to both sides"
    },
    // FACTIONS - Any organization, group, team, agency, order, guild, crew
    {
      "text": "The Iron Brotherhood",
      "category": "faction",
      "confidence": 0.9,
      "panels": ["p1-panel2", "p1-panel4"],
      "description": "A militant group seeking to overthrow the Council",
      "metadata": { "ideology": "Freedom through force", "leader": "General Krane", "size": "200+ members" }
    },
    {
      "text": "Council of Seven",
      "category": "faction",
      "confidence": 0.95,
      "panels": ["p1-panel3"],
      "description": "The ruling body that governs the city with an iron fist"
    },
    // EVENTS - Battles, discoveries, deaths, meetings, rituals, anything that happened
    {
      "text": "The Siege of Irongate",
      "category": "event",
      "confidence": 0.9,
      "panels": ["p1-panel3"],
      "description": "Bloody battle where the Brotherhood tried to storm the fortress",
      "metadata": { "date": "Three years ago", "casualties": "Heavy", "outcome": "Failed assault" }
    },
    {
      "text": "Sarah's Betrayal",
      "category": "event",
      "confidence": 0.85,
      "panels": ["p1-panel5"],
      "description": "When Sarah revealed herself as a Council spy, splitting the group"
    },
    // CONCEPTS - Powers, abilities, magic systems, phenomena, philosophies
    {
      "text": "Shadow Binding",
      "category": "concept",
      "confidence": 0.9,
      "panels": ["p1-panel4"],
      "description": "Rare ability to manipulate shadows to restrain enemies"
    },
    {
      "text": "The Voice",
      "category": "concept",
      "confidence": 0.8,
      "panels": ["p1-panel2"],
      "description": "Telepathic communication method used by trained operatives"
    },
    // ARTIFACTS - Named weapons, tools, relics, documents, significant objects
    {
      "text": "Blade of Echoes",
      "category": "artifact",
      "confidence": 0.95,
      "panels": ["p1-panel5"],
      "description": "Legendary sword that shows its wielder glimpses of the future",
      "metadata": { "origin": "Forged by the Ancient Smiths", "current_owner": "Unknown" }
    },
    {
      "text": "The Lost Codex",
      "category": "artifact",
      "confidence": 0.9,
      "panels": ["p1-panel3"],
      "description": "Ancient book containing forbidden knowledge of reality manipulation"
    },
    // RULES - World mechanics, constraints, established laws
    {
      "text": "The Pact of Silence",
      "category": "rule",
      "confidence": 0.85,
      "panels": ["p1-panel2"],
      "description": "Ancient law forbidding anyone from speaking of the Old Gods"
    },
    // ITEMS - Generic objects that characters interact with
    {
      "text": "Communication Crystal",
      "category": "item",
      "confidence": 0.7,
      "panels": ["p1-panel4"],
      "description": "Standard issue device for long-range messaging"
    }
  ],
  "overall_lore_summary": "Brief summary of the lore"
}

**Note**: The above examples demonstrate the diversity of entities you should extract. This is what a well-analyzed script looks like - it contains multiple categories, not just locations. If you're only finding locations, you're not analyzing deeply enough.

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

🚫 **COMMON MISTAKES TO AVOID**:
- ❌ **DO NOT return only locations** - This is the most common failure. Every script has more than just places.
- ❌ **DO NOT skip characters** just because they appear in the main characters array - Minor/background characters still go in lore_candidates
- ❌ **DO NOT skip events** just because they're implied rather than explicitly stated - References to past battles, meetings, deaths, or discoveries are events
- ❌ **DO NOT miss factions** - If a character mentions "the team," "the agency," "the order," "the guild," "the crew," or any group, that's a faction
- ❌ **DO NOT miss concepts** - If a character uses a power, ability, or technique (even once), that's a concept
- ❌ **DO NOT miss artifacts** - If a character wields a named weapon, tool, or important object, that's an artifact
- ❌ **DO NOT ignore dialogue** - Organizations, events, and artifacts are often mentioned in conversation, not just descriptions

✅ **MANDATORY SELF-CHECK BEFORE RESPONDING**:
Before you finalize your JSON response, you MUST verify the following checklist. If you answer "NO" to any of these, go back and extract more entities:

□ **Did I extract at least 2 locations?** (settings, places)
□ **Did I extract characters?** (people mentioned by name who aren't main protagonists)
□ **Did I extract factions/organizations?** (any group, team, agency, order, guild, crew, council, brotherhood, etc.)
□ **Did I extract events?** (battles, discoveries, deaths, meetings, rituals, betrayals - anything that happened)
□ **Did I extract concepts?** (powers, abilities, magic systems, phenomena, philosophies, techniques)
□ **Did I extract artifacts?** (named weapons, tools, relics, documents, significant objects)
□ **Did I check rules?** (world mechanics, constraints, laws, pacts, established limitations)
□ **Did I check items?** (generic objects characters interact with)

If your lore_candidates array has ONLY locations, you have FAILED this task. Go back and re-read the script specifically looking for the other categories listed above.

**Critical reminder**: Most scripts contain entities across AT LEAST 4-6 different categories. If you're returning fewer than 3 categories, you're not analyzing thoroughly enough.

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
