# LLM Script Parser Integration

## Overview

This implementation connects an LLM-based script parser to the Loom frontend, enabling users to paste raw comic scripts and extract structured lore data including characters, locations, timeline events, and objects.

## Features

- **Multi-Provider Support**: Works with OpenAI, Anthropic (Claude), Google Gemini, Grok (X.AI), and DeepSeek
- **Serverless Architecture**: Direct API calls from the browser (no backend required)
- **Real-time Parsing**: Immediate feedback with loading states
- **Smart Categorization**: AI-powered lore categorization (locations, timeline, echoes, uncategorized)
- **Interactive UI**: Hover over lore items to highlight referenced panels
- **Database Persistence**: Optional save to Supabase
- **Confidence Scoring**: Visual confidence bars for each extracted item

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser UI                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐              ┌─────────────────────┐      │
│  │              │              │                     │      │
│  │ LoreTracker  │◄─────────────┤   ScriptInput       │      │
│  │  (Sidebar)   │              │   (Main Area)       │      │
│  │              │              │                     │      │
│  │ • Characters │              │ • Textarea          │      │
│  │ • Locations  │              │ • Parse Button      │      │
│  │ • Timeline   │              │ • Character Count   │      │
│  │ • Echoes     │              │ • Error Display     │      │
│  │              │              │                     │      │
│  └──────────────┘              └─────────────────────┘      │
│         │                               │                    │
│         │                               │                    │
│         └───────────┬───────────────────┘                    │
│                     │                                        │
└─────────────────────┼────────────────────────────────────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │  parseScriptWithLLM   │
          │  (utils/scriptParser) │
          └───────────┬───────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    ┌──────────┐          ┌──────────────┐
    │ LLM APIs │          │  Validation  │
    │          │          │  & Cleanup   │
    │ • OpenAI │          │              │
    │ • Claude │          │ validateAnd  │
    │ • Gemini │          │ Clean()      │
    │ • Grok   │          │              │
    │ • DeepSeek│         └──────────────┘
    └──────────┘
```

## Data Flow

```
1. User pastes script → ScriptInput.tsx
2. User clicks "Parse & Weave"
3. ScriptInput reads API config from localStorage
4. Calls parseScriptWithLLM() with provider, key, model
5. LLM processes script → returns JSON
6. validateAndClean() ensures data integrity
7. onParsed() callback updates App state
8. LoreTracker displays categorized lore
9. (Optional) saveParsedScript() persists to Supabase
```

## Usage

### 1. Configuration

Set up localStorage variables in your browser console:

```javascript
// Required
localStorage.setItem('loom_api_key', 'your-api-key-here');

// Optional (defaults shown)
localStorage.setItem('loom_provider', 'gemini'); // or 'openai', 'anthropic', 'grok', 'deepseek'
localStorage.setItem('loom_model', 'gemini-1.5-pro'); // provider-specific model override
```

### 2. Access the Parser

Navigate to: `http://localhost:5173/?script-parser`

### 3. Parse a Script

Paste your comic script in the format:

```
PAGE 1

Panel 1
Wide establishing shot. The CITY OF NEO TOKYO at night.

Panel 2
ELI: I've been searching for the ANCIENT SWORD for years.
MAYA (thought): He doesn't know what he's getting into.

Panel 3
CAPTION: 2045 - The year everything changed.
```

Click **"Parse & Weave"** and wait for results.

### 4. Review Results

The LoreTracker sidebar will show:
- **Characters**: Expandable cards with descriptions
- **Locations**: ALL CAPS multi-word locations or high-confidence places
- **Timeline**: Year references (e.g., "2045")
- **Echoes/Objects**: Short ALL CAPS items (e.g., "SWORD")
- **Uncategorized**: Other extracted lore

Hover over any lore item to see which panels reference it.

## File Structure

```
src/
├── components/
│   ├── ScriptInput.tsx       # Script input UI with textarea & parse button
│   └── LoreTracker.tsx       # Lore display with categorization
├── services/
│   └── storage.ts            # Supabase persistence layer
├── utils/
│   └── scriptParser.ts       # LLM parser core logic
└── App.tsx                   # Integration layer (script-parser mode)
```

## API Integration

### OpenAI
```typescript
POST https://api.openai.com/v1/chat/completions
Headers: { Authorization: 'Bearer YOUR_KEY' }
Body: { model, messages, response_format: { type: 'json_object' } }
```

### Anthropic (Claude)
```typescript
POST https://api.anthropic.com/v1/messages
Headers: { 
  'x-api-key': 'YOUR_KEY',
  'anthropic-version': '2023-06-01'
}
Body: { model, messages, max_tokens: 4096 }
```

### Google Gemini
```typescript
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=YOUR_KEY
Body: { 
  contents: [{ parts: [{ text }] }],
  generationConfig: { responseMimeType: 'application/json' }
}
```

### Grok (X.AI)
```typescript
POST https://api.x.ai/v1/chat/completions
Headers: { Authorization: 'Bearer YOUR_KEY' }
Body: { model, messages } // OpenAI-compatible
```

### DeepSeek
```typescript
POST https://api.deepseek.com/v1/chat/completions
Headers: { Authorization: 'Bearer YOUR_KEY' }
Body: { model, messages } // OpenAI-compatible
```

## Output Schema

```typescript
interface ParsedScript {
  pages: Page[];
  characters: Character[];
  lore_candidates: LoreCandidate[];
  overall_lore_summary?: string;
}

interface Page {
  page_number: number;
  panels: Panel[];
}

interface Panel {
  panel_number: number;
  description: string;
  dialogue: DialogueLine[];
  panel_id: string; // e.g., "p1-panel3"
}

interface Character {
  name: string;
  description?: string;
  panel_count: number;
}

interface LoreCandidate {
  text: string;
  category: 'location' | 'timeline' | 'echo' | 'uncategorized';
  confidence: number; // 0.0 to 1.0
  panels: string[]; // panel_ids referencing this lore
}
```

## Security

- ✅ **CodeQL Scan**: 0 vulnerabilities found
- ✅ **AbortController**: Proper timeout handling with 2-minute limit
- ✅ **Input Validation**: All LLM responses validated and sanitized
- ✅ **Error Boundaries**: Graceful error handling with user-friendly messages
- ✅ **No eval/exec**: Safe JSON parsing only
- ⚠️ **API Keys**: Stored in localStorage (client-side only, not persisted to backend)

## Error Handling

| Error Type | Handling |
|------------|----------|
| Empty script | Inline error: "Please paste a script before parsing" |
| Missing API key | Inline error: "Please set your API key in localStorage" |
| Network failure | Caught and displayed with error message |
| Invalid JSON | Fallback to empty data structure |
| Timeout (2 min) | Request aborted, "Request was cancelled" error |
| Supabase disabled | Warning logged, parsing continues without persistence |

## Performance

- **Build Size**: ~12KB additional (gzipped)
- **Parse Time**: Depends on LLM API response (typically 3-10 seconds)
- **Timeout**: 2 minutes maximum
- **Memory**: Minimal overhead, scripts typically < 100KB

## Troubleshooting

### "Please set your API key"
Run in console: `localStorage.setItem('loom_api_key', 'your-key-here')`

### "Failed to parse script: 401 Unauthorized"
Check your API key is valid for the selected provider.

### "Request timeout after 2 minutes"
Try a shorter script or check your network connection.

### Lore items not categorized correctly
The LLM's categorization is trusted. If needed, adjust the NORMALIZATION_PROMPT in `utils/scriptParser.ts`.

### Supabase warnings
If you see "Supabase credentials not found", it's normal if you haven't configured Supabase. Parsing still works, just without database persistence.

## Future Enhancements

- [ ] Batch processing (multiple scripts)
- [ ] Export parsed data as JSON
- [ ] Custom prompt templates
- [ ] Relationship extraction (character connections)
- [ ] Conflict detection (timeline inconsistencies)
- [ ] Undo/redo for lore edits
- [ ] Search/filter in LoreTracker

## Testing

### Manual Testing
1. Start dev server: `npm run dev`
2. Navigate to `?script-parser` mode
3. Set API key in localStorage
4. Paste test script
5. Click "Parse & Weave"
6. Verify results appear in LoreTracker

### Unit Tests
No test infrastructure exists in this repository. Consider adding:
- Vitest for unit tests
- Playwright for E2E tests
- Mock LLM responses for deterministic testing

## Contributing

When modifying the parser:
1. Update `NORMALIZATION_PROMPT` if changing extraction logic
2. Update `validateAndClean()` if adding new fields
3. Update interfaces in `scriptParser.ts` for schema changes
4. Test with multiple providers (not all providers format JSON identically)
5. Run `npm run build` to verify TypeScript compilation

## License

Same as parent project (see root LICENSE file).
