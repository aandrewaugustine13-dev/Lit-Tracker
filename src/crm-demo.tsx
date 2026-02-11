// =============================================================================
// CRM FUNCTIONALITY DEMO
// =============================================================================
// This file demonstrates the new normalized CRM-style Lore Tracker functionality.
// It shows how to use the new entity adapters, timeline tracking, and relational queries.

import { useLitStore } from './store';
import { 
  useCharacterById, 
  useLocationById, 
  useItemById,
  useCharactersInLocation,
  useItemsAtLocation,
  useCharacterInventory,
  useTimelineForEntity,
  useAllTimeline,
} from './store/selectors';
import { Character, LocationEntry, Item, LoreType } from './types';

// =============================================================================
// EXAMPLE 1: Creating Entities
// =============================================================================

/**
 * Example: Create a location, character, and item, then link them together
 */
export function exampleCreateEntities() {
  const store = useLitStore.getState();
  
  // 1. Create a location
  const wasteland: LocationEntry = {
    id: crypto.randomUUID(),
    name: 'The Wasteland',
    type: LoreType.LOCATION,
    description: 'A desolate stretch of scorched earth',
    tags: ['dangerous', 'post-apocalyptic'],
    relatedEntryIds: [],
    characterIds: [],
    region: 'Eastern Territories',
    climate: 'Arid',
    importance: 'High',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  store.addLocation(wasteland);
  
  // 2. Create an item
  const sword: Item = {
    id: crypto.randomUUID(),
    name: 'Ancient Sword',
    description: 'A blade forged in the old world',
    currentHolderId: null,
    locationId: wasteland.id, // Item starts at the wasteland
    tags: ['weapon', 'legendary'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  store.addItem(sword);
  
  // 3. Create a character (using legacy characterSlice for now)
  // In the future, this could be migrated to use normalizedCharacters
  const characterData = {
    name: 'Eli',
    role: 'Protagonist' as const,
    archetype: 'Wanderer',
    eras: [],
    voice_profile: { samples: [], style: 'Gruff' },
    smart_tags: {},
    gallery: [],
    loreEntryIds: [wasteland.id],
    // CRM fields
    currentLocationId: wasteland.id,
    status: 'Active',
    inventory: [],
    relationships: {},
  };
  
  store.addCharacter(characterData);
  
  console.log('✅ Created location, character, and item');
  console.log('Timeline has', store.timeline.entries.length, 'entries');
}

// =============================================================================
// EXAMPLE 2: Moving a Character
// =============================================================================

/**
 * Example: Move a character to a different location with automatic timeline tracking
 */
export function exampleMoveCharacter() {
  const store = useLitStore.getState();
  
  // Get a character and location
  const character = store.characters[0];
  const location = store.normalizedLocations.ids[0];
  
  if (!character || !location) {
    console.log('❌ No character or location found');
    return;
  }
  
  // Move the character - this automatically:
  // 1. Updates the character's currentLocationId
  // 2. Appends a timeline entry
  store.moveCharacterToLocation(character.id, location);
  
  console.log('✅ Moved', character.name, 'to location');
  console.log('Timeline now has', store.timeline.entries.length, 'entries');
  
  // View the timeline for this character
  const timeline = store.timeline.entries.filter(e => 
    e.entityType === 'character' && e.entityId === character.id
  );
  console.log('Character timeline:', timeline.map(e => e.description));
}

// =============================================================================
// EXAMPLE 3: Item Acquisition
// =============================================================================

/**
 * Example: Character acquires an item from a location
 */
export function exampleAcquireItem() {
  const store = useLitStore.getState();
  
  const character = store.characters[0];
  const item = store.normalizedItems.ids[0];
  
  if (!character || !item) {
    console.log('❌ No character or item found');
    return;
  }
  
  // Character acquires item - this automatically:
  // 1. Adds item ID to character's inventory
  // 2. Sets item's currentHolderId to character
  // 3. Clears item's locationId
  // 4. Appends timeline entry
  store.characterAcquireItem(character.id, item);
  
  console.log('✅', character.name, 'acquired item');
  console.log('Timeline now has', store.timeline.entries.length, 'entries');
}

// =============================================================================
// EXAMPLE 4: Querying with Selectors
// =============================================================================

/**
 * Example React component showing how to use selectors
 */
export function ExampleLocationComponent({ locationId }: { locationId: string }) {
  // O(1) lookup of location
  const location = useLocationById(locationId);
  
  // Get all characters at this location
  const inhabitants = useCharactersInLocation(locationId);
  
  // Get all items at this location (not held by anyone)
  const itemsHere = useItemsAtLocation(locationId);
  
  if (!location) return <div>Location not found</div>;
  
  return (
    <div>
      <h2>{location.name}</h2>
      <p>{location.description}</p>
      
      <h3>Current Inhabitants ({inhabitants.length})</h3>
      <ul>
        {inhabitants.map(char => (
          <li key={char.id}>
            {char.name} - Status: {char.status}
          </li>
        ))}
      </ul>
      
      <h3>Items Here ({itemsHere.length})</h3>
      <ul>
        {itemsHere.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example: Character detail view with inventory
 */
export function ExampleCharacterComponent({ characterId }: { characterId: string }) {
  const character = useCharacterById(characterId);
  const inventory = useCharacterInventory(characterId);
  const currentLocation = useLocationById(character?.currentLocationId || null);
  const timeline = useTimelineForEntity('character', characterId);
  
  if (!character) return <div>Character not found</div>;
  
  return (
    <div>
      <h2>{character.name}</h2>
      <p>Status: {character.status}</p>
      <p>Location: {currentLocation?.name || 'Unknown'}</p>
      
      <h3>Inventory ({inventory.length})</h3>
      <ul>
        {inventory.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      
      <h3>History ({timeline.length} events)</h3>
      <ul>
        {timeline.slice(-5).map(entry => (
          <li key={entry.id}>
            {new Date(entry.timestamp).toLocaleDateString()}: {entry.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// EXAMPLE 5: Timeline / Activity Feed
// =============================================================================

/**
 * Example: Global activity feed showing all recent changes
 */
export function ExampleActivityFeed() {
  const recentActivity = useAllTimeline().slice(0, 20); // Last 20 entries
  
  return (
    <div>
      <h2>Recent Activity</h2>
      <ul>
        {recentActivity.map(entry => (
          <li key={entry.id}>
            <strong>{entry.entityType}</strong> - {entry.description}
            <br />
            <small>{new Date(entry.timestamp).toLocaleString()}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// BENEFITS OF THIS APPROACH
// =============================================================================

/**
 * KEY BENEFITS:
 * 
 * 1. SINGLE SOURCE OF TRUTH
 *    - Entity data is stored once in normalized maps
 *    - No duplication across panels, locations, etc.
 *    - Updates propagate automatically to all views
 * 
 * 2. O(1) LOOKUPS
 *    - Direct entity access by ID via `entities[id]`
 *    - No array scans or filters needed
 * 
 * 3. REFERENTIAL INTEGRITY
 *    - Entities reference each other by ID only
 *    - Can't have stale embedded data
 *    - Easy to detect broken references
 * 
 * 4. TIMELINE TRACKING
 *    - Immutable log of all state changes
 *    - Can reconstruct past states
 *    - Useful for consistency checks and AI prompts
 * 
 * 5. DYNAMIC UI
 *    - Location panels auto-update when characters move
 *    - Inventory panels auto-update when items are acquired/dropped
 *    - No manual sync required
 * 
 * 6. CONSISTENCY
 *    - Character location is always in sync with reality
 *    - Item holder/location state is always consistent
 *    - Timeline provides audit trail
 */

// =============================================================================
// MIGRATION GUIDE FOR EXISTING COMPONENTS
// =============================================================================

/**
 * BEFORE (duplicated data):
 * ```tsx
 * const panel = {
 *   characters: [
 *     { id: '1', name: 'Eli', location: 'Wasteland', ... }
 *   ]
 * }
 * ```
 * 
 * AFTER (ID references only):
 * ```tsx
 * const panel = {
 *   characterIds: ['1']
 * }
 * 
 * // In component:
 * const characters = panel.characterIds.map(id => useCharacterById(id));
 * ```
 * 
 * BENEFITS:
 * - If Eli moves, all panels show updated location automatically
 * - If Eli's name changes, all references update automatically
 * - No need to search and update all panels manually
 */
