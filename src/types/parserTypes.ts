// =============================================================================
// PARSER TYPES — Type definitions for Universal Script Parser
// =============================================================================
// Defines the complete type system for the two-pass extraction engine that
// parses script text, extracts entities and timeline events, and proposes
// updates before committing to the normalized Zustand store.

import { Character, LocationEntry, CharacterRole } from './index';
import { TimelineEntry, TimelineAction, TimelineEntityType } from './lore';

// ─── Parser Configuration ───────────────────────────────────────────────────

/**
 * Custom pattern configuration for user-defined entity extraction rules.
 */
export interface CustomPattern {
  /** User-friendly label for this pattern */
  label: string;
  /** Regex pattern string (will be compiled at runtime) */
  pattern: string;
  /** Type of entity to create when this pattern matches */
  entityType: 'character' | 'location' | 'item';
}

/**
 * Project-level configuration for the parser engine.
 * Controls which entities are recognized and how extraction rules are applied.
 */
export interface ProjectConfig {
  /** List of known entity names to scan for (cross-type) */
  knownEntityNames: string[];
  /** List of canon-locked names that LLM should not modify */
  canonLocks: string[];
  /** User-defined regex patterns for custom extraction */
  customPatterns: CustomPattern[];
}

// ─── Proposal Types ─────────────────────────────────────────────────────────

/**
 * Proposed entity type.
 */
export type ProposedEntityType = 'character' | 'location' | 'item' | 'faction' | 'event' | 'concept' | 'artifact' | 'rule';

/**
 * Source of an extraction proposal.
 * - 'deterministic': Extracted via regex rules in Pass 1
 * - 'llm': Extracted by AI in Pass 2
 */
export type ProposalSource = 'deterministic' | 'llm';

/**
 * Proposal for creating a new entity.
 * Contains all data needed to construct a full entity object upon approval.
 */
export interface ProposedNewEntity {
  /** Temporary ID for UI selection (not persisted) */
  tempId: string;
  /** Type of entity to create */
  entityType: ProposedEntityType;
  /** Extracted entity name */
  name: string;
  /** How this entity was discovered */
  source: ProposalSource;
  /** Confidence score 0-1 (deterministic=1.0, LLM=varies) */
  confidence: number;
  /** Snippet of text where this entity was found */
  contextSnippet: string;
  /** Line number in the script where this entity appeared */
  lineNumber: number;
  
  // Character-specific fields (optional)
  suggestedRole?: CharacterRole;
  suggestedDescription?: string;
  
  // Location-specific fields (optional)
  suggestedRegion?: string;
  suggestedTimeOfDay?: string;
  
  // Item-specific fields (optional)
  suggestedHolderId?: string;
  suggestedItemDescription?: string;
  
  // Lore-specific fields (optional)
  suggestedLoreType?: string;
  suggestedTags?: string[];
  suggestedIdeology?: string;  // factions
  suggestedLeader?: string;    // factions
  suggestedDate?: string;      // events
  suggestedOrigin?: string;    // concepts, artifacts
}

// ─── Proposed Entity Update ─────────────────────────────────────────────────

/**
 * Proposal for updating an existing entity.
 * Contains the delta to apply to the current entity state.
 */
export interface ProposedEntityUpdate {
  /** ID of the existing entity to update */
  entityId: string;
  /** Type of entity being updated */
  entityType: ProposedEntityType;
  /** Name of entity (for display) */
  entityName: string;
  /** How this update was discovered */
  source: ProposalSource;
  /** Confidence score 0-1 */
  confidence: number;
  /** Snippet of text that triggered this update */
  contextSnippet: string;
  /** Line number in the script */
  lineNumber: number;
  /** Human-readable description of what changed */
  changeDescription: string;
  /** Key-value pairs of fields to update */
  updates: Record<string, any>;
}

// ─── Proposed Timeline Event ────────────────────────────────────────────────

/**
 * Proposal for creating a new timeline event.
 * Will be converted to a full TimelineEntry upon approval.
 */
export interface ProposedTimelineEvent {
  /** Temporary ID for UI selection */
  tempId: string;
  /** How this event was discovered */
  source: ProposalSource;
  /** Confidence score 0-1 */
  confidence: number;
  /** Snippet of text that describes this event */
  contextSnippet: string;
  /** Line number in the script */
  lineNumber: number;
  /** Entity type this event relates to */
  entityType: TimelineEntityType;
  /** ID of the entity (if known, else empty string for new entities) */
  entityId: string;
  /** Name of the entity (for display) */
  entityName: string;
  /** Timeline action type */
  action: TimelineAction;
  /** Action-specific data */
  payload: Record<string, any>;
  /** Human-readable event description */
  description: string;
}

// ─── Complete Proposal ──────────────────────────────────────────────────────

/**
 * Complete extraction result from the parser engine.
 * Contains all proposed changes before user review.
 */
export interface ParsedProposal {
  /** Metadata about the parsing operation */
  meta: {
    /** ISO timestamp of when parsing completed */
    parsedAt: string;
    /** Character count of input script */
    rawScriptLength: number;
    /** Number of lines in input script */
    lineCount: number;
    /** How long parsing took in milliseconds */
    parseDurationMs: number;
    /** Whether LLM was invoked during parsing */
    llmWasUsed: boolean;
    /** Any warnings or issues during parsing */
    warnings: string[];
  };
  /** Proposed new entities to create */
  newEntities: ProposedNewEntity[];
  /** Proposed updates to existing entities */
  updatedEntities: ProposedEntityUpdate[];
  /** Proposed new timeline events to add */
  newTimelineEvents: ProposedTimelineEvent[];
}

// ─── Parser State ───────────────────────────────────────────────────────────

/**
 * Current status of the parser workflow.
 */
export type ParserStatus = 
  | 'idle'              // No parsing in progress
  | 'parsing'           // Currently parsing script text
  | 'awaiting-review'   // Proposal ready for user review
  | 'committing'        // Committing approved changes to store
  | 'error';            // Parsing failed

/**
 * UI state for the parser module.
 * Tracks the current proposal and user selections.
 */
export interface ParserState {
  /** Current workflow status */
  status: ParserStatus;
  /** The proposal awaiting review (null if no proposal) */
  currentProposal: ParsedProposal | null;
  /** Temp IDs of new entities selected for commit */
  selectedNewEntityIds: string[];
  /** Indices of entity updates selected for commit */
  selectedUpdateIds: string[];
  /** Temp IDs of timeline events selected for commit */
  selectedTimelineEventIds: string[];
  /** Error message if status is 'error' */
  errorMessage: string | null;
  /** Parser configuration */
  config: ProjectConfig;
}

// ─── LLM Integration ────────────────────────────────────────────────────────

/**
 * Expected JSON response structure from LLM (Pass 2).
 * This is the exact shape the prompt demands.
 */
export interface LLMExtractionResponse {
  /** New entities discovered by LLM */
  newEntities: {
    name: string;
    type: 'character' | 'location' | 'item' | 'faction' | 'event' | 'concept' | 'artifact' | 'rule';
    confidence: number;
    context: string;
    lineNumber: number;
    suggestedRole?: CharacterRole;
    suggestedDescription?: string;
    suggestedRegion?: string;
    suggestedTimeOfDay?: string;
    suggestedHolderId?: string;
    suggestedItemDescription?: string;
    suggestedTags?: string[];
    suggestedIdeology?: string;
    suggestedLeader?: string;
    suggestedDate?: string;
    suggestedOrigin?: string;
  }[];
  /** Updates to existing entities */
  entityUpdates: {
    entityId: string;
    entityType: 'character' | 'location' | 'item';
    entityName: string;
    confidence: number;
    context: string;
    lineNumber: number;
    changeDescription: string;
    updates: Record<string, any>;
  }[];
  /** Timeline events */
  timelineEvents: {
    confidence: number;
    context: string;
    lineNumber: number;
    entityType: TimelineEntityType;
    entityId: string;
    entityName: string;
    action: TimelineAction;
    payload: Record<string, any>;
    description: string;
  }[];
}
