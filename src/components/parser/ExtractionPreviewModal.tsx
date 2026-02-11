// =============================================================================
// EXTRACTION PREVIEW MODAL — Review UI for Universal Script Parser
// =============================================================================
// Full-screen modal for reviewing ParsedProposal before committing to store.
// Follows the "Paper & Ink" aesthetic from the existing codebase.

import React, { useState } from 'react';
import { useLitStore } from '../../store';
import { getProposalCounts } from '../../store/parserSlice';
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
  AlertTriangle,
} from 'lucide-react';

interface ExtractionPreviewModalProps {
  onClose: () => void;
}

/**
 * Extraction Preview Modal Component
 * 
 * Displays a review UI for the parser's proposed entities and timeline events.
 * Users can cherry-pick which proposals to commit to the lore tracker.
 */
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
    timelineEvents: true,
  });

  if (!currentProposal) {
    return null;
  }

  const counts = getProposalCounts(currentProposal);
  const hasNoExtractions = counts.total === 0;

  // Filter new entities by type
  const newCharacters = currentProposal.newEntities.filter(e => e.entityType === 'character');
  const newLocations = currentProposal.newEntities.filter(e => e.entityType === 'location');
  const newItems = currentProposal.newEntities.filter(e => e.entityType === 'item');

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCommit = () => {
    commitExtractionProposal();
    onClose();
  };

  const handleRejectAll = () => {
    deselectAllProposals();
    onClose();
  };

  /**
   * Render confidence bar with color coding.
   */
  const renderConfidenceBar = (confidence: number) => {
    const percentage = confidence * 100;
    let colorClass = 'bg-red-400';
    if (confidence >= 0.8) colorClass = 'bg-emerald-500';
    else if (confidence >= 0.5) colorClass = 'bg-amber-500';

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorClass} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-stone-500 font-mono w-10">{Math.round(percentage)}%</span>
      </div>
    );
  };

  /**
   * Render source badge (Regex vs AI).
   */
  const renderSourceBadge = (source: 'deterministic' | 'llm') => {
    if (source === 'deterministic') {
      return (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-600 rounded text-xs font-medium">
          <Cpu size={12} />
          <span>Regex</span>
        </div>
      );
    } else {
      return (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
          <Sparkles size={12} />
          <span>AI</span>
        </div>
      );
    }
  };

  /**
   * Render entity type icon.
   */
  const renderEntityIcon = (entityType: 'character' | 'location' | 'item') => {
    const iconProps = { size: 16, className: 'text-stone-500' };
    if (entityType === 'character') return <Users {...iconProps} />;
    if (entityType === 'location') return <MapPin {...iconProps} />;
    return <Package {...iconProps} />;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30">
      <div className="bg-card border border-stone-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* ─── Header ────────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-stone-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-2xl text-ink tracking-tight">
                Lore Extraction Review
              </h2>
              <p className="text-xs font-body text-stone-500 uppercase tracking-widest mt-1">
                {counts.total} {counts.total === 1 ? 'Proposal' : 'Proposals'} Found
                {counts.newCharacters > 0 && ` • ${counts.newCharacters} Characters`}
                {counts.newLocations > 0 && ` • ${counts.newLocations} Locations`}
                {counts.newItems > 0 && ` • ${counts.newItems} Items`}
                {counts.updates > 0 && ` • ${counts.updates} Updates`}
                {counts.timelineEvents > 0 && ` • ${counts.timelineEvents} Events`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-stone-500" />
            </button>
          </div>
        </div>

        {/* ─── Body (Scrollable) ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {hasNoExtractions ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle size={48} className="text-stone-300 mb-4" />
              <p className="text-lg font-display text-stone-400">No extractions found</p>
              <p className="text-sm text-stone-500 mt-2">
                The parser couldn't detect any new entities or events in the script.
              </p>
            </div>
          ) : (
            <>
              {/* ─── Section 1: New Entities ───────────────────────────────────── */}
              {counts.newCharacters + counts.newLocations + counts.newItems > 0 && (
                <section>
                  <button
                    onClick={() => toggleSection('newEntities')}
                    className="w-full flex items-center justify-between p-3 hover:bg-stone-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.newEntities ? (
                        <ChevronDown size={20} className="text-stone-400" />
                      ) : (
                        <ChevronRight size={20} className="text-stone-400" />
                      )}
                      <h3 className="font-display text-lg text-ink">New Entities</h3>
                      <span className="px-2 py-0.5 bg-ember-500 text-white rounded-full text-xs font-bold">
                        {counts.newCharacters + counts.newLocations + counts.newItems}
                      </span>
                    </div>
                  </button>

                  {expandedSections.newEntities && (
                    <div className="mt-3 space-y-3">
                      {newCharacters.map((entity) => (
                        <div
                          key={entity.tempId}
                          className="bg-paper border border-stone-200 rounded-lg p-4 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedNewEntityIds.includes(entity.tempId)}
                                onChange={() => toggleNewEntitySelection(entity.tempId)}
                                className="mt-1"
                              />
                              {renderEntityIcon('character')}
                              <span className="font-display text-base text-ink">{entity.name}</span>
                              <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                                Character
                              </span>
                            </div>
                            {renderSourceBadge(entity.source)}
                          </div>
                          {renderConfidenceBar(entity.confidence)}
                          <p className="font-mono text-xs bg-card p-2 rounded border border-stone-200 text-stone-700">
                            {entity.contextSnippet}
                            <span className="text-stone-400 ml-2">• Line {entity.lineNumber}</span>
                          </p>
                          {entity.suggestedDescription && (
                            <p className="text-sm text-stone-600">{entity.suggestedDescription}</p>
                          )}
                        </div>
                      ))}

                      {newLocations.map((entity) => (
                        <div
                          key={entity.tempId}
                          className="bg-paper border border-stone-200 rounded-lg p-4 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedNewEntityIds.includes(entity.tempId)}
                                onChange={() => toggleNewEntitySelection(entity.tempId)}
                                className="mt-1"
                              />
                              {renderEntityIcon('location')}
                              <span className="font-display text-base text-ink">{entity.name}</span>
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                Location
                              </span>
                            </div>
                            {renderSourceBadge(entity.source)}
                          </div>
                          {renderConfidenceBar(entity.confidence)}
                          <p className="font-mono text-xs bg-card p-2 rounded border border-stone-200 text-stone-700">
                            {entity.contextSnippet}
                            <span className="text-stone-400 ml-2">• Line {entity.lineNumber}</span>
                          </p>
                          {entity.suggestedDescription && (
                            <p className="text-sm text-stone-600">{entity.suggestedDescription}</p>
                          )}
                        </div>
                      ))}

                      {newItems.map((entity) => (
                        <div
                          key={entity.tempId}
                          className="bg-paper border border-stone-200 rounded-lg p-4 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedNewEntityIds.includes(entity.tempId)}
                                onChange={() => toggleNewEntitySelection(entity.tempId)}
                                className="mt-1"
                              />
                              {renderEntityIcon('item')}
                              <span className="font-display text-base text-ink">{entity.name}</span>
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                Item
                              </span>
                            </div>
                            {renderSourceBadge(entity.source)}
                          </div>
                          {renderConfidenceBar(entity.confidence)}
                          <p className="font-mono text-xs bg-card p-2 rounded border border-stone-200 text-stone-700">
                            {entity.contextSnippet}
                            <span className="text-stone-400 ml-2">• Line {entity.lineNumber}</span>
                          </p>
                          {entity.suggestedItemDescription && (
                            <p className="text-sm text-stone-600">{entity.suggestedItemDescription}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ─── Section 2: Entity Updates ─────────────────────────────────── */}
              {counts.updates > 0 && (
                <section>
                  <button
                    onClick={() => toggleSection('updates')}
                    className="w-full flex items-center justify-between p-3 hover:bg-stone-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.updates ? (
                        <ChevronDown size={20} className="text-stone-400" />
                      ) : (
                        <ChevronRight size={20} className="text-stone-400" />
                      )}
                      <h3 className="font-display text-lg text-ink">Entity Updates</h3>
                      <span className="px-2 py-0.5 bg-ember-500 text-white rounded-full text-xs font-bold">
                        {counts.updates}
                      </span>
                    </div>
                  </button>

                  {expandedSections.updates && (
                    <div className="mt-3 space-y-3">
                      {currentProposal.updatedEntities.map((update, idx) => (
                        <div
                          key={idx}
                          className="bg-paper border border-stone-200 rounded-lg p-4 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedUpdateIds.includes(String(idx))}
                                onChange={() => toggleUpdateSelection(idx)}
                                className="mt-1"
                              />
                              {renderEntityIcon(update.entityType)}
                              <span className="font-display text-base text-ink">{update.entityName}</span>
                            </div>
                            {renderSourceBadge(update.source)}
                          </div>
                          {renderConfidenceBar(update.confidence)}
                          <p className="font-mono text-xs bg-card p-2 rounded border border-stone-200 text-stone-700">
                            {update.contextSnippet}
                            <span className="text-stone-400 ml-2">• Line {update.lineNumber}</span>
                          </p>
                          <div className="text-sm">
                            <span className="font-medium text-stone-700">Change: </span>
                            <span className="text-stone-600">{update.changeDescription}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ─── Section 3: Timeline Events ────────────────────────────────── */}
              {counts.timelineEvents > 0 && (
                <section>
                  <button
                    onClick={() => toggleSection('timelineEvents')}
                    className="w-full flex items-center justify-between p-3 hover:bg-stone-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.timelineEvents ? (
                        <ChevronDown size={20} className="text-stone-400" />
                      ) : (
                        <ChevronRight size={20} className="text-stone-400" />
                      )}
                      <h3 className="font-display text-lg text-ink">Timeline Events</h3>
                      <span className="px-2 py-0.5 bg-ember-500 text-white rounded-full text-xs font-bold">
                        {counts.timelineEvents}
                      </span>
                    </div>
                  </button>

                  {expandedSections.timelineEvents && (
                    <div className="mt-3 space-y-3">
                      {currentProposal.newTimelineEvents.map((event) => (
                        <div
                          key={event.tempId}
                          className="bg-paper border border-stone-200 rounded-lg p-4 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedTimelineEventIds.includes(event.tempId)}
                                onChange={() => toggleTimelineEventSelection(event.tempId)}
                                className="mt-1"
                              />
                              <Clock size={16} className="text-stone-500" />
                              <span className="font-display text-base text-ink">{event.description}</span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {event.action}
                              </span>
                            </div>
                            {renderSourceBadge(event.source)}
                          </div>
                          {renderConfidenceBar(event.confidence)}
                          <p className="font-mono text-xs bg-card p-2 rounded border border-stone-200 text-stone-700">
                            {event.contextSnippet}
                            <span className="text-stone-400 ml-2">• Line {event.lineNumber}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* ─── Footer (Sticky) ───────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-stone-200 p-4 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <button
                onClick={selectAllProposals}
                className="text-sm text-stone-600 hover:text-ink font-medium transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAllProposals}
                className="text-sm text-stone-600 hover:text-ink font-medium transition-colors"
              >
                Deselect All
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-100 font-medium transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={handleCommit}
                className="px-6 py-2 bg-ember-500 text-white rounded-lg hover:bg-ember-600 font-bold transition-colors flex items-center gap-2"
                disabled={
                  selectedNewEntityIds.length === 0 &&
                  selectedUpdateIds.length === 0 &&
                  selectedTimelineEventIds.length === 0
                }
              >
                <Check size={18} />
                <span>Commit to Lore Tracker</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
