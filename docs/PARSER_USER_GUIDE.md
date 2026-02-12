# Universal Script Parser - User Guide

## Overview

The Universal Script Parser is now fully integrated into Lit-Tracker! This two-pass extraction engine analyzes your script text and automatically extracts:

- **Characters** (from dialogue speakers and mentions)
- **Locations** (from slug-lines, scene headings, and descriptions)
- **Items** (from action descriptions and prop mentions)
- **Timeline Events** (character movements, item transfers, status changes)

## How to Use

### 1. Navigate to Lore Tracker Module

Click on the "Lore Tracker" tab in the sidebar.

### 2. Click "Extract from Script"

In the Lore Tracker header, you'll see a purple button labeled **"Extract from Script"** (with a sparkles ✨ icon). Click it to open the Script Extraction modal.

### 3. Enter Your Script

You have two options:

- **Paste text directly**: Copy your script and paste it into the text area
- **Upload a file**: Click "Upload File" to select a `.txt`, `.fountain`, or `.fdx` file

**Example script format:**
```
INT. APARTMENT - NIGHT

Panel 1 Interior apartment. ELI sits at a table.

ELI
  I've been searching for years.

Panel 2 Close-up of the ANCIENT SWORD on the table.

Setting: Year 2077, Post-Apocalypse
```

### 4. Optional: Enable LLM Enhancement

Check the "Enable LLM-Enhanced Extraction" checkbox to use AI for more advanced extraction:

- Extracts implicit relationships
- Detects emotional states
- Identifies complex entity interactions

**Note:** You'll need a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (free).

### 5. Parse the Script

Click **"Parse Script"** button. The parser will:

1. **Pass 1 (Deterministic)**: Use pattern matching to extract high-confidence entities
2. **Pass 2 (LLM, optional)**: Use AI to find implicit entities and relationships
3. Generate a proposal with all findings

### 6. Review Extracted Entities

The **Extraction Preview Modal** will show three sections:

#### New Entities
- Each card shows the entity name, type (character/location/item)
- **Confidence bar**: Green (high), Amber (medium), Red (low)
- **Source badge**: "deterministic" or "llm"
- **Context snippet**: Where in the script it was found
- **Line number**: Exact location in your script

#### Entity Updates
- Proposed changes to existing entities
- Shows what will be modified

#### Timeline Events
- Chronological events extracted from your script
- Character movements, item transfers, etc.

### 7. Select What to Commit

- Use checkboxes to select/deselect individual proposals
- Click **"Select All"** or **"Deselect All"** for bulk actions
- Review confidence scores to decide what to trust

### 8. Commit to Lore Tracker

Click **"Commit to Lore Tracker"** to apply selected changes. The system will:

- Add new entities to normalized stores
- Apply updates to existing entities
- Create timeline entries for all changes
- Update the legacy character array for backward compatibility

### 9. View Results

Your new entities will appear in:
- **Lore Tracker** (locations, items)
- **Character Tracker** (characters)
- **Timeline** (all events with monotonically increasing epochs)

## Tips

1. **Start with deterministic only**: Test the parser without LLM first to see what it can extract
2. **Review confidence scores**: Items below 60% confidence might need manual review
3. **Check context snippets**: These show exactly where the entity was detected
4. **Use custom patterns**: Add custom regex patterns in Project Config for specialized extraction
5. **Canon locks**: Mark entities as canon-locked to prevent parser from modifying them

## Technical Details

### Pass 1: Deterministic Extraction

Detects:
- `INT.` / `EXT.` slug-lines → Locations
- All-caps names followed by indented dialogue → Characters
- "Setting:" and "CAPTION:" lines → Timeline markers
- Action verbs (picks up, grabs, drops) + capitalized words → Items
- Custom regex patterns from your project config

### Pass 2: LLM Extraction (Optional)

Uses Gemini 2.0 Flash to:
- Find implicit entity mentions
- Extract character relationships
- Detect emotional states and motivations
- Identify timeline events from context
- Deduplicate against Pass 1 results

### Data Safety

- **Preview before commit**: Nothing is changed until you click "Commit"
- **Atomic updates**: All changes happen in a single transaction
- **Timeline tracking**: Every change is logged with an epoch number
- **Reversible**: Timeline entries allow you to reconstruct past states

## Troubleshooting

**Q: Parser found too many false positives**
- Try adjusting your script format (clearer slug-lines, consistent character names)
- Disable LLM extraction if it's too aggressive
- Use the confidence scores to filter results

**Q: Parser missed entities**
- Check if your script follows standard screenplay/comic format
- Add custom patterns in Project Config for domain-specific terms
- Enable LLM extraction for better contextual understanding

**Q: LLM extraction failed**
- Check your API key is valid
- Ensure you have internet connectivity
- The parser will still work with Pass 1 (deterministic) results

**Q: Nothing was extracted**
- Ensure your script has proper formatting (slug-lines, character names, etc.)
- Check the warnings in the preview modal for parsing issues
- Verify the script text was actually entered/uploaded

## Example Workflow

1. Write a script in your preferred format (screenplay, comic, stage play)
2. Click "Extract from Script" in Lore Tracker
3. Paste your script (or upload a file)
4. Enable LLM with your Gemini API key for best results
5. Click "Parse Script" and wait for processing
6. Review the proposal - check confidence scores and context
7. Deselect any false positives
8. Click "Commit to Lore Tracker"
9. Your characters, locations, and items are now in the system!
10. Cross-reference them in Character Tracker and Lore Tracker

## Integration Points

The parser integrates with:
- **Normalized Entity Stores**: Characters, Locations, Items
- **Timeline System**: All changes create timeline entries
- **Entity Adapters**: Uses the same adapter pattern as the rest of the app
- **Project Config**: Respects canon locks and known entity names
- **Legacy Arrays**: Maintains backward compatibility with existing components

## Future Enhancements

Potential improvements:
- Support for more script formats (TV, animation, etc.)
- Better character role detection (protagonist, antagonist, etc.)
- Relationship extraction and graphing
- Conflict detection (contradictory timeline events)
- Batch processing (multiple scripts at once)
- Export proposals as JSON for version control
