import React, { useState } from 'react';
import {
  Users,
  MapPin,
  Package,
  Clock,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Cpu,
  Shield,
  Zap,
  Brain,
  Gem,
  BookOpen,
} from 'lucide-react';
import { useLitStore } from '../../store';
import { getProposalCounts } from '../../store/parserSlice';
import { ProposedNewEntity, ProposedEntityUpdate, ProposedTimelineEvent } from '../../types/parserTypes';

interface ExtractionPreviewModalProps {
  onClose: () => void;
}

export function ExtractionPreviewModal({ onClose }: ExtractionPreviewModalProps) {
  const currentProposal = useLitStore((s) => s.currentProposal);
  const selectedNewEntityIds = useLitStore((s) => s.selectedNewEntityIds);
  const selectedUpdateIds = useLitStore((s) => s.selectedUpdateIds);
  const selectedTimelineEventIds = useLitStore((s) => s.selectedTimelineEventIds);
  
  const toggleNewEntitySelection = useLitStore((s) => s.toggleNewEntitySelection);
  const toggleUpdateSelection = useLitStore((s) => s.toggleUpdateSelection);
  const toggleTimelineEventSelection = useLitStore((s) => s.toggleTimelineEventSelection);
  const selectAllProposals = useLitStore((s) => s.selectAllProposals);
  const deselectAllProposals = useLitStore((s) => s.deselectAllProposals);
  const commitExtractionProposal = useLitStore((s) => s.commitExtractionProposal);

  const [expandedSections, setExpandedSections] = useState({
    newEntities: true,
    updates: true,
    timeline: true,
  });

  if (!currentProposal) {
    return null;
  }

  const counts = getProposalCounts(currentProposal);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-emerald-500';
    if (confidence >= 0.5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'character':
        return <Users className="w-5 h-5" />;
      case 'location':
        return <MapPin className="w-5 h-5" />;
      case 'item':
        return <Package className="w-5 h-5" />;
      case 'faction':
        return <Shield className="w-5 h-5" />;
      case 'event':
        return <Zap className="w-5 h-5" />;
      case 'concept':
        return <Brain className="w-5 h-5" />;
      case 'artifact':
        return <Gem className="w-5 h-5" />;
      case 'rule':
        return <BookOpen className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const handleCommit = () => {
    commitExtractionProposal();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-card border border-stone-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-stone-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-display font-bold text-ink">
                Lore Extraction Review
              </h2>
              <p className="text-steel-300 mt-1">
                {counts.total} proposal{counts.total !== 1 ? 's' : ''} extracted •{' '}
                {currentProposal.meta.lineCount} lines •{' '}
                {currentProposal.meta.parseDurationMs}ms
              </p>
              {currentProposal.meta.llmWasUsed && (
                <div className="flex items-center gap-1.5 mt-2 text-amber-600">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">AI-assisted extraction</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-steel-400 hover:text-steel-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* New Entities Section */}
          {counts.newEntities > 0 && (
            <section>
              <button
                onClick={() => toggleSection('newEntities')}
                className="flex items-center justify-between w-full text-left group"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.newEntities ? (
                    <ChevronDown className="w-5 h-5 text-steel-300" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-steel-300" />
                  )}
                  <h3 className="text-lg font-display font-semibold text-ink">
                    New Entities
                  </h3>
                  <span className="px-2.5 py-0.5 bg-ember-900 text-ember-600 rounded-full text-sm font-medium">
                    {counts.newEntities}
                  </span>
                </div>
              </button>

              {expandedSections.newEntities && (
                <div className="mt-4 space-y-3">
                  {currentProposal.newEntities.map((entity) => (
                    <EntityCard
                      key={entity.tempId}
                      entity={entity}
                      isSelected={selectedNewEntityIds.includes(entity.tempId)}
                      onToggle={() => toggleNewEntitySelection(entity.tempId)}
                      getConfidenceColor={getConfidenceColor}
                      getEntityIcon={getEntityIcon}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Entity Updates Section */}
          {counts.updates > 0 && (
            <section>
              <button
                onClick={() => toggleSection('updates')}
                className="flex items-center justify-between w-full text-left group"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.updates ? (
                    <ChevronDown className="w-5 h-5 text-steel-300" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-steel-300" />
                  )}
                  <h3 className="text-lg font-display font-semibold text-ink">
                    Entity Updates
                  </h3>
                  <span className="px-2.5 py-0.5 bg-ember-900 text-ember-600 rounded-full text-sm font-medium">
                    {counts.updates}
                  </span>
                </div>
              </button>

              {expandedSections.updates && (
                <div className="mt-4 space-y-3">
                  {currentProposal.updatedEntities.map((update, idx) => (
                    <UpdateCard
                      key={idx}
                      update={update}
                      index={idx}
                      isSelected={selectedUpdateIds.includes(idx)}
                      onToggle={() => toggleUpdateSelection(idx)}
                      getConfidenceColor={getConfidenceColor}
                      getEntityIcon={getEntityIcon}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Timeline Events Section */}
          {counts.events > 0 && (
            <section>
              <button
                onClick={() => toggleSection('timeline')}
                className="flex items-center justify-between w-full text-left group"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.timeline ? (
                    <ChevronDown className="w-5 h-5 text-steel-300" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-steel-300" />
                  )}
                  <h3 className="text-lg font-display font-semibold text-ink">
                    Timeline Events
                  </h3>
                  <span className="px-2.5 py-0.5 bg-ember-900 text-ember-600 rounded-full text-sm font-medium">
                    {counts.events}
                  </span>
                </div>
              </button>

              {expandedSections.timeline && (
                <div className="mt-4 space-y-3">
                  {currentProposal.newTimelineEvents.map((event) => (
                    <TimelineEventCard
                      key={event.tempId}
                      event={event}
                      isSelected={selectedTimelineEventIds.includes(event.tempId)}
                      onToggle={() => toggleTimelineEventSelection(event.tempId)}
                      getConfidenceColor={getConfidenceColor}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Empty State */}
          {counts.total === 0 && (
            <div className="text-center py-12">
              <div className="text-steel-500 text-lg">No proposals to review</div>
              <p className="text-steel-400 mt-2">
                The script parser found no new entities or events.
              </p>
            </div>
          )}

          {/* Warnings */}
          {currentProposal.meta.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-amber-800 mb-2">Warnings</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                {currentProposal.meta.warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={selectAllProposals}
                className="px-4 py-2 text-sm font-medium text-steel-200 hover:text-ink border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAllProposals}
                className="px-4 py-2 text-sm font-medium text-steel-200 hover:text-ink border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Deselect All
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={handleCommit}
                className="px-5 py-2.5 text-sm font-medium text-white bg-ember-500 rounded-lg hover:bg-ember-600 transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Commit to Lore Tracker
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

interface EntityCardProps {
  entity: ProposedNewEntity;
  isSelected: boolean;
  onToggle: () => void;
  getConfidenceColor: (confidence: number) => string;
  getEntityIcon: (entityType: string) => React.ReactNode;
}

function EntityCard({ entity, isSelected, onToggle, getConfidenceColor, getEntityIcon }: EntityCardProps) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 hover:border-ember-500 transition-colors">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="mt-1 w-4 h-4 rounded border-stone-300 text-ember-500 focus:ring-ember-500"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-steel-300">{getEntityIcon(entity.entityType)}</div>
            <h4 className="font-display font-semibold text-ink">{entity.name}</h4>
            <span className="text-xs text-steel-400 capitalize">
              {entity.entityType}
            </span>
          </div>

          {/* Confidence Bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getConfidenceColor(entity.confidence)}`}
                style={{ width: `${entity.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-steel-400 tabular-nums">
              {Math.round(entity.confidence * 100)}%
            </span>
          </div>

          {/* Source Badge */}
          <div className="flex items-center gap-2 mb-2">
            {entity.source === 'deterministic' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-200 text-stone-700 rounded text-xs">
                <Cpu className="w-3 h-3" />
                Rule-based
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
            <span className="text-xs text-steel-400">Line {entity.lineNumber}</span>
          </div>

          {/* Context Snippet */}
          <div className="bg-white border border-stone-200 rounded p-2 mt-2">
            <pre className="font-mono text-xs text-steel-300 whitespace-pre-wrap break-words">
              {entity.contextSnippet}
            </pre>
          </div>

          {/* Additional Info */}
          {entity.suggestedDescription && (
            <p className="text-sm text-steel-300 mt-2">{entity.suggestedDescription}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface UpdateCardProps {
  update: ProposedEntityUpdate;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
  getConfidenceColor: (confidence: number) => string;
  getEntityIcon: (entityType: string) => React.ReactNode;
}

function UpdateCard({ update, isSelected, onToggle, getConfidenceColor, getEntityIcon }: UpdateCardProps) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 hover:border-ember-500 transition-colors">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="mt-1 w-4 h-4 rounded border-stone-300 text-ember-500 focus:ring-ember-500"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-steel-300">{getEntityIcon(update.entityType)}</div>
            <h4 className="font-display font-semibold text-ink">{update.entityName}</h4>
            <span className="text-xs text-steel-400 capitalize">
              {update.entityType}
            </span>
          </div>

          <p className="text-sm text-steel-200 mb-2">{update.changeDescription}</p>

          {/* Confidence Bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getConfidenceColor(update.confidence)}`}
                style={{ width: `${update.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-steel-400 tabular-nums">
              {Math.round(update.confidence * 100)}%
            </span>
          </div>

          {/* Source Badge */}
          <div className="flex items-center gap-2 mb-2">
            {update.source === 'deterministic' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-200 text-stone-700 rounded text-xs">
                <Cpu className="w-3 h-3" />
                Rule-based
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
            <span className="text-xs text-steel-400">Line {update.lineNumber}</span>
          </div>

          {/* Context Snippet */}
          <div className="bg-white border border-stone-200 rounded p-2 mt-2">
            <pre className="font-mono text-xs text-steel-300 whitespace-pre-wrap break-words">
              {update.contextSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimelineEventCardProps {
  event: ProposedTimelineEvent;
  isSelected: boolean;
  onToggle: () => void;
  getConfidenceColor: (confidence: number) => string;
}

function TimelineEventCard({ event, isSelected, onToggle, getConfidenceColor }: TimelineEventCardProps) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 hover:border-ember-500 transition-colors">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="mt-1 w-4 h-4 rounded border-stone-300 text-ember-500 focus:ring-ember-500"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-steel-300" />
            <h4 className="font-display font-semibold text-ink">{event.description}</h4>
          </div>

          <div className="flex items-center gap-2 text-sm text-steel-300 mb-2">
            <span className="capitalize">{event.entityType}</span>
            <span>→</span>
            <span className="capitalize">{event.action.replace(/_/g, ' ')}</span>
          </div>

          {/* Confidence Bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getConfidenceColor(event.confidence)}`}
                style={{ width: `${event.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-steel-400 tabular-nums">
              {Math.round(event.confidence * 100)}%
            </span>
          </div>

          {/* Source Badge */}
          <div className="flex items-center gap-2 mb-2">
            {event.source === 'deterministic' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-200 text-stone-700 rounded text-xs">
                <Cpu className="w-3 h-3" />
                Rule-based
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
            <span className="text-xs text-steel-400">Line {event.lineNumber}</span>
          </div>

          {/* Context Snippet */}
          <div className="bg-white border border-stone-200 rounded p-2 mt-2">
            <pre className="font-mono text-xs text-steel-300 whitespace-pre-wrap break-words">
              {event.contextSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
