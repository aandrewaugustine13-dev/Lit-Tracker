// =============================================================================
// PARSER TYPES — Universal Script Parser Type Definitions
// =============================================================================
// Type system for the two-pass extraction engine that parses script text,
// extracts entities (Characters, Locations, Items) and timeline events,
// and proposes updates for user review before committing to the store.

import { Character, LocationEntry, CharacterRole } from './index';
import { TimelineEntry, TimelineAction, TimelineEntityType } from './lore';

// ─── Project Configuration ──────────────────────────────────────────────────

/**
 * Custom pattern for user-defined regex matching in scripts.
 */
export interface CustomPattern {
  label: string;
  pattern: string; // Regex pattern as string
  entityType: 'character' | 'location' | 'item';
}

/**
 * Project-level configuration for the parser.
 * Contains user-defined entity names, canon locks, and custom extraction patterns.
 */
export interface ProjectConfig {
  /** Known entity names to scan for in the script */
  knownEntityNames: string[];
  /** Canon locks - rules that the LLM must respect (e.g., "Character X is always at Location Y") */
  canonLocks: string[];
  /** User-defined regex patterns for custom entity extraction */
  customPatterns: CustomPattern[];
}

// ─── Proposed Entity Types ──────────────────────────────────────────────────

export type ProposedEntityType = 'character' | 'location' | 'item';

/**
 * Proposed new entity extracted from the script.
 * Contains metadata about the extraction source, confidence, and context.
 */
export interface ProposedNewEntity {
  /** Temporary ID for selection tracking (before commit) */
  tempId: string;
  /** Type of entity being proposed */
  entityType: ProposedEntityType;
  /** Name of the entity */
  name: string;
  /** Source of extraction: deterministic (regex) or LLM */
  source: 'deterministic' | 'llm';
  /** Confidence score (0-1) */
  confidence: number;
  /** Snippet of text where this entity was found */
  contextSnippet: string;
  /** Line number in the script (1-indexed) */
  lineNumber: number;
  
  // Type-specific optional fields for entity creation
  /** Suggested role for character entities */
  suggestedRole?: CharacterRole;
  /** Suggested description for any entity */
  suggestedDescription?: string;
  /** Suggested region for location entities */
  suggestedRegion?: string;
  /** Suggested time of day for location entities */
  suggestedTimeOfDay?: string;
  /** Suggested holder ID for item entities */
  suggestedHolderId?: string;
  /** Suggested description specifically for item entities */
  suggestedItemDescription?: string;
}

/**
 * Proposed update to an existing entity.
 * Contains the entity ID, proposed changes, and extraction metadata.
 */
export interface ProposedEntityUpdate {
  /** ID of the existing entity to update */
  entityId: string;
  /** Type of entity being updated */
  entityType: ProposedEntityType;
  /** Name of the entity (for display) */
  entityName: string;
  /** Source of extraction: deterministic or LLM */
  source: 'deterministic' | 'llm';
  /** Confidence score (0-1) */
  confidence: number;
  /** Snippet of text that triggered this update */
  contextSnippet: string;
  /** Line number in the script (1-indexed) */
  lineNumber: number;
  /** Human-readable description of the change */
  changeDescription: string;
  /** Partial updates to apply to the entity */
  updates: Record<string, any>;
}

/**
 * Proposed timeline event extracted from the script.
 * Represents a state change or significant occurrence for an entity.
 */
export interface ProposedTimelineEvent {
  /** Temporary ID for selection tracking (before commit) */
  tempId: string;
  /** Source of extraction: deterministic or LLM */
  source: 'deterministic' | 'llm';
  /** Confidence score (0-1) */
  confidence: number;
  /** Snippet of text where this event was found */
  contextSnippet: string;
  /** Line number in the script (1-indexed) */
  lineNumber: number;
  /** Type of entity this event relates to */
  entityType: TimelineEntityType;
  /** ID of the entity (must exist in store) */
  entityId: string;
  /** Name of the entity (for display) */
  entityName: string;
  /** Type of action that occurred */
  action: TimelineAction;
  /** Action-specific data */
  payload: Record<string, any>;
  /** Human-readable description of the event */
  description: string;
}

// ─── Parse Results ──────────────────────────────────────────────────────────

/**
 * Complete output from the parser, containing all proposed changes.
 * Includes metadata about the parsing process.
 */
export interface ParsedProposal {
  meta: {
    /** ISO timestamp when parsing completed */
    parsedAt: string;
    /** Length of the raw script text in characters */
    rawScriptLength: number;
    /** Number of lines in the script */
    lineCount: number;
    /** Time taken to parse in milliseconds */
    parseDurationMs: number;
    /** Whether the LLM was invoked during parsing */
    llmWasUsed: boolean;
    /** Any warnings or issues encountered during parsing */
    warnings: string[];
  };
  /** Proposed new entities to be created */
  newEntities: ProposedNewEntity[];
  /** Proposed updates to existing entities */
  updatedEntities: ProposedEntityUpdate[];
  /** Proposed timeline events to be created */
  newTimelineEvents: ProposedTimelineEvent[];
}

// ─── Parser State ───────────────────────────────────────────────────────────

/**
 * Parser workflow status.
 */
export type ParserStatus = 'idle' | 'parsing' | 'awaiting-review' | 'committing' | 'error';

// ─── LLM Extraction Response ────────────────────────────────────────────────

/**
 * Expected JSON response structure from the LLM in Pass 2.
 * This matches the schema we demand in the system prompt.
 */
export interface LLMExtractionResponse {
  newEntities: Array<{
    name: string;
    entityType: 'character' | 'location' | 'item';
    confidence: number;
    contextSnippet: string;
    lineNumber: number;
    suggestedRole?: CharacterRole;
    suggestedDescription?: string;
    suggestedRegion?: string;
    suggestedTimeOfDay?: string;
    suggestedHolderId?: string;
    suggestedItemDescription?: string;
  }>;
  updatedEntities: Array<{
    entityId: string;
    entityType: 'character' | 'location' | 'item';
    entityName: string;
    confidence: number;
    contextSnippet: string;
    lineNumber: number;
    changeDescription: string;
    updates: Record<string, any>;
  }>;
  newTimelineEvents: Array<{
    entityType: TimelineEntityType;
    entityId: string;
    entityName: string;
    action: TimelineAction;
    payload: Record<string, any>;
    description: string;
    confidence: number;
    contextSnippet: string;
    lineNumber: number;
  }>;
}
