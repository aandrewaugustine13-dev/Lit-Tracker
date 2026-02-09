import { parseScreenplay } from './screenplayParser';
import {
  ParseResult,
  ParsedPage,
  ParseError
} from './parserTypes';

// ============= TV SERIES PATTERN DEFINITIONS =============

// Episode detection patterns
const EPISODE_NUMBER_PATTERNS = [
  /^EPISODE\s+(\d+)/i,
  /^EPISODE\s+(\d+)x(\d+)/i,  // e.g., "EPISODE 1x03"
  /^EP\.?.?(\d+)/i,
];

const EPISODE_TITLE_PATTERN = /["'"](.+?)["'";]/;

// Act break patterns
const ACT_PATTERNS = [
  /^(TEASER|COLD OPEN)\s*$/i,
  /^ACT\s+(ONE|TWO|THREE|FOUR|FIVE|1|2|3|4|5)\s*$/i,
  /^(TAG|EPILOGUE)\s*$/i,
  /^END\s+OF?\s+(TEASER|ACT|EPISODE)\s*$/i,
  /^END\s+(TEASER|TAG)\s*$/i,
];

interface EpisodeMetadata {
  episodeNumber?: string;
  episodeTitle?: string;
  acts: ActBreak[];
}

interface ActBreak {
  type: string;
  pageNumber: number;
  lineNumber: number;
}

/**
 * Parse episode number from a line
 */
function parseEpisodeNumber(line: string): string | null {
  for (const pattern of EPISODE_NUMBER_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      // Handle "1x03" format
      if (match[2]) {
        return `${match[1]}x${match[2]}`;
      }
      return match[1];
    }
  }
  return null;
}

/**
 * Parse episode title from a line
 */
function parseEpisodeTitle(line: string): string | null {
  const match = line.match(EPISODE_TITLE_PATTERN);
  return match ? match[1].trim() : null;
}

/**
 * Check if line is an act break
 */
function parseActBreak(line: string): string | null {
  for (const pattern of ACT_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      // Return normalized act name
      if (match[1]) {
        const actName = match[1].toUpperCase();
        // Convert numbers to words
        const actMap: Record<string, string> = {
          '1': 'ONE',
          '2': 'TWO',
          '3': 'THREE',
          '4': 'FOUR',
          '5': 'FIVE'
        };
        return actMap[actName] || actName;
      }
      return match[0].trim().toUpperCase();
    }
  }
  return null;
}

/**
 * Pre-process script to extract episode metadata and act breaks
 */
function extractEpisodeMetadata(scriptText: string): EpisodeMetadata {
  const metadata: EpisodeMetadata = {
    acts: []
  };
  
  const lines = scriptText.split('\n');
  let pageCounter = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Check for episode number
    if (!metadata.episodeNumber) {
      const episodeNum = parseEpisodeNumber(line);
      if (episodeNum) {
        metadata.episodeNumber = episodeNum;
        
        // Check if title is on the same line
        const title = parseEpisodeTitle(line);
        if (title) {
          metadata.episodeTitle = title;
        }
        continue;
      }
    }
    
    // Check for episode title (might be on separate line)
    if (!metadata.episodeTitle) {
      const title = parseEpisodeTitle(line);
      if (title) {
        metadata.episodeTitle = title;
        continue;
      }
    }
    
    // Check for act breaks
    const actBreak = parseActBreak(line);
    if (actBreak) {
      metadata.acts.push({
        type: actBreak,
        pageNumber: pageCounter,
        lineNumber: i
      });
      continue;
    }
    
    // Count scene headings as page markers
    if (/^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)/i.test(line)) {
      pageCounter++;
    }
  }
  
  return metadata;
}

/**
 * Inject act break metadata into parsed pages
 */
function injectActBreaks(pages: ParsedPage[], actBreaks: ActBreak[]): ParsedPage[] {
  if (actBreaks.length === 0) return pages;
  
  // Map act breaks to page numbers
  const actBreakMap = new Map<number, ActBreak[]>();
  actBreaks.forEach(act => {
    const existing = actBreakMap.get(act.pageNumber) || [];
    existing.push(act);
    actBreakMap.set(act.pageNumber, existing);
  });
  
  // Inject act breaks as artist notes on first panel of relevant pages
  return pages.map(page => {
    const pageActBreaks = actBreakMap.get(page.pageNumber);
    if (pageActBreaks && page.panels.length > 0) {
      const firstPanel = page.panels[0];
      const actNotes = pageActBreaks.map(act => `${act.type}`).join(', ');
      
      return {
        ...page,
        panels: [
          {
            ...firstPanel,
            artistNotes: firstPanel.artistNotes
              ? `${actNotes}; ${firstPanel.artistNotes}`
              : actNotes
          },
          ...page.panels.slice(1)
        ]
      };
    }
    return page;
  });
}

/**
 * Main TV series script parser function
 * Extends screenplay parser with episode and act awareness
 */
export function parseTVScript(scriptText: string): ParseResult & { metadata?: EpisodeMetadata } {
  const errors: ParseError[] = [];
  
  try {
    // Step 1: Extract episode metadata and act breaks
    const metadata = extractEpisodeMetadata(scriptText);
    
    // Step 2: Parse using screenplay parser (reuse all screenplay logic)
    const screenplayResult = parseScreenplay(scriptText);
    
    // Step 3: Inject act breaks into pages
    const pagesWithActs = injectActBreaks(screenplayResult.pages, metadata.acts);
    
    // Step 4: Add metadata warnings/info
    if (!metadata.episodeNumber && screenplayResult.pages.length > 0) {
      errors.push({
        message: 'No episode number detected. Consider adding "EPISODE 103" or similar at the beginning.'
      });
    }
    
    if (metadata.acts.length === 0 && screenplayResult.pages.length > 0) {
      errors.push({
        message: 'No act breaks detected. TV scripts typically include "TEASER", "ACT ONE", etc.'
      });
    }
    
    // Return extended result with metadata
    return {
      ...screenplayResult,
      pages: pagesWithActs,
      errors: [...screenplayResult.errors, ...errors],
      metadata
    };
    
  } catch (error) {
    errors.push({
      message: `TV parser exception: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    
    return {
      pages: [],
      characters: [],
      visualMarkers: {},
      errors
    };
  }
}

/**
 * Utility to get a summary of episode structure
 */
export function getTVScriptSummary(result: ParseResult & { metadata?: EpisodeMetadata }): string {
  const lines: string[] = [];
  
  if (result.metadata) {
    if (result.metadata.episodeNumber) {
      lines.push(`Episode: ${result.metadata.episodeNumber}`);
    }
    if (result.metadata.episodeTitle) {
      lines.push(`Title: "${result.metadata.episodeTitle}"`);
    }
    if (result.metadata.acts.length > 0) {
      lines.push(`\nAct Structure:`);
      result.metadata.acts.forEach(act => {
        lines.push(`  - ${act.type} (Scene ${act.pageNumber + 1})`);
      });
    }
  }
  
  lines.push(`\nScenes: ${result.pages.length}`);
  lines.push(`Total Shots: ${result.pages.reduce((sum, p) => sum + p.panels.length, 0)}`);
  
  if (result.characters.length > 0) {
    lines.push(`\nMain Characters (${result.characters.length}):`);
    result.characters.slice(0, 5).forEach(char => {
      lines.push(`  - ${char.name} (${char.panelCount} appearances)`);
    });
  }
  
  if (Object.keys(result.visualMarkers).length > 0) {
    lines.push(`\nShot Types Used:`);
    Object.entries(result.visualMarkers)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([marker, count]) => {
        lines.push(`  - ${marker}: ${count}`);
      });
  }
  
  if (result.errors.length > 0) {
    lines.push(`\nNotes:`);
    result.errors.forEach(err => {
      lines.push(`  - ${err.message}`);
    });
  }
  
  return lines.join('\n');
}