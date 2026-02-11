import { StateCreator } from 'zustand';
import { Character, LocationEntry, LoreType, CharacterRole } from '../types';
import { Item, TimelineEntry } from '../types/lore';
import {
  ParsedProposal,
  ParserStatus,
  ProjectConfig,
  ProposedNewEntity,
  ProposedEntityUpdate,
  ProposedTimelineEvent,
} from '../types/parserTypes';
import { createEntityAdapter, EntityState } from './entityAdapter';
import { genId, createDefaultEra } from '../utils/helpers';

// =============================================================================
// ENTITY ADAPTERS — Same pattern as loreSlice.ts
// =============================================================================

const characterAdapter = createEntityAdapter<Character>((c) => c.id);
const locationAdapter = createEntityAdapter<LocationEntry>((l) => l.id);
const itemAdapter = createEntityAdapter<Item>((i) => i.id);

// =============================================================================
// PARSER SLICE — State management for Universal Script Parser
// =============================================================================

export interface ParserSlice {
  // ─── Parser State ───────────────────────────────────────────────────────────
  
  parserStatus: ParserStatus;
  currentProposal: ParsedProposal | null;
  selectedNewEntityIds: string[];
  selectedUpdateIds: string[];
  selectedTimelineEventIds: string[];
  parserErrorMessage: string | null;
  projectConfig: ProjectConfig;

  // ─── Actions ────────────────────────────────────────────────────────────────
  
  setParserStatus: (status: ParserStatus) => void;
  setCurrentProposal: (proposal: ParsedProposal | null) => void;
  setParserError: (message: string | null) => void;
  toggleNewEntitySelection: (tempId: string) => void;
  toggleUpdateSelection: (index: number) => void;
  toggleTimelineEventSelection: (tempId: string) => void;
  selectAllProposals: () => void;
  deselectAllProposals: () => void;
  updateProjectConfig: (updates: Partial<ProjectConfig>) => void;
  commitExtractionProposal: () => void;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Create a timeline entry for a CRM action.
 */
function createTimelineEntry(
  lastEpoch: number,
  entityType: TimelineEntry['entityType'],
  entityId: string,
  action: TimelineEntry['action'],
  payload: Record<string, any>,
  description: string,
): TimelineEntry {
  const epoch = lastEpoch + 1;
  return {
    id: genId(),
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

/**
 * Derive loreEntries from normalized locations (for backward compatibility).
 */
function deriveLoreEntries(normalizedLocations: EntityState<LocationEntry>): LocationEntry[] {
  return normalizedLocations.ids.map(id => normalizedLocations.entities[id]);
}

// =============================================================================
// SLICE CREATOR
// =============================================================================

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

  // ─── Actions ────────────────────────────────────────────────────────────────

  setParserStatus: (status: ParserStatus) => {
    set({ parserStatus: status });
  },

  setCurrentProposal: (proposal: ParsedProposal | null) => {
    if (proposal === null) {
      // Reset all selections and set status to idle
      set({
        currentProposal: null,
        selectedNewEntityIds: [],
        selectedUpdateIds: [],
        selectedTimelineEventIds: [],
        parserStatus: 'idle',
      });
    } else {
      // Auto-select all proposals and set status to awaiting-review
      const selectedNewEntityIds = proposal.newEntities.map(e => e.tempId);
      const selectedUpdateIds = proposal.updatedEntities.map((_, idx) => String(idx));
      const selectedTimelineEventIds = proposal.newTimelineEvents.map(e => e.tempId);
      
      set({
        currentProposal: proposal,
        selectedNewEntityIds,
        selectedUpdateIds,
        selectedTimelineEventIds,
        parserStatus: 'awaiting-review',
      });
    }
  },

  setParserError: (message: string | null) => {
    set({
      parserErrorMessage: message,
      parserStatus: message ? 'error' : 'idle',
    });
  },

  toggleNewEntitySelection: (tempId: string) => {
    set((state: any) => {
      const selected = state.selectedNewEntityIds;
      const isSelected = selected.includes(tempId);
      
      return {
        selectedNewEntityIds: isSelected
          ? selected.filter((id: string) => id !== tempId)
          : [...selected, tempId],
      };
    });
  },

  toggleUpdateSelection: (index: number) => {
    set((state: any) => {
      // Note: Using index as ID for updates. This is stable within a single proposal session
      // since the updatedEntities array doesn't change order during review.
      const indexStr = String(index);
      const selected = state.selectedUpdateIds;
      const isSelected = selected.includes(indexStr);
      
      return {
        selectedUpdateIds: isSelected
          ? selected.filter((id: string) => id !== indexStr)
          : [...selected, indexStr],
      };
    });
  },

  toggleTimelineEventSelection: (tempId: string) => {
    set((state: any) => {
      const selected = state.selectedTimelineEventIds;
      const isSelected = selected.includes(tempId);
      
      return {
        selectedTimelineEventIds: isSelected
          ? selected.filter((id: string) => id !== tempId)
          : [...selected, tempId],
      };
    });
  },

  selectAllProposals: () => {
    set((state: any) => {
      const proposal = state.currentProposal;
      if (!proposal) return {};
      
      return {
        selectedNewEntityIds: proposal.newEntities.map((e: ProposedNewEntity) => e.tempId),
        selectedUpdateIds: proposal.updatedEntities.map((_: any, idx: number) => String(idx)),
        selectedTimelineEventIds: proposal.newTimelineEvents.map((e: ProposedTimelineEvent) => e.tempId),
      };
    });
  },

  deselectAllProposals: () => {
    set({
      selectedNewEntityIds: [],
      selectedUpdateIds: [],
      selectedTimelineEventIds: [],
    });
  },

  updateProjectConfig: (updates: Partial<ProjectConfig>) => {
    set((state: any) => ({
      projectConfig: {
        ...state.projectConfig,
        ...updates,
      },
    }));
  },

  /**
   * Commit the user-approved proposals to the store.
   * This is an atomic operation that updates normalized stores, timeline, and legacy arrays.
   */
  commitExtractionProposal: () => {
    const state = get() as any;
    const { currentProposal, selectedNewEntityIds, selectedUpdateIds, selectedTimelineEventIds } = state;
    
    if (!currentProposal) {
      console.warn('No proposal to commit');
      return;
    }

    set({ parserStatus: 'committing' });

    try {
      // Filter proposals to only user-selected items
      const approvedNewEntities = currentProposal.newEntities.filter((e: ProposedNewEntity) =>
        selectedNewEntityIds.includes(e.tempId)
      );
      const approvedUpdates = currentProposal.updatedEntities.filter((_: any, idx: number) =>
        selectedUpdateIds.includes(String(idx))
      );
      const approvedTimelineEvents = currentProposal.newTimelineEvents.filter((e: ProposedTimelineEvent) =>
        selectedTimelineEventIds.includes(e.tempId)
      );

      // Read current state
      let { normalizedCharacters, normalizedLocations, normalizedItems, timeline, characters } = state;
      let lastEpoch = timeline.lastEpoch;
      const newTimelineEntries: TimelineEntry[] = [...timeline.entries];

      // ─── 1. Process New Entities ──────────────────────────────────────────────

      for (const entity of approvedNewEntities) {
        const now = Date.now();
        
        if (entity.entityType === 'character') {
          // Build a full Character object
          const newCharacter: Character = {
            id: entity.tempId,
            name: entity.name,
            role: entity.suggestedRole || 'Supporting',
            archetype: '',
            eras: [createDefaultEra('Default')],
            voice_profile: { samples: [], style: '' },
            smart_tags: { source: `parser-${entity.source}` },
            gallery: [],
            loreEntryIds: [],
            description: entity.suggestedDescription || '',
            createdAt: now,
            updatedAt: now,
          };

          // Add to normalized store
          normalizedCharacters = characterAdapter.upsertOne(normalizedCharacters, newCharacter);

          // Add to legacy array (prepend)
          characters = [newCharacter, ...characters];

          // Create timeline entry
          const timelineEntry = createTimelineEntry(
            lastEpoch,
            'character',
            newCharacter.id,
            'created',
            { name: newCharacter.name },
            `Character "${newCharacter.name}" created from script`
          );
          lastEpoch = timelineEntry.epoch;
          newTimelineEntries.push(timelineEntry);
          
        } else if (entity.entityType === 'location') {
          // Build a LocationEntry
          const newLocation: LocationEntry = {
            id: entity.tempId,
            name: entity.name,
            type: LoreType.LOCATION,
            description: entity.suggestedDescription || 'Auto-extracted from script',
            tags: ['auto-extracted', `parser-${entity.source}`],
            relatedEntryIds: [],
            characterIds: [],
            region: entity.suggestedRegion || '',
            climate: '',
            importance: '',
            createdAt: now,
            updatedAt: now,
          };

          // Add to normalized store
          normalizedLocations = locationAdapter.upsertOne(normalizedLocations, newLocation);

          // Create timeline entry
          const timelineEntry = createTimelineEntry(
            lastEpoch,
            'location',
            newLocation.id,
            'created',
            { name: newLocation.name },
            `Location "${newLocation.name}" created from script`
          );
          lastEpoch = timelineEntry.epoch;
          newTimelineEntries.push(timelineEntry);
          
        } else if (entity.entityType === 'item') {
          // Build an Item
          const newItem: Item = {
            id: entity.tempId,
            name: entity.name,
            description: entity.suggestedItemDescription || entity.suggestedDescription || '',
            currentHolderId: entity.suggestedHolderId || null,
            locationId: null,
            tags: ['auto-extracted', `parser-${entity.source}`],
            createdAt: now,
            updatedAt: now,
          };

          // Add to normalized store
          normalizedItems = itemAdapter.upsertOne(normalizedItems, newItem);

          // Create timeline entry
          const timelineEntry = createTimelineEntry(
            lastEpoch,
            'item',
            newItem.id,
            'created',
            { name: newItem.name },
            `Item "${newItem.name}" created from script`
          );
          lastEpoch = timelineEntry.epoch;
          newTimelineEntries.push(timelineEntry);
        }
      }

      // ─── 2. Process Entity Updates ────────────────────────────────────────────

      for (const update of approvedUpdates) {
        const now = Date.now();
        // Ensure updatedAt is set to current time, overriding any value from update.updates
        const updatesWithTimestamp = { updatedAt: now, ...update.updates };
        
        if (update.entityType === 'character') {
          normalizedCharacters = characterAdapter.updateOne(
            normalizedCharacters,
            update.entityId,
            updatesWithTimestamp
          );

          // Update legacy array as well
          characters = characters.map((c: Character) =>
            c.id === update.entityId ? { ...c, ...updatesWithTimestamp } : c
          );

          // Create timeline entry
          const timelineEntry = createTimelineEntry(
            lastEpoch,
            'character',
            update.entityId,
            'updated',
            update.updates,
            `Character "${update.entityName}" updated: ${update.changeDescription}`
          );
          lastEpoch = timelineEntry.epoch;
          newTimelineEntries.push(timelineEntry);
          
        } else if (update.entityType === 'location') {
          normalizedLocations = locationAdapter.updateOne(
            normalizedLocations,
            update.entityId,
            updatesWithTimestamp
          );

          // Create timeline entry
          const timelineEntry = createTimelineEntry(
            lastEpoch,
            'location',
            update.entityId,
            'updated',
            update.updates,
            `Location "${update.entityName}" updated: ${update.changeDescription}`
          );
          lastEpoch = timelineEntry.epoch;
          newTimelineEntries.push(timelineEntry);
          
        } else if (update.entityType === 'item') {
          normalizedItems = itemAdapter.updateOne(
            normalizedItems,
            update.entityId,
            updatesWithTimestamp
          );

          // Create timeline entry
          const timelineEntry = createTimelineEntry(
            lastEpoch,
            'item',
            update.entityId,
            'updated',
            update.updates,
            `Item "${update.entityName}" updated: ${update.changeDescription}`
          );
          lastEpoch = timelineEntry.epoch;
          newTimelineEntries.push(timelineEntry);
        }
      }

      // ─── 3. Process Timeline Events ───────────────────────────────────────────

      for (const event of approvedTimelineEvents) {
        const timelineEntry = createTimelineEntry(
          lastEpoch,
          event.entityType,
          event.entityId,
          event.action,
          event.payload,
          event.description
        );
        lastEpoch = timelineEntry.epoch;
        newTimelineEntries.push(timelineEntry);
      }

      // ─── 4. Derive loreEntries for backward compatibility ─────────────────────

      const loreEntries = deriveLoreEntries(normalizedLocations);

      // ─── 5. Commit all changes in a single atomic update ──────────────────────

      set({
        normalizedCharacters,
        normalizedLocations,
        normalizedItems,
        timeline: {
          entries: newTimelineEntries,
          lastEpoch,
        },
        characters,
        loreEntries,
        
        // Reset parser state to idle
        parserStatus: 'idle',
        currentProposal: null,
        selectedNewEntityIds: [],
        selectedUpdateIds: [],
        selectedTimelineEventIds: [],
        parserErrorMessage: null,
      });

      console.log('✅ Extraction proposal committed successfully');
      
    } catch (error) {
      console.error('Failed to commit extraction proposal:', error);
      set({
        parserStatus: 'error',
        parserErrorMessage: error instanceof Error ? error.message : 'Unknown error during commit',
      });
    }
  },
});

// =============================================================================
// EXPORTED SELECTOR FUNCTIONS
// =============================================================================

/**
 * Get all characters at a specific location.
 */
export function getCharactersInLocation(
  normalizedCharacters: EntityState<Character>,
  locationId: string
): Character[] {
  return normalizedCharacters.ids
    .map(id => normalizedCharacters.entities[id])
    .filter(c => c.currentLocationId === locationId);
}

/**
 * Get all items at a specific location.
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
    .filter(Boolean);
}

/**
 * Get all timeline entries for a specific entity at a target epoch.
 */
export function getEntityAtEpoch(
  timeline: { entries: TimelineEntry[] },
  entityId: string,
  targetEpoch: number
): TimelineEntry[] {
  return timeline.entries.filter(
    entry => entry.entityId === entityId && entry.epoch <= targetEpoch
  );
}

/**
 * Get complete timeline for a specific entity.
 */
export function getEntityTimeline(
  timeline: { entries: TimelineEntry[] },
  entityId: string
): TimelineEntry[] {
  return timeline.entries.filter(entry => entry.entityId === entityId);
}

/**
 * Get counts of each proposal type from a ParsedProposal.
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
  const total = newCharacters + newLocations + newItems + updates + timelineEvents;

  return {
    newCharacters,
    newLocations,
    newItems,
    updates,
    timelineEvents,
    total,
  };
}
