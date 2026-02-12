# Universal Script Parser - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐      ┌───────────────────────────────────┐   │
│  │  Lore Tracker    │      │  "Extract from Script" Button     │   │
│  │  Module          │──────▶  (Purple, with ✨ icon)           │   │
│  └──────────────────┘      └───────────────────────────────────┘   │
│                                           │                          │
│                                           ▼                          │
│                            ┌──────────────────────────────┐         │
│                            │ ScriptExtractionTrigger      │         │
│                            │ (Modal for script input)     │         │
│                            └──────────────────────────────┘         │
│                                           │                          │
│                                           │ Script Text              │
│                                           │ + Config                 │
│                                           ▼                          │
└─────────────────────────────────────────────────────────────────────┘
                                            │
                                            │
┌───────────────────────────────────────────────────────────────────────┐
│                        PARSING ENGINE                                  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  src/engine/universalScriptParser.ts                                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  parseScriptAndProposeUpdates()                                 │  │
│  │                                                                  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ PASS 1: Deterministic Extraction                         │  │  │
│  │  │                                                           │  │  │
│  │  │ • Slug-lines (INT./EXT.)        → Locations             │  │  │
│  │  │ • Dialogue speakers (ALL-CAPS)  → Characters            │  │  │
│  │  │ • Action verbs + props          → Items                 │  │  │
│  │  │ • Setting/Caption markers       → Timeline Events       │  │  │
│  │  │ • Custom regex patterns         → User-defined          │  │  │
│  │  │                                                           │  │  │
│  │  │ Confidence: 0.75 - 1.0 (High)                            │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                              │                                   │  │
│  │                              ▼                                   │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ PASS 2: LLM Extraction (Optional)                        │  │  │
│  │  │                                                           │  │  │
│  │  │ Gemini 2.0 Flash API                                     │  │  │
│  │  │                                                           │  │  │
│  │  │ • Implicit entity mentions                               │  │  │
│  │  │ • Character relationships                                │  │  │
│  │  │ • Emotional states                                       │  │  │
│  │  │ • Complex timeline events                                │  │  │
│  │  │                                                           │  │  │
│  │  │ Confidence: 0.5 - 0.9 (Variable)                         │  │  │
│  │  │                                                           │  │  │
│  │  │ Graceful fallback: Returns empty on error                │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                              │                                   │  │
│  │                              ▼                                   │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ Merge & Deduplicate                                      │  │  │
│  │  │                                                           │  │  │
│  │  │ • Combine Pass 1 + Pass 2 results                        │  │  │
│  │  │ • Remove duplicates (case-insensitive name matching)     │  │  │
│  │  │ • Preserve highest confidence source                     │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                              │                                   │  │
│  │                              ▼                                   │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ Return ParsedProposal                                    │  │  │
│  │  │                                                           │  │  │
│  │  │ • meta: { parsedAt, lineCount, parseDuration, ... }      │  │  │
│  │  │ • newEntities: ProposedNewEntity[]                       │  │  │
│  │  │ • updatedEntities: ProposedEntityUpdate[]                │  │  │
│  │  │ • newTimelineEvents: ProposedTimelineEvent[]             │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┬─┘
                                            │                           │
                                            ▼                           │
┌─────────────────────────────────────────────────────────────────────┐
│                        STATE MANAGEMENT                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  src/store/parserSlice.ts                                           │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Zustand State                                                │   │
│  │                                                               │   │
│  │ • parserStatus: 'idle' | 'parsing' | 'awaiting-review'      │   │
│  │ • currentProposal: ParsedProposal | null                     │   │
│  │ • selectedNewEntityIds: string[]                             │   │
│  │ • selectedUpdateIds: number[]                                │   │
│  │ • selectedTimelineEventIds: string[]                         │   │
│  │ • projectConfig: ProjectConfig                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               │ Status: 'awaiting-review'
                               │ Proposal populated
                               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                     REVIEW INTERFACE                                   │
├───────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ExtractionPreviewModal                                                │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                  │  │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │  │
│  │  ┃ Lore Extraction Review                                  ┃  │  │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │  │
│  │                                                                  │  │
│  │  ▼ New Entities (5)                          3 selected         │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ ☑ ELI                                                     │  │  │
│  │  │   Character • deterministic • 95% ████████▓░              │  │  │
│  │  │   Line 3: "ELI sits at a table"                          │  │  │
│  │  ├──────────────────────────────────────────────────────────┤  │  │
│  │  │ ☑ APARTMENT                                               │  │  │
│  │  │   Location • deterministic • 95% ████████▓░               │  │  │
│  │  │   Line 1: "INT. APARTMENT - NIGHT"                       │  │  │
│  │  ├──────────────────────────────────────────────────────────┤  │  │
│  │  │ ☐ ANCIENT SWORD                                           │  │  │
│  │  │   Item • deterministic • 75% ██████▓░░░                   │  │  │
│  │  │   Line 7: "Close-up of the ANCIENT SWORD"                │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                  │  │
│  │  ▼ Entity Updates (0)                        0 selected         │  │
│  │                                                                  │  │
│  │  ▼ Timeline Events (2)                       2 selected         │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ ☑ ELI moved to APARTMENT                                  │  │  │
│  │  │   moved_to • deterministic • 85% ███████▓░░               │  │  │
│  │  ├──────────────────────────────────────────────────────────┤  │  │
│  │  │ ☑ Timeline marker: Year 2077                              │  │  │
│  │  │   created • deterministic • 100% ██████████               │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                  │  │
│  │  [Select All] [Deselect All]         [Reject] [Commit (5)] ✓  │  │
│  │                                                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                         │
│                              │ User clicks "Commit"                   │
│                              ▼                                         │
└───────────────────────────────────────────────────────────────────────┘
                               │
                               │
┌───────────────────────────────────────────────────────────────────────┐
│                    COMMIT TO STORE                                     │
├───────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  commitExtractionProposal()                                            │
│                                                                         │
│  Single atomic set() call:                                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                  │  │
│  │  1. Filter to selected items only                               │  │
│  │                                                                  │  │
│  │  2. Create entity objects:                                      │  │
│  │     • Characters with full dossier                              │  │
│  │     • Locations with region/climate/importance                  │  │
│  │     • Items with holder/location references                     │  │
│  │                                                                  │  │
│  │  3. Upsert to normalized stores via adapters:                   │  │
│  │     ┌──────────────────────────────────────────────────┐       │  │
│  │     │ characterAdapter.upsertOne()                      │       │  │
│  │     │ locationAdapter.upsertOne()                       │       │  │
│  │     │ itemAdapter.upsertOne()                           │       │  │
│  │     └──────────────────────────────────────────────────┘       │  │
│  │                                                                  │  │
│  │  4. Apply updates via adapter.updateOne()                       │  │
│  │                                                                  │  │
│  │  5. Create timeline entries:                                    │  │
│  │     • Monotonically increasing epochs                           │  │
│  │     • ISO timestamps                                            │  │
│  │     • Action type + payload + description                       │  │
│  │                                                                  │  │
│  │  6. Append to timeline.entries array                            │  │
│  │                                                                  │  │
│  │  7. Update legacy characters[] array                            │  │
│  │                                                                  │  │
│  │  8. Reset parser state to 'idle'                                │  │
│  │                                                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└───────────────────────────────────────────────────────────────────────┬┘
                                            │                            │
                                            ▼                            │
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA PERSISTENCE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  localStorage: 'lit-tracker-v1'                                      │
│                                                                       │
│  ✓ normalizedCharacters: EntityState<Character>                     │
│  ✓ normalizedLocations: EntityState<LocationEntry>                  │
│  ✓ normalizedItems: EntityState<Item>                               │
│  ✓ timeline: TimelineState                                          │
│  ✓ characters: Character[] (legacy)                                 │
│  ✓ parserStatus: ParserStatus                                       │
│  ✓ projectConfig: ProjectConfig                                     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Input Flow
```
User Script Text
    │
    ├─→ Pass 1 (Deterministic)
    │   └─→ Pattern Matching
    │       ├─→ Slug-line regex
    │       ├─→ Character name regex  
    │       ├─→ Action verb detection
    │       └─→ Custom patterns
    │
    └─→ Pass 2 (LLM, Optional)
        └─→ Gemini API
            ├─→ System prompt with context
            ├─→ JSON response parsing
            └─→ Confidence scoring
```

### Output Flow
```
ParsedProposal
    │
    ├─→ UI Review
    │   ├─→ User selects items
    │   └─→ Confidence filtering
    │
    └─→ Commit
        ├─→ Entity Adapters
        │   ├─→ Normalized Stores
        │   └─→ Legacy Arrays
        │
        └─→ Timeline System
            └─→ Epoch Sequencing
```

## Key Design Patterns

### 1. Entity Adapter Pattern
```typescript
characterAdapter.upsertOne(state, newCharacter)
  ↓
{ ids: [...ids, newId], entities: { ...entities, [newId]: newCharacter } }
```

### 2. Timeline Epoch System
```typescript
epoch: prevEpoch + 1  // Monotonically increasing
timestamp: new Date().toISOString()
action: 'created' | 'moved_to' | 'acquired' | ...
payload: { locationId: '...' }  // Action-specific data
```

### 3. Two-Pass Extraction
```
Pass 1 (Deterministic) → High confidence (0.75-1.0)
    │
    └─→ Results
            ├─→ Used immediately
            └─→ Fed to Pass 2 as context
                    │
                    └─→ Pass 2 (LLM) → Variable confidence (0.5-0.9)
                            │
                            └─→ Merged & deduplicated
```

### 4. Atomic State Updates
```typescript
set((prevState) => ({
  // All changes in single transaction
  normalizedCharacters: updatedChars,
  normalizedLocations: updatedLocs,
  normalizedItems: updatedItems,
  timeline: { entries: [...entries, ...newEntries], lastEpoch: newEpoch },
  characters: [...prevState.characters, ...newChars],
  parserStatus: 'idle',
  currentProposal: null,
}))
```

## Error Handling

```
┌──────────────────┐
│ User Action      │
└────────┬─────────┘
         │
         ▼
┌────────────────────────┐
│ Try Parse              │
├────────────────────────┤
│ • Validate input       │──NO──▶ Alert user
│ • Set status 'parsing' │
└────────┬───────────────┘
         │ YES
         ▼
┌────────────────────────┐
│ Pass 1: Deterministic  │
├────────────────────────┤
│ Always succeeds        │◀─────┐
│ (may have 0 results)   │      │
└────────┬───────────────┘      │
         │                       │
         ▼                       │
┌────────────────────────┐      │
│ Pass 2: LLM (optional) │      │
├────────────────────────┤      │
│ try {                  │      │
│   Gemini API call      │      │
│ } catch (error) {      │      │
│   console.error()      │──────┘ Graceful fallback
│   return empty         │        (Pass 1 results still valid)
│ }                      │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Show Proposal          │
├────────────────────────┤
│ Status: 'awaiting-     │
│         review'        │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ User commits           │
├────────────────────────┤
│ try {                  │
│   Atomic set()         │──SUCCESS──▶ Status: 'idle'
│ } catch (error) {      │              Proposal: null
│   Status: 'error'      │
│   Show error message   │
│ }                      │
└────────────────────────┘
```

## Performance Characteristics

- **Pass 1**: O(n) where n = lines in script (~1-5ms for typical script)
- **Pass 2**: Network-bound (~500-2000ms depending on API latency)
- **Merge**: O(m) where m = entities found (~1ms)
- **Commit**: O(k) where k = selected entities (~5-20ms)

Total: ~10ms (deterministic only) to ~2s (with LLM)

## Security Considerations

1. **API Key Storage**: Stored in memory only, not persisted
2. **Input Sanitization**: All regex patterns validated before execution
3. **XSS Prevention**: All entity names/descriptions escaped in UI
4. **CORS**: Gemini API requests use proper CORS headers
5. **Canon Locks**: Prevent parser from modifying protected entities
