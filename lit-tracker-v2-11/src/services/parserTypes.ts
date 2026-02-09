/**
 * Shared Parser Types
 * 
 * These interfaces define the common output format for all script parsers.
 * All parsers (comic, screenplay, stage play, TV series) output this same structure
 * so the rest of the app doesn't need to change - only the parsing logic differs.
 */

export interface ParseResult {
    pages: ParsedPage[];
    characters: CharacterCount[];
    visualMarkers: VisualMarkers;
    errors: ParseError[];
}

export interface ParsedPage {
    pageNumber: number;
    panels: ParsedPanel[];
    // Optional metadata for different project types
    location?: string;      // For screenplays: scene location
    timeOfDay?: string;     // For screenplays: DAY, NIGHT, etc.
    sceneType?: string;     // INT, EXT, INT/EXT
    actNumber?: string;     // For stage plays: act number
}

export interface ParsedPanel {
    panelNumber: number;
    description: string;
    characters: string[];
    dialogue: DialogueLine[];
    visualMarker?: string;
    artistNotes?: string;
    // Screenplay-specific
    shotType?: string;      // CLOSE UP, WIDE, etc.
    transition?: string;    // CUT TO, FADE TO, etc.
}

export interface DialogueLine {
    character: string;
    text: string;
    type: 'spoken' | 'voiceover' | 'caption' | 'thought';
    parenthetical?: string; // (V.O.), (O.S.), (CONT'D), stage directions, etc.
}

export interface CharacterCount {
    name: string;
    panelCount: number;
    description?: string;   // Character description if available
}

export type VisualMarkers = Record<string, number>;

export interface ParseError {
    message: string;
    line?: number;
    severity?: 'error' | 'warning' | 'info';
}
