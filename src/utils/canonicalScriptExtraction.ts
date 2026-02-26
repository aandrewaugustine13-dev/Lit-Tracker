import { ParseResult } from '../services/scriptParser';
import { LoreCandidate, ParsedScript } from './scriptParser';
import { reconstructFormattedScript } from '../engine/universalScriptParser';

export interface CanonicalScriptExtraction {
  parsedScript: ParsedScript;
  parseResult: ParseResult;
  formattedScriptText: string;
  loreCandidates: LoreCandidate[];
}

/**
 * Canonical conversion from a single AI read (`ParsedScript`) into downstream
 * artifacts consumed by Ink, Lore extraction, and timeline extraction.
 */
export function buildCanonicalScriptExtraction(parsedScript: ParsedScript): CanonicalScriptExtraction {
  return {
    parsedScript,
    parseResult: parsedScriptToParseResult(parsedScript),
    formattedScriptText: reconstructFormattedScript(parsedScript),
    loreCandidates: parsedScript.lore_candidates || [],
  };
}

export function parsedScriptToParseResult(parsedScript: ParsedScript): ParseResult {
  return {
    success: true,
    pages: parsedScript.pages.map(page => ({
      pageNumber: page.page_number,
      panels: page.panels.map(panel => ({
        panelNumber: panel.panel_number,
        description: panel.description,
        bubbles: panel.dialogue.map(d => ({
          type: d.type === 'spoken' ? 'dialogue' as const :
                d.type === 'thought' ? 'thought' as const :
                d.type === 'caption' ? 'caption' as const :
                d.type === 'sfx' ? 'sfx' as const :
                'dialogue' as const,
          text: d.text,
          character: d.character,
        })),
        artistNotes: [],
        visualMarker: 'standard' as const,
        aspectRatio: 'wide' as any,
      })),
    })),
    characters: parsedScript.characters.map(char => ({
      name: char.name,
      description: char.description || `Character appearing in ${char.panel_count} panel${char.panel_count !== 1 ? 's' : ''}`,
      lineCount: char.panel_count,
      firstAppearance: char.description || undefined,
    })),
    errors: [],
    warnings: [],
  };
}
