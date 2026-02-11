import { StateCreator } from 'zustand';
import { 
  ParsedProposal, 
  ParserStatus, 
  ProjectConfig,
  ProposedNewEntity,
  ProposedEntityUpdate,
  ProposedTimelineEvent,
} from '../types/parserTypes';
import { Character, LocationEntry, LoreType } from '../types';
import { Item, TimelineEntry } from '../types/lore';
import { EntityState } from './entityAdapter';
import { createEntityAdapter } from './entityAdapter';

// ─── UUID Helper ────────────────────────────────────────────────────────────

/**
 * Generate a UUID with fallback for environments without crypto.randomUUID
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Entity Adapters ────────────────────────────────────────────────────────

const characterAdapter = createEntityAdapter<Character>((c) => c.id);
const locationAdapter = createEntityAdapter<LocationEntry>((l) => l.id);
const itemAdapter = createEntityAdapter<Item>((i) => i.id);

// ─── Selector Functions (Memoized) ──────────────────────────────────────────

/**
 * Get all characters currently at a specific location.
 */
export function getCharactersInLocation(
  normalizedCharacters: EntityState<Character>,
  locationId: string
): Character[] {
  return normalizedCharacters.ids
    .map(id => normalizedCharacters.entities[id])
    .filter(char => char.currentLocationId === locationId);
}

/**
 * Get all items currently at a specific location.
 */
export function getItemsAtLocation(
  normalizedItems: EntityState<Item>,
  locationId: string
): Item[] {
  return normalizedItems.ids
    .map(id => normalizedItems.entities[id])
    .filter(item => item.locationId === locationId);
}

/**
 * Get all items in a character's inventory.
 */
export function getCharacterInventory(
  normalizedCharacters: EntityState<Character>,
  normalizedItems: EntityState<Item>,
  characterId: string
): Item[] {
  const character = normalizedCharacters.entities[characterId];
  if (!character || !character.inventory) return [];
  
  return character.inventory
    .map(itemId => normalizedItems.entities[itemId])
    .filter(Boolean) as Item[];
}

/**
 * Get timeline entries for a specific entity at a target epoch.
 */
export function getEntityAtEpoch(
  timeline: { entries: TimelineEntry[]; lastEpoch: number },
  entityId: string,
  targetEpoch: number
): TimelineEntry[] {
  return timeline.entries.filter(
    entry => entry.entityId === entityId && entry.epoch <= targetEpoch
  );
}

/**
 * Get all timeline entries for a specific entity.
 */
export function getEntityTimeline(
  timeline: { entries: TimelineEntry[]; lastEpoch: number },
  entityId: string
): TimelineEntry[] {
  return timeline.entries.filter(entry => entry.entityId === entityId);
}

/**
 * Get counts of proposals for display.
 */
export function getProposalCounts(proposal: ParsedProposal | null): {
  newCharacters: number;
  newLocations: number;
  newItems: number;
  updates: number;
  timelineEvents: number;
  total: number;
} {
  if (!proposal) {
    return {
      newCharacters: 0,
      newLocations: 0,
      newItems: 0,
      updates: 0,
      timelineEvents: 0,
      total: 0,
    };
  }

  const newCharacters = proposal.newEntities.filter(e => e.entityType === 'character').length;
  const newLocations = proposal.newEntities.filter(e => e.entityType === 'location').length;
  const newItems = proposal.newEntities.filter(e => e.entityType === 'item').length;
  const updates = proposal.updatedEntities.length;
  const timelineEvents = proposal.newTimelineEvents.length;

  return {
    newCharacters,
    newLocations,
    newItems,
    updates,
    timelineEvents,
    total: newCharacters + newLocations + newItems + updates + timelineEvents,
  };
}

// ─── Parser Slice ───────────────────────────────────────────────────────────

export interface ParserSlice {
  // State
  parserStatus: ParserStatus;
  currentProposal: ParsedProposal | null;
  selectedNewEntityIds: string[];
  selectedUpdateIds: string[];
  selectedTimelineEventIds: string[];
  parserErrorMessage: string | null;
  projectConfig: ProjectConfig;

  // Actions
  setParserStatus: (status: ParserStatus) => void;
  setCurrentProposal: (proposal: ParsedProposal | null) => void;
  setParserError: (error: string | null) => void;
  
  toggleNewEntitySelection: (tempId: string) => void;
  toggleUpdateSelection: (index: string) => void;
  toggleTimelineEventSelection: (tempId: string) => void;
  
  selectAllProposals: () => void;
  deselectAllProposals: () => void;
  
  updateProjectConfig: (updates: Partial<ProjectConfig>) => void;
  
  commitExtractionProposal: () => void;
}

/**
 * Helper to derive loreEntries from normalized locations (backward compat).
 */
function deriveLoreEntries(normalizedLocations: EntityState<LocationEntry>) {
  return normalizedLocations.ids.map(id => normalizedLocations.entities[id]);
}

export const createParserSlice: StateCreator<any, [], [], ParserSlice> = (set, get) => ({
  // ─── Initial State ──────────────────────────────────────────────────────────
  
  parserStatus: 'idle',
  currentProposal: null,
  selectedNewEntityIds: [],
  selectedUpdateIds: [],
  selectedTimelineEventIds: [],
  parserErrorMessage: null,
  projectConfig: {
    knownEntityNames: [],
    canonLocks: [],
    customPatterns: [],
  },

  // ─── Basic Setters ──────────────────────────────────────────────────────────
  
  setParserStatus: (status) => set({ parserStatus: status }),
  
  setCurrentProposal: (proposal) => {
    if (!proposal) {
      set({
        currentProposal: null,
        selectedNewEntityIds: [],
        selectedUpdateIds: [],
        selectedTimelineEventIds: [],
        parserStatus: 'idle',
      });
      return;
    }

    // Auto-select all proposals
    const selectedNewEntityIds = proposal.newEntities.map(e => e.tempId);
    const selectedUpdateIds = proposal.updatedEntities.map((_, idx) => idx.toString());
    const selectedTimelineEventIds = proposal.newTimelineEvents.map(e => e.tempId);

    set({
      currentProposal: proposal,
      selectedNewEntityIds,
      selectedUpdateIds,
      selectedTimelineEventIds,
      parserStatus: 'awaiting-review',
      parserErrorMessage: null,
    });
  },
  
  setParserError: (error) => set({ 
    parserErrorMessage: error,
    parserStatus: error ? 'error' : 'idle',
  }),

  // ─── Selection Toggles ──────────────────────────────────────────────────────
  
  toggleNewEntitySelection: (tempId) => set((state: any) => {
    const current = state.selectedNewEntityIds || [];
    const isSelected = current.includes(tempId);
    
    return {
      selectedNewEntityIds: isSelected
        ? current.filter((id: string) => id !== tempId)
        : [...current, tempId],
    };
  }),
  
  toggleUpdateSelection: (index) => set((state: any) => {
    const current = state.selectedUpdateIds || [];
    const isSelected = current.includes(index);
    
    return {
      selectedUpdateIds: isSelected
        ? current.filter((id: string) => id !== index)
        : [...current, index],
    };
  }),
  
  toggleTimelineEventSelection: (tempId) => set((state: any) => {
    const current = state.selectedTimelineEventIds || [];
    const isSelected = current.includes(tempId);
    
    return {
      selectedTimelineEventIds: isSelected
        ? current.filter((id: string) => id !== tempId)
        : [...current, tempId],
    };
  }),

  // ─── Select All / Deselect All ──────────────────────────────────────────────
  
  selectAllProposals: () => set((state: any) => {
    if (!state.currentProposal) return state;
    
    return {
      selectedNewEntityIds: state.currentProposal.newEntities.map((e: ProposedNewEntity) => e.tempId),
      selectedUpdateIds: state.currentProposal.updatedEntities.map((_: any, idx: number) => idx.toString()),
      selectedTimelineEventIds: state.currentProposal.newTimelineEvents.map((e: ProposedTimelineEvent) => e.tempId),
    };
  }),
  
  deselectAllProposals: () => set({
    selectedNewEntityIds: [],
    selectedUpdateIds: [],
    selectedTimelineEventIds: [],
  }),

  // ─── Config Updates ─────────────────────────────────────────────────────────
  
  updateProjectConfig: (updates) => set((state: any) => ({
    projectConfig: { ...state.projectConfig, ...updates },
  })),

  // ─── Commit Extraction Proposal ─────────────────────────────────────────────
  
  commitExtractionProposal: () => {
    const state = get();
    const proposal = state.currentProposal;
    
    if (!proposal) {
      console.warn('No proposal to commit');
      return;
    }

    set({ parserStatus: 'committing' });

    try {
      const now = Date.now();
      const timestamp = new Date().toISOString();
      
      // Filter to only approved items
      const approvedNewEntities = proposal.newEntities.filter((e: ProposedNewEntity) =>
        state.selectedNewEntityIds.includes(e.tempId)
      );
      
      const approvedUpdates = proposal.updatedEntities.filter((_: any, idx: number) =>
        state.selectedUpdateIds.includes(idx.toString())
      );
      
      const approvedTimelineEvents = proposal.newTimelineEvents.filter((e: ProposedTimelineEvent) =>
        state.selectedTimelineEventIds.includes(e.tempId)
      );

      // Prepare new state
      let newNormalizedCharacters = state.normalizedCharacters;
      let newNormalizedLocations = state.normalizedLocations;
      let newNormalizedItems = state.normalizedItems;
      let newTimeline = state.timeline;
      let newCharactersArray = state.characters || [];

      // Process new entities
      for (const proposed of approvedNewEntities) {
        if (proposed.entityType === 'character') {
          const newCharacter: Character = {
            id: generateUUID(),
            name: proposed.name,
            role: proposed.suggestedRole || 'Supporting',
            archetype: '',
            eras: [],
            voice_profile: { samples: [], style: '' },
            smart_tags: { 
              source: 'parser-extraction',
              context: proposed.contextSnippet.substring(0, 100),
            },
            gallery: [],
            loreEntryIds: [],
            description: proposed.suggestedDescription || 'Auto-created from script parser',
            createdAt: now,
            updatedAt: now,
            // CRM fields
            currentLocationId: null,
            status: 'Active',
            inventory: [],
            relationships: {},
          };
          
          // Add to normalized store
          newNormalizedCharacters = characterAdapter.upsertOne(
            newNormalizedCharacters,
            newCharacter
          );
          
          // Add to legacy array (backward compat)
          newCharactersArray = [...newCharactersArray, newCharacter];
          
          // Create timeline entry
          const epoch = newTimeline.lastEpoch + 1;
          const timelineEntry: TimelineEntry = {
            id: generateUUID(),
            epoch,
            timestamp,
            entityType: 'character',
            entityId: newCharacter.id,
            action: 'created',
            payload: { name: newCharacter.name },
            description: `Character "${newCharacter.name}" created from script`,
            createdAt: now,
            updatedAt: now,
          };
          
          newTimeline = {
            entries: [...newTimeline.entries, timelineEntry],
            lastEpoch: epoch,
          };
        } else if (proposed.entityType === 'location') {
          const newLocation: LocationEntry = {
            id: generateUUID(),
            name: proposed.name,
            type: LoreType.LOCATION,
            description: proposed.suggestedDescription || 'Auto-created from script parser',
            tags: ['parser-extraction'],
            relatedEntryIds: [],
            characterIds: [],
            region: proposed.suggestedRegion || '',
            climate: '',
            importance: '',
            createdAt: now,
            updatedAt: now,
          };
          
          newNormalizedLocations = locationAdapter.upsertOne(
            newNormalizedLocations,
            newLocation
          );
          
          // Create timeline entry
          const epoch = newTimeline.lastEpoch + 1;
          const timelineEntry: TimelineEntry = {
            id: generateUUID(),
            epoch,
            timestamp,
            entityType: 'location',
            entityId: newLocation.id,
            action: 'created',
            payload: { name: newLocation.name },
            description: `Location "${newLocation.name}" created from script`,
            createdAt: now,
            updatedAt: now,
          };
          
          newTimeline = {
            entries: [...newTimeline.entries, timelineEntry],
            lastEpoch: epoch,
          };
        } else if (proposed.entityType === 'item') {
          const newItem: Item = {
            id: generateUUID(),
            name: proposed.name,
            description: proposed.suggestedItemDescription || 'Auto-created from script parser',
            currentHolderId: proposed.suggestedHolderId || null,
            locationId: null,
            tags: ['parser-extraction'],
            createdAt: now,
            updatedAt: now,
          };
          
          newNormalizedItems = itemAdapter.upsertOne(
            newNormalizedItems,
            newItem
          );
          
          // Create timeline entry
          const epoch = newTimeline.lastEpoch + 1;
          const timelineEntry: TimelineEntry = {
            id: generateUUID(),
            epoch,
            timestamp,
            entityType: 'item',
            entityId: newItem.id,
            action: 'created',
            payload: { name: newItem.name },
            description: `Item "${newItem.name}" created from script`,
            createdAt: now,
            updatedAt: now,
          };
          
          newTimeline = {
            entries: [...newTimeline.entries, timelineEntry],
            lastEpoch: epoch,
          };
        }
      }

      // Process entity updates
      for (const update of approvedUpdates) {
        if (update.entityType === 'character') {
          newNormalizedCharacters = characterAdapter.updateOne(
            newNormalizedCharacters,
            update.entityId,
            { ...update.updates, updatedAt: now }
          );
          
          // Update legacy array
          newCharactersArray = newCharactersArray.map((c: Character) =>
            c.id === update.entityId ? { ...c, ...update.updates, updatedAt: now } : c
          );
        } else if (update.entityType === 'location') {
          newNormalizedLocations = locationAdapter.updateOne(
            newNormalizedLocations,
            update.entityId,
            { ...update.updates, updatedAt: now }
          );
        } else if (update.entityType === 'item') {
          newNormalizedItems = itemAdapter.updateOne(
            newNormalizedItems,
            update.entityId,
            { ...update.updates, updatedAt: now }
          );
        }
        
        // Create timeline entry for update
        const epoch = newTimeline.lastEpoch + 1;
        const timelineEntry: TimelineEntry = {
          id: generateUUID(),
          epoch,
          timestamp,
          entityType: update.entityType as any,
          entityId: update.entityId,
          action: 'updated',
          payload: update.updates,
          description: update.changeDescription,
          createdAt: now,
          updatedAt: now,
        };
        
        newTimeline = {
          entries: [...newTimeline.entries, timelineEntry],
          lastEpoch: epoch,
        };
      }

      // Process approved timeline events
      for (const event of approvedTimelineEvents) {
        const epoch = newTimeline.lastEpoch + 1;
        const timelineEntry: TimelineEntry = {
          id: generateUUID(),
          epoch,
          timestamp,
          entityType: event.entityType,
          entityId: event.entityId,
          action: event.action,
          payload: event.payload,
          description: event.description,
          createdAt: now,
          updatedAt: now,
        };
        
        newTimeline = {
          entries: [...newTimeline.entries, timelineEntry],
          lastEpoch: epoch,
        };
      }

      // Derive loreEntries for backward compat
      const newLoreEntries = deriveLoreEntries(newNormalizedLocations);

      // Commit all changes atomically
      set({
        normalizedCharacters: newNormalizedCharacters,
        normalizedLocations: newNormalizedLocations,
        normalizedItems: newNormalizedItems,
        timeline: newTimeline,
        characters: newCharactersArray,
        loreEntries: newLoreEntries,
        // Reset parser state
        currentProposal: null,
        selectedNewEntityIds: [],
        selectedUpdateIds: [],
        selectedTimelineEventIds: [],
        parserStatus: 'idle',
        parserErrorMessage: null,
      });

      console.log('✅ Extraction proposal committed successfully', {
        newEntities: approvedNewEntities.length,
        updates: approvedUpdates.length,
        timelineEvents: approvedTimelineEvents.length,
      });
    } catch (error) {
      console.error('❌ Failed to commit extraction proposal:', error);
      set({
        parserStatus: 'error',
        parserErrorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});
