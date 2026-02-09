/**
 * Cross-Module Sync Engine
 * 
 * Handles the connective tissue between modules:
 * - Script import → seed Character dossiers
 * - Panel prompts/dialogue → auto-link character IDs
 * - Panel content → suggest lore connections
 * - Name matching with fuzzy tolerance
 */

import { Character, LoreEntry, Panel, Page, Issue, InkProject } from '../types';
import { genId, createDefaultEra } from './helpers';

// ─── Name matching ──────────────────────────────────────────────────────

/**
 * Normalize a name for comparison: lowercase, trim, collapse whitespace
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if a text block contains a character name.
 * Matches whole words only to avoid false positives (e.g., "May" in "maybe").
 */
function textContainsName(text: string, name: string): boolean {
  if (!text || !name) return false;
  const normalized = normalizeName(text);
  const nameNorm = normalizeName(name);
  // Word boundary match
  const escaped = nameNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(normalized);
}

/**
 * Find a character by name in an existing roster.
 * Returns the match or null. Handles case insensitivity.
 */
export function findCharacterByName(name: string, characters: Character[]): Character | null {
  const norm = normalizeName(name);
  return characters.find(c => normalizeName(c.name) === norm) || null;
}

/**
 * Find a lore entry by name in existing entries.
 */
export function findLoreByName(name: string, entries: LoreEntry[]): LoreEntry | null {
  const norm = normalizeName(name);
  return entries.find(e => normalizeName(e.name) === norm) || null;
}

// ─── Script Import → Character Seeding ──────────────────────────────────

export interface ParsedCharacterInput {
  name: string;
  description?: string;
  lineCount: number;
  firstAppearance?: string;
}

export interface SeedResult {
  /** Characters that were newly created */
  created: Character[];
  /** Characters that already existed (matched by name) */
  existing: Character[];
  /** Map from parsed name → character ID (includes both created and existing) */
  nameToId: Map<string, string>;
}

/**
 * Given parsed characters from a script import, create Character dossiers
 * for any that don't already exist. Returns a map of name → ID for linking.
 */
export function seedCharactersFromScript(
  parsedCharacters: ParsedCharacterInput[],
  existingCharacters: Character[],
): SeedResult {
  const created: Character[] = [];
  const existing: Character[] = [];
  const nameToId = new Map<string, string>();

  for (const parsed of parsedCharacters) {
    const match = findCharacterByName(parsed.name, existingCharacters);

    if (match) {
      // Already exists — just map the name
      existing.push(match);
      nameToId.set(normalizeName(parsed.name), match.id);
    } else {
      // Create a new dossier
      const now = Date.now();
      const newChar: Character = {
        id: genId(),
        createdAt: now,
        updatedAt: now,
        name: parsed.name,
        role: guessRole(parsed),
        archetype: '',
        eras: [createDefaultEra('Default')],
        voice_profile: { samples: [], style: '' },
        smart_tags: { Status: 'Active' },
        gallery: [],
        loreEntryIds: [],
        description: parsed.description || parsed.firstAppearance || '',
      };
      created.push(newChar);
      nameToId.set(normalizeName(parsed.name), newChar.id);
    }
  }

  return { created, existing, nameToId };
}

/**
 * Guess a character's role based on their line count relative to others.
 */
function guessRole(parsed: ParsedCharacterInput): Character['role'] {
  // Simple heuristic — can be refined later
  if (parsed.lineCount >= 20) return 'Protagonist';
  if (parsed.lineCount >= 10) return 'Supporting';
  if (parsed.lineCount >= 3) return 'Supporting';
  return 'Minor';
}

// ─── Auto-linking panels to characters ──────────────────────────────────

export interface AutoLinkResult {
  /** Panel ID → array of character IDs that should be linked */
  panelLinks: Map<string, string[]>;
  /** Total number of new links that would be added */
  newLinkCount: number;
}

/**
 * Scan all panels in an issue for character name mentions in prompts and dialogue.
 * Returns a map of suggested character links.
 */
export function autoLinkPanelsToCharacters(
  issue: Issue,
  characters: Character[],
): AutoLinkResult {
  const panelLinks = new Map<string, string[]>();
  let newLinkCount = 0;

  for (const page of issue.pages) {
    for (const panel of page.panels) {
      const matchedIds: string[] = [];

      for (const char of characters) {
        if (!char.name || char.name.length < 2) continue;

        // Check panel prompt
        const inPrompt = textContainsName(panel.prompt || '', char.name);

        // Check dialogue/text elements
        const inDialogue = panel.textElements.some(te =>
          textContainsName(te.content, char.name)
        );

        // Check notes
        const inNotes = textContainsName(panel.notes || '', char.name);

        if (inPrompt || inDialogue || inNotes) {
          // Only add if not already linked
          if (!panel.characterIds.includes(char.id)) {
            matchedIds.push(char.id);
            newLinkCount++;
          }
        }
      }

      if (matchedIds.length > 0) {
        panelLinks.set(panel.id, matchedIds);
      }
    }
  }

  return { panelLinks, newLinkCount };
}

// ─── Lore mention detection ─────────────────────────────────────────────

export interface LoreMention {
  loreEntryId: string;
  loreEntryName: string;
  panelId: string;
  pageNumber: number;
  context: string; // snippet of text where the mention was found
}

/**
 * Scan panels for mentions of lore entry names.
 * Returns a list of detected mentions for review.
 */
export function detectLoreMentions(
  issue: Issue,
  loreEntries: LoreEntry[],
): LoreMention[] {
  const mentions: LoreMention[] = [];

  // Only scan entries with names >= 3 chars to avoid false positives
  const scannable = loreEntries.filter(e => e.name.length >= 3);

  for (const page of issue.pages) {
    for (const panel of page.panels) {
      const textBlocks = [
        panel.prompt || '',
        panel.notes || '',
        ...panel.textElements.map(te => te.content),
      ].filter(Boolean);

      const fullText = textBlocks.join(' ');

      for (const entry of scannable) {
        if (textContainsName(fullText, entry.name)) {
          // Find the context snippet
          const idx = fullText.toLowerCase().indexOf(entry.name.toLowerCase());
          const start = Math.max(0, idx - 30);
          const end = Math.min(fullText.length, idx + entry.name.length + 30);
          const context = (start > 0 ? '...' : '') + fullText.slice(start, end) + (end < fullText.length ? '...' : '');

          mentions.push({
            loreEntryId: entry.id,
            loreEntryName: entry.name,
            panelId: panel.id,
            pageNumber: page.number,
            context,
          });
        }
      }
    }
  }

  return mentions;
}

// ─── Batch operations ───────────────────────────────────────────────────

/**
 * Apply auto-link results to panels, returning updated pages.
 */
export function applyAutoLinks(
  pages: Page[],
  panelLinks: Map<string, string[]>,
): Page[] {
  return pages.map(page => ({
    ...page,
    panels: page.panels.map(panel => {
      const newIds = panelLinks.get(panel.id);
      if (!newIds || newIds.length === 0) return panel;
      return {
        ...panel,
        characterIds: [...new Set([...panel.characterIds, ...newIds])],
      };
    }),
  }));
}
