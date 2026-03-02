// =============================================================================
// PARSER PIPELINE — Single entry point for all script parsing
// =============================================================================
// AI-only pipeline. No deterministic fallback, no enrichment step.
// If no LLM credentials are provided, or if the AI call fails, we throw.
// Clean failure > polluted output.

import { UnifiedParseResult, ProjectType } from './parserPipeline.types';
import { aiParse, LLMProvider, AiParseOptions } from './aiParser';

// Re-export for convenience — consumers only need to import from parserPipeline
export type { UnifiedParseResult, ProjectType } from './parserPipeline.types';
export type { LLMProvider } from './aiParser';

export interface ParseOptions {
  scriptText: string;
  projectType: ProjectType;
  llmProvider?: LLMProvider;
  llmApiKey?: string;
  existingCharacters?: string[];
  canonLocks?: string[];
}

/**
 * Parse a script through the AI pipeline.
 *
 * Requires an LLM provider and API key. Throws if either is missing
 * or if the AI call fails. No silent fallbacks.
 */
export async function parseScript(options: ParseOptions): Promise<UnifiedParseResult> {
  const { scriptText, projectType, llmProvider, llmApiKey } = options;

  if (!llmProvider || !llmApiKey) {
    throw new Error('AI parsing requires an LLM provider and API key. Please select a provider and enter your API key.');
  }

  console.log('[parseScript] Running AI-only pipeline with provider:', llmProvider);

  const aiResult = await aiParse(
    scriptText,
    projectType,
    llmProvider,
    llmApiKey,
    {
      existingCharacters: options.existingCharacters,
      canonLocks: options.canonLocks,
    },
  );

  // ── Diagnostic logging ──
  console.log('[parseScript] AI parse complete.');
  console.log('[parseScript] Characters:', aiResult.characters.map(c => c.name));
  console.log('[parseScript] Lore:', aiResult.lore.map(l => `${l.name} (${l.category})`));
  console.log('[parseScript] Lore categories:', [...new Set(aiResult.lore.map(l => l.category))]);
  console.log('[parseScript] Timeline events:', aiResult.timeline.length);
  console.log('[parseScript] Pages:', aiResult.pages.length);

  return aiResult;
}
