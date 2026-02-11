import { StateCreator } from 'zustand';
import { Character, LocationEntry, LoreType } from '../types';
import { Item, TimelineEntry, TimelineState } from '../types/lore';
import {
  ParserStatus,
  ParsedProposal,
  ProjectConfig,
} from '../types/parserTypes';
import { createEntityAdapter, EntityState } from './entityAdapter';

const characterAdapter = createEntityAdapter<Character>((c) => c.id);
const locationAdapter = createEntityAdapter<LocationEntry>((l) => l.id);
const itemAdapter = createEntityAdapter<Item>((i) => i.id);

export interface ParserSlice {
  parserStatus: ParserStatus;
  currentProposal: ParsedProposal | null;
  selectedNewEntityIds: string[];
  selectedUpdateIds: string[];
  selectedTimelineEventIds: string[];
  parserErrorMessage: string | null;
  projectConfig: ProjectConfig;

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

export function getCharactersInLocation(chars: EntityState<Character>, locId: string): Character[] {
  return chars.ids
    .map(id => chars.entities[id])
    .filter(c => c.currentLocationId === locId);
}

export function getItemsAtLocation(items: EntityState<Item>, locId: string): Item[] {
  return items.ids
    .map(id => items.entities[id])
    .filter(i => i.locationId === locId && i.currentHolderId === null);
}

export function getCharacterInventory(
  chars: EntityState<Character>,
  items: EntityState<Item>,
  charId: string
): Item[] {
  const character = chars.entities[charId];
  if (!character || !character.inventory) return [];
  return character.inventory
    .map(itemId => items.entities[itemId])
    .filter(item => item !== undefined);
}

export function getEntityAtEpoch(
  timeline: TimelineState,
  entityId: string,
  epoch: number
): TimelineEntry[] {
  return timeline.entries
    .filter(e => e.entityId === entityId && e.epoch <= epoch)
    .sort((a, b) => a.epoch - b.epoch);
}

export function getEntityTimeline(timeline: TimelineState, entityId: string): TimelineEntry[] {
  return timeline.entries
    .filter(e => e.entityId === entityId)
    .sort((a, b) => a.epoch - b.epoch);
}

export function getProposalCounts(proposal: ParsedProposal | null) {
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
  const total = proposal.newEntities.length + updates + timelineEvents;

  return {
    newCharacters,
    newLocations,
    newItems,
    updates,
    timelineEvents,
    total,
  };
}

export const createParserSlice: StateCreator<any, [], [], ParserSlice> = (set, get) => ({
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

  setParserStatus: (status) => set({ parserStatus: status }),

  setCurrentProposal: (proposal) => {
    if (proposal === null) {
      set({
        currentProposal: null,
        selectedNewEntityIds: [],
        selectedUpdateIds: [],
        selectedTimelineEventIds: [],
        parserStatus: 'idle',
      });
    } else {
      const allNewEntityIds = proposal.newEntities.map(e => e.tempId);
      const allUpdateIds = proposal.updatedEntities.map((_, idx) => String(idx));
      const allTimelineEventIds = proposal.newTimelineEvents.map(e => e.tempId);

      set({
        currentProposal: proposal,
        selectedNewEntityIds: allNewEntityIds,
        selectedUpdateIds: allUpdateIds,
        selectedTimelineEventIds: allTimelineEventIds,
        parserStatus: 'awaiting-review',
      });
    }
  },

  setParserError: (message) => set({ parserErrorMessage: message, parserStatus: 'error' }),

  toggleNewEntitySelection: (tempId) =>
    set((state: ParserSlice) => {
      const selected = state.selectedNewEntityIds;
      const isSelected = selected.includes(tempId);
      return {
        selectedNewEntityIds: isSelected
          ? selected.filter((id: string) => id !== tempId)
          : [...selected, tempId],
      };
    }),

  toggleUpdateSelection: (index) =>
    set((state: ParserSlice) => {
      const indexStr = String(index);
      const selected = state.selectedUpdateIds;
      const isSelected = selected.includes(indexStr);
      return {
        selectedUpdateIds: isSelected
          ? selected.filter((id: string) => id !== indexStr)
          : [...selected, indexStr],
      };
    }),

  toggleTimelineEventSelection: (tempId) =>
    set((state: ParserSlice) => {
      const selected = state.selectedTimelineEventIds;
      const isSelected = selected.includes(tempId);
      return {
        selectedTimelineEventIds: isSelected
          ? selected.filter((id: string) => id !== tempId)
          : [...selected, tempId],
      };
    }),

  selectAllProposals: () =>
    set((state: ParserSlice) => {
      if (!state.currentProposal) return state;
      return {
        selectedNewEntityIds: state.currentProposal.newEntities.map((e: any) => e.tempId),
        selectedUpdateIds: state.currentProposal.updatedEntities.map((_: any, idx: number) => String(idx)),
        selectedTimelineEventIds: state.currentProposal.newTimelineEvents.map((e: any) => e.tempId),
      };
    }),

  deselectAllProposals: () =>
    set({
      selectedNewEntityIds: [],
      selectedUpdateIds: [],
      selectedTimelineEventIds: [],
    }),

  updateProjectConfig: (updates) =>
    set((state: ParserSlice) => ({
      projectConfig: { ...state.projectConfig, ...updates },
    })),

  commitExtractionProposal: () => {
    const state = get();
    const { currentProposal, selectedNewEntityIds, selectedUpdateIds, selectedTimelineEventIds } = state;

    if (!currentProposal) return;

    const selectedNewEntitySet = new Set(selectedNewEntityIds);
    const selectedUpdateSet = new Set(selectedUpdateIds);
    const selectedTimelineEventSet = new Set(selectedTimelineEventIds);

    const approvedNewEntities = currentProposal.newEntities.filter((e: any) => selectedNewEntitySet.has(e.tempId));
    const approvedUpdates = currentProposal.updatedEntities.filter((_: any, idx: number) => selectedUpdateSet.has(String(idx)));
    const approvedTimelineEvents = currentProposal.newTimelineEvents.filter((e: any) => selectedTimelineEventSet.has(e.tempId));

    set((prev: any) => {
      let newNormalizedCharacters = prev.normalizedCharacters;
      let newNormalizedLocations = prev.normalizedLocations;
      let newNormalizedItems = prev.normalizedItems;
      const newCharactersToAdd: Character[] = [];
      const newTimelineEntries: TimelineEntry[] = [];
      let currentEpoch = prev.timeline.lastEpoch;

      for (const entity of approvedNewEntities) {
        const now = Date.now();
        currentEpoch += 1;

        if (entity.entityType === 'character') {
          const newChar: Character = {
            id: entity.tempId,
            name: entity.name,
            role: entity.suggestedRole || 'Supporting',
            archetype: '',
            eras: [],
            voice_profile: { samples: [], style: '' },
            smart_tags: { source: 'parser' },
            gallery: [],
            loreEntryIds: [],
            description: entity.suggestedDescription || '',
            createdAt: now,
            updatedAt: now,
          };

          newNormalizedCharacters = characterAdapter.upsertOne(newNormalizedCharacters, newChar);
          newCharactersToAdd.push(newChar);

          const timelineEntry: TimelineEntry = {
            id: crypto.randomUUID(),
            epoch: currentEpoch,
            timestamp: new Date().toISOString(),
            entityType: 'character',
            entityId: entity.tempId,
            action: 'created',
            payload: { name: entity.name, source: entity.source },
            description: `Character "${entity.name}" created from parser`,
            createdAt: now,
            updatedAt: now,
          };
          newTimelineEntries.push(timelineEntry);
        } else if (entity.entityType === 'location') {
          const newLoc: LocationEntry = {
            id: entity.tempId,
            name: entity.name,
            type: LoreType.LOCATION,
            description: entity.suggestedDescription || '',
            tags: ['parser-extracted'],
            relatedEntryIds: [],
            characterIds: [],
            region: entity.suggestedRegion || '',
            climate: '',
            importance: '',
            createdAt: now,
            updatedAt: now,
          };

          newNormalizedLocations = locationAdapter.upsertOne(newNormalizedLocations, newLoc);

          const timelineEntry: TimelineEntry = {
            id: crypto.randomUUID(),
            epoch: currentEpoch,
            timestamp: new Date().toISOString(),
            entityType: 'location',
            entityId: entity.tempId,
            action: 'created',
            payload: { name: entity.name, source: entity.source },
            description: `Location "${entity.name}" created from parser`,
            createdAt: now,
            updatedAt: now,
          };
          newTimelineEntries.push(timelineEntry);
        } else if (entity.entityType === 'item') {
          const newItem: Item = {
            id: entity.tempId,
            name: entity.name,
            description: entity.suggestedItemDescription || entity.suggestedDescription || '',
            currentHolderId: entity.suggestedHolderId || null,
            locationId: null,
            tags: ['parser-extracted'],
            createdAt: now,
            updatedAt: now,
          };

          newNormalizedItems = itemAdapter.upsertOne(newNormalizedItems, newItem);

          const timelineEntry: TimelineEntry = {
            id: crypto.randomUUID(),
            epoch: currentEpoch,
            timestamp: new Date().toISOString(),
            entityType: 'item',
            entityId: entity.tempId,
            action: 'created',
            payload: { name: entity.name, source: entity.source },
            description: `Item "${entity.name}" created from parser`,
            createdAt: now,
            updatedAt: now,
          };
          newTimelineEntries.push(timelineEntry);
        }
      }

      for (const update of approvedUpdates) {
        const now = Date.now();
        currentEpoch += 1;

        if (update.entityType === 'character') {
          newNormalizedCharacters = characterAdapter.updateOne(
            newNormalizedCharacters,
            update.entityId,
            { ...update.updates, updatedAt: now }
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

        const timelineEntry: TimelineEntry = {
          id: crypto.randomUUID(),
          epoch: currentEpoch,
          timestamp: new Date().toISOString(),
          entityType: update.entityType,
          entityId: update.entityId,
          action: 'updated',
          payload: { updates: update.updates, source: update.source },
          description: update.changeDescription,
          createdAt: now,
          updatedAt: now,
        };
        newTimelineEntries.push(timelineEntry);
      }

      for (const event of approvedTimelineEvents) {
        const now = Date.now();
        currentEpoch += 1;

        const timelineEntry: TimelineEntry = {
          id: crypto.randomUUID(),
          epoch: currentEpoch,
          timestamp: new Date().toISOString(),
          entityType: event.entityType,
          entityId: event.entityId,
          action: event.action,
          payload: event.payload,
          description: event.description,
          createdAt: now,
          updatedAt: now,
        };
        newTimelineEntries.push(timelineEntry);
      }

      return {
        normalizedCharacters: newNormalizedCharacters,
        normalizedLocations: newNormalizedLocations,
        normalizedItems: newNormalizedItems,
        characters: newCharactersToAdd.length > 0 ? [...newCharactersToAdd, ...prev.characters] : prev.characters,
        timeline: {
          entries: [...prev.timeline.entries, ...newTimelineEntries],
          lastEpoch: currentEpoch,
        },
        parserStatus: 'idle' as ParserStatus,
        currentProposal: null,
        selectedNewEntityIds: [],
        selectedUpdateIds: [],
        selectedTimelineEventIds: [],
      };
    });
  },
});
