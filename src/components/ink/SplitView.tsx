import React, { useState, useRef, useEffect } from 'react';
import { Panel, Separator, Group } from 'react-resizable-panels';
import { RefreshCw } from 'lucide-react';
import { Issue, Panel as StoryPanel, Page } from '../../types';
import { VisualMarker } from '../../services/scriptParser';
import { ScriptReparseModal } from './ScriptReparseModal';

interface Props {
    issue: Issue;
    activePanelId: string | null;
    onPanelClick: (panelId: string) => void;
    onScriptSectionClick: (panelId: string) => void;
    onSyncPrompt: (panelId: string, newPrompt: string) => void;
    onReparseApply: (updatedPages: Page[]) => void;
    children: React.ReactNode; // The right pane content (panel canvas)
}

const MARKER_COLORS: Record<VisualMarker, string> = {
    standard: 'bg-stone-50',
    echo: 'bg-red-50 border-l-4 border-red-500',
    hitch: 'bg-cyan-50 border-l-4 border-cyan-500',
    overflow: 'bg-purple-50 border-l-4 border-purple-500',
    shattered: 'bg-red-50 border-l-4 border-red-400',
    split: 'bg-amber-50 border-l-4 border-amber-500',
    splash: 'bg-emerald-50 border-l-4 border-emerald-500',
    inset: 'bg-sky-50 border-l-4 border-sky-400',
    large: 'bg-lime-50 border-l-4 border-lime-500',
    'full-width': 'bg-pink-50 border-l-4 border-pink-500',
};

export function SplitView({ issue, activePanelId, onPanelClick, onScriptSectionClick, onSyncPrompt, onReparseApply, children }: Props) {
    const [highlightedScriptSection, setHighlightedScriptSection] = useState<{ start: number; end: number } | null>(null);
    const [editedSections, setEditedSections] = useState<Map<string, string>>(new Map());
    const [showReparseModal, setShowReparseModal] = useState(false);
    const scriptRef = useRef<HTMLDivElement>(null);

    // Find the panel with scriptRef for the given activePanelId
    useEffect(() => {
        if (activePanelId && issue.scriptText) {
            // Find the panel with this ID
            const panel = findPanelById(issue, activePanelId);
            if (panel?.scriptRef) {
                setHighlightedScriptSection({
                    start: panel.scriptRef.startOffset,
                    end: panel.scriptRef.endOffset
                });
                // Scroll to the section
                scrollToScriptSection(panel.scriptRef.startOffset, panel.scriptRef.endOffset);
            }
        }
    }, [activePanelId, issue]);

    const findPanelById = (issue: Issue, panelId: string): StoryPanel | null => {
        for (const page of issue.pages) {
            const panel = page.panels.find(p => p.id === panelId);
            if (panel) return panel;
        }
        return null;
    };

    const scrollToScriptSection = (start: number, end: number) => {
        if (!scriptRef.current || !issue.scriptText) return;
        
        // Find the element containing this character offset
        const scriptElements = scriptRef.current.querySelectorAll('[data-offset]');
        for (const el of Array.from(scriptElements)) {
            const offset = parseInt((el as HTMLElement).getAttribute('data-offset') || '0');
            if (offset >= start && offset <= end) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
            }
        }
    };

    const handleScriptClick = (offset: number) => {
        // Find which panel this offset belongs to
        for (const page of issue.pages) {
            for (const panel of page.panels) {
                if (panel.scriptRef && offset >= panel.scriptRef.startOffset && offset <= panel.scriptRef.endOffset) {
                    onScriptSectionClick(panel.id);
                    return;
                }
            }
        }
    };

    const renderScriptWithHighlights = () => {
        if (!issue.scriptText) return null;

        const scriptText = issue.scriptText;
        const sections: Array<{ start: number; end: number; panelId: string; visualMarker: VisualMarker; text: string }> = [];

        // Collect all panel sections
        for (const page of issue.pages) {
            for (const panel of page.panels) {
                if (panel.scriptRef) {
                    sections.push({
                        start: panel.scriptRef.startOffset,
                        end: panel.scriptRef.endOffset,
                        panelId: panel.id,
                        visualMarker: (panel.scriptRef.visualMarker as VisualMarker) || 'standard',
                        text: scriptText.substring(panel.scriptRef.startOffset, panel.scriptRef.endOffset)
                    });
                }
            }
        }

        // Sort sections by start offset
        sections.sort((a, b) => a.start - b.start);

        // Render sections with highlights
        const elements: React.ReactNode[] = [];
        let lastEnd = 0;

        sections.forEach((section, idx) => {
            // Add text before this section
            if (section.start > lastEnd) {
                const betweenText = scriptText.substring(lastEnd, section.start);
                elements.push(
                    <div key={`between-${idx}`} className="text-stone-500 p-2">
                        {betweenText}
                    </div>
                );
            }

            // Add the section itself
            const isHighlighted = highlightedScriptSection && 
                                 section.start >= highlightedScriptSection.start && 
                                 section.end <= highlightedScriptSection.end;
            
            const highlightClass = isHighlighted ? 'bg-stone-50 border-l-4 border-stone-400' : '';
            const markerClass = MARKER_COLORS[section.visualMarker] || '';

            elements.push(
                <div
                    key={`section-${idx}`}
                    data-offset={section.start}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${markerClass} ${highlightClass} hover:bg-stone-100`}
                    onClick={() => handleScriptClick(section.start)}
                >
                    <div className="text-ink whitespace-pre-wrap">{section.text}</div>
                    {editedSections.has(section.panelId) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const editedText = editedSections.get(section.panelId)!;
                                onSyncPrompt(section.panelId, editedText);
                                const newEdited = new Map(editedSections);
                                newEdited.delete(section.panelId);
                                setEditedSections(newEdited);
                            }}
                            className="mt-2 px-3 py-1 bg-ink hover:bg-stone-800 text-white text-xs font-bold rounded transition-all"
                        >
                            Sync →
                        </button>
                    )}
                </div>
            );

            lastEnd = section.end;
        });

        // Add remaining text
        if (lastEnd < scriptText.length) {
            const remainingText = scriptText.substring(lastEnd);
            elements.push(
                <div key="remaining" className="text-stone-500 p-2">
                    {remainingText}
                </div>
            );
        }

        return elements;
    };

    if (!issue.scriptText) {
        // If there's no script, just render the children (normal view)
        return <>{children}</>;
    }

    return (
        <>
        <Group orientation="horizontal" className="h-full">
            <Panel defaultSize={40} minSize={20} className="bg-paper">
                <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-stone-200 flex items-center justify-between">
                        <div>
                            <h2 className="font-display text-xl tracking-widest text-ember-500 uppercase">Script</h2>
                            <p className="text-[10px] font-body text-stone-500 mt-1 uppercase tracking-widest">
                                Click sections to navigate panels
                            </p>
                        </div>
                        <button
                            onClick={() => setShowReparseModal(true)}
                            className="px-3 py-2 border border-stone-200 hover:border-stone-400 hover:bg-stone-50 text-stone-700 hover:text-ink rounded transition-all flex items-center gap-2 text-xs font-bold uppercase"
                            title="Re-parse script"
                        >
                            <RefreshCw size={14} />
                            Re-parse
                        </button>
                    </div>
                    <div
                        ref={scriptRef}
                        className="flex-1 overflow-y-auto p-4 font-body text-xs"
                    >
                        {renderScriptWithHighlights()}
                    </div>
                </div>
            </Panel>
            
            <Separator className="w-1 bg-stone-200 hover:bg-ink transition-colors cursor-col-resize" />
            
            <Panel defaultSize={60} minSize={20}>
                <div className="h-full bg-card">
                    {children}
                </div>
            </Panel>
        </Group>
        
        {showReparseModal && (
            <ScriptReparseModal
                issue={issue}
                onClose={() => setShowReparseModal(false)}
                onApplyChanges={(updatedPages) => {
                    onReparseApply(updatedPages);
                    setShowReparseModal(false);
                }}
            />
        )}
        </>
    );
}
