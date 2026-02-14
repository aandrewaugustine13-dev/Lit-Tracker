import React, { useState } from 'react';
import { MapPin, Clock, Sparkles, FileQuestion, ChevronDown, ChevronUp } from 'lucide-react';
import type { ParsedScript, LoreCandidate, Character } from '../utils/scriptParser';

interface LoreTrackerProps {
  parsedData: ParsedScript | null;
  onHighlightPanels?: (panels: string[]) => void;
}

export const LoreTracker: React.FC<LoreTrackerProps> = ({ parsedData, onHighlightPanels }) => {
  const [expandedCharacters, setExpandedCharacters] = useState<Set<string>>(new Set());

  if (!parsedData) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-paper p-8 text-center">
        <Sparkles className="w-16 h-16 text-stone-300 mb-4" />
        <h3 className="text-xl font-serif text-stone-400 mb-2">No Script Parsed</h3>
        <p className="text-sm text-stone-500 max-w-md">
          Paste a comic script in the main area and click "Parse & Weave" to extract lore data.
        </p>
      </div>
    );
  }

  const toggleCharacter = (name: string) => {
    const newExpanded = new Set(expandedCharacters);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedCharacters(newExpanded);
  };

  // Categorize lore candidates - trust the LLM's categorization primarily
  const locations: LoreCandidate[] = [];
  const timeline: LoreCandidate[] = [];
  const echoes: LoreCandidate[] = [];
  const uncategorized: LoreCandidate[] = [];

  parsedData.lore_candidates.forEach((lore) => {
    // Use the category provided by the LLM
    switch (lore.category) {
      case 'location':
        locations.push(lore);
        break;
      case 'timeline':
        timeline.push(lore);
        break;
      case 'echo':
        echoes.push(lore);
        break;
      default:
        uncategorized.push(lore);
    }
  });

  const renderLoreItem = (lore: LoreCandidate, icon: React.ReactNode) => {
    const confidenceColor =
      lore.confidence >= 0.8
        ? 'bg-green-500'
        : lore.confidence >= 0.6
        ? 'bg-yellow-500'
        : 'bg-orange-500';

    return (
      <div
        key={`${lore.text}-${lore.panels.join('-')}`}
        className="p-3 bg-white border border-stone-200 rounded-lg hover:border-ember-400 hover:shadow-sm transition-all cursor-pointer"
        onMouseEnter={() => onHighlightPanels?.(lore.panels)}
        onMouseLeave={() => onHighlightPanels?.([])}
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1">
            <div className="font-medium text-ink mb-1">{lore.text}</div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${confidenceColor}`}
                  style={{ width: `${lore.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-stone-500">{Math.round(lore.confidence * 100)}%</span>
            </div>
            {lore.panels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {lore.panels.map((panelId) => (
                  <span
                    key={panelId}
                    className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded"
                  >
                    {panelId}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-paper overflow-y-auto">
      <div className="sticky top-0 bg-paper border-b border-stone-200 p-4 z-10">
        <h2 className="text-2xl font-serif text-ink mb-1">Lore Tracker</h2>
        <p className="text-sm text-stone-600">
          {parsedData.characters.length} characters, {parsedData.lore_candidates.length} lore items
        </p>
      </div>

      <div className="p-4 space-y-6">
        {/* Characters Section */}
        <section>
          <h3 className="text-lg font-serif text-ink mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-ember-500" />
            Characters ({parsedData.characters.length})
          </h3>
          <div className="space-y-2">
            {parsedData.characters.map((character) => {
              const isExpanded = expandedCharacters.has(character.name);
              return (
                <div
                  key={character.name}
                  className="bg-white border border-stone-200 rounded-lg overflow-hidden hover:border-ember-400 transition-colors"
                >
                  <button
                    onClick={() => toggleCharacter(character.name)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-ember-100 flex items-center justify-center text-ember-700 font-bold">
                        {character.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-ink">{character.name}</div>
                        <div className="text-xs text-stone-500">{character.panel_count} panels</div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-stone-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-stone-400" />
                    )}
                  </button>
                  {isExpanded && character.description && (
                    <div className="px-4 pb-3 pt-1 border-t border-stone-100 bg-stone-50">
                      <p className="text-sm text-stone-700">{character.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Locations Section */}
        {locations.length > 0 && (
          <section>
            <h3 className="text-lg font-serif text-ink mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-500" />
              Locations ({locations.length})
            </h3>
            <div className="space-y-2">
              {locations.map((lore) => renderLoreItem(lore, <MapPin className="w-4 h-4 text-blue-500" />))}
            </div>
          </section>
        )}

        {/* Timeline Section */}
        {timeline.length > 0 && (
          <section>
            <h3 className="text-lg font-serif text-ink mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              Timeline ({timeline.length})
            </h3>
            <div className="space-y-2">
              {timeline.map((lore) => renderLoreItem(lore, <Clock className="w-4 h-4 text-purple-500" />))}
            </div>
          </section>
        )}

        {/* Echoes/Objects Section */}
        {echoes.length > 0 && (
          <section>
            <h3 className="text-lg font-serif text-ink mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Echoes/Objects ({echoes.length})
            </h3>
            <div className="space-y-2">
              {echoes.map((lore) => renderLoreItem(lore, <Sparkles className="w-4 h-4 text-amber-500" />))}
            </div>
          </section>
        )}

        {/* Uncategorized Section */}
        {uncategorized.length > 0 && (
          <section>
            <h3 className="text-lg font-serif text-ink mb-3 flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-stone-500" />
              Uncategorized ({uncategorized.length})
            </h3>
            <div className="space-y-2">
              {uncategorized.map((lore) => renderLoreItem(lore, <FileQuestion className="w-4 h-4 text-stone-500" />))}
            </div>
          </section>
        )}

        {/* Overall Lore Summary */}
        {parsedData.overall_lore_summary && (
          <section className="mt-6 p-4 bg-stone-50 border border-stone-200 rounded-lg">
            <h3 className="text-lg font-serif text-ink mb-2">Lore Summary</h3>
            <p className="text-sm text-stone-700 leading-relaxed">{parsedData.overall_lore_summary}</p>
          </section>
        )}
      </div>
    </div>
  );
};
