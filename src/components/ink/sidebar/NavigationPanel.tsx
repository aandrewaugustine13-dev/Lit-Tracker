import React, { useState } from 'react';
import { AppState, Issue, Page, Project } from '../../../types';
import { InkAction as Action } from '../../../store/inkSlice';
import { Icons } from '../../../constants';
import EmptyState from '../EmptyState';
import { PageThumbnails } from '../PageThumbnails';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortablePageItemProps {
    page: Page;
    isActive: boolean;
    dispatch: React.Dispatch<Action>;
    panelCount: number;
}

const SortablePageItem: React.FC<SortablePageItemProps> = ({ page, isActive, dispatch, panelCount }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: page.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2">
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none p-1 text-stone-500 hover:text-ink transition-colors"
                title="Drag to reorder"
            >
                <GripVertical size={14} />
            </button>
            <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_PAGE', id: page.id })}
                className={`flex-1 text-left px-3 py-1.5 rounded text-[11px] font-body transition-all ${
                    isActive ? 'bg-ink text-white font-bold' : 'text-stone-600 hover:bg-stone-100'
                }`}
            >
                <div className="flex justify-between items-center w-full">
                    <span>PAGE {page.number}</span>
                    <span className="opacity-40 text-[9px]">{panelCount}F</span>
                </div>
                {panelCount > 0 && (
                    <PageThumbnails panels={page.panels} />
                )}
            </button>
        </div>
    );
};

interface NavigationPanelProps {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    activeProject: Project | undefined;
    activeIssue: Issue | undefined;
    activePage: Page | undefined;
    typeLabel: string;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({ 
    state, 
    dispatch, 
    activeProject,
    activeIssue,
    activePage,
    typeLabel 
}) => {
    const [showCharForm, setShowCharForm] = useState(false);
    const [charName, setCharName] = useState('');
    const [charDesc, setCharDesc] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handlePageDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        
        if (!over || active.id === over.id) return;
        
        if (!activeIssue) return;
        
        const oldIndex = activeIssue.pages.findIndex(p => p.id === active.id);
        const newIndex = activeIssue.pages.findIndex(p => p.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
            dispatch({
                type: 'REORDER_PAGES',
                issueId: activeIssue.id,
                oldIndex,
                newIndex,
            });
        }
    };

    const handleAddChar = () => {
        if (charName.trim()) {
            dispatch({ type: 'ADD_CHARACTER', name: charName.trim(), description: charDesc.trim() });
            setCharName('');
            setCharDesc('');
            setShowCharForm(false);
        }
    };

    return (
        <>
            {/* Issues / Chapters section */}
            <div>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-xs font-body text-stone-600 uppercase tracking-widest">{typeLabel}s</h2>
                    <button
                        onClick={() => {
                            if (!activeProject) {
                                alert("No active project found. Try creating or selecting a story first.");
                                console.log("Active project missing when adding issue:", state.activeProjectId, state.projects);
                                return;
                            }
                            console.log("Dispatching ADD_ISSUE for project:", activeProject.id, activeProject.title);
                            dispatch({ type: 'ADD_ISSUE', projectId: activeProject.id });
                        }}
                        className="text-stone-600 hover:text-ink transition-colors flex items-center gap-1 group"
                        title="Add New Issue/Chapter"
                    >
                        <Icons.Plus />
                        <span className="text-[9px] font-body opacity-0 group-hover:opacity-100 transition-opacity">NEW</span>
                    </button>
                </div>

                {/* Issues list */}
                <div className="space-y-4">
                    {activeProject && activeProject.issues.length === 0 && (
                        <EmptyState
                            variant="issues"
                            compact
                            onAction={() => {
                                if (activeProject) {
                                    dispatch({ type: 'ADD_ISSUE', projectId: activeProject.id });
                                }
                            }}
                            actionLabel={`Add ${typeLabel}`}
                        />
                    )}
                    {activeProject?.issues.map(iss => {
                        const isActive = state.activeIssueId === iss.id;
                        return (
                            <div key={iss.id} className={`rounded-lg overflow-hidden transition-all border ${isActive ? 'border-ink bg-stone-50' : 'border-stone-200'}`}>
                                <div
                                    onClick={() => dispatch({ type: 'SET_ACTIVE_ISSUE', id: iss.id })}
                                    className={`px-3 py-2 flex items-center justify-between cursor-pointer group ${isActive ? 'bg-stone-50' : 'hover:bg-stone-100'}`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className={`text-[10px] font-body ${isActive ? 'text-ink' : 'text-stone-500'}`}>{isActive ? '●' : '○'}</span>
                                        <p className={`text-xs font-bold uppercase tracking-widest truncate ${isActive ? 'text-ink' : 'text-stone-600 group-hover:text-ink'}`}>{iss.title}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-body text-stone-500">{iss.pages.length}P</span>
                                        <button
                                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (confirm(`Delete ${iss.title}?`)) dispatch({ type: 'DELETE_ISSUE', issueId: iss.id }); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all"
                                        >
                                            <Icons.Trash />
                                        </button>
                                    </div>
                                </div>
                                {isActive && (
                                    <div className="px-2 py-2 border-t border-stone-200 space-y-1 animate-fade-in">
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handlePageDragEnd}
                                        >
                                            <SortableContext
                                                items={iss.pages.map(p => p.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {iss.pages.map(pg => (
                                                    <SortablePageItem
                                                        key={pg.id}
                                                        page={pg}
                                                        isActive={state.activePageId === pg.id}
                                                        dispatch={dispatch}
                                                        panelCount={pg.panels.length}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </DndContext>
                                        <button
                                            onClick={() => dispatch({ type: 'ADD_PAGE', issueId: iss.id })}
                                            className="w-full py-1 text-center text-[10px] font-body text-stone-600 hover:text-ink hover:bg-stone-100 rounded transition-all mt-1 uppercase tracking-tighter"
                                        >
                                            + Add Page
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Cast section */}
            <div>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-xs font-body text-stone-600 uppercase tracking-widest">Cast</h2>
                    <button
                        onClick={() => setShowCharForm(!showCharForm)}
                        className={`transition-colors ${showCharForm ? 'text-ink rotate-45' : 'text-stone-600 hover:text-ink'}`}
                    >
                        <Icons.Plus />
                    </button>
                </div>

                {showCharForm && (
                    <div className="mb-4 p-3 bg-card border border-stone-200 rounded-lg space-y-3 animate-fade-in shadow-sm">
                        <input
                            autoFocus
                            placeholder="Name (e.g. Detective Jack)"
                            value={charName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCharName(e.target.value)}
                            className="w-full bg-white border border-stone-200 rounded px-3 py-1.5 text-xs text-ink focus:border-ink outline-none font-bold"
                        />
                        <textarea
                            placeholder="Description (age, vibe, key features...)"
                            value={charDesc}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCharDesc(e.target.value)}
                            rows={2}
                            className="w-full bg-white border border-stone-200 rounded px-3 py-1.5 text-xs text-stone-600 focus:border-ink outline-none resize-none italic"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleAddChar}
                                className="flex-1 bg-ink text-white font-bold py-1.5 rounded text-[10px] uppercase tracking-widest hover:bg-stone-800 transition-colors"
                            >
                                Save Cast
                            </button>
                            <button
                                onClick={() => setShowCharForm(false)}
                                className="px-3 py-1.5 border border-stone-200 text-stone-600 rounded text-[10px] uppercase hover:bg-stone-100"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {activeProject?.characters?.map(char => (
                        <div key={char.id} className="group flex items-center justify-between p-2 bg-stone-50 rounded border border-stone-200">
                            <div className="overflow-hidden">
                                <p className="text-[11px] text-ink font-bold truncate">{char.name}</p>
                                <p className="text-[9px] text-stone-500 truncate italic">{char.description}</p>
                            </div>
                            <button
                                onClick={() => dispatch({ type: 'DELETE_CHARACTER', id: char.id })}
                                className="opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-500 transition-all p-1"
                            >
                                <Icons.Trash />
                            </button>
                        </div>
                    ))}
                    {!activeProject?.characters?.length && !showCharForm && (
                        <EmptyState
                            variant="cast"
                            compact
                            onAction={() => setShowCharForm(true)}
                            actionLabel="Add Character"
                        />
                    )}
                </div>
            </div>
        </>
    );
};
