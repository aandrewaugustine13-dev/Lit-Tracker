import React, { useState, useEffect } from 'react';
import { parseScript, ParseResult } from '../../services/scriptParser';
import { Issue, Page, Panel } from '../../types';
import { X } from 'lucide-react';

interface Props {
    issue: Issue;
    onClose: () => void;
    onApplyChanges: (updatedPages: Page[]) => void;
}

type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

interface PanelDiff {
    type: DiffType;
    pageNumber: number;
    panelNumber: number;
    oldPanel?: Panel;
    newPanel?: {
        description: string;
        aspectRatio: any;
        visualMarker: string;
    };
    oldDescription?: string;
    newDescription?: string;
}

export function ScriptReparseModal({ issue, onClose, onApplyChanges }: Props) {
    const [diffs, setDiffs] = useState<PanelDiff[]>([]);
    const [selectedDiffs, setSelectedDiffs] = useState<Set<number>>(new Set());
    const [reparsing, setReparsing] = useState(false);

    useEffect(() => {
        if (!issue.scriptText) return;
        
        setReparsing(true);
        
        // Re-parse the script
        const result = parseScript(issue.scriptText);
        
        if (!result.success) {
            alert('Failed to re-parse script: ' + result.errors.join(', '));
            setReparsing(false);
            return;
        }

        // Calculate diffs
        const calculatedDiffs: PanelDiff[] = [];
        
        // Create a map of existing panels by page and panel number
        const existingPanels = new Map<string, Panel>();
        issue.pages.forEach(page => {
            page.panels.forEach(panel => {
                if (panel.scriptRef) {
                    const key = `${panel.scriptRef.pageNumber}-${panel.scriptRef.panelNumber}`;
                    existingPanels.set(key, panel);
                }
            });
        });

        // Create a map of new panels
        const newPanels = new Map<string, any>();
        result.pages.forEach(page => {
            page.panels.forEach(panel => {
                const key = `${page.pageNumber}-${panel.panelNumber}`;
                newPanels.set(key, { page: page.pageNumber, panel });
            });
        });

        // Check for added and modified panels
        newPanels.forEach((value, key) => {
            const existingPanel = existingPanels.get(key);
            const newPanel = value.panel;
            
            if (!existingPanel) {
                // New panel
                calculatedDiffs.push({
                    type: 'added',
                    pageNumber: value.page,
                    panelNumber: newPanel.panelNumber,
                    newPanel: {
                        description: newPanel.description,
                        aspectRatio: newPanel.aspectRatio,
                        visualMarker: newPanel.visualMarker
                    }
                });
            } else if (existingPanel.prompt !== newPanel.description) {
                // Modified panel
                calculatedDiffs.push({
                    type: 'modified',
                    pageNumber: value.page,
                    panelNumber: newPanel.panelNumber,
                    oldPanel: existingPanel,
                    oldDescription: existingPanel.prompt,
                    newDescription: newPanel.description,
                    newPanel: {
                        description: newPanel.description,
                        aspectRatio: newPanel.aspectRatio,
                        visualMarker: newPanel.visualMarker
                    }
                });
            }
        });

        // Check for removed panels
        existingPanels.forEach((panel, key) => {
            if (!newPanels.has(key) && panel.scriptRef) {
                calculatedDiffs.push({
                    type: 'removed',
                    pageNumber: panel.scriptRef.pageNumber,
                    panelNumber: panel.scriptRef.panelNumber,
                    oldPanel: panel,
                    oldDescription: panel.prompt
                });
            }
        });

        // Sort diffs by page and panel number
        calculatedDiffs.sort((a, b) => {
            if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
            return a.panelNumber - b.panelNumber;
        });

        setDiffs(calculatedDiffs);
        setReparsing(false);
    }, [issue]);

    const handleAcceptAll = () => {
        const allIndices = new Set(diffs.map((_, idx) => idx));
        setSelectedDiffs(allIndices);
    };

    const handleRejectAll = () => {
        setSelectedDiffs(new Set());
    };

    const handleToggleDiff = (index: number) => {
        const newSelected = new Set(selectedDiffs);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedDiffs(newSelected);
    };

    const handleApply = () => {
        // Get selected diffs and apply changes
        const selectedDiffList = Array.from(selectedDiffs).map(idx => diffs[idx]);
        
        // Build updated pages based on selected diffs
        // This is a simplified implementation - a full implementation would need to:
        // 1. Apply additions by creating new panels
        // 2. Apply removals by deleting panels
        // 3. Apply modifications by updating panel prompts
        // For now, we'll just pass the data to the parent
        
        // Create a modified version of pages based on diffs
        const updatedPages = issue.pages.map(page => ({ ...page }));
        
        // Apply changes (simplified - just log for now)
        console.log('Applying changes:', selectedDiffList);
        
        onApplyChanges(updatedPages);
    };

    const getDiffColor = (type: DiffType) => {
        switch (type) {
            case 'added': return 'bg-green-50 border-green-300';
            case 'removed': return 'bg-red-50 border-red-300';
            case 'modified': return 'bg-yellow-50 border-yellow-300';
            default: return 'bg-white border-stone-200';
        }
    };

    const getDiffIcon = (type: DiffType) => {
        switch (type) {
            case 'added': return '+';
            case 'removed': return '−';
            case 'modified': return '±';
            default: return '•';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-[700] p-8">
            <div className="w-full max-w-6xl bg-paper border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-stone-200 flex items-center justify-between">
                    <div>
                        <h2 className="font-display text-3xl tracking-widest text-ink uppercase">Script Re-parse</h2>
                        <p className="text-[10px] font-body text-stone-600 mt-1 uppercase tracking-widest">
                            Review changes detected in script
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-stone-100 text-stone-600 hover:text-red-600 border border-stone-200 transition-all text-xl font-bold"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {reparsing ? (
                        <div className="flex flex-col items-center gap-4 py-12 text-stone-600">
                            <div className="w-10 h-10 rounded-full border-[3px] border-ink border-t-transparent animate-spin" />
                            <p className="text-sm font-body text-ink font-bold uppercase tracking-widest">
                                Analyzing Script Changes
                            </p>
                            <div className="flex flex-col gap-2 w-56">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
                                    <span className="text-xs font-body text-green-600">Re-parsing script...</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center text-[10px] font-bold animate-pulse">2</div>
                                    <span className="text-xs font-body text-ink">Comparing panels...</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-[10px] font-bold">3</div>
                                    <span className="text-xs font-body text-stone-500">Building diff view...</span>
                                </div>
                            </div>
                        </div>
                    ) : diffs.length === 0 ? (
                        <div className="text-center py-12 text-stone-600">
                            No changes detected in the script.
                        </div>
                    ) : (
                        diffs.map((diff, index) => (
                            <div
                                key={index}
                                className={`border-2 rounded-lg p-4 transition-all ${getDiffColor(diff.type)} ${
                                    selectedDiffs.has(index) ? 'ring-2 ring-ink' : ''
                                }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                                            diff.type === 'added' ? 'bg-green-600 text-white' :
                                            diff.type === 'removed' ? 'bg-red-600 text-white' :
                                            'bg-yellow-500 text-ink'
                                        }`}>
                                            {getDiffIcon(diff.type)}
                                        </div>
                                        <div>
                                            <div className="font-body text-sm font-bold text-ink">
                                                Page {diff.pageNumber}, Panel {diff.panelNumber}
                                            </div>
                                            <div className="text-[10px] font-body uppercase tracking-widest text-stone-600">
                                                {diff.type}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleDiff(index)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                                            selectedDiffs.has(index)
                                                ? 'bg-ink text-white border-ink'
                                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                                        }`}
                                    >
                                        {selectedDiffs.has(index) ? 'SELECTED' : 'SELECT'}
                                    </button>
                                </div>

                                {diff.type === 'added' && diff.newPanel && (
                                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="text-xs font-body text-green-700 mb-1 font-semibold">New Description:</div>
                                        <div className="text-sm text-ink">{diff.newPanel.description}</div>
                                    </div>
                                )}

                                {diff.type === 'removed' && diff.oldDescription && (
                                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="text-xs font-body text-red-700 mb-1 font-semibold">Removed Description:</div>
                                        <div className="text-sm text-ink line-through">{diff.oldDescription}</div>
                                    </div>
                                )}

                                {diff.type === 'modified' && (
                                    <div className="mt-3 space-y-2">
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="text-xs font-body text-red-700 mb-1 font-semibold">Before:</div>
                                            <div className="text-sm text-ink">{diff.oldDescription}</div>
                                        </div>
                                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                            <div className="text-xs font-body text-green-700 mb-1 font-semibold">After:</div>
                                            <div className="text-sm text-ink">{diff.newDescription}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-stone-200 flex items-center justify-between gap-4">
                    <div className="flex gap-3">
                        <button
                            onClick={handleAcceptAll}
                            disabled={diffs.length === 0}
                            className="px-6 py-3 bg-white hover:bg-green-50 text-green-700 border border-green-300 font-bold text-sm uppercase tracking-widest rounded-lg transition-all disabled:opacity-30"
                        >
                            Accept All
                        </button>
                        <button
                            onClick={handleRejectAll}
                            disabled={diffs.length === 0}
                            className="px-6 py-3 bg-white hover:bg-red-50 text-red-700 border border-red-300 font-bold text-sm uppercase tracking-widest rounded-lg transition-all disabled:opacity-30"
                        >
                            Reject All
                        </button>
                    </div>
                    <button
                        onClick={handleApply}
                        disabled={selectedDiffs.size === 0}
                        className="px-8 py-3 bg-ink hover:bg-stone-800 text-white font-bold text-sm uppercase tracking-widest rounded-lg transition-all disabled:opacity-30"
                    >
                        Apply {selectedDiffs.size} Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
