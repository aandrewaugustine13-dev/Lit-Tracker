// =============================================================================
// ENTITY ADAPTER — Lightweight normalized state utilities for Zustand
// =============================================================================
// Provides RTK-style normalized state management ({ ids, entities }) without Redux.
// All operations return new objects (immutable) for proper Zustand reactivity.

export interface EntityState<T> {
  ids: string[];
  entities: Record<string, T>;
}

export interface EntityAdapter<T> {
  getInitialState(): EntityState<T>;
  addOne(state: EntityState<T>, entity: T): EntityState<T>;
  addMany(state: EntityState<T>, entities: T[]): EntityState<T>;
  updateOne(state: EntityState<T>, id: string, changes: Partial<T>): EntityState<T>;
  removeOne(state: EntityState<T>, id: string): EntityState<T>;
  upsertOne(state: EntityState<T>, entity: T): EntityState<T>;
  setAll(state: EntityState<T>, entities: T[]): EntityState<T>;
  getSelectors<V>(): EntitySelectors<T, V>;
}

export interface EntitySelectors<T, V> {
  selectAll: (state: V) => T[];
  selectById: (state: V, id: string) => T | undefined;
  selectIds: (state: V) => string[];
  selectTotal: (state: V) => number;
}

/**
 * Creates a lightweight entity adapter for normalized state management.
 * Similar to RTK's createEntityAdapter but works with plain TypeScript.
 * 
 * @param selectId - Function to extract the entity's unique ID
 * @returns EntityAdapter with normalized state operations
 * 
 * @example
 * ```ts
 * interface Character { id: string; name: string; }
 * const characterAdapter = createEntityAdapter<Character>((c) => c.id);
 * 
 * // In your Zustand slice:
 * const initialState = characterAdapter.getInitialState();
 * const newState = characterAdapter.addOne(state, newCharacter);
 * ```
 */
export function createEntityAdapter<T>(
  selectId: (entity: T) => string
): EntityAdapter<T> {
  return {
    getInitialState(): EntityState<T> {
      return {
        ids: [],
        entities: {},
      };
    },

    /**
     * Adds a single entity to the state.
     * If entity already exists (by ID), it is NOT replaced.
     */
    addOne(state: EntityState<T>, entity: T): EntityState<T> {
      const id = selectId(entity);
      
      // Don't add if already exists
      if (state.entities[id]) {
        return state;
      }

      return {
        ids: [...state.ids, id],
        entities: { ...state.entities, [id]: entity },
      };
    },

    /**
     * Adds multiple entities to the state.
     * Skips entities that already exist.
     */
    addMany(state: EntityState<T>, entities: T[]): EntityState<T> {
      const newIds: string[] = [];
      const newEntities: Record<string, T> = { ...state.entities };

      for (const entity of entities) {
        const id = selectId(entity);
        if (!newEntities[id]) {
          newIds.push(id);
          newEntities[id] = entity;
        }
      }

      if (newIds.length === 0) {
        return state;
      }

      return {
        ids: [...state.ids, ...newIds],
        entities: newEntities,
      };
    },

    /**
     * Updates an existing entity with partial changes.
     * If entity doesn't exist, no change is made.
     */
    updateOne(state: EntityState<T>, id: string, changes: Partial<T>): EntityState<T> {
      const existing = state.entities[id];
      if (!existing) {
        return state;
      }

      return {
        ids: state.ids,
        entities: {
          ...state.entities,
          [id]: { ...existing, ...changes },
        },
      };
    },

    /**
     * Removes an entity by ID.
     */
    removeOne(state: EntityState<T>, id: string): EntityState<T> {
      if (!state.entities[id]) {
        return state;
      }

      const { [id]: removed, ...remainingEntities } = state.entities;

      return {
        ids: state.ids.filter((eid) => eid !== id),
        entities: remainingEntities,
      };
    },

    /**
     * Upserts an entity: updates if exists, adds if doesn't.
     */
    upsertOne(state: EntityState<T>, entity: T): EntityState<T> {
      const id = selectId(entity);
      const exists = state.entities[id] !== undefined;

      if (exists) {
        return {
          ids: state.ids,
          entities: {
            ...state.entities,
            [id]: entity,
          },
        };
      } else {
        return {
          ids: [...state.ids, id],
          entities: { ...state.entities, [id]: entity },
        };
      }
    },

    /**
     * Replaces all entities with a new set.
     */
    setAll(state: EntityState<T>, entities: T[]): EntityState<T> {
      const ids: string[] = [];
      const entityMap: Record<string, T> = {};

      for (const entity of entities) {
        const id = selectId(entity);
        ids.push(id);
        entityMap[id] = entity;
      }

      return {
        ids,
        entities: entityMap,
      };
    },

    /**
     * Returns selector functions for querying the normalized state.
     * V is the full store state type containing the EntityState.
     */
    getSelectors<V>(): EntitySelectors<T, V> {
      return {
        selectAll: (state: V) => {
          const entityState = state as unknown as EntityState<T>;
          return entityState.ids.map((id) => entityState.entities[id]);
        },
        selectById: (state: V, id: string) => {
          const entityState = state as unknown as EntityState<T>;
          return entityState.entities[id];
        },
        selectIds: (state: V) => {
          const entityState = state as unknown as EntityState<T>;
          return entityState.ids;
        },
        selectTotal: (state: V) => {
          const entityState = state as unknown as EntityState<T>;
          return entityState.ids.length;
        },
      };
    },
  };
}
