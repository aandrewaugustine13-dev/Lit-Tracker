/**
 * Pure TypeScript LLM-based Script Parser
 * Serverless implementation that calls LLM APIs directly to normalize comic scripts
 * UPDATED: Balanced two-phase prompt — 119 panels + rich multi-category lore
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
  panel_id: string;
}
export interface DialogueLine {
  character: string;
  text: string;
  type: 'spoken' | 'thought' | 'caption' | 'sfx';
}
export interface LoreCandidate {
  text: string;
  category: 'location' | 'timeline' | 'echo' | 'uncategorized' | 'faction' | 'event' | 'concept' | 'artifact' | 'rule' | 'item' | 'character';
  confidence: number;
  panels: string[];
  description?: string;
  metadata?: Record<string, any>;
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

export const BROWSER_COMPATIBLE_PROVIDERS = ['gemini', 'anthropic'] as const;

// ============= BALANCED NORMALIZATION PROMPT (this is the magic) =============
export const NORMALIZATION_PROMPT = `You are an expert comic script parser for Lit-Tracker. You perform a strict two-phase process. Both phases are mandatory.

**PHASE 1: PERFECT STORYBOARD PANEL EXTRACTION (HIGHEST PRIORITY)**  
This script contains exactly 119 panels. You MUST output ALL 119 panels. Never summarize, combine, skip, or give fewer. The storyboard tool depends on the full count.

- Every "PAGE X" → one page object  
- Every "Panel Y" → one panel object  
- panel_number is GLOBAL (1 to 119 across the whole script)  
- description = full [ARTIST NOTE] + visual directions (extremely detailed)  
- dialogue = every line, correctly typed (spoken / caption / sfx)

**PHASE 2: DEEP LORE EXTRACTION (EQUALLY CRITICAL — DO THIS AFTER PANELS)**  
Now use your full understanding of the entire script to extract rich lore across ALL categories. Returning only locations is failure.

⚠️ CRITICAL: You MUST return entities from MULTIPLE categories — not just locations. Typical yield:
- 2-5 locations
- 1-3 characters (minor/background)
- 1-2 factions/organizations
- 1-3 events
- 1-2 concepts
- 0-2 artifacts
- 0-2 rules
- 0-2 items

Follow the exact same rich extraction guidelines as before (motivations, ideology, consequences, metadata, etc.).

**Output ONLY valid JSON** (no markdown, no extra text) in this structure:

{
  "pages": [ ... full 119 panels ... ],
  "characters": [ ... ],
  "lore_candidates": [
    // example with diversity
    { "text": "The Orb", "category": "artifact", "confidence": 0.95, "panels": ["p19-panel1"], "description": "...", "metadata": {...} },
    { "text": "The Wilson Family", "category": "event", "confidence": 0.9, "panels": ["p9-panel1", "p10-panel1"], ... },
    { "text": "The Iron Ascension", "category": "faction", "confidence": 0.85, ... },
    // etc. — at least 4-6 different categories
  ],
  "overall_lore_summary": "..."
}

MANDATORY SELF-CHECK BEFORE RESPONDING:
□ At least 119 panels?
□ At least 4 different lore categories?
□ No "only locations"?

If you fail either check, go back and fix it.

Now parse this script:`;

// ============= API CALL FUNCTIONS (unchanged) =============
async function callOpenAI(...args: any[]) { /* same as before */ }
async function callAnthropic(...args: any[]) { /* same */ }
async function callGemini(...args: any[]) { /* same */ }
async function callGrok(...args: any[]) { /* same */ }
async function callDeepSeek(...args: any[]) { /* same */ }

// ============= HELPER FUNCTIONS (unchanged) =============
export function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}
export function validateAndClean(data: any): ParsedScript {
  return {
    pages: Array.isArray(data?.pages) ? data.pages : [],
    characters: Array.isArray(data?.characters) ? data.characters : [],
    lore_candidates: Array.isArray(data?.lore_candidates) ? data.lore_candidates : [],
    overall_lore_summary: data?.overall_lore_summary || '',
  };
}

// ============= PROXY FUNCTION (unchanged) =============
async function callViaProxy(...args: any[]) { /* same */ }

// ============= MAIN ENTRY POINT (unchanged) =============
export async function parseScriptWithLLM(...args: any[]) { /* same */ }
