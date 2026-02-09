/**
 * Stage Play Parser
 * 
 * Parses common stage play format into the common ParseResult structure.
 * 
 * Format recognition:
 * - Act detection: ACT ONE, ACT TWO, ACT 1, ACT 2, etc.
 * - Scene detection: SCENE 1, SCENE ONE, Scene 3
 * - Stage directions: Text in parentheses or brackets at start of line
 * - Character dialogue: CHARACTER NAME: or CHARACTER NAME. followed by text
 * - Blocking directions: enters, exits, crosses, moves, sits, stands, etc.
 * - Technical cues: LIGHTS:, SOUND:, MUSIC:, [Lights fade]
 * - Offstage dialogue: (O.S.), (V.O.), (OFF), (OFFSTAGE)
 */

import {
  ParseResult,
  ParsedPage,
  ParsedPanel,
  DialogueLine,
  CharacterCount,
  VisualMarkers,
  ParseError
} from './parserTypes';

// ============= PATTERN DEFINITIONS =============

// Act patterns
const ACT_PATTERNS = [
  /^ACT\s+(ONE|TWO|THREE|FOUR|FIVE|1|2|3|4|5|I|II|III|IV|V)\s*$/i,
  /^ACT\s+(ONE|TWO|THREE|FOUR|FIVE|1|2|3|4|5|I|II|III|IV|V)\s*[:–—-]/i,
  /^#\s*ACT\s+(ONE|TWO|THREE|FOUR|FIVE|1|2|3|4|5|I|II|III|IV|V)/i,
];

// Scene patterns
const SCENE_PATTERNS = [
  /^SCENE\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|\d+)\s*$/i,
  /^SCENE\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|\d+)\s*[:–—-]/i,
  /^#\s*SCENE\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|\d+)/i,
  /^Scene\s+(\d+)/i,
];

// Stage direction patterns (in parentheses or brackets at line start)
const STAGE_DIRECTION_PATTERNS = [
  /^\(([^)]+)\)\s*$/,           // (Stage direction at start of line)
  /^\[([^\]]+)\]\s*$/,          // [Stage direction in brackets]
  /^\(([^)]+)\)$/,              // (Full line is stage direction)
  /^\[([^\]]+)\]$/,             // [Full line is stage direction]
];

// Character dialogue patterns
const DIALOGUE_PATTERNS = [
  /^([A-Z][A-Z0-9\s\-'.]+?)(?:\s*\(([^)]+)\))?\s*:\s*(.+)$/,  // CHARACTER (modifier): dialogue
  /^([A-Z][A-Za-z0-9\s\-'.]+?)(?:\s*\(([^)]+)\))?\s*:\s*(.+)$/, // Character (modifier): dialogue
  /^([A-Z][A-Z0-9\s\-'.]+?)(?:\s*\(([^)]+)\))?\s*\.\s+(.+)$/,  // CHARACTER (modifier). dialogue
];

// Blocking verbs that indicate movement/action (create new beats)
const BLOCKING_VERBS = [
  'enters', 'enter', 'entering',
  'exits', 'exit', 'exiting',
  'crosses', 'cross', 'crossing',
  'moves', 'move', 'moving',
  'sits', 'sit', 'sitting',
  'stands', 'stand', 'standing',
  'rises', 'rise', 'rising',
  'turns', 'turn', 'turning',
  'gestures', 'gesture', 'gesturing',
  'walks', 'walk', 'walking',
  'runs', 'run', 'running',
  'falls', 'fall', 'falling',
  'kneels', 'kneel', 'kneeling',
  'lies', 'lie', 'lying',
  'picks up', 'puts down',
  'opens', 'closes',
  'grabs', 'takes', 'hands',
];

// Technical cue patterns
const TECHNICAL_CUE_PATTERNS = [
  /^LIGHTS?\s*[:–—-]\s*(.+)$/i,
  /^SOUND\s*[:–—-]\s*(.+)$/i,
  /^MUSIC\s*[:–—-]\s*(.+)$/i,
  /^SFX\s*[:–—-]\s*(.+)$/i,
  /^CUE\s*[:–—-]\s*(.+)$/i,
  /^\[(?:Lights?|Sound|Music|SFX|Cue)\s+([^\]]+)\]$/i,
];

// Offstage/voiceover patterns
const OFFSTAGE_PATTERNS = [
  /\b(O\.?S\.?|OFF\s*STAGE?|OFFSTAGE|OFF)\b/i,
  /\b(V\.?O\.?|VOICE\s*OVER|VOICEOVER)\b/i,
];

// Word to number mapping
const WORD_TO_NUM: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
};

function parseNumber(str: string): number {
  const lower = str.toLowerCase().trim();
  if (WORD_TO_NUM[lower]) return WORD_TO_NUM[lower];
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

// Check if line contains blocking directions
function hasBlockingVerb(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKING_VERBS.some(verb => {
    const pattern = new RegExp(`\\b${verb}\\b`, 'i');
    return pattern.test(lower);
  });
}

// Check if stage direction indicates entrance or exit
function isEntranceOrExit(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(enters?|entering|exits?|exiting)\b/.test(lower);
}

// Parse act number
function parseActNumber(line: string): string | null {
  for (const pattern of ACT_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const actNum = match[1].toUpperCase();
      const numMap: Record<string, string> = {
        '1': 'ONE', '2': 'TWO', '3': 'THREE', '4': 'FOUR', '5': 'FIVE',
        'I': 'ONE', 'II': 'TWO', 'III': 'THREE', 'IV': 'FOUR', 'V': 'FIVE'
      };
      return numMap[actNum] || actNum;
    }
  }
  return null;
}

// Parse scene number
function parseSceneNumber(line: string): number | null {
  for (const pattern of SCENE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return parseNumber(match[1]);
    }
  }
  return null;
}

// Extract stage direction
function parseStageDirection(line: string): string | null {
  for (const pattern of STAGE_DIRECTION_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

// Parse character dialogue
function parseDialogue(line: string): { character: string; modifier?: string; text: string } | null {
  for (const pattern of DIALOGUE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const character = match[1].trim().toUpperCase();
      const modifier = match[2]?.trim();
      const text = match[3].trim();
      
      // Filter out non-character lines
      const excludeWords = ['SCENE', 'ACT', 'LIGHTS', 'SOUND', 'MUSIC', 'SFX', 'CUE', 'END'];
      if (excludeWords.includes(character)) return null;
      
      return { character, modifier, text };
    }
  }
  return null;
}

// Check for technical cue
function parseTechnicalCue(line: string): string | null {
  for (const pattern of TECHNICAL_CUE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

// Determine dialogue type
function getDialogueType(modifier?: string): 'spoken' | 'voiceover' {
  if (!modifier) return 'spoken';
  
  for (const pattern of OFFSTAGE_PATTERNS) {
    if (pattern.test(modifier)) {
      return 'voiceover';
    }
  }
  
  return 'spoken';
}

/**
 * Main stage play parser function
 */
export function parseStagePlay(scriptText: string): ParseResult {
  const pages: ParsedPage[] = [];
  const characterMap = new Map<string, { count: number; description?: string }>();
  const visualMarkers: VisualMarkers = {};
  const errors: ParseError[] = [];

  try {
    const lines = scriptText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    
    let currentPage: ParsedPage | null = null;
    let currentPanel: ParsedPanel | null = null;
    let currentAct: string | null = null;
    let sceneCount = 0;
    let panelCount = 0;
    let stageDirectionBuffer: string[] = [];
    
    const saveCurrentPanel = () => {
      if (currentPanel && currentPage) {
        // Add buffered stage directions as description
        if (stageDirectionBuffer.length > 0) {
          const stageText = stageDirectionBuffer.join(' ').trim();
          if (!currentPanel.description) {
            currentPanel.description = stageText;
          } else {
            currentPanel.description += ' ' + stageText;
          }
        }
        stageDirectionBuffer = [];
        
        // Only save if panel has content
        if (currentPanel.description.trim() || currentPanel.dialogue.length > 0) {
          currentPage.panels.push(currentPanel);
          
          // Track visual markers
          if (currentPanel.visualMarker) {
            visualMarkers[currentPanel.visualMarker] = (visualMarkers[currentPanel.visualMarker] || 0) + 1;
          }
        }
      }
      currentPanel = null;
    };
    
    const saveCurrentPage = () => {
      saveCurrentPanel();
      if (currentPage && currentPage.panels.length > 0) {
        pages.push(currentPage);
      }
      currentPage = null;
    };
    
    const startNewPanel = (description: string = '', marker?: string) => {
      saveCurrentPanel();
      panelCount++;
      currentPanel = {
        panelNumber: panelCount,
        description: description.trim(),
        characters: [],
        dialogue: [],
        visualMarker: marker
      };
    };
    
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Skip formatting markers
      if (line === '---' || line === '***' || line === '===') continue;
      
      // Check for act number
      const actNum = parseActNumber(line);
      if (actNum) {
        currentAct = actNum;
        // Don't create new page for act alone - wait for scene
        continue;
      }
      
      // Check for scene number
      const sceneNum = parseSceneNumber(line);
      if (sceneNum) {
        saveCurrentPage();
        sceneCount++;
        panelCount = 0;
        
        currentPage = {
          pageNumber: sceneCount,
          panels: [],
          actNumber: currentAct || undefined
        };
        
        // Create first panel for this scene
        startNewPanel(`Scene ${sceneNum}${currentAct ? ` (Act ${currentAct})` : ''}`, 'SCENE');
        continue;
      }
      
      // Check for technical cues
      const technicalCue = parseTechnicalCue(line);
      if (technicalCue) {
        if (currentPanel !== null) {
          (currentPanel as ParsedPanel).artistNotes = (currentPanel as ParsedPanel).artistNotes
            ? `${(currentPanel as ParsedPanel).artistNotes}; ${technicalCue}`
            : technicalCue;
        }
        continue;
      }
      
      // Check for stage direction
      const stageDirection = parseStageDirection(line);
      if (stageDirection) {
        // If no page yet, create one (implicit first scene)
        if (!currentPage) {
          sceneCount++;
          panelCount = 0;
          currentPage = {
            pageNumber: sceneCount,
            panels: [],
            actNumber: currentAct || undefined
          };
        }
        
        // If entrance/exit, create new panel/beat
        if (isEntranceOrExit(stageDirection)) {
          if (currentPanel) {
            // Save current panel first
            saveCurrentPanel();
          }
          startNewPanel(stageDirection, 'BLOCKING');
          
          // Extract character from entrance/exit
          const charMatch = stageDirection.match(/^([A-Z][A-Za-z\s\-'.]+)\s+(?:enters?|exits?)/i);
          if (charMatch && currentPanel !== null) {
            const charName = charMatch[1].trim().toUpperCase();
            if (!(currentPanel as ParsedPanel).characters.includes(charName)) {
              (currentPanel as ParsedPanel).characters.push(charName);
            }
          }
        } else if (hasBlockingVerb(stageDirection)) {
          // Significant blocking - might start new beat
          if (!currentPanel) {
            startNewPanel(stageDirection, 'BLOCKING');
          } else {
            // Add to current panel's description
            stageDirectionBuffer.push(stageDirection);
          }
        } else {
          // Regular stage direction - add to buffer or current panel
          if (!currentPanel) {
            startNewPanel(stageDirection);
          } else {
            stageDirectionBuffer.push(stageDirection);
          }
        }
        continue;
      }
      
      // Check for character dialogue
      const dialogue = parseDialogue(line);
      if (dialogue) {
        // Ensure we have a page and panel
        if (!currentPage) {
          sceneCount++;
          panelCount = 0;
          currentPage = {
            pageNumber: sceneCount,
            panels: [],
            actNumber: currentAct || undefined
          };
        }
        
        if (!currentPanel) {
          startNewPanel('');
        }
        
        // Track character
        const existing = characterMap.get(dialogue.character);
        if (existing) {
          existing.count++;
        } else {
          characterMap.set(dialogue.character, { count: 1 });
        }
        
        // Add to current panel's characters
        if (!currentPanel!.characters.includes(dialogue.character)) {
          currentPanel!.characters.push(dialogue.character);
        }
        
        // Add dialogue
        const dialogueLine: DialogueLine = {
          character: dialogue.character,
          text: dialogue.text,
          type: getDialogueType(dialogue.modifier),
          parenthetical: dialogue.modifier
        };
        
        currentPanel!.dialogue.push(dialogueLine);
        continue;
      }
      
      // If we get here, it's probably continuation dialogue or description
      // Add to current panel's description if we have one
      if (currentPanel) {
        stageDirectionBuffer.push(line);
      } else if (currentPage) {
        // Start a new panel with this content
        startNewPanel(line);
      }
    }
    
    // Save final page
    saveCurrentPage();
    
    // Validation
    if (pages.length === 0) {
      errors.push({
        message: 'No scenes detected. Stage plays should have "SCENE 1" or "Scene One" markers.',
        severity: 'error'
      });
    }
    
    // Build character list
    const characters: CharacterCount[] = Array.from(characterMap.entries())
      .map(([name, data]) => ({
        name,
        panelCount: data.count,
        description: data.description
      }))
      .sort((a, b) => b.panelCount - a.panelCount);
    
    return {
      pages,
      characters,
      visualMarkers,
      errors
    };
    
  } catch (error) {
    errors.push({
      message: `Stage play parser exception: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error'
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
 * Utility to get a summary of the parsed stage play
 */
export function getStagePlaySummary(result: ParseResult): string {
  const lines: string[] = [];
  
  lines.push(`Scenes: ${result.pages.length}`);
  lines.push(`Total Beats: ${result.pages.reduce((sum, p) => sum + p.panels.length, 0)}`);
  
  if (result.characters.length > 0) {
    lines.push(`\nCharacters (${result.characters.length}):`);
    result.characters.slice(0, 10).forEach(char => {
      lines.push(`  - ${char.name}: ${char.panelCount} appearances`);
    });
  }
  
  if (Object.keys(result.visualMarkers).length > 0) {
    lines.push(`\nBlocking Types:`);
    Object.entries(result.visualMarkers)
      .sort(([, a], [, b]) => b - a)
      .forEach(([marker, count]) => {
        lines.push(`  - ${marker}: ${count}`);
      });
  }
  
  if (result.errors.length > 0) {
    lines.push(`\nWarnings:`);
    result.errors.forEach(err => {
      lines.push(`  - ${err.message}`);
    });
  }
  
  return lines.join('\n');
}
