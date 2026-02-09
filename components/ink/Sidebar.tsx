import React, { useState, useEffect } from 'react';
import { AppState, PanelFrameStyle, TextOverlayStyle } from '../../types';
import { InkAction as Action } from '../../store/inkSlice';
import { ART_STYLES, Icons } from '../../constants';
import EmptyState from './EmptyState';
import { generateImage as generateGeminiImage } from '../../services/geminiService';
import { generateLeonardoImage } from '../../services/leonardoService';
import { generateGrokImage } from '../../services/grokService';
import { generateFluxImage as generateFalFlux } from '../../services/falFluxService';
import { generateSeaArtImage } from '../../services/seaartService';
import { generateOpenAIImage } from '../../services/openaiService';
import { saveImage } from '../../services/imageStorage';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../services/supabase';
import { PageThumbnails } from './PageThumbnails';
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
import { Page } from '../../types';

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
                className="cursor-grab active:cursor-grabbing touch-none p-1 text-steel-600 hover:text-ember-500 transition-colors"
                title="Drag to reorder"
            >
                <GripVertical size={14} />
            </button>
            <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_PAGE', id: page.id })}
                className={`flex-1 text-left px-3 py-1.5 rounded text-[11px] font-mono transition-all ${
                    isActive ? 'bg-ember-500 text-ink-950 font-bold' : 'text-steel-500 hover:bg-ink-700'
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

interface SidebarProps {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    onOpenProjects: () => void;
    onOpenScriptImport: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ state, dispatch, onOpenProjects, onOpenScriptImport }) => {
    const { user, signInWithGoogle } = useAuth();
    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    const activeIssue = activeProject?.issues.find(i => i.id === state.activeIssueId);
    const activePage = activeIssue?.pages.find(p => p.id === state.activePageId);
    const typeLabel = activeProject?.issueType === 'issue' ? 'Issue' : 'Chapter';

    // DnD sensors for page reordering
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

    // Handle page drag end
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

    // Updated style groups with new categories
    const STYLE_GROUPS: Record<string, string[]> = {
        "Noir & Crime": ["classic-noir", "sin-city", "crime-noir", "will-eisner"],
        "Superhero": ["bronze-superhero", "silver-superhero", "kirby-cosmic", "alex-ross", "frank-miller"],
        "Horror & Dark Fantasy": ["ec-horror", "vertigo-horror", "mignola-hellboy", "hellraiser", "spawn-mcfarlane"],
        "Indie & European": ["underground-comix", "indie-minimalist", "clear-line", "european-bd", "modern-alt"],
        "Americana & Whimsy": ["norman-rockwell", "kinkade-luminous", "lisa-frank"],
        "Sci-Fi & Experimental": ["dune-epic", "erotic-realism", "pulp-adventure", "cyberpunk-noir"],
        "Custom": ["custom"]
    };

    const [sidebarKey, setSidebarKey] = useState('');

    useEffect(() => {
        if (activeProject?.imageProvider === 'gemini') {
            setSidebarKey(activeProject?.geminiApiKey || '');
        } else if (activeProject?.imageProvider === 'leonardo') {
            setSidebarKey(activeProject?.leonardoApiKey || '');
        } else if (activeProject?.imageProvider === 'grok') {
            setSidebarKey(activeProject?.grokApiKey || '');
        } else if (activeProject?.imageProvider === 'fal') {
            setSidebarKey(activeProject?.falApiKey || '');
        } else if (activeProject?.imageProvider === 'seaart') {
            setSidebarKey(activeProject?.seaartApiKey || '');
        } else if (activeProject?.imageProvider === 'openai') {
            setSidebarKey(activeProject?.openaiApiKey || '');
        } else {
            setSidebarKey('');
        }
    }, [activeProject?.geminiApiKey, activeProject?.leonardoApiKey, activeProject?.grokApiKey, activeProject?.falApiKey, activeProject?.seaartApiKey, activeProject?.openaiApiKey, activeProject?.imageProvider]);

    const [showCharForm, setShowCharForm] = useState(false);
    const [charName, setCharName] = useState('');
    const [charDesc, setCharDesc] = useState('');

    const handleAddChar = () => {
        if (charName.trim()) {
            dispatch({ type: 'ADD_CHARACTER', name: charName.trim(), description: charDesc.trim() });
            setCharName('');
            setCharDesc('');
            setShowCharForm(false);
        }
    };

    // Generate with FAL
    const handleFalClick = async () => {
        if (activeProject?.imageProvider !== 'fal') {
            dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { imageProvider: 'fal' } });
            return;
        }

        if (!activeProject?.falApiKey) {
            alert("FAL API key is missing. Enter it below and click SET.");
            return;
        }

        if (!activePage || activePage.panels.length === 0) {
            alert("No active page or frames. Add a frame first.");
            return;
        }

        const targetPanel = activePage.panels[0];
        const prompt = targetPanel.prompt?.trim();

        if (!prompt) {
            alert("No prompt/description in the active frame. Add one first.");
            return;
        }

        try {
            const generatedUrl = await generateFalFlux(
                prompt,
                targetPanel.aspectRatio || 'square',
                activeProject.falApiKey,
                activeProject.fluxModel || 'fal-ai/flux-pro',
                undefined,
                0.7
            );

            if (!generatedUrl) throw new Error("No image URL returned from FAL");

            const storedRef = await saveImage(targetPanel.id, generatedUrl);
            dispatch({
                type: 'UPDATE_PANEL',
                panelId: targetPanel.id,
                updates: { imageUrl: storedRef }
            });

            console.log("FAL image generated and saved:", generatedUrl);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Check console for details';
            console.error("FAL generation failed:", err);
            alert(`FAL generation failed: ${errorMessage}`);
        }
    };

    // Generate with Leonardo
    const handleLeonardoClick = async () => {
        if (activeProject?.imageProvider !== 'leonardo') {
            dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { imageProvider: 'leonardo' } });
            return;
        }

        if (!activeProject?.leonardoApiKey) {
            alert("Leonardo API key is missing. Enter it above and click SET.");
            return;
        }

        if (!activePage || activePage.panels.length === 0) {
            alert("No active page or frames. Add a frame first.");
            return;
        }

        const targetPanel = activePage.panels[0];
        const prompt = targetPanel.prompt?.trim();

        if (!prompt) {
            alert("No prompt/description in the active frame. Add one first.");
            return;
        }

        try {
            const generatedUrl = await generateLeonardoImage(
                prompt,
                targetPanel.aspectRatio || 'square',
                activeProject.leonardoApiKey,
                undefined,
                0.7
            );

            if (!generatedUrl) throw new Error("No image URL returned from Leonardo");

            const storedRef = await saveImage(targetPanel.id, generatedUrl);
            dispatch({
                type: 'UPDATE_PANEL',
                panelId: targetPanel.id,
                updates: { imageUrl: storedRef }
            });

            console.log("Leonardo image generated and saved:", generatedUrl);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Check console for details';
            console.error("Leonardo generation failed:", err);
            alert(`Leonardo generation failed: ${errorMessage}`);
        }
    };

    // Generate with Gemini
    const handleGeminiClick = async () => {
        if (activeProject?.imageProvider !== 'gemini') {
            dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { imageProvider: 'gemini' } });
            return;
        }

        if (!activeProject?.geminiApiKey) {
            alert("Gemini API key is missing. Enter it below and click SET.");
            return;
        }

        if (!activePage || activePage.panels.length === 0) {
            alert("No active page or frames. Add a frame first.");
            return;
        }

        const targetPanel = activePage.panels[0];
        const prompt = targetPanel.prompt?.trim();

        if (!prompt) {
            alert("No prompt/description in the active frame. Add one first.");
            return;
        }

        try {
            const generatedUrl = await generateGeminiImage(
                prompt,
                targetPanel.aspectRatio || 'square',
                activeProject.geminiApiKey,
                undefined,
                0.7
            );

            if (!generatedUrl) throw new Error("No image URL returned from Gemini");

            const storedRef = await saveImage(targetPanel.id, generatedUrl);
            dispatch({
                type: 'UPDATE_PANEL',
                panelId: targetPanel.id,
                updates: { imageUrl: storedRef }
            });

            console.log("Gemini image generated and saved:", generatedUrl);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Check console for details';
            console.error("Gemini generation failed:", err);
            alert(`Gemini generation failed: ${errorMessage}`);
        }
    };

    // Generate with Grok
    const handleGrokClick = async () => {
        if (activeProject?.imageProvider !== 'grok') {
            dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { imageProvider: 'grok' } });
            return;
        }

        if (!activeProject?.grokApiKey) {
            alert("Grok (xAI) API key is missing. Enter it below and click SET.");
            return;
        }

        if (!activePage || activePage.panels.length === 0) {
            alert("No active page or frames. Add a frame first.");
            return;
        }

        const targetPanel = activePage.panels[0];
        const prompt = targetPanel.prompt?.trim();

        if (!prompt) {
            alert("No prompt/description in the active frame. Add one first.");
            return;
        }

        try {
            const generatedUrl = await generateGrokImage(
                prompt,
                targetPanel.aspectRatio || 'square',
                activeProject.grokApiKey,
                undefined,
                0.7
            );

            if (!generatedUrl) throw new Error("No image URL returned from Grok");

            const storedRef = await saveImage(targetPanel.id, generatedUrl);
            dispatch({
                type: 'UPDATE_PANEL',
                panelId: targetPanel.id,
                updates: { imageUrl: storedRef }
            });

            console.log("Grok image generated and saved:", generatedUrl);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Check console for details';
            console.error("Grok generation failed:", err);
            alert(`Grok generation failed: ${errorMessage}`);
        }
    };

    // Generate with SeaArt
    const handleSeaArtClick = async () => {
        if (activeProject?.imageProvider !== 'seaart') {
            dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { imageProvider: 'seaart' } });
            return;
        }

        if (!activeProject?.seaartApiKey) {
            alert("SeaArt API key is missing. Enter it below and click SET.");
            return;
        }

        if (!activePage || activePage.panels.length === 0) {
            alert("No active page or frames. Add a frame first.");
            return;
        }

        const targetPanel = activePage.panels[0];
        const prompt = targetPanel.prompt?.trim();

        if (!prompt) {
            alert("No prompt/description in the active frame. Add one first.");
            return;
        }

        try {
            const generatedUrl = await generateSeaArtImage(
                prompt,
                targetPanel.aspectRatio || 'square',
                activeProject.seaartApiKey,
                undefined,
                0.7
            );

            if (!generatedUrl) throw new Error("No image URL returned from SeaArt");

            const storedRef = await saveImage(targetPanel.id, generatedUrl);
            dispatch({
                type: 'UPDATE_PANEL',
                panelId: targetPanel.id,
                updates: { imageUrl: storedRef }
            });

            console.log("SeaArt image generated and saved:", generatedUrl);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Check console for details';
            console.error("SeaArt generation failed:", err);
            alert(`SeaArt generation failed: ${errorMessage}`);
        }
    };

    // Generate with OpenAI
    const handleOpenAIClick = async () => {
        if (activeProject?.imageProvider !== 'openai') {
            dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { imageProvider: 'openai' } });
            return;
        }

        if (!activeProject?.openaiApiKey) {
            alert("OpenAI API key is missing. Enter it below and click SET.");
            return;
        }

        if (!activePage || activePage.panels.length === 0) {
            alert("No active page or frames. Add a frame first.");
            return;
        }

        const targetPanel = activePage.panels[0];
        const prompt = targetPanel.prompt?.trim();

        if (!prompt) {
            alert("No prompt/description in the active frame. Add one first.");
            return;
        }

        try {
            const generatedUrl = await generateOpenAIImage(
                prompt,
                targetPanel.aspectRatio || 'square',
                activeProject.openaiApiKey,
                undefined,
                0.7
            );

            if (!generatedUrl) throw new Error("No image URL returned from OpenAI");

            const storedRef = await saveImage(targetPanel.id, generatedUrl);
            dispatch({
                type: 'UPDATE_PANEL',
                panelId: targetPanel.id,
                updates: { imageUrl: storedRef }
            });

            console.log("OpenAI image generated and saved:", generatedUrl);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Check console for details';
            console.error("OpenAI generation failed:", err);
            alert(`OpenAI generation failed: ${errorMessage}`);
        }
    };

    return (
        <aside className="w-72 bg-ink-900 border-r border-ink-700 flex flex-col overflow-hidden z-30">
            <div className="p-6 border-b border-ink-700">
                <h1 className="font-display text-3xl tracking-widest text-ember-500 mb-1 text-center">INK TRACKER</h1>
                <p className="font-mono text-[10px] text-steel-500 uppercase tracking-tighter text-center">Script System v1.7</p>
                
                {/* Sign in button - only shows when Supabase is configured and user is not logged in */}
                {isSupabaseConfigured() && !user && (
                    <button
                        onClick={signInWithGoogle}
                        aria-label="Sign in with Google for cloud sync"
                        className="w-full mt-4 py-2 px-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-[10px] font-mono uppercase tracking-widest rounded-lg transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
                            />
                        </svg>
                        Sign in for Cloud Sync
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-none">
                <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h2 className="text-xs font-mono text-steel-500 uppercase tracking-widest">Story</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const i = activeProject?.issueType === 'issue' ? 'chapter' : 'issue';
                                    if (activeProject) dispatch({ type: 'UPDATE_PROJECT', id: activeProject.id, updates: { issueType: i } });
                                }}
                                className="text-[9px] font-mono text-steel-600 hover:text-ember-500 uppercase transition-colors"
                                title="Switch Label Type"
                            >
                                Mode: {activeProject?.issueType}
                            </button>
                            <button onClick={onOpenProjects} className="text-steel-400 hover:text-ember-500 transition-colors">
                                <Icons.Folder />
                            </button>
                        </div>
                    </div>

                    <div className="p-3 bg-ink-800 rounded border border-ink-700 shadow-inner flex flex-col gap-2">
                        <p className="font-display text-lg text-steel-200 tracking-wide truncate">{activeProject?.title}</p>
                        <button
                            onClick={onOpenScriptImport}
                            className="w-full mt-2 py-2 text-[10px] font-mono text-cyan-500 border border-cyan-800/50 rounded-lg hover:bg-cyan-900/20 uppercase tracking-widest transition-colors"
                        >
                            📜 Import Script
                        </button>

                        <div className="flex flex-col gap-2 mt-3">
                            <p className="text-[9px] font-mono text-steel-500 uppercase tracking-widest">Image Provider</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    onClick={handleGeminiClick}
                                    className={`text-[9px] font-mono py-2 rounded-lg transition-all ${
                                        activeProject?.imageProvider === 'gemini'
                                            ? 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/30'
                                            : 'bg-ink-900 text-steel-500 hover:bg-ink-800 hover:text-steel-300'
                                    }`}
                                >
                                    GEMINI
                                </button>
                                <button
                                    onClick={handleLeonardoClick}
                                    className={`text-[9px] font-mono py-2 rounded-lg transition-all ${
                                        activeProject?.imageProvider === 'leonardo'
                                            ? 'bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-lg shadow-orange-600/30'
                                            : 'bg-ink-900 text-steel-500 hover:bg-ink-800 hover:text-steel-300'
                                    }`}
                                >
                                    LEONARDO
                                </button>
                                <button
                                    onClick={handleGrokClick}
                                    className={`text-[9px] font-mono py-2 rounded-lg transition-all ${
                                        activeProject?.imageProvider === 'grok'
                                            ? 'bg-gray-600 hover:bg-gray-500 text-white font-bold shadow-lg shadow-gray-600/30'
                                            : 'bg-ink-900 text-steel-500 hover:bg-ink-800 hover:text-steel-300'
                                    }`}
                                    title="xAI Grok - Image generation may be limited"
                                >
                                    GROK
                                </button>
                                <button
                                    onClick={handleFalClick}
                                    className={`text-[9px] font-mono py-2 rounded-lg transition-all ${
                                        activeProject?.imageProvider === 'fal'
                                            ? 'bg-ember-500 hover:bg-ember-400 text-ink-950 font-bold shadow-lg shadow-ember-500/30'
                                            : 'bg-ink-900 text-steel-500 hover:bg-ink-800 hover:text-steel-300'
                                    }`}
                                >
                                    FAL
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                                <button
                                    onClick={handleSeaArtClick}
                                    className={`text-[9px] font-mono py-2 rounded-lg transition-all ${
                                        activeProject?.imageProvider === 'seaart'
                                            ? 'bg-pink-600 hover:bg-pink-500 text-white font-bold shadow-lg shadow-pink-600/30'
                                            : 'bg-ink-900 text-steel-500 hover:bg-ink-800 hover:text-steel-300'
                                    }`}
                                    title="SeaArt - Creative image generation"
                                >
                                    SEAART
                                </button>
                                <button
                                    onClick={handleOpenAIClick}
                                    className={`text-[9px] font-mono py-2 rounded-lg transition-all ${
                                        activeProject?.imageProvider === 'openai'
                                            ? 'bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-600/30'
                                            : 'bg-ink-900 text-steel-500 hover:bg-ink-800 hover:text-steel-300'
                                    }`}
                                    title="OpenAI GPT Image - gpt-image-1"
                                >
                                    OPENAI
                                </button>
                            </div>
                        </div>

                        {/* API Key Input */}
                        <div className="mt-3 pt-3 border-t border-ink-700 space-y-2">
                            <label className="text-[9px] font-mono text-steel-500 uppercase flex justify-between items-center">
                                <span>
                                    {activeProject?.imageProvider === 'gemini' ? 'Gemini' :
                                     activeProject?.imageProvider === 'leonardo' ? 'Leonardo' :
                                     activeProject?.imageProvider === 'grok' ? 'Grok (xAI)' :
                                     activeProject?.imageProvider === 'fal' ? 'FAL' :
                                     activeProject?.imageProvider === 'seaart' ? 'SeaArt' :
                                     activeProject?.imageProvider === 'openai' ? 'OpenAI' : 'API'} Key
                                </span>
                                {!sidebarKey && <span className="text-red-500 font-bold animate-pulse text-[8px]">REQUIRED</span>}
                            </label>
                            <div className="flex gap-1">
                                <input
                                    type="password"
                                    placeholder="Enter API Key..."
                                    value={sidebarKey}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSidebarKey(e.target.value)}
                                    className="flex-1 bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-[10px] text-steel-300 focus:border-ember-500 outline-none"
                                />
                                <button
                                    onClick={() => {
                                        if (sidebarKey.trim()) {
                                            if (activeProject?.imageProvider === 'gemini') {
                                                dispatch({ type: 'UPDATE_PROJECT_GEMINI_KEY', projectId: activeProject.id, apiKey: sidebarKey.trim() });
                                            } else if (activeProject?.imageProvider === 'leonardo') {
                                                dispatch({ type: 'UPDATE_PROJECT_LEONARDO_KEY', projectId: activeProject.id, apiKey: sidebarKey.trim() });
                                            } else if (activeProject?.imageProvider === 'grok') {
                                                dispatch({ type: 'UPDATE_PROJECT_GROK_KEY', projectId: activeProject.id, apiKey: sidebarKey.trim() });
                                            } else if (activeProject?.imageProvider === 'fal') {
                                                dispatch({ type: 'UPDATE_PROJECT_FAL_KEY', projectId: activeProject.id, apiKey: sidebarKey.trim() });
                                            } else if (activeProject?.imageProvider === 'seaart') {
                                                dispatch({ type: 'UPDATE_PROJECT_SEAART_KEY', projectId: activeProject.id, apiKey: sidebarKey.trim() });
                                            } else if (activeProject?.imageProvider === 'openai') {
                                                dispatch({ type: 'UPDATE_PROJECT_OPENAI_KEY', projectId: activeProject.id, apiKey: sidebarKey.trim() });
                                            }
                                            alert('API key saved!');
                                        }
                                    }}
                                    className="bg-ember-500 hover:bg-ember-400 text-ink-950 px-4 rounded-lg text-[9px] transition-colors font-bold"
                                >
                                    SET
                                </button>
                            </div>
                            {activeProject?.imageProvider === 'gemini' ? (
                                <a 
                                    href="https://aistudio.google.com/app/apikey" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-steel-600 italic hover:underline hover:text-steel-400 cursor-pointer transition-colors"
                                >
                                    Get key from ai.google.dev
                                </a>
                            ) : activeProject?.imageProvider === 'leonardo' ? (
                                <a 
                                    href="https://leonardo.ai/settings" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-steel-600 italic hover:underline hover:text-steel-400 cursor-pointer transition-colors"
                                >
                                    Get key from leonardo.ai
                                </a>
                            ) : activeProject?.imageProvider === 'grok' ? (
                                <a 
                                    href="https://console.x.ai" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-steel-600 italic hover:underline hover:text-steel-400 cursor-pointer transition-colors"
                                >
                                    Get key from console.x.ai (experimental)
                                </a>
                            ) : activeProject?.imageProvider === 'fal' ? (
                                <a 
                                    href="https://fal.ai/dashboard/keys" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-steel-600 italic hover:underline hover:text-steel-400 cursor-pointer transition-colors"
                                >
                                    Get key from fal.ai
                                </a>
                            ) : activeProject?.imageProvider === 'seaart' ? (
                                <a 
                                    href="https://seaart.ai/api" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-steel-600 italic hover:underline hover:text-steel-400 cursor-pointer transition-colors"
                                >
                                    Get key from seaart.ai/api
                                </a>
                            ) : activeProject?.imageProvider === 'openai' ? (
                                <a 
                                    href="https://platform.openai.com/api-keys" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-steel-600 italic hover:underline hover:text-steel-400 cursor-pointer transition-colors"
                                >
                                    Get key from platform.openai.com
                                </a>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Issues / Chapters section */}
                <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h2 className="text-xs font-mono text-steel-500 uppercase tracking-widest">{typeLabel}s</h2>
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
                            className="text-steel-400 hover:text-ember-500 transition-colors flex items-center gap-1 group"
                            title="Add New Issue/Chapter"
                        >
                            <Icons.Plus />
                            <span className="text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity">NEW</span>
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
                                <div key={iss.id} className={`rounded-lg overflow-hidden transition-all border ${isActive ? 'border-ember-500/30 bg-ember-500/5' : 'border-ink-700'}`}>
                                    <div
                                        onClick={() => dispatch({ type: 'SET_ACTIVE_ISSUE', id: iss.id })}
                                        className={`px-3 py-2 flex items-center justify-between cursor-pointer group ${isActive ? 'bg-ember-500/10' : 'hover:bg-ink-800'}`}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className={`text-[10px] font-mono ${isActive ? 'text-ember-500' : 'text-steel-600'}`}>{isActive ? '●' : '○'}</span>
                                            <p className={`text-xs font-bold uppercase tracking-widest truncate ${isActive ? 'text-ember-500' : 'text-steel-400 group-hover:text-steel-200'}`}>{iss.title}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[9px] font-mono text-steel-600">{iss.pages.length}P</span>
                                            <button
                                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (confirm(`Delete ${iss.title}?`)) dispatch({ type: 'DELETE_ISSUE', issueId: iss.id }); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-steel-700 hover:text-red-500 transition-all"
                                            >
                                                <Icons.Trash />
                                            </button>
                                        </div>
                                    </div>
                                    {isActive && (
                                        <div className="px-2 py-2 border-t border-ember-500/10 space-y-1 animate-fade-in">
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
                                                className="w-full py-1 text-center text-[10px] font-mono text-steel-600 hover:text-ember-500 hover:bg-ink-800 rounded transition-all mt-1 uppercase tracking-tighter"
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
                        <h2 className="text-xs font-mono text-steel-500 uppercase tracking-widest">Cast</h2>
                        <button
                            onClick={() => setShowCharForm(!showCharForm)}
                            className={`transition-colors ${showCharForm ? 'text-ember-500 rotate-45' : 'text-steel-400 hover:text-ember-500'}`}
                        >
                            <Icons.Plus />
                        </button>
                    </div>

                    {showCharForm && (
                        <div className="mb-4 p-3 bg-ink-800 border border-ember-500/30 rounded-lg space-y-3 animate-fade-in shadow-xl">
                            <input
                                autoFocus
                                placeholder="Name (e.g. Detective Jack)"
                                value={charName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCharName(e.target.value)}
                                className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-1.5 text-xs text-steel-200 focus:border-ember-500 outline-none font-bold"
                            />
                            <textarea
                                placeholder="Description (age, vibe, key features...)"
                                value={charDesc}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCharDesc(e.target.value)}
                                rows={2}
                                className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-1.5 text-xs text-steel-400 focus:border-ember-500 outline-none resize-none italic"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleAddChar}
                                    className="flex-1 bg-ember-500 text-ink-950 font-bold py-1.5 rounded text-[10px] uppercase tracking-widest hover:bg-ember-400 transition-colors"
                                >
                                    Save Cast
                                </button>
                                <button
                                    onClick={() => setShowCharForm(false)}
                                    className="px-3 py-1.5 border border-ink-700 text-steel-500 rounded text-[10px] uppercase hover:bg-ink-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {activeProject?.characters?.map(char => (
                            <div key={char.id} className="group flex items-center justify-between p-2 bg-ink-800/50 rounded border border-ink-700/50">
                                <div className="overflow-hidden">
                                    <p className="text-[11px] text-steel-300 font-bold truncate">{char.name}</p>
                                    <p className="text-[9px] text-steel-600 truncate italic">{char.description}</p>
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
            </div>

            {/* Art Style selector - Updated with custom style support */}
            <div className="p-6 border-t border-ink-700 bg-ink-950 space-y-3">
                <h2 className="text-xs font-mono text-steel-500 uppercase tracking-widest px-1">Art Style</h2>
                <select
                    value={activeProject?.style}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { style: e.target.value } });
                        // Clear custom prompt if switching away from custom
                        if (e.target.value !== 'custom' && activeProject?.customStylePrompt) {
                            dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { customStylePrompt: '' } });
                        }
                    }}
                    className="w-full bg-ink-800 border border-ink-700 rounded-lg px-2 py-2 text-xs text-steel-300 font-mono focus:outline-none focus:border-ember-500 transition-colors"
                >
                    {Object.entries(STYLE_GROUPS).map(([groupName, styleIds]) => (
                        <optgroup key={groupName} label={groupName}>
                            {styleIds.map(id => {
                                const s = ART_STYLES.find(x => x.id === id);
                                return s ? <option key={s.id} value={s.id}>{s.name}</option> : null;
                            })}
                        </optgroup>
                    ))}
                </select>

                {/* Custom style input - only shows when "custom" is selected */}
                {activeProject?.style === 'custom' && (
                    <div className="space-y-2 animate-fade-in">
                        <label className="text-[9px] font-mono text-steel-500 uppercase">
                            Custom Style Prompt
                        </label>
                        <textarea
                            placeholder="Describe your art style... (e.g., 'watercolor fantasy, soft edges, muted pastels, Studio Ghibli influence')"
                            value={activeProject?.customStylePrompt || ''}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { customStylePrompt: e.target.value } })
                            }
                            rows={3}
                            className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-xs text-steel-300 focus:outline-none focus:border-ember-500 transition-colors resize-none placeholder-steel-600"
                        />
                        <p className="text-[8px] text-steel-600 italic">
                            Tip: Include artist names, techniques, color palettes, and mood descriptors.
                        </p>
                    </div>
                )}
            </div>

            {/* Panel & Text Style Settings */}
            {activeProject && (
                <div className="p-6 border-t border-ink-700 bg-ink-950 space-y-4">
                    <h2 className="text-xs font-mono text-steel-500 uppercase tracking-widest px-1">Panel & Text Styles</h2>

                    {/* Panel Frame Style */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-mono text-steel-500 uppercase">Panel Frames</label>
                        <div className="flex rounded-lg overflow-hidden border border-ink-700">
                            {([
                                { value: 'opaque-black' as PanelFrameStyle, label: 'Black' },
                                { value: 'opaque-white' as PanelFrameStyle, label: 'White' },
                                { value: 'translucent' as PanelFrameStyle, label: 'Translucent' },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => dispatch({ type: 'UPDATE_PROJECT', id: activeProject.id, updates: { panelFrameStyle: opt.value } })}
                                    className={`flex-1 text-[9px] font-mono py-2 transition-all ${
                                        (activeProject.panelFrameStyle || 'opaque-black') === opt.value
                                            ? 'bg-ember-500 text-ink-950 font-bold'
                                            : 'bg-ink-900 text-steel-500 hover:bg-ink-800 hover:text-steel-300'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Text Overlay Style */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-mono text-steel-500 uppercase">Text Elements</label>
                        <div className="flex rounded-lg overflow-hidden border border-ink-700">
                            {([
                                { value: 'opaque' as TextOverlayStyle, label: 'Opaque' },
                                { value: 'semi-transparent' as TextOverlayStyle, label: 'Semi-Trans' },
                                { value: 'border-only' as TextOverlayStyle, label: 'Border Only' },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => dispatch({ type: 'UPDATE_PROJECT', id: activeProject.id, updates: { textOverlayStyle: opt.value } })}
                                    className={`flex-1 text-[9px] font-mono py-2 transition-all ${
                                        (activeProject.textOverlayStyle || 'opaque') === opt.value
                                            ? 'bg-ember-500 text-ink-950 font-bold'
                                            : 'bg-ink-900 text-steel-500 hover:bg-ink-800 hover:text-steel-300'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
