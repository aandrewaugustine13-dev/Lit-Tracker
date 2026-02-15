import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CharacterSlice, createCharacterSlice } from './characterSlice';
import { LoreSlice, createLoreSlice } from './loreSlice';
import { NavSlice, createNavSlice } from './navSlice';
import { InkSlice, createInkSlice } from './inkSlice';
import { DetailSlice, createDetailSlice } from './detailSlice';
import { CrossSlice, createCrossSlice } from './crossSlice';
import { ParserSlice, createParserSlice } from './parserSlice';

// Combined store type
export type LitStore = CharacterSlice & LoreSlice & NavSlice & InkSlice & DetailSlice & CrossSlice & ParserSlice;

export const useLitStore = create<LitStore>()(
  persist(
    (...a) => ({
      ...createCharacterSlice(...a),
      ...createLoreSlice(...a),
      ...createNavSlice(...a),
      ...createInkSlice(...a),
      ...createDetailSlice(...a),
      ...createCrossSlice(...a),
      ...createParserSlice(...a),
    }),
    {
      name: 'lit-tracker-v1',
      storage: createJSONStorage(() => localStorage),
      // Persist data, including new normalized stores and timeline.
      // Ink state persists itself to 'ink_tracker_data' for backward compat.
      partialize: (state) => ({
        // Legacy state (backward compatible)
        characters: state.characters,
        relationships: state.relationships,
        loreEntries: state.loreEntries,
        projectName: state.projectName,
        activeModule: state.activeModule,
        
        // New normalized state
        normalizedCharacters: state.normalizedCharacters,
        normalizedLocations: state.normalizedLocations,
        normalizedItems: state.normalizedItems,
        timeline: state.timeline,
        
        // Parser state
        parserStatus: state.parserStatus,
        currentProposal: state.currentProposal,
        projectConfig: state.projectConfig,
        parsedScriptResult: state.parsedScriptResult,
        rawScriptText: state.rawScriptText,
      }),
    }
  )
);

// ─── Legacy Selectors (Backward Compatible) ─────────────────────────────────

export const useCharacters = () => useLitStore((s) => s.characters);
export const useLoreEntries = () => useLitStore((s) => s.loreEntries);
export const useActiveModule = () => useLitStore((s) => s.activeModule);

// Cross-reference selectors
export const useCharacterLoreEntries = (characterId: string) =>
  useLitStore((s) => {
    const char = s.characters.find(c => c.id === characterId);
    if (!char) return [];
    return s.loreEntries.filter(e => char.loreEntryIds.includes(e.id));
  });

export const useLoreEntryCharacters = (loreEntryId: string) =>
  useLitStore((s) => {
    const entry = s.loreEntries.find(e => e.id === loreEntryId);
    if (!entry) return [];
    return s.characters.filter(c => entry.characterIds.includes(c.id));
  });

// ─── Re-export New Selectors ────────────────────────────────────────────────

export * from './selectors';
