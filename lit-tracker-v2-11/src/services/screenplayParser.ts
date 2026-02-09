/**
 * Screenplay Parser
 * 
 * Parses industry-standard screenplay format into the common ParseResult structure.
 * 
 * Format recognition:
 * - Scene headings: INT./EXT. LOCATION - TIME
 * - Shot directions: ANGLE ON, CLOSE UP, WIDE SHOT, POV, INSERT, etc.
 * - Character dialogue: Centered CHARACTER NAME followed by dialogue
 * - Parentheticals: (V.O.), (O.S.), (CONT'D), (INTO PHONE), etc.
 * - Action lines: Standard paragraph text
 * - Transitions: CUT TO:, FADE TO:, DISSOLVE TO:, etc.
 * - SFX/Sound: SFX: or SOUND:
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

// Scene heading patterns (slug lines)
const SCENE_HEADING_PATTERNS = [
  /^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|I\/E\.|E\/I\.)\s*(.+?)\s*[-–—]\s*(.+)$/i,  // Full format: INT. LOCATION - TIME
  /^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|I\/E\.|E\/I\.)\s*(.+)$/i,  // Without time: INT. LOCATION
];

// Shot/camera direction patterns (these start new panels)
const SHOT_PATTERNS = [
  /^(ANGLE ON)\s*[-–—:]?\s*(.*)$/i,
  /^(CLOSE UP|CLOSE ON|CLOSEUP|CU|ECU|EXTREME CLOSE UP)\s*[-–—:]?\s*(.*)$/i,
  /^(WIDE SHOT|WIDE ON|WIDE|WS|EWS|EXTREME WIDE)\s*[-–—:]?\s*(.*)$/i,
  /^(ESTABLISHING|ESTABLISHING SHOT)\s*[-–—:]?\s*(.*)$/i,
  /^(POV|POV SHOT)\s*[-–—:]?\s*(.*)$/i,
  /^(INSERT|INSERT SHOT)\s*[-–—:]?\s*(.*)$/i,
  /^(TWO SHOT|2 SHOT|2-SHOT)\s*[-–—:]?\s*(.*)$/i,
  /^(THREE SHOT|3 SHOT|3-SHOT)\s*[-–—:]?\s*(.*)$/i,
  /^(OVER THE SHOULDER|OTS|O\.T\.S\.)\s*[-–—:]?\s*(.*)$/i,
  /^(TRACKING|TRACKING SHOT|DOLLY|STEADICAM)\s*[-–—:]?\s*(.*)$/i,
  /^(PAN TO|PAN|TILT)\s*[-–—:]?\s*(.*)$/i,
  /^(PUSH IN|PULL BACK|PULL OUT|ZOOM)\s*[-–—:]?\s*(.*)$/i,
  /^(MEDIUM SHOT|MED SHOT|MS|MCU|MEDIUM CLOSE UP)\s*[-–—:]?\s*(.*)$/i,
  /^(LONG SHOT|LS|FULL SHOT)\s*[-–—:]?\s*(.*)$/i,
  /^(LOW ANGLE|HIGH ANGLE|DUTCH ANGLE|BIRD'S EYE|WORM'S EYE)\s*[-–—:]?\s*(.*)$/i,
  /^(AERIAL|CRANE|HELICOPTER SHOT)\s*[-–—:]?\s*(.*)$/i,
  /^(REVERSE ANGLE|REVERSE)\s*[-–—:]?\s*(.*)$/i,
  /^(BACK TO SCENE|BACK TO)\s*[-–—:]?\s*(.*)$/i,
];

// Character name pattern (centered, ALL CAPS, with optional parentheticals)
// In screenplays, character names are typically indented and in ALL CAPS
const CHARACTER_NAME_PATTERN = /^([A-Z][A-Z0-9\s\-'.]+?)(?:\s*\(([^)]+)\))?\s*$/;

// Parenthetical patterns
const PARENTHETICAL_PATTERNS = {
  voiceover: /\b(V\.?O\.?|VOICE\s*OVER|VOICEOVER)\b/i,
  offscreen: /\b(O\.?S\.?|OFF\s*SCREEN|OFFSCREEN|OFF)\b/i,
  contd: /\b(CONT'?D?\.?|CONTINUED|CONTINUING)\b/i,
  phone: /\b(INTO\s*PHONE|ON\s*PHONE|PHONE|INTO\s*COMMS?|RADIO)\b/i,
  filtered: /\b(FILTERED|DISTORTED|ECHO)\b/i,
};

// Transition patterns
const TRANSITION_PATTERNS = [
  /^(CUT TO):?$/i,
  /^(FADE TO):?$/i,
  /^(FADE IN):?\.?$/i,
  /^(FADE OUT):?\.?$/i,
  /^(DISSOLVE TO):?$/i,
  /^(SMASH CUT TO):?$/i,
  /^(SMASH CUT):?$/i,
  /^(MATCH CUT TO):?$/i,
  /^(MATCH CUT):?$/i,
  /^(JUMP CUT TO):?$/i,
  /^(WIPE TO):?$/i,
  /^(IRIS IN|IRIS OUT):?$/i,
  /^(TIME CUT):?$/i,
  /^(INTERCUT):?$/i,
  /^(SPLIT SCREEN):?$/i,
  /^(FREEZE FRAME):?$/i,
  /^(END OF|THE END|FADE TO BLACK):?\.?$/i,
];

// SFX/Sound patterns
const SFX_PATTERN = /^(?:SFX|SOUND|SND|AUDIO)\s*[:–—-]\s*(.+)$/i;

// Check if a line looks like centered text (multiple leading spaces or tabs)
function isLikelyCenteredOrIndented(rawLine: string): boolean {
  // Screenplay format typically has character names indented ~37 spaces (center of 72-char line)
  // or at least 15+ spaces for dialogue blocks
  const leadingSpaces = rawLine.match(/^(\s*)/)?.[1].length || 0;
  return leadingSpaces >= 10 || rawLine.startsWith('\t\t');
}

// Check if line is a dialogue parenthetical
function isParenthetical(line: string): boolean {
  return /^\([^)]+\)$/.test(line.trim());
}

// Extract parenthetical content
function extractParenthetical(text: string): string | undefined {
  const match = text.match(/^\(([^)]+)\)$/);
  return match ? match[1] : undefined;
}

// Determine dialogue type from parenthetical
function getDialogueType(parenthetical?: string): 'spoken' | 'voiceover' | 'thought' {
  if (!parenthetical) return 'spoken';
  
  if (PARENTHETICAL_PATTERNS.voiceover.test(parenthetical)) return 'voiceover';
  if (PARENTHETICAL_PATTERNS.offscreen.test(parenthetical)) return 'spoken'; // O.S. is still spoken, just off-screen
  
  return 'spoken';
}

// Check if line is a transition
function isTransition(line: string): string | null {
  for (const pattern of TRANSITION_PATTERNS) {
    const match = line.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

// Check if line is a shot direction
function parseShot(line: string): { type: string; subject: string } | null {
  for (const pattern of SHOT_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return {
        type: normalizeShot(match[1]),
        subject: (match[2] || '').trim()
      };
    }
  }
  return null;
}

// Normalize shot type names
function normalizeShot(shot: string): string {
  const upper = shot.toUpperCase().trim();
  
  // Normalize variations
  if (upper.includes('CLOSE')) return 'CLOSE UP';
  if (upper.includes('WIDE') || upper === 'EWS') return 'WIDE SHOT';
  if (upper.includes('ESTABLISH')) return 'ESTABLISHING';
  if (upper === 'POV' || upper === 'POV SHOT') return 'POV';
  if (upper.includes('INSERT')) return 'INSERT';
  if (upper.includes('TWO') || upper.includes('2')) return 'TWO SHOT';
  if (upper.includes('THREE') || upper.includes('3')) return 'THREE SHOT';
  if (upper.includes('OVER') || upper === 'OTS' || upper === 'O.T.S.') return 'OVER THE SHOULDER';
  if (upper.includes('TRACK') || upper.includes('DOLLY') || upper.includes('STEADY')) return 'TRACKING';
  if (upper.includes('PAN')) return 'PAN';
  if (upper.includes('MEDIUM') || upper === 'MS' || upper === 'MCU') return 'MEDIUM SHOT';
  if (upper.includes('LONG') || upper === 'LS' || upper === 'FULL SHOT') return 'LONG SHOT';
  if (upper.includes('LOW ANGLE')) return 'LOW ANGLE';
  if (upper.includes('HIGH ANGLE')) return 'HIGH ANGLE';
  if (upper.includes('AERIAL') || upper.includes('CRANE') || upper.includes('HELICOPTER')) return 'AERIAL';
  if (upper.includes('REVERSE')) return 'REVERSE ANGLE';
  if (upper.includes('BACK TO')) return 'BACK TO SCENE';
  
  return upper;
}

// Check if line is a valid character name
function isCharacterName(line: string, rawLine: string): boolean {
  // Must be relatively short (character names typically < 30 chars)
  if (line.length > 35) return false;
  
  // Must be mostly uppercase letters
  const textOnly = line.replace(/[^\w\s]/g, '').trim();
  if (!/^[A-Z][A-Z0-9\s\-'.]+$/.test(textOnly)) return false;
  
  // Should be indented or centered (in proper screenplay format)
  // But we'll be lenient for plain text imports
  
  // Exclude common non-character words
  const excludeWords = [
    'THE', 'END', 'FADE', 'CUT', 'DISSOLVE', 'INT', 'EXT', 'DAY', 'NIGHT',
    'MORNING', 'EVENING', 'AFTERNOON', 'CONTINUOUS', 'LATER', 'SAME',
    'ANGLE', 'CLOSE', 'WIDE', 'INSERT', 'POV', 'BACK', 'SCENE', 'SHOT',
    'TRACKING', 'ESTABLISHING', 'SFX', 'SOUND', 'MUSIC', 'SUPER', 'TITLE',
    'CONTINUED', 'MORE', 'CONTD', 'OVER', 'FREEZE', 'FRAME'
  ];
  
  if (excludeWords.includes(textOnly)) return false;
  
  return true;
}

// Parse scene heading
function parseSceneHeading(line: string): { sceneType: string; location: string; timeOfDay?: string } | null {
  for (const pattern of SCENE_HEADING_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const sceneType = match[1].toUpperCase().replace('.', '').trim();
      const location = (match[2] || '').trim();
      const timeOfDay = match[3] ? match[3].trim().toUpperCase() : undefined;
      
      return { sceneType, location, timeOfDay };
    }
  }
  return null;
}

// Extract SFX
function parseSFX(line: string): string | null {
  const match = line.match(SFX_PATTERN);
  return match ? match[1].trim() : null;
}

/**
 * Main screenplay parser function
 */
export function parseScreenplay(scriptText: string): ParseResult {
  const pages: ParsedPage[] = [];
  const characterMap = new Map<string, { count: number; description?: string }>();
  const visualMarkers: VisualMarkers = {};
  const errors: ParseError[] = [];

  try {
    const lines = scriptText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    
    let currentPage: ParsedPage | null = null;
    let currentPanel: ParsedPanel | null = null;
    let currentCharacter: string | null = null;
    let currentParenthetical: string | null = null;
    let actionBuffer: string[] = [];
    let sceneCount = 0;
    let panelCount = 0;
    
    const saveCurrentPanel = () => {
      if (currentPanel && currentPage) {
        // Add buffered action as description
        if (actionBuffer.length > 0 && !currentPanel.description) {
          currentPanel.description = actionBuffer.join(' ').trim();
        } else if (actionBuffer.length > 0) {
          currentPanel.description += ' ' + actionBuffer.join(' ').trim();
        }
        actionBuffer = [];
        
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
      currentCharacter = null;
      currentParenthetical = null;
    };
    
    const saveCurrentPage = () => {
      saveCurrentPanel();
      if (currentPage && currentPage.panels.length > 0) {
        pages.push(currentPage);
      }
      currentPage = null;
    };
    
    const startNewPanel = (description: string = '', shotType?: string) => {
      saveCurrentPanel();
      panelCount++;
      currentPanel = {
        panelNumber: panelCount,
        description: description.trim(),
        characters: [],
        dialogue: [],
        visualMarker: shotType,
        shotType
      };
    };
    
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      
      // Skip empty lines but reset character state
      if (!line) {
        currentCharacter = null;
        currentParenthetical = null;
        continue;
      }
      
      // Skip page breaks and formatting markers
      if (line === '---' || line === '***' || line === '===') continue;
      
      // Check for scene heading
      const sceneHeading = parseSceneHeading(line);
      if (sceneHeading) {
        saveCurrentPage();
        sceneCount++;
        panelCount = 0;
        
        currentPage = {
          pageNumber: sceneCount,
          panels: [],
          sceneType: sceneHeading.sceneType,
          location: sceneHeading.location,
          timeOfDay: sceneHeading.timeOfDay
        };
        
        // Create first panel with scene description
        startNewPanel(`${sceneHeading.sceneType}. ${sceneHeading.location}${sceneHeading.timeOfDay ? ' - ' + sceneHeading.timeOfDay : ''}`, 'ESTABLISHING');
        continue;
      }
      
      // Check for shot/camera direction
      const shot = parseShot(line);
      if (shot) {
        if (!currentPage) {
          // No scene yet, create implicit first scene
          sceneCount++;
          panelCount = 0;
          currentPage = {
            pageNumber: sceneCount,
            panels: []
          };
        }
        
        const shotDesc = shot.subject || '';
        startNewPanel(shotDesc, shot.type);
        continue;
      }
      
      // Check for transition
      const transition = isTransition(line);
      if (transition) {
        if (currentPanel !== null) {
          (currentPanel as ParsedPanel).transition = transition;
          (currentPanel as ParsedPanel).artistNotes = (currentPanel as ParsedPanel).artistNotes 
            ? `${(currentPanel as ParsedPanel).artistNotes}; ${transition}` 
            : transition;
        }
        continue;
      }
      
      // Check for SFX
      const sfx = parseSFX(line);
      if (sfx) {
        if (currentPanel !== null) {
          (currentPanel as ParsedPanel).artistNotes = (currentPanel as ParsedPanel).artistNotes
            ? `${(currentPanel as ParsedPanel).artistNotes}; SFX: ${sfx}`
            : `SFX: ${sfx}`;
        }
        continue;
      }
      
      // Check if this is a parenthetical (comes between character name and dialogue)
      if (isParenthetical(line)) {
        currentParenthetical = extractParenthetical(line) || null;
        continue;
      }
      
      // Check for character name (potential dialogue coming)
      if (isCharacterName(line, rawLine)) {
        const match = line.match(CHARACTER_NAME_PATTERN);
        if (match) {
          currentCharacter = match[1].trim().toUpperCase();
          
          // Handle inline parenthetical like "JOHN (V.O.)"
          if (match[2]) {
            currentParenthetical = match[2];
          }
          
          // Track character
          const existing = characterMap.get(currentCharacter);
          if (existing) {
            existing.count++;
          } else {
            characterMap.set(currentCharacter, { count: 1 });
          }
          
          // Add to current panel's characters
          if (currentPanel !== null && !(currentPanel as ParsedPanel).characters.includes(currentCharacter)) {
            (currentPanel as ParsedPanel).characters.push(currentCharacter);
          }
          
          continue;
        }
      }
      
      // If we have a current character, this line is probably dialogue
      if (currentCharacter) {
        // This is dialogue
        const dialogueType = getDialogueType(currentParenthetical || undefined);
        
        // Ensure we have a panel
        if (!currentPanel) {
          if (!currentPage) {
            sceneCount++;
            panelCount = 0;
            currentPage = { pageNumber: sceneCount, panels: [] };
          }
          startNewPanel('');
        }
        
        const dialogueLine: DialogueLine = {
          character: currentCharacter,
          text: line,
          type: dialogueType,
          parenthetical: currentParenthetical || undefined
        };
        
        currentPanel!.dialogue.push(dialogueLine);
        
        // Reset parenthetical after use
        currentParenthetical = null;
        continue;
      }
      
      // This is an action line
      // If we don't have a current panel, create one
      if (!currentPage) {
        // Script starts without a scene heading - create implicit scene
        sceneCount++;
        panelCount = 0;
        currentPage = { pageNumber: sceneCount, panels: [] };
      }
      
      if (!currentPanel) {
        startNewPanel('');
      }
      
      // Add to action buffer
      actionBuffer.push(line);
    }
    
    // Save final page
    saveCurrentPage();
    
    // Validation
    if (pages.length === 0) {
      errors.push({
        message: 'No scenes detected. Screenplay scenes should start with INT. or EXT. (e.g., "INT. COFFEE SHOP - DAY")',
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
      message: `Screenplay parser exception: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
 * Utility to get a summary of the parsed screenplay
 */
export function getScreenplaySummary(result: ParseResult): string {
  const lines: string[] = [];
  
  lines.push(`Scenes: ${result.pages.length}`);
  lines.push(`Total Shots: ${result.pages.reduce((sum, p) => sum + p.panels.length, 0)}`);
  
  if (result.characters.length > 0) {
    lines.push(`\nCharacters (${result.characters.length}):`);
    result.characters.slice(0, 10).forEach(char => {
      lines.push(`  - ${char.name}: ${char.panelCount} appearances`);
    });
  }
  
  if (Object.keys(result.visualMarkers).length > 0) {
    lines.push(`\nShot Types Used:`);
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
