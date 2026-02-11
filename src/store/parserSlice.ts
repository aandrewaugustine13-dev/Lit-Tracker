import { StateCreator } from 'zustand';
import { 
  ParsedProposal, 
  ParserStatus, 
  ProjectConfig,
  ProposedNewEntity,
  ProposedEntityUpdate,
  ProposedTimelineEvent,
} from '../types/parserTypes';
import { Character, LocationEntry, Item, TimelineEntry } from '../types';
import { createEntityAdapter, EntityState } from './entityAdapter';

// Create adapters for entity management
const characterAdapter = createEntityAdapter<Character>((c) => c.id);
const locationAdapter = createEntityAdapter<LocationEntry>((l) => l.id);
const itemAdapter = createEntityAdapter<Item>((i) => i.id);

// =============================================================================
// PARSER SLICE — Manages universal script parser state and proposal workflow
// =============================================================================

export interface ParserSlice {
  // ─── State ──────────────────────────────────────────────────────────────────
  
  /** Current parser status */
  parserStatus: ParserStatus;
  /** Current parsed proposal awaiting review (null when idle) */
  currentProposal: ParsedProposal | null;
  /** Temp IDs of new entities selected for commit */
  selectedNewEntityIds: string[];
  /** Indices of entity updates selected for commit */
  selectedUpdateIds: number[];
  /** Temp IDs of timeline events selected for commit */
  selectedTimelineEventIds: string[];
  /** Error message if parser failed */
  parserErrorMessage: string | null;
  /** Project-level parser configuration */
  projectConfig: ProjectConfig;

  // ─── Actions ────────────────────────────────────────────────────────────────
  
  /** Set the current parser status */
  setParserStatus: (status: ParserStatus) => void;
  
  /** Set the current proposal (auto-selects all when non-null, sets status 'awaiting-review') */
  setCurrentProposal: (proposal: ParsedProposal | null) => void;
  
  /** Set parser error message and status */
  setParserError: (message: string) => void;
  
  /** Toggle selection of a new entity by temp ID */
  toggleNewEntitySelection: (tempId: string) => void;
  
  /** Toggle selection of an entity update by index */
  toggleUpdateSelection: (index: number) => void;
  
  /** Toggle selection of a timeline event by temp ID */
  toggleTimelineEventSelection: (tempId: string) => void;
  
  /** Select all proposals */
  selectAllProposals: () => void;
  
  /** Deselect all proposals */
  deselectAllProposals: () => void;
  
  /** Update project configuration */
  updateProjectConfig: (config: Partial<ProjectConfig>) => void;
  
  /** Commit the selected proposals to the store */
  commitExtractionProposal: () => void;
}

// ─── Selector Functions ─────────────────────────────────────────────────────

/**
 * Get all characters at a specific location.
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
  normalizedItems: EntityState<Item>,
  characterId: string
): Item[] {
  return normalizedItems.ids
    .map(id => normalizedItems.entities[id])
    .filter(item => item.currentHolderId === characterId);
}

/**
 * Get entity state at a specific epoch by replaying timeline.
 */
export function getEntityAtEpoch(
  timeline: TimelineEntry[],
  entityId: string,
  epoch: number
): Record<string, any> | null {
  const relevantEntries = timeline
    .filter(entry => entry.entityId === entityId && entry.epoch <= epoch)
    .sort((a, b) => a.epoch - b.epoch);
  
  if (relevantEntries.length === 0) return null;
  
  const state: Record<string, any> = {};
  for (const entry of relevantEntries) {
    Object.assign(state, entry.payload);
  }
  
  return state;
}

/**
 * Get timeline entries for a specific entity.
 */
export function getEntityTimeline(
  timeline: TimelineEntry[],
  entityId: string
): TimelineEntry[] {
  return timeline
    .filter(entry => entry.entityId === entityId)
    .sort((a, b) => a.epoch - b.epoch);
}

/**
 * Get counts of proposals in current proposal.
 */
export function getProposalCounts(proposal: ParsedProposal | null): {
  newEntities: number;
  updates: number;
  events: number;
  total: number;
} {
  if (!proposal) {
    return { newEntities: 0, updates: 0, events: 0, total: 0 };
  }
  
  return {
    newEntities: proposal.newEntities.length,
    updates: proposal.updatedEntities.length,
    events: proposal.newTimelineEvents.length,
    total: proposal.newEntities.length + proposal.updatedEntities.length + proposal.newTimelineEvents.length,
  };
}

// ─── Slice Creator ──────────────────────────────────────────────────────────

export const createParserSlice: StateCreator<any, [], [], ParserSlice> = (set, get) => ({
  // Initial state
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

  // Actions
  setParserStatus: (status: ParserStatus) => {
    set({ parserStatus: status });
  },

  setCurrentProposal: (proposal: ParsedProposal | null) => {
    if (proposal === null) {
      set({
        currentProposal: null,
        selectedNewEntityIds: [],
        selectedUpdateIds: [],
        selectedTimelineEventIds: [],
        parserStatus: 'idle',
      });
    } else {
      // Auto-select all proposals
      const selectedNewEntityIds = proposal.newEntities.map(e => e.tempId);
      const selectedUpdateIds = proposal.updatedEntities.map((_, idx) => idx);
      const selectedTimelineEventIds = proposal.newTimelineEvents.map(e => e.tempId);
      
      set({
        currentProposal: proposal,
        selectedNewEntityIds,
        selectedUpdateIds,
        selectedTimelineEventIds,
        parserStatus: 'awaiting-review',
        parserErrorMessage: null,
      });
    }
  },

  setParserError: (message: string) => {
    set({
      parserStatus: 'error',
      parserErrorMessage: message,
    });
  },

  toggleNewEntitySelection: (tempId: string) => {
    set((state: any) => {
      const selectedIds = state.selectedNewEntityIds;
      const isSelected = selectedIds.includes(tempId);
      
      return {
        selectedNewEntityIds: isSelected
          ? selectedIds.filter((id: string) => id !== tempId)
          : [...selectedIds, tempId],
      };
    });
  },

  toggleUpdateSelection: (index: number) => {
    set((state: any) => {
      const selectedIndices = state.selectedUpdateIds;
      const isSelected = selectedIndices.includes(index);
      
      return {
        selectedUpdateIds: isSelected
          ? selectedIndices.filter((i: number) => i !== index)
          : [...selectedIndices, index],
      };
    });
  },

  toggleTimelineEventSelection: (tempId: string) => {
    set((state: any) => {
      const selectedIds = state.selectedTimelineEventIds;
      const isSelected = selectedIds.includes(tempId);
      
      return {
        selectedTimelineEventIds: isSelected
          ? selectedIds.filter((id: string) => id !== tempId)
          : [...selectedIds, tempId],
      };
    });
  },

  selectAllProposals: () => {
    set((state: any) => {
      const proposal = state.currentProposal;
      if (!proposal) return {};
      
      return {
        selectedNewEntityIds: proposal.newEntities.map((e: ProposedNewEntity) => e.tempId),
        selectedUpdateIds: proposal.updatedEntities.map((_: any, idx: number) => idx),
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

  updateProjectConfig: (config: Partial<ProjectConfig>) => {
    set((state: any) => ({
      projectConfig: {
        ...state.projectConfig,
        ...config,
      },
    }));
  },

  commitExtractionProposal: () => {
    const state = get();
    const proposal = state.currentProposal;
    
    if (!proposal) {
      console.warn('No proposal to commit');
      return;
    }

    set({ parserStatus: 'committing' });

    try {
      // Filter to only approved items
      const approvedNewEntities = proposal.newEntities.filter(
        (e: ProposedNewEntity) => state.selectedNewEntityIds.includes(e.tempId)
      );
      const approvedUpdates = proposal.updatedEntities.filter(
        (_: any, idx: number) => state.selectedUpdateIds.includes(idx)
      );
      const approvedEvents = proposal.newTimelineEvents.filter(
        (e: ProposedTimelineEvent) => state.selectedTimelineEventIds.includes(e.tempId)
      );

      // Single set() call to apply all changes atomically
      set((prevState: any) => {
        const now = Date.now();
        const timestamp = new Date().toISOString();
        
        // Prepare new entities by type
        const newCharacters: Character[] = [];
        const newLocations: LocationEntry[] = [];
        const newItems: Item[] = [];
        
        approvedNewEntities.forEach((proposed: ProposedNewEntity) => {
          const baseEntity = {
            id: crypto.randomUUID(),
            name: proposed.name,
            createdAt: now,
            updatedAt: now,
          };
          
          if (proposed.entityType === 'character') {
            newCharacters.push({
              ...baseEntity,
              role: proposed.suggestedRole || 'Supporting',
              archetype: '',
              eras: [],
              voice_profile: { samples: [], style: '' },
              smart_tags: { source: proposed.source },
              gallery: [],
              loreEntryIds: [],
              description: proposed.suggestedDescription || `Auto-extracted from script (line ${proposed.lineNumber})`,
              currentLocationId: null,
              status: 'Active',
              inventory: [],
              relationships: {},
            });
          } else if (proposed.entityType === 'location') {
            newLocations.push({
              ...baseEntity,
              type: 'location' as any,
              description: `Auto-extracted from script (line ${proposed.lineNumber})`,
              tags: ['auto-extracted'],
              relatedEntryIds: [],
              characterIds: [],
              region: proposed.suggestedRegion || '',
              climate: '',
              importance: '',
            });
          } else if (proposed.entityType === 'item') {
            newItems.push({
              ...baseEntity,
              description: proposed.suggestedItemDescription || `Auto-extracted from script (line ${proposed.lineNumber})`,
              currentHolderId: proposed.suggestedHolderId || null,
              locationId: proposed.suggestedHolderId ? null : null,
              tags: ['auto-extracted'],
            });
          }
        });
        
        // Upsert new entities into normalized stores
        let updatedNormalizedCharacters = prevState.normalizedCharacters;
        let updatedNormalizedLocations = prevState.normalizedLocations;
        let updatedNormalizedItems = prevState.normalizedItems;
        
        for (const char of newCharacters) {
          updatedNormalizedCharacters = characterAdapter.upsertOne(updatedNormalizedCharacters, char);
        }
        for (const loc of newLocations) {
          updatedNormalizedLocations = locationAdapter.upsertOne(updatedNormalizedLocations, loc);
        }
        for (const item of newItems) {
          updatedNormalizedItems = itemAdapter.upsertOne(updatedNormalizedItems, item);
        }
        
        // Apply entity updates
        approvedUpdates.forEach((update: ProposedEntityUpdate) => {
          if (update.entityType === 'character') {
            updatedNormalizedCharacters = characterAdapter.updateOne(
              updatedNormalizedCharacters,
              update.entityId,
              { ...update.updates, updatedAt: now }
            );
          } else if (update.entityType === 'location') {
            updatedNormalizedLocations = locationAdapter.updateOne(
              updatedNormalizedLocations,
              update.entityId,
              { ...update.updates, updatedAt: now }
            );
          } else if (update.entityType === 'item') {
            updatedNormalizedItems = itemAdapter.updateOne(
              updatedNormalizedItems,
              update.entityId,
              { ...update.updates, updatedAt: now }
            );
          }
        });
        
        // Create timeline entries for all changes
        const newTimelineEntries: TimelineEntry[] = [];
        let currentEpoch = prevState.timeline.lastEpoch;
        
        // Timeline entries for new entities
        [...newCharacters, ...newLocations, ...newItems].forEach((entity: any) => {
          currentEpoch++;
          newTimelineEntries.push({
            id: crypto.randomUUID(),
            epoch: currentEpoch,
            timestamp,
            entityType: newCharacters.includes(entity) ? 'character' : newLocations.includes(entity) ? 'location' : 'item',
            entityId: entity.id,
            action: 'created',
            payload: { name: entity.name },
            description: `${entity.name} created via script extraction`,
            createdAt: now,
            updatedAt: now,
          });
        });
        
        // Timeline entries for updates
        approvedUpdates.forEach((update: ProposedEntityUpdate) => {
          currentEpoch++;
          newTimelineEntries.push({
            id: crypto.randomUUID(),
            epoch: currentEpoch,
            timestamp,
            entityType: update.entityType,
            entityId: update.entityId,
            action: 'updated',
            payload: update.updates,
            description: update.changeDescription,
            createdAt: now,
            updatedAt: now,
          });
        });
        
        // Timeline entries for events
        approvedEvents.forEach((event: ProposedTimelineEvent) => {
          currentEpoch++;
          newTimelineEntries.push({
            id: crypto.randomUUID(),
            epoch: currentEpoch,
            timestamp,
            entityType: event.entityType,
            entityId: event.entityId,
            action: event.action,
            payload: event.payload,
            description: event.description,
            createdAt: now,
            updatedAt: now,
          });
        });
        
        return {
          // Update normalized stores
          normalizedCharacters: updatedNormalizedCharacters,
          normalizedLocations: updatedNormalizedLocations,
          normalizedItems: updatedNormalizedItems,
          
          // Update legacy characters array (for backward compatibility)
          characters: [
            ...prevState.characters,
            ...newCharacters,
          ],
          
          // Update timeline
          timeline: {
            entries: [...prevState.timeline.entries, ...newTimelineEntries],
            lastEpoch: currentEpoch,
          },
          
          // Reset parser state
          parserStatus: 'idle' as ParserStatus,
          currentProposal: null,
          selectedNewEntityIds: [],
          selectedUpdateIds: [],
          selectedTimelineEventIds: [],
          parserErrorMessage: null,
        };
      });
    } catch (error) {
      console.error('Error committing extraction proposal:', error);
      set({
        parserStatus: 'error',
        parserErrorMessage: error instanceof Error ? error.message : 'Unknown error during commit',
      });
    }
  },
});
