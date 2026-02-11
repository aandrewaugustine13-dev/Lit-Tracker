// =============================================================================
// SELECTORS — Memoized queries for normalized entity state
// =============================================================================
// These selectors provide efficient O(1) lookups and derived views from the
// normalized entity stores. They prevent data duplication and ensure UI
// components always show current state.

import { useLitStore, LitStore } from './index';
import { Character, LocationEntry, Item, TimelineEntry } from '../types';

// =============================================================================
// BASIC ENTITY SELECTORS (O(1) lookups)
// =============================================================================

/**
 * Get a character by ID from the normalized store.
 * Returns undefined if not found.
 */
export const useCharacterById = (characterId: string | null) =>
  useLitStore((state) => 
    characterId ? state.normalizedCharacters.entities[characterId] : undefined
  );

/**
 * Get a location by ID from the normalized store.
 * Returns undefined if not found.
 */
export const useLocationById = (locationId: string | null) =>
  useLitStore((state) => 
    locationId ? state.normalizedLocations.entities[locationId] : undefined
  );

/**
 * Get an item by ID from the normalized store.
 * Returns undefined if not found.
 */
export const useItemById = (itemId: string | null) =>
  useLitStore((state) => 
    itemId ? state.normalizedItems.entities[itemId] : undefined
  );

/**
 * Get all characters as an array.
 */
export const useAllCharacters = () =>
  useLitStore((state) =>
    state.normalizedCharacters.ids.map(id => state.normalizedCharacters.entities[id])
  );

/**
 * Get all locations as an array.
 */
export const useAllLocations = () =>
  useLitStore((state) =>
    state.normalizedLocations.ids.map(id => state.normalizedLocations.entities[id])
  );

/**
 * Get all items as an array.
 */
export const useAllItems = () =>
  useLitStore((state) =>
    state.normalizedItems.ids.map(id => state.normalizedItems.entities[id])
  );

// =============================================================================
// RELATIONAL SELECTORS (Derive views from ID references)
// =============================================================================

/**
 * Get all characters currently at a specific location.
 * Filters by currentLocationId field.
 */
export const useCharactersInLocation = (locationId: string | null) =>
  useLitStore((state) => {
    if (!locationId) return [];
    
    return state.normalizedCharacters.ids
      .map(id => state.normalizedCharacters.entities[id])
      .filter(char => char.currentLocationId === locationId);
  });

/**
 * Get all items at a specific location (not held by anyone).
 * Filters by locationId field where currentHolderId is null.
 */
export const useItemsAtLocation = (locationId: string | null) =>
  useLitStore((state) => {
    if (!locationId) return [];
    
    return state.normalizedItems.ids
      .map(id => state.normalizedItems.entities[id])
      .filter(item => item.locationId === locationId && item.currentHolderId === null);
  });

/**
 * Get a character's full inventory (resolves item IDs to Item objects).
 * Returns an array of Item objects the character is carrying.
 */
export const useCharacterInventory = (characterId: string | null) =>
  useLitStore((state) => {
    if (!characterId) return [];
    
    const character = state.normalizedCharacters.entities[characterId];
    if (!character || !character.inventory) return [];
    
    return character.inventory
      .map(itemId => state.normalizedItems.entities[itemId])
      .filter((item): item is Item => item !== undefined);
  });

/**
 * Get all items held by any character (useful for showing "in circulation" items).
 */
export const useHeldItems = () =>
  useLitStore((state) =>
    state.normalizedItems.ids
      .map(id => state.normalizedItems.entities[id])
      .filter(item => item.currentHolderId !== null)
  );

/**
 * Get all unassigned items (not held and not at any location).
 */
export const useUnassignedItems = () =>
  useLitStore((state) =>
    state.normalizedItems.ids
      .map(id => state.normalizedItems.entities[id])
      .filter(item => item.currentHolderId === null && item.locationId === null)
  );

// =============================================================================
// TIMELINE SELECTORS
// =============================================================================

/**
 * Get all timeline entries for a specific entity.
 * Returns entries in chronological order (oldest first).
 */
export const useTimelineForEntity = (
  entityType: TimelineEntry['entityType'],
  entityId: string | null
) =>
  useLitStore((state) => {
    if (!entityId) return [];
    
    return state.timeline.entries
      .filter(entry => entry.entityType === entityType && entry.entityId === entityId)
      .sort((a, b) => a.epoch - b.epoch);
  });

/**
 * Get all timeline entries, sorted by epoch (newest first for activity feed).
 */
export const useAllTimeline = () =>
  useLitStore((state) =>
    [...state.timeline.entries].sort((a, b) => b.epoch - a.epoch)
  );

/**
 * Get recent timeline entries (last N entries).
 */
export const useRecentTimeline = (limit: number = 20) =>
  useLitStore((state) =>
    [...state.timeline.entries]
      .sort((a, b) => b.epoch - a.epoch)
      .slice(0, limit)
  );

/**
 * Reconstructs entity state at a specific epoch by replaying timeline entries.
 * This is useful for consistency checks and viewing past states.
 * 
 * NOTE: This is a simplified implementation. A full implementation would
 * need to replay all relevant state changes from epoch 0 to the target epoch.
 */
export const useEntityStateAtEpoch = (
  entityType: TimelineEntry['entityType'],
  entityId: string | null,
  epoch: number
) =>
  useLitStore((state) => {
    if (!entityId) return null;

    // Get all timeline entries for this entity up to the target epoch
    const relevantEntries = state.timeline.entries
      .filter(entry => 
        entry.entityType === entityType && 
        entry.entityId === entityId && 
        entry.epoch <= epoch
      )
      .sort((a, b) => a.epoch - b.epoch);

    // For this simplified version, we'll just return the entries
    // A full implementation would reconstruct the entity state by applying changes
    return {
      entries: relevantEntries,
      lastEpoch: relevantEntries[relevantEntries.length - 1]?.epoch || 0,
    };
  });

// =============================================================================
// PLAIN FUNCTION VERSIONS (for use outside React components)
// =============================================================================

/**
 * Plain function to get a character by ID.
 * Use this in cross-slice actions or other non-React code.
 */
export function getCharacterById(state: LitStore, characterId: string): Character | undefined {
  return state.normalizedCharacters.entities[characterId];
}

/**
 * Plain function to get a location by ID.
 */
export function getLocationById(state: LitStore, locationId: string): LocationEntry | undefined {
  return state.normalizedLocations.entities[locationId];
}

/**
 * Plain function to get an item by ID.
 */
export function getItemById(state: LitStore, itemId: string): Item | undefined {
  return state.normalizedItems.entities[itemId];
}

/**
 * Plain function to get characters in a location.
 */
export function getCharactersInLocation(state: LitStore, locationId: string): Character[] {
  return state.normalizedCharacters.ids
    .map((id: string) => state.normalizedCharacters.entities[id])
    .filter((char: Character) => char.currentLocationId === locationId);
}

/**
 * Plain function to get items at a location.
 */
export function getItemsAtLocation(state: LitStore, locationId: string): Item[] {
  return state.normalizedItems.ids
    .map((id: string) => state.normalizedItems.entities[id])
    .filter((item: Item) => item.locationId === locationId && item.currentHolderId === null);
}

/**
 * Plain function to get timeline entries for an entity.
 */
export function getTimelineForEntity(
  state: LitStore,
  entityType: TimelineEntry['entityType'],
  entityId: string
): TimelineEntry[] {
  return state.timeline.entries
    .filter((entry: TimelineEntry) => 
      entry.entityType === entityType && entry.entityId === entityId
    )
    .sort((a: TimelineEntry, b: TimelineEntry) => a.epoch - b.epoch);
}
