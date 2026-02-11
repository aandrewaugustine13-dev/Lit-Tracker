import React, { useState } from 'react';
import { useLitStore } from '../../store';
import { ProposedNewEntity, ProposedEntityUpdate, ProposedTimelineEvent } from '../../types/parserTypes';
import { Users, MapPin, Package, Clock, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getProposalCounts } from '../../store/parserSlice';

// =============================================================================
// EXTRACTION PREVIEW MODAL — Review and commit script parser proposals
// =============================================================================

interface ExtractionPreviewModalProps {
  onClose: () => void;
}

export const ExtractionPreviewModal: React.FC<ExtractionPreviewModalProps> = ({ onClose }) => {
  const [expandedSection, setExpandedSection] = useState<'entities' | 'updates' | 'events' | null>('entities');
  
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
  const setCurrentProposal = useLitStore((s) => s.setCurrentProposal);

  if (!currentProposal) {
    return null;
  }

  const counts = getProposalCounts(currentProposal);
  const selectedCount = selectedNewEntityIds.length + selectedUpdateIds.length + selectedTimelineEventIds.length;

  const toggleSection = (section: 'entities' | 'updates' | 'events') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleCommit = () => {
    commitExtractionProposal();
    onClose();
  };

  const handleRejectAll = () => {
    setCurrentProposal(null);
    onClose();
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getSourceBadge = (source: 'deterministic' | 'llm'): string => {
    return source === 'deterministic' 
      ? 'bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded'
      : 'bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded';
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'character': return <Users className="w-4 h-4" />;
      case 'location': return <MapPin className="w-4 h-4" />;
      case 'item': return <Package className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-card border-stone-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">Lore Extraction Review</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-stone-600" />
          </button>
        </div>

        {/* Meta info */}
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-200 text-sm text-stone-600 font-body">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">Parsed:</span> {new Date(currentProposal.meta.parsedAt).toLocaleString()}
              {' · '}
              <span className="font-medium">Duration:</span> {currentProposal.meta.parseDurationMs}ms
              {' · '}
              <span className="font-medium">Lines:</span> {currentProposal.meta.lineCount}
            </div>
            <div>
              {currentProposal.meta.llmWasUsed && (
                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">LLM Enhanced</span>
              )}
            </div>
          </div>
          {currentProposal.meta.warnings.length > 0 && (
            <div className="mt-2 text-amber-600">
              <span className="font-medium">Warnings:</span> {currentProposal.meta.warnings.join(', ')}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* New Entities Section */}
          {counts.newEntities > 0 && (
            <div className="mb-6">
              <button
                onClick={() => toggleSection('entities')}
                className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedSection === 'entities' ? (
                    <ChevronDown className="w-5 h-5 text-stone-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-stone-600" />
                  )}
                  <Users className="w-5 h-5 text-ember-500" />
                  <span className="font-body font-semibold text-ink">New Entities</span>
                  <span className="text-sm text-stone-500">({counts.newEntities})</span>
                </div>
                <div className="text-sm text-stone-600">
                  {selectedNewEntityIds.length} selected
                </div>
              </button>
              
              {expandedSection === 'entities' && (
                <div className="mt-2 space-y-2">
                  {currentProposal.newEntities.map((entity: ProposedNewEntity) => (
                    <div
                      key={entity.tempId}
                      className="bg-white border border-stone-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedNewEntityIds.includes(entity.tempId)}
                          onChange={() => toggleNewEntitySelection(entity.tempId)}
                          className="mt-1 w-4 h-4 text-ember-500 border-stone-300 rounded focus:ring-ember-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getEntityIcon(entity.entityType)}
                            <span className="font-body font-semibold text-ink">{entity.name}</span>
                            <span className={getSourceBadge(entity.source)}>
                              {entity.source}
                            </span>
                          </div>
                          <div className="text-sm text-stone-600 mb-2">
                            Line {entity.lineNumber}: "{entity.contextSnippet}"
                          </div>
                          {entity.suggestedDescription && (
                            <div className="text-sm text-stone-500 italic">
                              {entity.suggestedDescription}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1">
                              <div className="w-24 h-2 bg-stone-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getConfidenceColor(entity.confidence)}`}
                                  style={{ width: `${entity.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-stone-500">{Math.round(entity.confidence * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Entity Updates Section */}
          {counts.updates > 0 && (
            <div className="mb-6">
              <button
                onClick={() => toggleSection('updates')}
                className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedSection === 'updates' ? (
                    <ChevronDown className="w-5 h-5 text-stone-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-stone-600" />
                  )}
                  <Package className="w-5 h-5 text-ember-500" />
                  <span className="font-body font-semibold text-ink">Entity Updates</span>
                  <span className="text-sm text-stone-500">({counts.updates})</span>
                </div>
                <div className="text-sm text-stone-600">
                  {selectedUpdateIds.length} selected
                </div>
              </button>
              
              {expandedSection === 'updates' && (
                <div className="mt-2 space-y-2">
                  {currentProposal.updatedEntities.map((update: ProposedEntityUpdate, index: number) => (
                    <div
                      key={index}
                      className="bg-white border border-stone-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedUpdateIds.includes(index)}
                          onChange={() => toggleUpdateSelection(index)}
                          className="mt-1 w-4 h-4 text-ember-500 border-stone-300 rounded focus:ring-ember-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getEntityIcon(update.entityType)}
                            <span className="font-body font-semibold text-ink">{update.entityName}</span>
                            <span className={getSourceBadge(update.source)}>
                              {update.source}
                            </span>
                          </div>
                          <div className="text-sm text-stone-600 mb-2">
                            Line {update.lineNumber}: "{update.contextSnippet}"
                          </div>
                          <div className="text-sm text-ember-600 font-medium mb-1">
                            {update.changeDescription}
                          </div>
                          <div className="text-xs text-stone-500 bg-stone-50 p-2 rounded">
                            Updates: {JSON.stringify(update.updates)}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1">
                              <div className="w-24 h-2 bg-stone-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getConfidenceColor(update.confidence)}`}
                                  style={{ width: `${update.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-stone-500">{Math.round(update.confidence * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline Events Section */}
          {counts.events > 0 && (
            <div className="mb-6">
              <button
                onClick={() => toggleSection('events')}
                className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedSection === 'events' ? (
                    <ChevronDown className="w-5 h-5 text-stone-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-stone-600" />
                  )}
                  <Clock className="w-5 h-5 text-ember-500" />
                  <span className="font-body font-semibold text-ink">Timeline Events</span>
                  <span className="text-sm text-stone-500">({counts.events})</span>
                </div>
                <div className="text-sm text-stone-600">
                  {selectedTimelineEventIds.length} selected
                </div>
              </button>
              
              {expandedSection === 'events' && (
                <div className="mt-2 space-y-2">
                  {currentProposal.newTimelineEvents.map((event: ProposedTimelineEvent) => (
                    <div
                      key={event.tempId}
                      className="bg-white border border-stone-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedTimelineEventIds.includes(event.tempId)}
                          onChange={() => toggleTimelineEventSelection(event.tempId)}
                          className="mt-1 w-4 h-4 text-ember-500 border-stone-300 rounded focus:ring-ember-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="font-body font-semibold text-ink">{event.entityName}</span>
                            <span className="text-sm text-stone-600">— {event.action}</span>
                            <span className={getSourceBadge(event.source)}>
                              {event.source}
                            </span>
                          </div>
                          <div className="text-sm text-stone-600 mb-2">
                            Line {event.lineNumber}: "{event.contextSnippet}"
                          </div>
                          <div className="text-sm text-stone-700">
                            {event.description}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1">
                              <div className="w-24 h-2 bg-stone-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getConfidenceColor(event.confidence)}`}
                                  style={{ width: `${event.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-stone-500">{Math.round(event.confidence * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {counts.total === 0 && (
            <div className="text-center py-12 text-stone-500">
              No proposals to review. The parser did not find any new entities, updates, or events.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <button
              onClick={selectAllProposals}
              className="px-3 py-1.5 text-sm font-body text-ember-600 hover:bg-ember-50 rounded transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAllProposals}
              className="px-3 py-1.5 text-sm font-body text-stone-600 hover:bg-stone-100 rounded transition-colors"
            >
              Deselect All
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRejectAll}
              className="px-4 py-2 font-body text-stone-700 hover:bg-stone-200 rounded-lg transition-colors"
            >
              Reject All
            </button>
            <button
              onClick={handleCommit}
              disabled={selectedCount === 0}
              className="px-6 py-2 font-body font-semibold text-white bg-ember-500 hover:bg-ember-600 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Commit to Lore Tracker ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
