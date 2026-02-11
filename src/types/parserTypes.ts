// =============================================================================
// PARSER TYPES — Universal Script Parser Type Definitions
// =============================================================================
// Defines types for the two-pass script extraction engine with preview/commit workflow.

import { Character, LocationEntry, CharacterRole } from './index';
import { TimelineAction, TimelineEntityType } from './lore';

// ─── Custom Pattern Configuration ───────────────────────────────────────────

/**
 * Custom regex pattern for extracting specific entity types from script text.
 */
export interface CustomPattern {
  label: string;
  pattern: string;
  entityType: 'character' | 'location' | 'item';
}

// ─── Project Configuration ──────────────────────────────────────────────────

/**
 * Project-level configuration for the parser.
 * Maintains known entity names, canon locks, and custom extraction patterns.
 */
export interface ProjectConfig {
  /** List of entity names that exist in the project (used for entity resolution) */
  knownEntityNames: string[];
  /** Entity names that are locked and should not be modified by parser */
  canonLocks: string[];
  /** Custom regex patterns for specialized entity extraction */
  customPatterns: CustomPattern[];
}

// ─── Proposed Entity Types ──────────────────────────────────────────────────

export type ProposedEntityType = 'character' | 'location' | 'item';

// ─── Proposed New Entity ────────────────────────────────────────────────────

/**
 * A proposed new entity discovered during script parsing.
 * Can be created either deterministically (Pass 1) or via LLM analysis (Pass 2).
 */
export interface ProposedNewEntity {
  /** Temporary ID for tracking in UI (not the final entity ID) */
  tempId: string;
  /** Type of entity being proposed */
  entityType: ProposedEntityType;
  /** Name of the proposed entity */
  name: string;
  /** Source of extraction: deterministic rules or LLM inference */
  source: 'deterministic' | 'llm';
  /** Confidence score (0-1) indicating extraction certainty */
  confidence: number;
  /** Text snippet from script where entity was found */
  contextSnippet: string;
  /** Line number where entity was detected */
  lineNumber: number;
  
  // ─── Character-specific suggestions ───────────────────────────────────────
  suggestedRole?: CharacterRole;
  suggestedDescription?: string;
  
  // ─── Location-specific suggestions ────────────────────────────────────────
  suggestedRegion?: string;
  
  // ─── Item-specific suggestions ─────────────────────────────────────────────
  suggestedHolderId?: string;
  suggestedItemDescription?: string;
}

// ─── Proposed Entity Update ─────────────────────────────────────────────────

/**
 * A proposed update to an existing entity based on new information in the script.
 */
export interface ProposedEntityUpdate {
  /** ID of the existing entity to update */
  entityId: string;
  /** Type of entity being updated */
  entityType: ProposedEntityType;
  /** Name of the entity (for display) */
  entityName: string;
  /** Source of extraction: deterministic rules or LLM inference */
  source: 'deterministic' | 'llm';
  /** Confidence score (0-1) indicating update certainty */
  confidence: number;
  /** Text snippet from script where update was detected */
  contextSnippet: string;
  /** Line number where update was detected */
  lineNumber: number;
  /** Human-readable description of what changed */
  changeDescription: string;
  /** Partial entity updates to apply (key-value pairs) */
  updates: Record<string, any>;
}

// ─── Proposed Timeline Event ────────────────────────────────────────────────

/**
 * A proposed timeline event extracted from the script.
 */
export interface ProposedTimelineEvent {
  /** Temporary ID for tracking in UI (not the final timeline entry ID) */
  tempId: string;
  /** Source of extraction: deterministic rules or LLM inference */
  source: 'deterministic' | 'llm';
  /** Confidence score (0-1) indicating extraction certainty */
  confidence: number;
  /** Text snippet from script where event was detected */
  contextSnippet: string;
  /** Line number where event was detected */
  lineNumber: number;
  /** Type of entity involved in this timeline event */
  entityType: TimelineEntityType;
  /** ID of the entity involved (if known) */
  entityId: string;
  /** Name of the entity (for display when ID is not yet assigned) */
  entityName: string;
  /** Type of action that occurred */
  action: TimelineAction;
  /** Action-specific data (e.g., { locationId: '...' } for 'moved_to') */
  payload: Record<string, any>;
  /** Human-readable description of the event */
  description: string;
}

// ─── Parsed Proposal ────────────────────────────────────────────────────────

/**
 * Complete parsing result containing all proposed changes from both Pass 1 and Pass 2.
 */
export interface ParsedProposal {
  /** Metadata about the parsing run */
  meta: {
    /** ISO timestamp when parsing completed */
    parsedAt: string;
    /** Length of the raw script text in characters */
    rawScriptLength: number;
    /** Number of lines in the script */
    lineCount: number;
    /** Time taken to parse in milliseconds */
    parseDurationMs: number;
    /** Whether LLM was used in this parse (Pass 2) */
    llmWasUsed: boolean;
    /** Any warnings or issues encountered during parsing */
    warnings: string[];
  };
  /** Proposed new entities to create */
  newEntities: ProposedNewEntity[];
  /** Proposed updates to existing entities */
  updatedEntities: ProposedEntityUpdate[];
  /** Proposed new timeline events to add */
  newTimelineEvents: ProposedTimelineEvent[];
}

// ─── Parser Status ──────────────────────────────────────────────────────────

export type ParserStatus = 
  | 'idle'              // No parsing in progress
  | 'parsing'           // Currently parsing script
  | 'awaiting-review'   // Parse complete, awaiting user review
  | 'committing'        // Committing approved changes to store
  | 'error';            // Parser encountered an error

// ─── LLM Extraction Response ────────────────────────────────────────────────

/**
 * Response structure from LLM API for entity and event extraction.
 */
export interface LLMExtractionResponse {
  /** New entities discovered by LLM */
  newEntities: Array<{
    name: string;
    entityType: string;
    confidence: number;
    contextSnippet: string;
    lineNumber: number;
    suggestedRole?: CharacterRole;
    suggestedDescription?: string;
    suggestedRegion?: string;
    suggestedItemDescription?: string;
  }>;
  /** Updates to existing entities suggested by LLM */
  updatedEntities: Array<{
    entityName: string;
    entityType: string;
    confidence: number;
    contextSnippet: string;
    lineNumber: number;
    changeDescription: string;
    updates: Record<string, any>;
  }>;
  /** Timeline events extracted by LLM */
  newTimelineEvents: Array<{
    entityName: string;
    entityType: string;
    action: string;
    confidence: number;
    contextSnippet: string;
    lineNumber: number;
    payload: Record<string, any>;
    description: string;
  }>;
}
