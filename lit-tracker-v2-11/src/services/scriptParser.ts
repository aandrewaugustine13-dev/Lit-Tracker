import { AspectRatio } from '../types';
import {
  ParseResult as SharedParseResult,
  ParsedPage as SharedParsedPage,
  ParsedPanel as SharedParsedPanel,
  DialogueLine,
  CharacterCount,
  VisualMarkers,
  ParseError
} from './parserTypes';

// Export legacy types for backward compatibility with existing components
export type VisualMarker = 'standard' | 'echo' | 'hitch' | 'overflow' | 'shattered' | 'split' | 'splash' | 'inset' | 'large' | 'full-width';

export interface ParsedBubble {
    type: 'dialogue' | 'caption' | 'thought' | 'sfx' | 'screen-text' | 'phone';
    text: string;
    character?: string;
    modifier?: string;
}

export interface ParsedPanel {
    panelNumber: number;
    description: string;
    bubbles: ParsedBubble[];
    artistNotes: string[];
    visualMarker: VisualMarker;
    aspectRatio: AspectRatio;
    panelModifier?: string;
    startOffset?: number;  // Character offset in original script text
    endOffset?: number;    // Character offset where panel ends
}

export interface ParsedPage {
    pageNumber: number;
    panels: ParsedPanel[];
    pageNotes?: string;
}

export interface ParsedCharacter {
    name: string;
    description?: string;
    lineCount: number;
    firstAppearance?: string;
}

export interface ParsedIssue {
    title: string;
    issueNumber?: number;
    subtitle?: string;
    writer?: string;
    pageCount?: number;
    timeline?: string;
    artistNotes?: string;
}

// Legacy ParseResult for backward compatibility
export interface ParseResult {
    success: boolean;
    issue?: ParsedIssue;
    pages: ParsedPage[];
    characters: ParsedCharacter[];
    errors: string[];
    warnings: string[];
}

// Word to number mapping (extended)
const WORD_TO_NUM: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'twentyone': 21, 'twentytwo': 22, 'twentythree': 23, 'twentyfour': 24,
    'twentyfive': 25, 'twentysix': 26, 'twentyseven': 27, 'twentyeight': 28,
    'twentynine': 29, 'thirty': 30,
};

function parsePageNumber(str: string): number {
    // Clean the string: lowercase, remove hyphens and spaces
    const cleaned = str.toLowerCase().trim().replace(/[-\s]+/g, '');
    
    // Check word mapping first
    if (WORD_TO_NUM[cleaned]) {
        return WORD_TO_NUM[cleaned];
    }
    
    // Try parsing as integer
    const num = parseInt(str, 10);
    return isNaN(num) ? 0 : num;
}

// ============= PATTERN DEFINITIONS =============

// Flexible PAGE patterns that match any word or number
const PAGE_PATTERNS = [
    /^#{1,3}\s*PAGE\s+(\w+)/i,       // Matches: ### PAGE 14, ## PAGE FOURTEEN
    /^\*\*PAGE\s+(\w+)\*\*/i,         // Matches: **PAGE 14**
    /^(?:PAGE|PG)\s+(\w+)(?:\s*$|\s*\()/i,  // Matches: PAGE 14, PAGE FOURTEEN, PAGE 14 (note), PG 14 (etc.)
];

// FIXED: Simplified PANEL patterns
const PANEL_PATTERNS = [
    // Panel 1, Panel 2, etc.
    /^Panel\s+(\d+)\s*(.*)/i,
    // **Panel 1** format
    /^\*\*Panel\s+(\d+)\*\*\s*(.*)/i,
    // Panel 1 [modifier] or Panel 1 (modifier)
    /^Panel\s+(\d+)\s*[\[\(]([^\]\)]+)[\]\)]\s*(.*)/i,
    // PANEL 1: or FRAME 1:
    /^(?:PANEL|FRAME)\s*(\d+)\s*[:\-]?\s*(.*)/i,
];

// Fallback: just a number at the start of a line (1. description)
const NUMERIC_PANEL_START = /^(\d+)\.\s*(.*)/;

// Dialogue patterns
const BLOCKQUOTE_DIALOGUE = /^>\s*(?:\*\*)?([A-Z][A-Z0-9\s\-'.]{0,30})(?:\s*[\(\[<]([^\)\]>]+)[\)\]>])?\s*(?:\*\*)?\s*[:\-]\s*(.+)$/;
const BOLD_DIALOGUE = /^\*\*([A-Z][A-Z0-9\s\-'.]{0,30})(?:\s*[\(\[<]([^\)\]>]+)[\)\]>])?\s*[:\-]\*\*\s*(.+)$/;
const BOLD_DIALOGUE_ALT = /^\*\*([A-Z][A-Z0-9\s\-'.]{0,30})(?:\s*[\(\[<]([^\)\]>]+)[\)\]>])?\*\*\s*[:\-]\s*(.+)$/;
const STANDARD_DIALOGUE = /^([A-Z][A-Z0-9\s\-'.]{1,25})(?:\s*[\(\[<]([^\)\]>]+)[\)\]>])?\s*[:\-\—]\s*(.+)$/;

// Caption patterns
const BLOCKQUOTE_CAPTION = /^>\s*(?:\*\*)?CAPTION(?:\s*[\(\[<]([^\)\]>]+)[\)\]>])?\s*(?:\*\*)?\s*[:\-]\s*(.+)$/i;
const BOLD_CAPTION = /^\*\*CAPTION(?:\s*[\(\[<]([^\)\]>]+)[\)\]>])?\s*[:\-]\*\*\s*(.+)$/i;
const SIMPLE_CAPTION = /^CAPTION\s*[:\-]\s*(.+)$/i;

// SFX patterns
const BLOCKQUOTE_SFX = /^>\s*(?:\*\*)?SFX\s*(?:\*\*)?\s*[:\-]\s*(.+)$/i;
const BOLD_SFX = /^\*\*SFX\s*[:\-]\*\*\s*(.+)$/i;
const INLINE_SFX = /^SFX\s*[:\-]\s*(.+)$/i;

// Screen text pattern
const SCREEN_TEXT = /^>\s*(?:\*\*)?(?:ON\s+SCREEN|ON\s+WALL|ON\s+BOARD|LABEL|ON\s+PHONE|ON\s+TV|READOUT|DRONE\s+SCREEN|DRONE\s+FEED)(?:\s*[\(\[<]([^\)\]>]+)[\)\]>])?\s*(?:\*\*)?\s*[:\-]\s*(.+)$/i;

// Thought modifiers
const THOUGHT_MODIFIERS = ['thought', 'thought caption', 'thinking', 'inner', 'v.o.', 'vo', 'internal'];

// Artist note patterns
const ARTIST_NOTE_PATTERNS = [
    /^\*\(([^)]+)\)\*$/,
    /^\(([^)]+)\)$/,  
    /^(?:Artist\s*note|NOTE|PROMPT|REF)\s*[:\-]\s*(.+)$/i,
];

// Issue/header patterns
const ISSUE_HEADER = /^#\s+(.+)$/;
const ISSUE_NUMBER = /^##\s+Issue\s+#?(\d+)(?:\s*[:\-]\s*["]?(.+?)["]?)?$/i;

// Cast section
const CAST_HEADER = /^###\s+CAST\s+OF\s+CHARACTERS/i;
const CHARACTER_DEFINITION = /^\*\*([A-Z][A-Z\s\-'.]+)\*\*\s+(.+)$/;

// Timeline caption
const TIMELINE_CAPTION = /^>\s*CAPTION:\s*(.+)$/i;

// Inset pattern
const INSET_PATTERN = /(?:inset|micro-flash|flash|intercut)/i;

function detectVisualMarker(text: string, modifiers: string): VisualMarker {
    const combined = `${text} ${modifiers}`.toLowerCase();
    if (combined.includes('micro-flash') || combined.includes('inset')) return 'inset';
    if (combined.includes('echo') || combined.includes('shatter') || combined.includes('fracture')) return 'echo';
    if (combined.includes('hitch') || combined.includes('stutter') || combined.includes('smear')) return 'hitch';
    if (combined.includes('overflow') || combined.includes('bruise') || combined.includes('lattice')) return 'overflow';
    if (combined.includes('split')) return 'split';
    if (combined.includes('splash') || combined.includes('full-page') || combined.includes('full page')) return 'splash';
    if (combined.includes('shattered') || combined.includes('fragments')) return 'shattered';
    if (combined.includes('large') || combined.includes('larger')) return 'large';
    if (combined.includes('full-width') || combined.includes('full width')) return 'full-width';
    return 'standard';
}

function detectAspectRatio(description: string, modifier: string = ''): AspectRatio {
    const combined = `${description} ${modifier}`.toLowerCase();
    if (combined.includes('wide') || combined.includes('landscape') || combined.includes('double') || combined.includes('establishing') || combined.includes('panoramic') || combined.includes('16:9') || combined.includes('exterior') || combined.includes('full-width')) return AspectRatio.WIDE;
    if (combined.includes('tall') || combined.includes('vertical') || combined.includes('9:16') || combined.includes('portrait')) return AspectRatio.PORTRAIT;
    if (combined.includes('close') || combined.includes('face') || combined.includes('tight') || combined.includes('4:3') || combined.includes('standard')) return AspectRatio.STD;
    if (combined.includes('square') || combined.includes('1:1')) return AspectRatio.SQUARE;
    if (combined.includes('large panel') || combined.includes('splash')) return AspectRatio.WIDE;
    return AspectRatio.WIDE;
}

function isThoughtModifier(modifier: string): boolean {
    const lower = (modifier || '').toLowerCase();
    return THOUGHT_MODIFIERS.some(m => lower.includes(m));
}

function isPhoneModifier(modifier: string): boolean {
    const lower = (modifier || '').toLowerCase();
    return lower.includes('phone') || lower.includes('text') || lower.includes('comms') || lower.includes('radio');
}

function cleanDialogueText(text: string): string {
    return text.replace(/\*+$/, '').trim();
}

function extractCharacterFromLine(line: string): { character: string; modifier: string; text: string; type: 'dialogue' | 'thought' | 'phone' } | null {
    let match = line.match(BLOCKQUOTE_DIALOGUE);
    if (match) {
        const [, char, mod, txt] = match;
        const type = isThoughtModifier(mod || '') ? 'thought' : isPhoneModifier(mod || '') ? 'phone' : 'dialogue';
        return { character: char.trim().toUpperCase(), modifier: mod || '', text: cleanDialogueText(txt), type };
    }

    match = line.match(BOLD_DIALOGUE);
    if (match) {
        const [, char, mod, txt] = match;
        const type = isThoughtModifier(mod || '') ? 'thought' : isPhoneModifier(mod || '') ? 'phone' : 'dialogue';
        return { character: char.trim().toUpperCase(), modifier: mod || '', text: cleanDialogueText(txt), type };
    }

    match = line.match(BOLD_DIALOGUE_ALT);
    if (match) {
        const [, char, mod, txt] = match;
        const type = isThoughtModifier(mod || '') ? 'thought' : isPhoneModifier(mod || '') ? 'phone' : 'dialogue';
        return { character: char.trim().toUpperCase(), modifier: mod || '', text: cleanDialogueText(txt), type };
    }

    match = line.match(STANDARD_DIALOGUE);
    if (match) {
        const [, char, mod, txt] = match;
        if (['CAPTION', 'SFX', 'ON SCREEN', 'ON WALL', 'LABEL', 'NOTE', 'ARTIST'].some(k => char.toUpperCase().includes(k))) {
            return null;
        }
        const type = isThoughtModifier(mod || '') ? 'thought' : isPhoneModifier(mod || '') ? 'phone' : 'dialogue';
        return { character: char.trim().toUpperCase(), modifier: mod || '', text: cleanDialogueText(txt), type };
    }

    return null;
}

function extractCaption(line: string): string | null {
    let match = line.match(BLOCKQUOTE_CAPTION);
    if (match) return match[2].trim();

    match = line.match(BOLD_CAPTION);
    if (match) return match[2].trim();

    match = line.match(TIMELINE_CAPTION);
    if (match) return match[1].trim();

    match = line.match(SIMPLE_CAPTION);
    if (match) return match[1].trim();

    return null;
}

function extractSFX(line: string): string | null {
    let match = line.match(BLOCKQUOTE_SFX);
    if (match) return match[1].trim();

    match = line.match(BOLD_SFX);
    if (match) return match[1].trim();

    match = line.match(INLINE_SFX);
    if (match) return match[1].trim();

    return null;
}

function extractScreenText(line: string): { text: string; subtype?: string } | null {
    const match = line.match(SCREEN_TEXT);
    if (match) {
        return { text: match[2].trim(), subtype: match[1] || undefined };
    }
    return null;
}

function extractArtistNote(line: string): string | null {
    for (const pattern of ARTIST_NOTE_PATTERNS) {
        const match = line.match(pattern);
        if (match) return match[1].trim();
    }
    return null;
}

/**
 * Main parse function exported as parseComicScript for the new interface
 * Returns the standardized ParseResult from parserTypes.ts
 */
export function parseComicScript(scriptText: string): SharedParseResult {
    const legacyResult = parseScript(scriptText);
    
    // Convert legacy format to new shared format
    const pages: SharedParsedPage[] = legacyResult.pages.map(page => ({
        pageNumber: page.pageNumber,
        panels: page.panels.map(panel => {
            // Extract characters from bubbles
            const characters = Array.from(new Set(
                panel.bubbles
                    .filter(b => b.character)
                    .map(b => b.character!)
            ));
            
            // Convert bubbles to dialogue array
            const dialogue: DialogueLine[] = panel.bubbles
                .filter(b => b.character)
                .map(b => ({
                    character: b.character!,
                    text: b.text,
                    type: b.type === 'dialogue' ? 'spoken' as const :
                          b.type === 'thought' ? 'thought' as const :
                          b.type === 'caption' ? 'caption' as const :
                          'voiceover' as const
                }));
            
            return {
                panelNumber: panel.panelNumber,
                description: panel.description,
                characters,
                dialogue,
                visualMarker: panel.visualMarker !== 'standard' ? panel.visualMarker : undefined,
                artistNotes: panel.artistNotes.join(' ') || undefined
            };
        })
    }));
    
    const characters: CharacterCount[] = legacyResult.characters.map(char => ({
        name: char.name,
        panelCount: char.lineCount
    }));
    
    const visualMarkers: VisualMarkers = {};
    legacyResult.pages.forEach(page => {
        page.panels.forEach(panel => {
            if (panel.visualMarker !== 'standard') {
                visualMarkers[panel.visualMarker] = (visualMarkers[panel.visualMarker] || 0) + 1;
            }
        });
    });
    
    const errors: ParseError[] = legacyResult.errors.map(err => ({ message: err }));
    
    return {
        pages,
        characters,
        visualMarkers,
        errors
    };
}

/**
 * Legacy parseScript function for backward compatibility with ScriptImportModal
 */
export function parseScript(scriptText: string): ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const pages: ParsedPage[] = [];
    const characterMap = new Map<string, { count: number; first: string; description?: string }>();
    let issueInfo: ParsedIssue | undefined;

    try {
        const normalizedText = scriptText
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

        const allLines = normalizedText.split('\n');

        let currentPageNumber = 0;
        let currentPagePanels: ParsedPanel[] = [];
        let currentPageNotes = '';
        let currentPanelNumber = 0;
        let currentPanelDescription = '';
        let currentPanelModifier = '';
        let currentPanelBubbles: ParsedBubble[] = [];
        let currentPanelArtistNotes: string[] = [];
        let inCastSection = false;
        let inArtistNotes = false;
        let pendingCharacter: string | null = null;
        let currentPanelStartOffset = 0;
        let currentCharOffset = 0;

        const saveCurrentPanel = () => {
            if (currentPanelNumber > 0) {
                if (currentPanelDescription.trim() || currentPanelBubbles.length > 0) {
                    const visualMarker = detectVisualMarker(currentPanelDescription, currentPanelModifier);
                    const aspectRatio = detectAspectRatio(currentPanelDescription, currentPanelModifier);

                    currentPagePanels.push({
                        panelNumber: currentPanelNumber,
                        description: currentPanelDescription.trim(),
                        bubbles: [...currentPanelBubbles],
                        artistNotes: [...currentPanelArtistNotes],
                        visualMarker,
                        aspectRatio,
                        panelModifier: currentPanelModifier || undefined,
                        startOffset: currentPanelStartOffset,
                        endOffset: currentCharOffset,
                    });
                }
            }
            currentPanelDescription = '';
            currentPanelModifier = '';
            currentPanelBubbles = [];
            currentPanelArtistNotes = [];
            pendingCharacter = null;
        };

        const saveCurrentPage = () => {
            saveCurrentPanel();
            if (currentPageNumber > 0 && currentPagePanels.length > 0) {
                pages.push({
                    pageNumber: currentPageNumber,
                    panels: [...currentPagePanels],
                    pageNotes: currentPageNotes || undefined,
                });
            }
            currentPagePanels = [];
            currentPageNotes = '';
        };

        for (let i = 0; i < allLines.length; i++) {
            const line = allLines[i].trim();
            const rawLine = allLines[i];

            if (!line) {
                pendingCharacter = null;
                inArtistNotes = false;
                continue;
            }

            if (line === '---' || line === '***') {
                continue;
            }

            // Check for issue header
            const issueHeaderMatch = line.match(ISSUE_HEADER);
            if (issueHeaderMatch && !issueInfo) {
                issueInfo = { title: issueHeaderMatch[1].trim() };
                continue;
            }

            // Check for issue number
            const issueNumMatch = line.match(ISSUE_NUMBER);
            if (issueNumMatch) {
                if (!issueInfo) issueInfo = { title: '' };
                issueInfo.issueNumber = parseInt(issueNumMatch[1], 10);
                if (issueNumMatch[2]) issueInfo.subtitle = issueNumMatch[2].trim();
                continue;
            }

            // Check for writer credit
            if (line.startsWith('**Written by')) {
                const writerMatch = line.match(/\*\*Written by\s+(.+)\*\*/i);
                if (writerMatch && issueInfo) {
                    issueInfo.writer = writerMatch[1].trim();
                }
                continue;
            }

            // Check for page count
            if (line.match(/^\d+\s+Pages?\s*/i)) {
                const pageCountMatch = line.match(/^(\d+)\s+Pages?/i);
                if (pageCountMatch && issueInfo) {
                    issueInfo.pageCount = parseInt(pageCountMatch[1], 10);
                }
                continue;
            }

            // Check for timeline
            if (line.startsWith('**Timeline:')) {
                const timelineMatch = line.match(/\*\*Timeline:\s*(.+)\*\*/i);
                if (timelineMatch && issueInfo) {
                    issueInfo.timeline = timelineMatch[1].trim();
                }
                continue;
            }

            // Check for cast section
            if (CAST_HEADER.test(line)) {
                inCastSection = true;
                continue;
            }

            // Check for artist notes section
            if (line.match(/^###\s*ARTIST/i) || line.match(/^###\s*COLORIST/i)) {
                inArtistNotes = true;
                continue;
            }

            // Handle cast section
            if (inCastSection) {
                const charDefMatch = line.match(CHARACTER_DEFINITION);
                if (charDefMatch) {
                    const charName = charDefMatch[1].trim().toUpperCase();
                    const description = charDefMatch[2].trim();
                    if (!characterMap.has(charName)) {
                        characterMap.set(charName, { count: 0, first: '', description });
                    } else {
                        const existing = characterMap.get(charName)!;
                        existing.description = description;
                    }
                    continue;
                }
                if (line.startsWith('##') || line.startsWith('###')) {
                    inCastSection = false;
                }
            }

            // Check for PAGE marker
            let pageMatch: RegExpMatchArray | null = null;
            for (const pattern of PAGE_PATTERNS) {
                pageMatch = line.match(pattern);
                if (pageMatch) break;
            }
            if (pageMatch) {
                saveCurrentPage();
                currentPageNumber = parsePageNumber(pageMatch[1]);
                inCastSection = false;
                inArtistNotes = false;
                continue;
            }

            // Check for PANEL marker
            let panelMatch: RegExpMatchArray | null = null;
            for (const pattern of PANEL_PATTERNS) {
                panelMatch = line.match(pattern);
                if (panelMatch) break;
            }
            
            // Fallback to numeric panel start (1. description)
            if (!panelMatch) {
                panelMatch = line.match(NUMERIC_PANEL_START);
            }

            if (panelMatch) {
                saveCurrentPanel();
                currentPanelNumber = parseInt(panelMatch[1], 10);
                currentPanelStartOffset = currentCharOffset; // Mark where this panel starts
                
                // Handle different capture group positions
                if (panelMatch.length >= 4 && panelMatch[2] && !panelMatch[2].match(/^\d/)) {
                    // Pattern with modifier in group 2
                    currentPanelModifier = panelMatch[2].trim();
                    currentPanelDescription = (panelMatch[3] || '').trim();
                } else {
                    // Pattern without modifier or modifier in different position
                    currentPanelModifier = '';
                    currentPanelDescription = (panelMatch[2] || '').trim();
                }
                
                inCastSection = false;
                inArtistNotes = false;
                continue;
            }

            // If we're in a panel, process content
            if (currentPanelNumber > 0) {
                // Check for artist note
                const artistNote = extractArtistNote(line);
                if (artistNote) {
                    currentPanelArtistNotes.push(artistNote);
                    continue;
                }

                // Check for caption
                const caption = extractCaption(line);
                if (caption) {
                    currentPanelBubbles.push({ type: 'caption', text: caption });
                    continue;
                }

                // Check for SFX
                const sfx = extractSFX(line);
                if (sfx) {
                    currentPanelBubbles.push({ type: 'sfx', text: sfx });
                    continue;
                }

                // Check for screen text
                const screenText = extractScreenText(line);
                if (screenText) {
                    currentPanelBubbles.push({ type: 'screen-text', text: screenText.text, modifier: screenText.subtype });
                    continue;
                }

                // Check for character dialogue
                const dialogue = extractCharacterFromLine(line);
                if (dialogue) {
                    const existing = characterMap.get(dialogue.character);
                    if (existing) {
                        existing.count++;
                    } else {
                        characterMap.set(dialogue.character, { count: 1, first: currentPanelDescription });
                    }
                    currentPanelBubbles.push({
                        type: dialogue.type,
                        text: dialogue.text,
                        character: dialogue.character,
                        modifier: dialogue.modifier || undefined,
                    });
                    pendingCharacter = null;
                    continue;
                }

                // Check for indented dialogue continuation
                if (pendingCharacter && (rawLine.startsWith('  ') || rawLine.startsWith('\t'))) {
                    const text = line.trim();
                    const existing = characterMap.get(pendingCharacter);
                    if (existing) {
                        existing.count++;
                    } else {
                        characterMap.set(pendingCharacter, { count: 1, first: currentPanelDescription });
                    }
                    currentPanelBubbles.push({
                        type: 'dialogue',
                        text,
                        character: pendingCharacter,
                    });
                    continue;
                }

                // Check for standalone character name (dialogue on next line)
                if (/^[A-Z][A-Z\s\-']{1,25}$/.test(line) && !line.includes(':')) {
                    pendingCharacter = line.trim().toUpperCase();
                    continue;
                }

                // Check for inset pattern
                if (INSET_PATTERN.test(line)) {
                    currentPanelDescription += ' ' + line;
                    continue;
                }

                // Handle blockquote description lines
                if (line.startsWith('>')) {
                    const cleanedLine = line.replace(/^>\s*/, '').trim();
                    if (cleanedLine) {
                        currentPanelDescription += ' ' + cleanedLine;
                    }
                } else {
                    // Regular description line
                    if (currentPanelDescription) {
                        currentPanelDescription += ' ' + line;
                    } else {
                        currentPanelDescription = line;
                    }
                }
            } else {
                // Not in a panel yet - handle artist notes at page level
                if (inArtistNotes && currentPageNumber > 0) {
                    currentPageNotes += line + '\n';
                }
            }
            
            // Track character offset for every line
            currentCharOffset += rawLine.length + 1; // +1 for newline
        }

        // Save the final page
        saveCurrentPage();

        // Validation
        if (pages.length === 0) {
            errors.push('No story structure detected. Ensure pages start with "PAGE 1" or "PAGE ONE" and panels with "Panel 1".');
            return { success: false, pages: [], characters: [], errors, warnings };
        }

        // Sort pages by number
        pages.sort((a, b) => a.pageNumber - b.pageNumber);

        // Filter and sort characters
        const systemKeywords = ['CAPTION', 'SFX', 'TITLE', 'SUBTITLE', 'TEXT', 'NARRATION', 'DESCRIPTION', 'ACTION', 'SOUND', 'ON SCREEN', 'ON WALL', 'LABEL', 'READOUT'];
        const characters: ParsedCharacter[] = Array.from(characterMap.entries())
            .map(([name, data]) => ({
                name,
                description: data.description,
                lineCount: data.count,
                firstAppearance: data.first || undefined,
            }))
            .filter(c => !systemKeywords.some(k => c.name.toUpperCase().includes(k)))
            .filter(c => c.lineCount > 0 || c.description)
            .sort((a, b) => b.lineCount - a.lineCount);

        return { success: true, issue: issueInfo, pages, characters, errors, warnings };

    } catch (error) {
        errors.push(`Parser exception: ${error instanceof Error ? error.message : 'Unknown'}`);
        return { success: false, pages: [], characters: [], errors, warnings };
    }
}

/**
 * Utility to extract a summary of the parsed script
 */
export function getScriptSummary(result: ParseResult): string {
    if (!result.success) {
        return `Parse failed: ${result.errors.join(', ')}`;
    }

    const lines: string[] = [];

    if (result.issue) {
        lines.push(`Title: ${result.issue.title}`);
        if (result.issue.issueNumber) lines.push(`Issue #${result.issue.issueNumber}`);
        if (result.issue.subtitle) lines.push(`"${result.issue.subtitle}"`);
        if (result.issue.writer) lines.push(`Written by: ${result.issue.writer}`);
        if (result.issue.pageCount) lines.push(`Pages: ${result.issue.pageCount}`);
    }

    lines.push(`\nParsed: ${result.pages.length} pages, ${result.pages.reduce((sum, p) => sum + p.panels.length, 0)} panels`);

    if (result.characters.length > 0) {
        lines.push(`\nCharacters (${result.characters.length}):`);
        result.characters.slice(0, 10).forEach(c => {
            lines.push(`  - ${c.name}: ${c.lineCount} lines${c.description ? ` (${c.description.slice(0, 50)}...)` : ''}`);
        });
    }

    if (result.warnings.length > 0) {
        lines.push(`\nWarnings: ${result.warnings.join(', ')}`);
    }

    return lines.join('\n');
}
