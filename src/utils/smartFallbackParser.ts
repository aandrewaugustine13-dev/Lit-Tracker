/**
 * Smart Fallback Script Parser
 * Handles multiple comic script formats without requiring an LLM.
 * 
 * Supports:
 * - PAGE N / Panel N: headers
 * - INT./EXT. slug lines (treated as new panels)
 * - CHARACTER: inline dialogue
 * - Standalone CHARACTER name + next-line dialogue
 * - CAPTION: and SFX: lines
 * - Setting: lines
 * - Multi-line panel descriptions
 */

import type { ParsedScript } from './scriptParser';

// Screenplay keywords to skip as character names
const SKIP_WORDS = new Set([
  'INT', 'EXT', 'CUT', 'FADE', 'DISSOLVE', 'SMASH', 'MATCH', 'CONTINUED',
  'CONT', 'ANGLE', 'CLOSE', 'WIDE', 'PAN', 'ZOOM', 'SFX', 'VO', 'OS',
  'POV', 'INSERT', 'SUPER', 'TITLE', 'THE', 'AND', 'BUT', 'FOR', 'NOT',
  'WITH', 'FROM', 'PAGE', 'PANEL', 'SCENE', 'ACT', 'END', 'DAY', 'NIGHT',
  'MORNING', 'EVENING', 'LATER', 'CONTINUOUS', 'INTERCUT', 'FLASHBACK',
  'MONTAGE', 'BEGIN', 'RESUME', 'BACK', 'SAME', 'TIME', 'CAPTION', 'SETTING',
]);

function isSkipWord(name: string): boolean {
  return name.split(/\s+/).every(w => SKIP_WORDS.has(w.toUpperCase()));
}

export function smartFallbackParse(scriptText: string): ParsedScript {
  const lines = scriptText.split('\n');
  let pages: ParsedScript['pages'] = [];
  const characters = new Map<string, number>();

  let currentPage: ParsedScript['pages'][0] | null = null;
  let currentPanel: ParsedScript['pages'][0]['panels'][0] | null = null;
  let pageNum = 0;
  let panelNum = 0;

  // Patterns
  const pagePattern = /^PAGE\s+(\d+)/i;
  const panelPattern = /^Panel\s+(\d+)\s*[:\-—]?\s*(.*)/i;
  const sluglinePattern = /^(INT\.|EXT\.|INT\/EXT\.)\s+(.+)/i;
  const inlineDialogue = /^([A-Z][A-Z\s'./-]{1,28})\s*(?:\([^)]*\))?\s*:\s*(.+)/;
  const standaloneCharName = /^([A-Z][A-Z\s'./-]{1,28})\s*(?:\(([^)]*)\))?\s*$/;
  const captionPattern = /^CAPTION\s*:\s*(.+)/i;
  const sfxPattern = /^SFX\s*:\s*(.+)/i;
  const settingPattern = /^Setting\s*:\s*(.+)/i;

  function ensurePage(): ParsedScript['pages'][0] {
    if (!currentPage) {
      pageNum++;
      currentPage = { page_number: pageNum, panels: [] };
      pages.push(currentPage);
    }
    return currentPage;
  }

  function ensurePanel(): ParsedScript['pages'][0]['panels'][0] {
    const page = ensurePage();
    if (!currentPanel) {
      panelNum++;
      currentPanel = {
        panel_number: panelNum,
        description: '',
        dialogue: [],
        panel_id: `p${page.page_number}-panel${panelNum}`,
      };
      page.panels.push(currentPanel);
    }
    return currentPanel;
  }

  function trackChar(name: string) {
    const count = characters.get(name) || 0;
    characters.set(name, count + 1);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // PAGE header
    const pageMatch = line.match(pagePattern);
    if (pageMatch) {
      pageNum = parseInt(pageMatch[1], 10);
      currentPage = { page_number: pageNum, panels: [] };
      pages.push(currentPage);
      panelNum = 0;
      currentPanel = null;
      continue;
    }

    // PANEL header
    const panelMatch = line.match(panelPattern);
    if (panelMatch) {
      panelNum = parseInt(panelMatch[1], 10);
      const page = ensurePage();
      currentPanel = {
        panel_number: panelNum,
        description: panelMatch[2].trim() || '',
        dialogue: [],
        panel_id: `p${page.page_number}-panel${panelNum}`,
      };
      page.panels.push(currentPanel);
      continue;
    }

    // Slugline (INT./EXT.)
    const slugMatch = line.match(sluglinePattern);
    if (slugMatch) {
      const page = ensurePage();
      panelNum++;
      currentPanel = {
        panel_number: panelNum,
        description: line,
        dialogue: [],
        panel_id: `p${page.page_number}-panel${panelNum}`,
      };
      page.panels.push(currentPanel);
      continue;
    }

    // CAPTION:
    const captionMatch = line.match(captionPattern);
    if (captionMatch) {
      const panel = ensurePanel();
      panel.dialogue.push({ character: 'CAPTION', text: captionMatch[1].trim(), type: 'caption' });
      continue;
    }

    // SFX:
    const sfxMatch = line.match(sfxPattern);
    if (sfxMatch) {
      const panel = ensurePanel();
      panel.dialogue.push({ character: 'SFX', text: sfxMatch[1].trim(), type: 'sfx' });
      continue;
    }

    // Setting: — treat as new panel
    const settingMatch = line.match(settingPattern);
    if (settingMatch) {
      const page = ensurePage();
      panelNum++;
      currentPanel = {
        panel_number: panelNum,
        description: settingMatch[1].trim(),
        dialogue: [],
        panel_id: `p${page.page_number}-panel${panelNum}`,
      };
      page.panels.push(currentPanel);
      continue;
    }

    // Inline dialogue: CHARACTER: text
    const inlineMatch = line.match(inlineDialogue);
    if (inlineMatch) {
      const charName = inlineMatch[1].trim();
      if (!isSkipWord(charName)) {
        const panel = ensurePanel();
        const text = inlineMatch[2].replace(/^["']|["']$/g, '').trim();
        panel.dialogue.push({ character: charName, text, type: 'spoken' });
        trackChar(charName);
      }
      continue;
    }

    // Standalone character name + next-line dialogue
    const charMatch = line.match(standaloneCharName);
    if (charMatch && i + 1 < lines.length) {
      const charName = charMatch[1].trim();
      const modifier = charMatch[2];
      const nextLine = lines[i + 1].trim();

      if (!isSkipWord(charName) && nextLine && !pagePattern.test(nextLine) && !panelPattern.test(nextLine)) {
        const panel = ensurePanel();
        const text = nextLine.replace(/^["']|["']$/g, '').trim();
        const type = modifier && /think|thought/i.test(modifier) ? 'thought' as const : 'spoken' as const;
        panel.dialogue.push({ character: charName, text, type });
        trackChar(charName);
        i++;
        continue;
      }
    }

    // Description continuation
    if (currentPanel) {
      if (currentPanel.description) {
        currentPanel.description += ' ' + line;
      } else {
        currentPanel.description = line;
      }
    }
  }

  // Auto-paginate panels if we have panels but no explicit PAGE markers
  if (pages.length === 1 && currentPage && currentPage.panels.length > 6) {
    // We have panels but they're all in one page - split them up
    const allPanels = currentPage.panels;
    const PANELS_PER_PAGE = 6;
    pages = [];
    
    for (let i = 0; i < allPanels.length; i += PANELS_PER_PAGE) {
      const pagePanels = allPanels.slice(i, i + PANELS_PER_PAGE);
      const pageNumber = Math.floor(i / PANELS_PER_PAGE) + 1;
      
      // Re-number panels within each page and update panel_ids
      const renumberedPanels = pagePanels.map((panel, idx) => ({
        ...panel,
        panel_number: idx + 1,
        panel_id: `p${pageNumber}-panel${idx + 1}`,
      }));
      
      pages.push({
        page_number: pageNumber,
        panels: renumberedPanels,
      });
    }
  }
  
  // If truly nothing was parsed (no panels at all), create a single panel fallback
  if (pages.length === 0 || (pages.length === 1 && pages[0].panels.length === 0)) {
    pages = [{
      page_number: 1,
      panels: [{
        panel_number: 1,
        description: scriptText.slice(0, 200),
        dialogue: [],
        panel_id: 'p1-panel1',
      }],
    }];
  }

  return {
    pages,
    characters: Array.from(characters.entries()).map(([name, count]) => ({
      name,
      panel_count: count,
    })),
    lore_candidates: [],
  };
}
