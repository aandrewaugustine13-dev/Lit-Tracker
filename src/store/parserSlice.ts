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
import { parseTimelineAndLocations } from '../engine/timelineLocationsParser';

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

/**
 * Helper to derive loreEntries from normalized locations (backward compat).
 */
function deriveLoreEntries(normalizedLocations: EntityState<LocationEntry>) {
  return normalizedLocations.ids.map(id => normalizedLocations.entities[id]);
}

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
              // Location is unknown at extraction time; will be set via timeline events if location context exists
              locationId: null,
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

  // ─── Parse Timeline and Locations ───────────────────────────────────────────
  
  parseTimelineAndLocations: async (rawScriptText: string) => {
    const state = get();
    
    // Set status to parsing
    set({ parserStatus: 'parsing', parserErrorMessage: null });

    try {
      // Read current state
      const characters = state.characters || [];
      const normalizedLocations = state.normalizedLocations || locationAdapter.getInitialState();
      const loreEntries = deriveLoreEntries(normalizedLocations);

      // Call the parser engine
      const proposal = await parseTimelineAndLocations(rawScriptText, {
        characters,
        normalizedLocations,
        loreEntries,
      });

      // Set the proposal (this auto-selects all and sets status to 'awaiting-review')
      state.setCurrentProposal(proposal);

      console.log('✅ Timeline and locations parsed successfully', {
        newLocations: proposal.newEntities.filter(e => e.entityType === 'location').length,
        timelineEvents: proposal.newTimelineEvents.length,
        characterMoves: proposal.updatedEntities.filter(e => e.entityType === 'character').length,
      });
    } catch (error) {
      console.error('❌ Failed to parse timeline and locations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      state.setParserError(errorMessage);
    }
  },
});
