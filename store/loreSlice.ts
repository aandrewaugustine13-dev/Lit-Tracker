import { StateCreator } from 'zustand';
import { LoreEntry, LoreType } from '../types';

export interface LoreSlice {
  loreEntries: LoreEntry[];
  activeLoreEntryId: string | null;
  isLoreEditorOpen: boolean;
  loreSearchTerm: string;
  loreFilterType: LoreType | 'all';

  // Actions
  addLoreEntry: (entry: LoreEntry) => void;
  updateLoreEntry: (id: string, updates: Partial<LoreEntry>) => void;
  deleteLoreEntry: (id: string) => void;
  setActiveLoreEntry: (id: string | null) => void;
  setLoreEditorOpen: (open: boolean) => void;
  setLoreSearchTerm: (term: string) => void;
  setLoreFilterType: (type: LoreType | 'all') => void;
  linkLoreToCharacter: (loreEntryId: string, characterId: string) => void;
  unlinkLoreFromCharacter: (loreEntryId: string, characterId: string) => void;
}

export const createLoreSlice: StateCreator<LoreSlice, [], [], LoreSlice> = (set) => ({
  loreEntries: [],
  activeLoreEntryId: null,
  isLoreEditorOpen: false,
  loreSearchTerm: '',
  loreFilterType: 'all',

  addLoreEntry: (entry) => set((state) => ({
    loreEntries: [entry, ...state.loreEntries],
    activeLoreEntryId: entry.id,
    isLoreEditorOpen: true,
  })),

  updateLoreEntry: (id, updates) => set((state) => ({
    loreEntries: state.loreEntries.map((e) =>
      e.id === id ? { ...e, ...updates, updatedAt: Date.now() } as LoreEntry : e
    ),
  })),

  deleteLoreEntry: (id) => set((state) => ({
    loreEntries: state.loreEntries.filter((e) => e.id !== id),
    activeLoreEntryId: state.activeLoreEntryId === id ? null : state.activeLoreEntryId,
  })),

  setActiveLoreEntry: (id) => set({ activeLoreEntryId: id }),
  setLoreEditorOpen: (open) => set({ isLoreEditorOpen: open }),
  setLoreSearchTerm: (term) => set({ loreSearchTerm: term }),
  setLoreFilterType: (type) => set({ loreFilterType: type }),

  linkLoreToCharacter: (loreEntryId, characterId) => set((state) => ({
    loreEntries: state.loreEntries.map(e =>
      e.id === loreEntryId && !e.characterIds.includes(characterId)
        ? { ...e, characterIds: [...e.characterIds, characterId], updatedAt: Date.now() } as LoreEntry
        : e
    ),
  })),

  unlinkLoreFromCharacter: (loreEntryId, characterId) => set((state) => ({
    loreEntries: state.loreEntries.map(e =>
      e.id === loreEntryId
        ? { ...e, characterIds: e.characterIds.filter(id => id !== characterId), updatedAt: Date.now() } as LoreEntry
        : e
    ),
  })),
});
