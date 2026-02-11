# Lore Tracker CRM System

## Overview

The Lore Tracker has been upgraded to function as a lightweight relational CRM / Applicant Tracking System for narrative elements. This eliminates data duplication, ensures single-source-of-truth updates, and lets the UI derive dynamic views automatically.

## Architecture

### Normalized State Structure

```typescript
{
  normalizedCharacters: { ids: string[], entities: { [id]: Character } },
  normalizedLocations:  { ids: string[], entities: { [id]: LocationEntry } },
  normalizedItems:      { ids: string[], entities: { [id]: Item } },
  timeline: { entries: TimelineEntry[], lastEpoch: number }
}
```

### Key Components

1. **Entity Adapter** (`src/store/entityAdapter.ts`) - Normalized state utilities
2. **Type System** (`src/types/lore.ts`) - CRM types and timeline
3. **Lore Slice** (`src/store/loreSlice.ts`) - State management with CRM actions
4. **Selectors** (`src/store/selectors.ts`) - Memoized query hooks

## Benefits

- **Single Source of Truth**: Entity data stored once, referenced by ID
- **O(1) Lookups**: Direct entity access via normalized maps
- **Automatic Updates**: Character moves propagate to all views instantly
- **Timeline Tracking**: Immutable audit log for consistency and AI
- **Type Safe**: Full TypeScript coverage
- **No Dependencies**: Pure Zustand implementation

## Quick Start

See `src/crm-demo.tsx` for complete usage examples.

### Creating Entities

```typescript
const store = useLitStore.getState();

store.addLocation({ id: crypto.randomUUID(), name: 'Wasteland', ... });
store.addItem({ id: crypto.randomUUID(), name: 'Sword', ... });
```

### CRM Actions

```typescript
// Move character (auto-logs to timeline)
store.moveCharacterToLocation(characterId, locationId);

// Item management
store.characterAcquireItem(characterId, itemId);
store.characterDropItem(characterId, itemId);

// Status updates
store.changeCharacterStatus(characterId, 'Deceased');
```

### Querying

```typescript
// React hooks
const location = useLocationById(locationId);
const inhabitants = useCharactersInLocation(locationId);
const inventory = useCharacterInventory(characterId);
const timeline = useTimelineForEntity('character', characterId);

// Plain functions (non-React)
const char = getCharacterById(state, characterId);
```

## Full Documentation

See complete API reference and examples in this document.

For implementation details, see:
- `src/store/entityAdapter.ts` - Entity adapter implementation
- `src/store/loreSlice.ts` - CRM actions and state management
- `src/store/selectors.ts` - Query hooks
- `src/types/lore.ts` - Type definitions
