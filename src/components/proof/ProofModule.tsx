import React, { useMemo, useState } from 'react';
import { useLitStore } from '../../store';
import { Issue, Page, Panel, TextElement } from '../../types';
import { ScrollText, Eye, Search } from 'lucide-react';

/**
 * Proof Module — Live manuscript view
 * Reconstructs script from Ink storyboard data (Issue → Pages → Panels → textElements)
 * Does NOT store its own copy — it's a live lens over Zustand inkSlice
 * Edits flow bidirectionally via UPDATE_TEXT_ELEMENT and UPDATE_PANEL actions
 */
const ProofModule: React.FC = () => {
  const { inkState } = useLitStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Get active project and issue
  const activeProject = inkState.projects.find(p => p.id === inkState.activeProjectId);
  const activeIssue = activeProject?.issues.find(i => i.id === inkState.activeIssueId);

  // Reconstruct script from panels
  const reconstructedScript = useMemo(() => {
    if (!activeIssue) return [];

    const scriptLines: Array<{
      type: 'panel' | 'dialogue' | 'caption' | 'thought' | 'phone';
      content: string;
      pageNumber: number;
      panelNumber: number;
      elementId?: string;
      panelId?: string;
    }> = [];

    activeIssue.pages.forEach((page: Page) => {
      page.panels.forEach((panel: Panel, panelIndex: number) => {
        // Add visual description (panel prompt)
        scriptLines.push({
          type: 'panel',
          content: panel.prompt,
          pageNumber: page.number,
          panelNumber: panelIndex + 1,
          panelId: panel.id,
        });

        // Add text elements (dialogue, captions, etc.)
        panel.textElements.forEach((textEl: TextElement) => {
          scriptLines.push({
            type: textEl.type,
            content: textEl.content,
            pageNumber: page.number,
            panelNumber: panelIndex + 1,
            elementId: textEl.id,
            panelId: panel.id,
          });
        });
      });
    });

    return scriptLines;
  }, [activeIssue]);

  // Filter based on search
  const filteredScript = useMemo(() => {
    if (!searchTerm) return reconstructedScript;
    return reconstructedScript.filter(line =>
      line.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [reconstructedScript, searchTerm]);

  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-paper">
        <div className="text-center">
          <ScrollText size={48} className="mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-display font-medium text-ink mb-2">No Project Selected</h2>
          <p className="text-stone-500">Create or select a project to view the proof.</p>
        </div>
      </div>
    );
  }

  if (!activeIssue) {
    return (
      <div className="flex-1 flex items-center justify-center bg-paper">
        <div className="text-center">
          <ScrollText size={48} className="mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-display font-medium text-ink mb-2">No Issue Selected</h2>
          <p className="text-stone-500">Select an issue to view its reconstructed script.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-paper">
      {/* Header */}
      <header className="h-16 bg-card border-b border-stone-200 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-proof-500/15 flex items-center justify-center">
            <ScrollText size={18} className="text-proof-500" />
          </div>
          <div>
            <h1 className="text-lg font-display font-medium text-ink leading-tight">Proof</h1>
            <p className="text-[10px] font-body text-stone-500 uppercase tracking-wider">
              {activeIssue.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search script..."
              className="w-64 pl-9 pr-3 py-1.5 text-sm border border-stone-200 rounded focus:outline-none focus:ring-2 focus:ring-proof-500/20"
            />
          </div>

          {/* Edit Mode Toggle - Placeholder for future bidirectional editing */}
          <button
            disabled={true}
            className="px-3 py-1.5 rounded text-sm font-medium transition-all bg-stone-100 text-stone-400 cursor-not-allowed"
            title="Edit mode coming soon"
          >
            <Eye size={14} className="inline mr-1.5" />
            Reading
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto py-8 px-6">
          {filteredScript.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-stone-400">No content to display.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredScript.map((line, index) => (
                <div
                  key={`${line.panelId}-${line.elementId || 'panel'}-${index}`}
                  className={`group ${
                    line.type === 'panel'
                      ? 'bg-card border border-stone-200 rounded-sm p-4'
                      : 'ml-8 p-2 rounded'
                  }`}
                >
                  {/* Page/Panel indicator */}
                  <div className="flex items-center gap-2 mb-2 text-[10px] text-stone-400 uppercase tracking-wider">
                    <span>Page {line.pageNumber}</span>
                    <span>•</span>
                    <span>Panel {line.panelNumber}</span>
                    {line.type !== 'panel' && (
                      <>
                        <span>•</span>
                        <span className="text-proof-500 font-medium">{line.type}</span>
                      </>
                    )}
                  </div>

                  {/* Content */}
                  {line.type === 'panel' ? (
                    <div>
                      <div className="text-[11px] font-body text-proof-600 uppercase tracking-wide mb-1">
                        Visual Description
                      </div>
                      <p className="text-sm text-ink leading-relaxed font-body">
                        {line.content}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-ink leading-relaxed italic">
                      "{line.content}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProofModule;
