// =============================================================================
// PARSER PIPELINE — Single entry point for all script parsing
// =============================================================================
// This is the ONLY function the rest of the app calls.
// Path A: AI parse -> deterministic enrichment (when API key present)
// Path B: Deterministic only (no API key, or AI call failed)
// Replaces: universalScriptParser.ts (parseScriptAndProposeUpdates)

import { UnifiedParseResult, ProjectType } from './parserPipeline.types';
import { aiParse, LLMProvider, AiParseOptions } from './aiParser';
import { deterministicParse, enrichParseResult } from './deterministicParser';

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
 * Parse a script through the unified pipeline.
 *
 * If an LLM provider and API key are supplied, runs the AI parser first
 * then enriches with a deterministic pass. If the AI call fails for any
 * reason, falls back silently to deterministic-only mode.
 *
 * If no LLM credentials are supplied, runs deterministic-only mode.
 *
 * Every code path returns UnifiedParseResult — the single contract.
 */
export async function parseScript(options: ParseOptions): Promise<UnifiedParseResult> {
  const { scriptText, projectType, llmProvider, llmApiKey } = options;

  // Path A: AI parse followed by deterministic enrichment
  if (llmProvider && llmApiKey) {
    try {
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

      // Deterministic pass validates and fills gaps
      return enrichParseResult(aiResult, scriptText, projectType);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[parseScript] AI parse failed, falling back to deterministic:', message);
      // Fall through to deterministic
    }
  }

  // Path B: Deterministic only (no API key, or AI failed)
  return deterministicParse(scriptText, projectType);
}