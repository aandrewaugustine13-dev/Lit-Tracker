import { StateCreator } from 'zustand';
import { Character } from '../types';

// =============================================================================
// CROSS-SLICE — Cross-cutting actions that orchestrate updates across multiple slices
// =============================================================================

export interface CrossSlice {
  updateEntity: (id: string, data: Partial<Character>) => void;
  autoCreateFromScript: (text: string) => string[];
}

// Helper to escape special regex characters in character names
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Common screenplay direction keywords to filter out
const SCREENPLAY_KEYWORDS = new Set([
  'INT', 'EXT', 'CUT', 'FADE', 'DISSOLVE', 'SMASH', 'MATCH', 'CONTINUED',
  'CONT', 'ANGLE', 'CLOSE', 'WIDE', 'PAN', 'ZOOM', 'SFX', 'VO', 'OS', 'OC',
  'POV', 'INSERT', 'SUPER', 'TITLE', 'THE', 'AND', 'BUT', 'FOR', 'NOT',
  'WITH', 'FROM', 'PAGE', 'PANEL', 'SCENE', 'ACT', 'END', 'DAY', 'NIGHT',
  'MORNING', 'EVENING', 'LATER', 'CONTINUOUS', 'INTERCUT', 'FLASHBACK',
  'MONTAGE', 'BEGIN', 'RESUME', 'BACK', 'SAME', 'TIME',
]);

// Convert string to title case
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// NOTE: This slice needs access to the full LitStore type to read/write across all slices.
// The first generic parameter must be the complete LitStore intersection type.
// TypeScript will infer this when the slice is composed in index.ts.
export const createCrossSlice: StateCreator<any, [], [], CrossSlice> = (set, get) => ({
  /**
   * Updates a character and propagates name changes through all Ink Tracker content.
   * If data.name is provided and differs from the current name, it walks through
   * all ink projects → issues → pages → panels → textElements and replaces
   * occurrences of the old character name with the new name in textElement.content
   * using word-boundary regex matching (case-insensitive).
   */
  updateEntity: (id: string, data: Partial<Character>) => {
    const state = get();
    const character = state.characters.find((c: Character) => c.id === id);
    
    if (!character) {
      console.warn(`Character with id ${id} not found`);
      return;
    }

    // First, update the character record
    state.updateCharacter(id, data);

    // If name is being changed, propagate through ink tracker content
    if (data.name && data.name !== character.name) {
      const oldName = character.name;
      const newName = data.name;
      
      // Create a word-boundary regex for the old name (case-insensitive)
      const escapedOldName = escapeRegex(oldName);
      const nameRegex = new RegExp(`\\b${escapedOldName}\\b`, 'gi');

      // Clone the current ink state
      const inkState = state.inkState;
      const updatedInkState = {
        ...inkState,
        projects: inkState.projects.map((project: any) => ({
          ...project,
          issues: project.issues.map((issue: any) => ({
            ...issue,
            pages: issue.pages.map((page: any) => ({
              ...page,
              panels: page.panels.map((panel: any) => ({
                ...panel,
                textElements: panel.textElements.map((textElement: any) => {
                  // Replace old name with new name in the content
                  const updatedContent = textElement.content.replace(nameRegex, newName);
                  return {
                    ...textElement,
                    content: updatedContent,
                  };
                }),
              })),
            })),
          })),
        })),
      };

      // Push the updated ink state via inkDispatch
      state.inkDispatch({ type: 'HYDRATE', payload: updatedInkState });
    }
  },

  /**
   * Scans the provided script text for CAPITALIZED NAMES (standard screenplay convention).
   * Filters out common screenplay direction keywords and compares found names against
   * existing characters (case-insensitive). For each new name, creates a placeholder
   * Character object and adds it to the characters array. Returns an array of the
   * newly created character IDs.
   */
  autoCreateFromScript: (text: string): string[] => {
    const state = get();
    
    // Extract all-caps words/phrases using the specified regex pattern
    const pattern = /\b([A-Z][A-Z '.-]{1,30})\b/g;
    const matches = text.match(pattern) || [];
    
    // Create a set of unique capitalized names, filtering out screenplay keywords
    const uniqueNames = new Set<string>();
    matches.forEach((match) => {
      const trimmed = match.trim();
      // Filter out screenplay keywords
      if (!SCREENPLAY_KEYWORDS.has(trimmed)) {
        uniqueNames.add(trimmed);
      }
    });

    // Get existing character names (case-insensitive comparison)
    const existingNames = new Set(
      state.characters.map((c: Character) => c.name.toLowerCase())
    );

    // Create new characters for names that don't exist yet
    const newCharacters: Character[] = [];
    const newCharacterIds: string[] = [];
    
    uniqueNames.forEach((name) => {
      const lowerName = name.toLowerCase();
      
      // Skip if character already exists
      if (existingNames.has(lowerName)) {
        return;
      }

      // Create a new character with placeholder data
      const newCharacter: Character = {
        id: crypto.randomUUID(),
        name: toTitleCase(name),
        role: 'Supporting',
        archetype: '',
        eras: [],
        voice_profile: {
          samples: [],
          style: '',
        },
        smart_tags: {
          source: 'auto-script-import',
        },
        gallery: [],
        loreEntryIds: [],
        description: 'Auto-created from script import',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add to the lists
      newCharacters.push(newCharacter);
      newCharacterIds.push(newCharacter.id);
      
      // Add to existing names set to avoid duplicates in this batch
      existingNames.add(lowerName);
    });

    // Add all new characters to the store using set()
    if (newCharacters.length > 0) {
      set((prevState: any) => ({
        characters: [...newCharacters, ...prevState.characters],
      }));
    }

    return newCharacterIds;
  },
});
