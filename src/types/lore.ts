// =============================================================================
// LORE TYPES — CRM-style types for normalized entity management
// =============================================================================
// Extends the existing Character and Location types with CRM fields for
// tracking state, inventory, relationships, and historical changes.

import { EntityBase } from './index';

// ─── Items ──────────────────────────────────────────────────────────────────

/**
 * Item entity — physical objects that can be held by characters or placed at locations.
 * Uses single-source-of-truth referencing: an item is either held by a character
 * (currentHolderId set, locationId null) or at a location (locationId set, currentHolderId null).
 */
export interface Item extends EntityBase {
  name: string;
  description: string;
  /** ID of character holding this item, or null if not held */
  currentHolderId: string | null;
  /** ID of location where this item is, or null if held by a character */
  locationId: string | null;
  tags: string[];
}

// ─── Character CRM Fields ───────────────────────────────────────────────────

/**
 * CRM-style fields for character entities.
 * These extend the base Character type to support dynamic location tracking,
 * status management, inventory, and relationships.
 */
export interface CharacterCRMFields {
  /** ID of the location where this character is currently at, or null */
  currentLocationId: string | null;
  /** Current status: Active, Deceased, MIA, etc. */
  status: string;
  /** Array of item IDs that this character is carrying */
  inventory: string[];
  /** Map of relationship labels: { [characterId]: "relationship description" } */
  relationships: Record<string, string>;
}

// ─── Timeline / History ─────────────────────────────────────────────────────

/**
 * Timeline action types for tracking entity state changes.
 * Each action represents a significant state transition that should be logged.
 */
export type TimelineAction =
  | 'created'
  | 'moved_to'
  | 'acquired'
  | 'dropped'
  | 'status_changed'
  | 'updated'
  | 'deleted'
  | 'relationship_changed';

/**
 * Entity types that can generate timeline entries.
 */
export type TimelineEntityType = 'character' | 'location' | 'item';

/**
 * Timeline entry — immutable log of an entity state change.
 * 
 * Timeline entries are append-only and form a complete audit trail for each entity.
 * They enable:
 * - Historical reconstruction: replay entries to rebuild entity state at any past epoch
 * - Consistency validation: detect contradictions or impossible state transitions
 * - AI prompt generation: include historical context for image generation
 * 
 * Example entries:
 * - { action: 'moved_to', entityType: 'character', entityId: 'eli-123', payload: { locationId: 'wasteland-456' }, description: 'Eli moved to The Wasteland' }
 * - { action: 'acquired', entityType: 'character', entityId: 'eli-123', payload: { itemId: 'sword-789' }, description: 'Eli acquired Ancient Sword' }
 */
export interface TimelineEntry extends EntityBase {
  /** Monotonically increasing epoch number for ordering */
  epoch: number;
  /** ISO timestamp for human-readable dates */
  timestamp: string;
  /** Type of entity this entry relates to */
  entityType: TimelineEntityType;
  /** ID of the entity being tracked */
  entityId: string;
  /** Type of action that occurred */
  action: TimelineAction;
  /** Action-specific data (e.g., { locationId: '...' } for 'moved_to') */
  payload: Record<string, any>;
  /** Human-readable description of the event */
  description: string;
}

/**
 * Timeline state — manages the append-only log of all entity changes.
 */
export interface TimelineState {
  /** Chronological list of all timeline entries (append-only) */
  entries: TimelineEntry[];
  /** Last used epoch number (monotonically increasing) */
  lastEpoch: number;
}
