import { StateCreator } from 'zustand';
import { 
  LoreEntry, 
  LoreType, 
  LocationEntry, 
  Character,
  Item,
  TimelineEntry,
  TimelineState,
} from '../types';
import { createEntityAdapter, EntityState } from './entityAdapter';

// =============================================================================
// ENTITY ADAPTERS — Normalized state management
// =============================================================================

const characterAdapter = createEntityAdapter<Character>((c) => c.id);
const locationAdapter = createEntityAdapter<LocationEntry>((l) => l.id);
const itemAdapter = createEntityAdapter<Item>((i) => i.id);

// =============================================================================
// LORE SLICE — Refactored to use normalized entity storage
// =============================================================================
// This slice now manages three normalized entity collections (characters, locations, items)
// plus an immutable timeline log of all state changes. Legacy flat arrays are derived
// from the normalized state for backward compatibility with existing components.

export interface LoreSlice {
  // ─── Normalized Entity Stores ───────────────────────────────────────────────
  // Single-source-of-truth for all entities. UI components should use selectors
  // to derive views rather than storing duplicate entity data.
  
  normalizedCharacters: EntityState<Character>;
  normalizedLocations: EntityState<LocationEntry>;
  normalizedItems: EntityState<Item>;
  timeline: TimelineState;

  // ─── Backward Compatibility (Derived) ───────────────────────────────────────
  // These flat arrays are maintained for backward compatibility with existing
  // components. They are derived from the normalized stores.
  
  loreEntries: LoreEntry[];  // Derived from normalizedLocations (LocationEntry is a LoreEntry subtype)
  
  // ─── UI State ───────────────────────────────────────────────────────────────
  
  activeLoreEntryId: string | null;
  isLoreEditorOpen: boolean;
  loreSearchTerm: string;
  loreFilterType: LoreType | 'all';

  // ─── Legacy Actions (Backward Compatible) ───────────────────────────────────
  
  addLoreEntry: (entry: LoreEntry) => void;
  updateLoreEntry: (id: string, updates: Partial<LoreEntry>) => void;
  deleteLoreEntry: (id: string) => void;
  setActiveLoreEntry: (id: string | null) => void;
  setLoreEditorOpen: (open: boolean) => void;
  setLoreSearchTerm: (term: string) => void;
  setLoreFilterType: (type: LoreType | 'all') => void;
  linkLoreToCharacter: (loreEntryId: string, characterId: string) => void;
  unlinkLoreFromCharacter: (loreEntryId: string, characterId: string) => void;

  // ─── Location CRUD Actions ──────────────────────────────────────────────────
  
  addLocation: (location: LocationEntry) => void;
  updateLocation: (id: string, updates: Partial<LocationEntry>) => void;
  deleteLocation: (id: string) => void;

  // ─── Item CRUD Actions ──────────────────────────────────────────────────────
  
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string) => void;

  // ─── CRM Actions (with Timeline Tracking) ───────────────────────────────────
  // These actions update entity state AND append immutable timeline entries
  // so we can reconstruct past states and maintain consistency.
  
  moveCharacterToLocation: (characterId: string, locationId: string | null) => void;
  changeCharacterStatus: (characterId: string, newStatus: string) => void;
  characterAcquireItem: (characterId: string, itemId: string) => void;
  characterDropItem: (characterId: string, itemId: string, locationId?: string | null) => void;
  setCharacterRelationship: (characterId: string, targetId: string, relationship: string) => void;
  removeCharacterRelationship: (characterId: string, targetId: string) => void;
}

// ─── Helper: Create timeline entry ──────────────────────────────────────────

function createTimelineEntry(
  state: { timeline: TimelineState },
  entityType: TimelineEntry['entityType'],
  entityId: string,
  action: TimelineEntry['action'],
  payload: Record<string, any>,
  description: string,
): TimelineEntry {
  const epoch = state.timeline.lastEpoch + 1;
  return {
    id: crypto.randomUUID(),
    epoch,
    timestamp: new Date().toISOString(),
    entityType,
    entityId,
    action,
    payload,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─── Helper: Derive loreEntries from normalized locations ───────────────────

function deriveLoreEntries(
  state: { normalizedLocations: EntityState<LocationEntry> },
  existingLoreEntries: LoreEntry[]
): LoreEntry[] {
  const nonLocationEntries = existingLoreEntries.filter(
    entry => entry.type !== LoreType.LOCATION
  );
  const locationEntries = state.normalizedLocations.ids.map(
    id => state.normalizedLocations.entities[id]
  );
  return [...nonLocationEntries, ...locationEntries];
}

// =============================================================================
// SLICE CREATOR
// =============================================================================

export const createLoreSlice: StateCreator<LoreSlice, [], [], LoreSlice> = (set, get) => ({
  // ─── Initial State ──────────────────────────────────────────────────────────
  
  normalizedCharacters: characterAdapter.getInitialState(),
  normalizedLocations: locationAdapter.getInitialState(),
  normalizedItems: itemAdapter.getInitialState(),
  timeline: {
    entries: [],
    lastEpoch: 0,
  },
  
  loreEntries: [],
  activeLoreEntryId: null,
  isLoreEditorOpen: false,
  loreSearchTerm: '',
  loreFilterType: 'all',

  // ─── Legacy Actions ─────────────────────────────────────────────────────────

  addLoreEntry: (entry) => set((state) => {
    // Route LocationEntry types to normalized storage
    if (entry.type === LoreType.LOCATION) {
      const locationEntry = entry as LocationEntry;
      const newLocations = locationAdapter.addOne(state.normalizedLocations, locationEntry);
      
      return {
        normalizedLocations: newLocations,
        loreEntries: deriveLoreEntries({ normalizedLocations: newLocations }, state.loreEntries),
        activeLoreEntryId: entry.id,
        isLoreEditorOpen: true,
      };
    }
    
    // For other lore types, keep the legacy behavior (they're not normalized yet)
    return {
      loreEntries: [entry, ...state.loreEntries],
      activeLoreEntryId: entry.id,
      isLoreEditorOpen: true,
    };
  }),

  updateLoreEntry: (id, updates) => set((state) => {
    const entry = state.normalizedLocations.entities[id];
    
    if (entry) {
      // It's a location - update in normalized storage
      // Cast updates to LocationEntry since we know it's a location
      const locationUpdates = updates as Partial<LocationEntry>;
      const newLocations = locationAdapter.updateOne(
        state.normalizedLocations, 
        id, 
        { ...locationUpdates, updatedAt: Date.now() }
      );
      
      return {
        normalizedLocations: newLocations,
        loreEntries: deriveLoreEntries({ normalizedLocations: newLocations }, state.loreEntries),
      };
    }
    
    // Not a location - update in legacy array
    return {
      loreEntries: state.loreEntries.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: Date.now() } as LoreEntry : e
      ),
    };
  }),

  deleteLoreEntry: (id) => set((state) => {
    const entry = state.normalizedLocations.entities[id];
    
    if (entry) {
      // It's a location - remove from normalized storage
      const newLocations = locationAdapter.removeOne(state.normalizedLocations, id);
      
      return {
        normalizedLocations: newLocations,
        loreEntries: deriveLoreEntries({ normalizedLocations: newLocations }, state.loreEntries),
        activeLoreEntryId: state.activeLoreEntryId === id ? null : state.activeLoreEntryId,
      };
    }
    
    // Not a location - remove from legacy array
    return {
      loreEntries: state.loreEntries.filter((e) => e.id !== id),
      activeLoreEntryId: state.activeLoreEntryId === id ? null : state.activeLoreEntryId,
    };
  }),

  setActiveLoreEntry: (id) => set({ activeLoreEntryId: id }),
  setLoreEditorOpen: (open) => set({ isLoreEditorOpen: open }),
  setLoreSearchTerm: (term) => set({ loreSearchTerm: term }),
  setLoreFilterType: (type) => set({ loreFilterType: type }),

  linkLoreToCharacter: (loreEntryId, characterId) => set((state) => {
    const location = state.normalizedLocations.entities[loreEntryId];
    
    if (location) {
      // It's a location - update in normalized storage
      const updatedLocation = {
        ...location,
        characterIds: location.characterIds.includes(characterId) 
          ? location.characterIds 
          : [...location.characterIds, characterId],
        updatedAt: Date.now(),
      };
      
      const newLocations = locationAdapter.updateOne(
        state.normalizedLocations,
        loreEntryId,
        updatedLocation
      );
      
      return {
        normalizedLocations: newLocations,
        loreEntries: deriveLoreEntries({ normalizedLocations: newLocations }, state.loreEntries),
      };
    }
    
    // Not a location - update in legacy array
    return {
      loreEntries: state.loreEntries.map(e =>
        e.id === loreEntryId && !e.characterIds.includes(characterId)
          ? { ...e, characterIds: [...e.characterIds, characterId], updatedAt: Date.now() } as LoreEntry
          : e
      ),
    };
  }),

  unlinkLoreFromCharacter: (loreEntryId, characterId) => set((state) => {
    const location = state.normalizedLocations.entities[loreEntryId];
    
    if (location) {
      // It's a location - update in normalized storage
      const updatedLocation = {
        ...location,
        characterIds: location.characterIds.filter(id => id !== characterId),
        updatedAt: Date.now(),
      };
      
      const newLocations = locationAdapter.updateOne(
        state.normalizedLocations,
        loreEntryId,
        updatedLocation
      );
      
      return {
        normalizedLocations: newLocations,
        loreEntries: deriveLoreEntries({ normalizedLocations: newLocations }, state.loreEntries),
      };
    }
    
    // Not a location - update in legacy array
    return {
      loreEntries: state.loreEntries.map(e =>
        e.id === loreEntryId
          ? { ...e, characterIds: e.characterIds.filter(id => id !== characterId), updatedAt: Date.now() } as LoreEntry
          : e
      ),
    };
  }),

  // ─── Location CRUD Actions ──────────────────────────────────────────────────

  addLocation: (location) => set((state) => {
    const timelineEntry = createTimelineEntry(
      state,
      'location',
      location.id,
      'created',
      { name: location.name },
      `Location "${location.name}" created`
    );

    const newLocations = locationAdapter.addOne(state.normalizedLocations, location);

    return {
      normalizedLocations: newLocations,
      loreEntries: deriveLoreEntries({ normalizedLocations: newLocations }, state.loreEntries),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  updateLocation: (id, updates) => set((state) => {
    const timelineEntry = createTimelineEntry(
      state,
      'location',
      id,
      'updated',
      updates,
      `Location updated`
    );

    const newLocations = locationAdapter.updateOne(
      state.normalizedLocations,
      id,
      { ...updates, updatedAt: Date.now() }
    );

    return {
      normalizedLocations: newLocations,
      loreEntries: deriveLoreEntries({ normalizedLocations: newLocations }, state.loreEntries),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  deleteLocation: (id) => set((state) => {
    const location = state.normalizedLocations.entities[id];
    const timelineEntry = createTimelineEntry(
      state,
      'location',
      id,
      'deleted',
      { name: location?.name },
      `Location "${location?.name}" deleted`
    );

    const newLocations = locationAdapter.removeOne(state.normalizedLocations, id);

    return {
      normalizedLocations: newLocations,
      loreEntries: deriveLoreEntries({ normalizedLocations: newLocations }, state.loreEntries),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  // ─── Item CRUD Actions ──────────────────────────────────────────────────────

  addItem: (item) => set((state) => {
    const timelineEntry = createTimelineEntry(
      state,
      'item',
      item.id,
      'created',
      { name: item.name },
      `Item "${item.name}" created`
    );

    return {
      normalizedItems: itemAdapter.addOne(state.normalizedItems, item),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  updateItem: (id, updates) => set((state) => {
    const timelineEntry = createTimelineEntry(
      state,
      'item',
      id,
      'updated',
      updates,
      `Item updated`
    );

    return {
      normalizedItems: itemAdapter.updateOne(
        state.normalizedItems,
        id,
        { ...updates, updatedAt: Date.now() }
      ),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  deleteItem: (id) => set((state) => {
    const item = state.normalizedItems.entities[id];
    const timelineEntry = createTimelineEntry(
      state,
      'item',
      id,
      'deleted',
      { name: item?.name },
      `Item "${item?.name}" deleted`
    );

    return {
      normalizedItems: itemAdapter.removeOne(state.normalizedItems, id),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  // ─── CRM Actions ────────────────────────────────────────────────────────────

  moveCharacterToLocation: (characterId, locationId) => set((state) => {
    const character = state.normalizedCharacters.entities[characterId];
    const location = locationId ? state.normalizedLocations.entities[locationId] : null;
    
    if (!character) return state;

    const description = locationId 
      ? `${character.name} moved to ${location?.name || 'unknown location'}`
      : `${character.name} location cleared`;

    const timelineEntry = createTimelineEntry(
      state,
      'character',
      characterId,
      'moved_to',
      { locationId, locationName: location?.name },
      description
    );

    return {
      normalizedCharacters: characterAdapter.updateOne(
        state.normalizedCharacters,
        characterId,
        { currentLocationId: locationId, updatedAt: Date.now() }
      ),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  changeCharacterStatus: (characterId, newStatus) => set((state) => {
    const character = state.normalizedCharacters.entities[characterId];
    if (!character) return state;

    const timelineEntry = createTimelineEntry(
      state,
      'character',
      characterId,
      'status_changed',
      { oldStatus: character.status, newStatus },
      `${character.name} status changed to ${newStatus}`
    );

    return {
      normalizedCharacters: characterAdapter.updateOne(
        state.normalizedCharacters,
        characterId,
        { status: newStatus, updatedAt: Date.now() }
      ),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  characterAcquireItem: (characterId, itemId) => set((state) => {
    const character = state.normalizedCharacters.entities[characterId];
    const item = state.normalizedItems.entities[itemId];
    
    if (!character || !item) return state;

    const timelineEntry = createTimelineEntry(
      state,
      'character',
      characterId,
      'acquired',
      { itemId, itemName: item.name },
      `${character.name} acquired ${item.name}`
    );

    // Update character inventory
    const newInventory = character.inventory 
      ? [...character.inventory, itemId]
      : [itemId];

    return {
      normalizedCharacters: characterAdapter.updateOne(
        state.normalizedCharacters,
        characterId,
        { inventory: newInventory, updatedAt: Date.now() }
      ),
      normalizedItems: itemAdapter.updateOne(
        state.normalizedItems,
        itemId,
        { currentHolderId: characterId, locationId: null, updatedAt: Date.now() }
      ),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  characterDropItem: (characterId, itemId, locationId = null) => set((state) => {
    const character = state.normalizedCharacters.entities[characterId];
    const item = state.normalizedItems.entities[itemId];
    const location = locationId ? state.normalizedLocations.entities[locationId] : null;
    
    if (!character || !item) return state;

    const description = locationId
      ? `${character.name} dropped ${item.name} at ${location?.name || 'unknown location'}`
      : `${character.name} dropped ${item.name}`;

    const timelineEntry = createTimelineEntry(
      state,
      'character',
      characterId,
      'dropped',
      { itemId, itemName: item.name, locationId },
      description
    );

    // Remove item from character inventory
    const newInventory = character.inventory 
      ? character.inventory.filter(id => id !== itemId)
      : [];

    // Determine the item's new location
    const effectiveLocationId = locationId || character.currentLocationId || null;

    return {
      normalizedCharacters: characterAdapter.updateOne(
        state.normalizedCharacters,
        characterId,
        { inventory: newInventory, updatedAt: Date.now() }
      ),
      normalizedItems: itemAdapter.updateOne(
        state.normalizedItems,
        itemId,
        { currentHolderId: null, locationId: effectiveLocationId, updatedAt: Date.now() }
      ),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  setCharacterRelationship: (characterId, targetId, relationship) => set((state) => {
    const character = state.normalizedCharacters.entities[characterId];
    const target = state.normalizedCharacters.entities[targetId];
    
    if (!character || !target) return state;

    const timelineEntry = createTimelineEntry(
      state,
      'character',
      characterId,
      'relationship_changed',
      { targetId, targetName: target.name, relationship },
      `${character.name} → ${target.name}: ${relationship}`
    );

    const newRelationships = {
      ...(character.relationships || {}),
      [targetId]: relationship,
    };

    return {
      normalizedCharacters: characterAdapter.updateOne(
        state.normalizedCharacters,
        characterId,
        { relationships: newRelationships, updatedAt: Date.now() }
      ),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),

  removeCharacterRelationship: (characterId, targetId) => set((state) => {
    const character = state.normalizedCharacters.entities[characterId];
    const target = state.normalizedCharacters.entities[targetId];
    
    if (!character) return state;

    const timelineEntry = createTimelineEntry(
      state,
      'character',
      characterId,
      'relationship_changed',
      { targetId, targetName: target?.name, removed: true },
      `${character.name} relationship with ${target?.name || 'unknown'} removed`
    );

    const { [targetId]: removed, ...newRelationships } = character.relationships || {};

    return {
      normalizedCharacters: characterAdapter.updateOne(
        state.normalizedCharacters,
        characterId,
        { relationships: newRelationships, updatedAt: Date.now() }
      ),
      timeline: {
        entries: [...state.timeline.entries, timelineEntry],
        lastEpoch: timelineEntry.epoch,
      },
    };
  }),
});
