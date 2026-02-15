# AI Comprehension-First Parser Refactoring

## Overview

This document describes the refactoring of the Lit-Tracker script parser system from a "lore extraction engine" to a comprehension-first AI "editor/teacher" approach.

## Problem Statement

The previous parser system had two major limitations:

1. **Pattern-Dependent (Pass 1)**: The deterministic parser required very specific formatting:
   - ALL-CAPS character names
   - INT./EXT. location markers
   - Panel/Page indicators
   - Specific dialogue formatting
   
   Scripts that didn't match these patterns produced poor or empty results.

2. **Data-Mining AI (Pass 2)**: The LLM was prompted only to extract entities — it didn't actually *read and understand* the story. It was used as a supplement to regex pattern matching rather than being the primary reader.

## Solution: Comprehension-First Approach

### Key Changes

#### 1. Updated NORMALIZATION_PROMPT (`src/utils/scriptParser.ts`)

The AI prompt was refactored to use a two-phase approach:

**PHASE 1: COMPREHENSION**
- Read the story naturally as an editor would
- Understand plot, characters, motivations, relationships, settings, themes, and narrative arc
- Don't rely on formatting patterns (ALL-CAPS, INT./EXT., Panel markers)

**PHASE 2: EXTRACTION**
- Extract entities based on story comprehension
- Provide richer descriptions that include:
  - Character motivations, relationships, and narrative roles
  - Location atmosphere, emotional tone, and significance
  - Faction ideology, influence, and role in conflict
  - Event impact, consequences, and thematic significance
  - Concept explanations and thematic implications
  - Artifact origin stories, properties, and symbolic meaning
  - Rule implications, exceptions, and narrative constraints

#### 2. Refactored Pass 2 System Prompt (`src/engine/universalScriptParser.ts`)

The `runPass2` function's system prompt was updated with similar comprehension-first instructions:
- Changed from "narrative extraction engine" to "editor and English teacher"
- Added explicit comprehension phase before extraction
- Emphasized format-agnostic reading (works with prose, screenplay, comic scripts, natural writing)
- Required richer 2-3 sentence descriptions based on story understanding

#### 3. AI-Primary Merge Logic

When LLM is enabled, the merge logic was inverted:

**Before:**
- Pass 1 (deterministic) runs first
- Pass 2 (LLM) supplements by adding entities Pass 1 missed
- Pass 1 entities come first in results

**After:**
- Pass 2 (AI) entities are prioritized and come first (richer descriptions from comprehension)
- Pass 1 acts as supplementary validation to catch anything AI missed
- Explicitly logs: "AI-primary merge: X AI entities + Y supplementary deterministic entities"

#### 4. Updated Warning Messages

- When no entities found with LLM: Suggests providing more context
- When no entities found without LLM: Suggests enabling AI-assisted extraction for format-agnostic parsing
- Removed heavy emphasis on formatting requirements

## Benefits

1. **Format-Agnostic**: Works with prose, screenplay, comic script, or any natural writing style
2. **Richer Extraction**: Descriptions include motivations, relationships, atmosphere, significance
3. **Better Comprehension**: AI reads and understands the story before extracting entities
4. **Improved User Experience**: Users don't need to format scripts in specific ways
5. **Backward Compatible**: All existing interfaces unchanged, works with all AI providers

## Technical Details

### Interfaces Unchanged

All existing TypeScript interfaces remain compatible:
- `ParsedScript`
- `LoreCandidate`
- `ProposedNewEntity`
- `ParsedProposal`
- `ProjectConfig`

### Supported AI Providers

All existing providers continue to work:
- Anthropic (Claude)
- Google Gemini
- OpenAI (GPT-4)
- Grok
- DeepSeek

### Merge Order (When enableLLM = true)

```
1. Run Pass 1 (deterministic patterns)
2. Merge external lore candidates (from AI formatting step)
3. Run comic parser (if panel format detected or few results)
4. Run Pass 2 (AI comprehension)
5. Prioritize Pass 2 results (AI entities first)
6. Add Pass 1 results that AI didn't find (supplementary)
7. Return merged proposal
```

## Testing

The refactoring was verified to:
- ✅ Compile successfully with TypeScript
- ✅ Parse test scripts and extract entities
- ✅ Work with deterministic mode (enableLLM=false)
- ✅ Maintain all existing interfaces
- ✅ Support all existing AI providers

## Usage

No changes required for existing code. The parser automatically uses the new comprehension-first approach when:
- `enableLLM` is set to `true`
- A valid API key is provided
- An AI provider is selected

The UI (`ScriptExtractionTrigger.tsx`) remains unchanged and works exactly as before.

## Example Improvement

**Before (data-mining approach):**
- Character: "ELIAS" (extracted because it's ALL-CAPS)
- Location: "COMMAND CENTER" (extracted because it matches INT./EXT. pattern)

**After (comprehension-first approach):**
- Character: "Elias" — A determined protagonist racing against time to activate the Gateway before enemy forces arrive. Shows leadership qualities and strategic thinking.
- Location: "Secret Base" — Underground command center serving as the heroes' last refuge. Atmospheric tension is heightened by the imminent threat of attack. Houses the ancient Gateway technology.

## Files Modified

1. `src/utils/scriptParser.ts` — Updated NORMALIZATION_PROMPT
2. `src/engine/universalScriptParser.ts` — Updated Pass 2 system prompt and merge logic

## Future Enhancements

Potential improvements for future iterations:
- Add explicit story summary extraction
- Support for character relationship graphs
- Thematic analysis and pattern detection
- Multi-pass comprehension for complex narratives
- User-configurable comprehension depth levels
