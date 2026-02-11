import { CharacterRole } from './index';
import { TimelineAction, TimelineEntityType } from './lore';

export interface CustomPattern {
  label: string;
  pattern: string;
  entityType: 'character' | 'location' | 'item';
}

export interface ProjectConfig {
  knownEntityNames: string[];
  canonLocks: string[];
  customPatterns: CustomPattern[];
}

export type ProposedEntityType = 'character' | 'location' | 'item';

export interface ProposedNewEntity {
  tempId: string;
  entityType: ProposedEntityType;
  name: string;
  source: 'deterministic' | 'llm';
  confidence: number;
  contextSnippet: string;
  lineNumber: number;
  suggestedRole?: CharacterRole;
  suggestedDescription?: string;
  suggestedRegion?: string;
  suggestedTimeOfDay?: string;
  suggestedHolderId?: string;
  suggestedItemDescription?: string;
}

export interface ProposedEntityUpdate {
  entityId: string;
  entityType: ProposedEntityType;
  entityName: string;
  source: 'deterministic' | 'llm';
  confidence: number;
  contextSnippet: string;
  lineNumber: number;
  changeDescription: string;
  updates: Record<string, any>;
}

export interface ProposedTimelineEvent {
  tempId: string;
  source: 'deterministic' | 'llm';
  confidence: number;
  contextSnippet: string;
  lineNumber: number;
  entityType: TimelineEntityType;
  entityId: string;
  entityName: string;
  action: TimelineAction;
  payload: Record<string, any>;
  description: string;
}

export interface ParsedProposal {
  meta: {
    parsedAt: string;
    rawScriptLength: number;
    lineCount: number;
    parseDurationMs: number;
    llmWasUsed: boolean;
    warnings: string[];
  };
  newEntities: ProposedNewEntity[];
  updatedEntities: ProposedEntityUpdate[];
  newTimelineEvents: ProposedTimelineEvent[];
}

export type ParserStatus = 'idle' | 'parsing' | 'awaiting-review' | 'committing' | 'error';

export interface LLMExtractionResponse {
  newEntities: Array<{
    name: string;
    entityType: 'character' | 'location' | 'item';
    confidence: number;
    contextSnippet: string;
    lineNumber: number;
    suggestedRole?: string;
    suggestedDescription?: string;
    suggestedRegion?: string;
    suggestedItemDescription?: string;
  }>;
  updatedEntities: Array<{
    entityName: string;
    entityType: 'character' | 'location' | 'item';
    confidence: number;
    contextSnippet: string;
    lineNumber: number;
    changeDescription: string;
    updates: Record<string, any>;
  }>;
  newTimelineEvents: Array<{
    entityName: string;
    entityType: 'character' | 'location' | 'item';
    action: string;
    confidence: number;
    contextSnippet: string;
    lineNumber: number;
    payload: Record<string, any>;
    description: string;
  }>;
}
