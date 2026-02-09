import { StateCreator } from 'zustand';
import { Character, CharacterRole, Relationship, CharacterViewType, Era } from '../types';

export interface CharacterSlice {
  characters: Character[];
  relationships: Relationship[];
  activeCharacterId: string | null;
  activeEraId: string | null;
  characterView: CharacterViewType;
  isCharacterEditorOpen: boolean;
  isChatOpen: boolean;
  activeChatCharacterId: string | null;
  characterSearchTerm: string;

  // Actions
  addCharacter: (data: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  setActiveCharacter: (id: string | null) => void;
  setActiveEra: (id: string | null) => void;
  setCharacterEditorOpen: (open: boolean) => void;
  setCharacterChatOpen: (open: boolean, characterId?: string | null) => void;
  setCharacterView: (view: CharacterViewType) => void;
  setCharacterSearchTerm: (term: string) => void;
  addRelationship: (rel: Omit<Relationship, 'id'>) => void;
  deleteRelationship: (id: string) => void;
  linkCharacterToLore: (characterId: string, loreEntryId: string) => void;
  unlinkCharacterFromLore: (characterId: string, loreEntryId: string) => void;
}

export const createCharacterSlice: StateCreator<CharacterSlice, [], [], CharacterSlice> = (set) => ({
  characters: [],
  relationships: [],
  activeCharacterId: null,
  activeEraId: null,
  characterView: 'grid',
  isCharacterEditorOpen: false,
  isChatOpen: false,
  activeChatCharacterId: null,
  characterSearchTerm: '',

  addCharacter: (data) => set((state) => {
    const newChar: Character = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return {
      characters: [newChar, ...state.characters],
      activeCharacterId: newChar.id,
      activeEraId: newChar.eras[0]?.id || null,
      isCharacterEditorOpen: true,
    };
  }),

  updateCharacter: (id, updates) => set((state) => ({
    characters: state.characters.map((c) =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    ),
  })),

  deleteCharacter: (id) => set((state) => ({
    characters: state.characters.filter((c) => c.id !== id),
    relationships: state.relationships.filter(r => r.fromId !== id && r.toId !== id),
    activeCharacterId: state.activeCharacterId === id ? null : state.activeCharacterId,
  })),

  setActiveCharacter: (id) => set((state) => {
    const char = state.characters.find(c => c.id === id);
    return {
      activeCharacterId: id,
      activeEraId: char?.eras[0]?.id || null,
    };
  }),

  setActiveEra: (id) => set({ activeEraId: id }),
  setCharacterEditorOpen: (open) => set({ isCharacterEditorOpen: open }),
  setCharacterChatOpen: (open, characterId = null) => set((state) => ({
    isChatOpen: open,
    activeChatCharacterId: characterId !== undefined ? characterId : state.activeChatCharacterId,
  })),
  setCharacterView: (view) => set({ characterView: view }),
  setCharacterSearchTerm: (term) => set({ characterSearchTerm: term }),

  addRelationship: (rel) => set((state) => ({
    relationships: [...state.relationships, { ...rel, id: crypto.randomUUID() }],
  })),

  deleteRelationship: (id) => set((state) => ({
    relationships: state.relationships.filter(r => r.id !== id),
  })),

  linkCharacterToLore: (characterId, loreEntryId) => set((state) => ({
    characters: state.characters.map(c =>
      c.id === characterId && !c.loreEntryIds.includes(loreEntryId)
        ? { ...c, loreEntryIds: [...c.loreEntryIds, loreEntryId], updatedAt: Date.now() }
        : c
    ),
  })),

  unlinkCharacterFromLore: (characterId, loreEntryId) => set((state) => ({
    characters: state.characters.map(c =>
      c.id === characterId
        ? { ...c, loreEntryIds: c.loreEntryIds.filter(id => id !== loreEntryId), updatedAt: Date.now() }
        : c
    ),
  })),
});
