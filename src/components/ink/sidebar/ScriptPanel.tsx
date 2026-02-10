import React, { useState, useEffect } from 'react';
import { AppState, Project } from '../../../types';
import { InkAction as Action } from '../../../store/inkSlice';
import { ART_STYLES, Icons } from '../../../constants';
import { generateImage as generateGeminiImage } from '../../../services/geminiService';
import { generateLeonardoImage } from '../../../services/leonardoService';
import { generateGrokImage } from '../../../services/grokService';
import { generateFluxImage as generateFalFlux } from '../../../services/falFluxService';
import { generateSeaArtImage } from '../../../services/seaartService';
import { generateOpenAIImage } from '../../../services/openaiService';
import { saveImage } from '../../../services/imageStorage';

interface ScriptPanelProps {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    onOpenProjects: () => void;
    onOpenScriptImport: () => void;
    activeProject: Project | undefined;
}

export const STYLE_GROUPS: Record<string, string[]> = {
    "Noir & Crime": ["classic-noir", "sin-city", "crime-noir", "will-eisner"],
    "Superhero": ["bronze-superhero", "silver-superhero", "kirby-cosmic", "alex-ross", "frank-miller"],
    "Horror & Dark Fantasy": ["ec-horror", "vertigo-horror", "mignola-hellboy", "hellraiser", "spawn-mcfarlane"],
    "Indie & European": ["underground-comix", "indie-minimalist", "clear-line", "european-bd", "modern-alt"],
    "Americana & Whimsy": ["norman-rockwell", "kinkade-luminous", "lisa-frank"],
    "Sci-Fi & Experimental": ["dune-epic", "erotic-realism", "pulp-adventure", "cyberpunk-noir"],
    "Custom": ["custom"]
};

export const ScriptPanel: React.FC<ScriptPanelProps> = ({ 
    state, 
    dispatch, 
    onOpenProjects, 
    onOpenScriptImport,
    activeProject 
}) => {
    const activePage = activeProject?.issues
        .find(i => i.id === state.activeIssueId)
        ?.pages.find(p => p.id === state.activePageId);

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
        <div>
            <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-xs font-body text-stone-600 uppercase tracking-widest">Story</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            const i = activeProject?.issueType === 'issue' ? 'chapter' : 'issue';
                            if (activeProject) dispatch({ type: 'UPDATE_PROJECT', id: activeProject.id, updates: { issueType: i } });
                        }}
                        className="text-[9px] font-body text-stone-600 hover:text-ink uppercase transition-colors"
                        title="Switch Label Type"
                    >
                        Mode: {activeProject?.issueType}
                    </button>
                    <button onClick={onOpenProjects} className="text-stone-600 hover:text-ink transition-colors">
                        <Icons.Folder />
                    </button>
                </div>
            </div>

            <div className="p-3 bg-card rounded border border-stone-200 shadow-sm flex flex-col gap-2">
                <p className="font-display text-lg text-ink tracking-wide truncate">{activeProject?.title}</p>
                <button
                    onClick={onOpenScriptImport}
                    className="w-full mt-2 py-2 text-[10px] font-body text-ink border border-stone-200 rounded-lg hover:bg-stone-100 uppercase tracking-widest transition-colors"
                >
                    📜 Import Script
                </button>

                <div className="flex flex-col gap-2 mt-3">
                    <p className="text-[9px] font-body text-stone-600 uppercase tracking-widest">Image Provider</p>
                    <div className="grid grid-cols-2 gap-1.5">
                        <button
                            onClick={handleGeminiClick}
                            className={`text-[9px] font-body py-2 rounded-lg transition-all ${
                                activeProject?.imageProvider === 'gemini'
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-sm'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-ink border border-stone-200'
                            }`}
                        >
                            GEMINI
                        </button>
                        <button
                            onClick={handleLeonardoClick}
                            className={`text-[9px] font-body py-2 rounded-lg transition-all ${
                                activeProject?.imageProvider === 'leonardo'
                                    ? 'bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-sm'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-ink border border-stone-200'
                            }`}
                        >
                            LEONARDO
                        </button>
                        <button
                            onClick={handleGrokClick}
                            className={`text-[9px] font-body py-2 rounded-lg transition-all ${
                                activeProject?.imageProvider === 'grok'
                                    ? 'bg-gray-600 hover:bg-gray-500 text-white font-bold shadow-sm'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-ink border border-stone-200'
                            }`}
                            title="xAI Grok - Image generation may be limited"
                        >
                            GROK
                        </button>
                        <button
                            onClick={handleFalClick}
                            className={`text-[9px] font-body py-2 rounded-lg transition-all ${
                                activeProject?.imageProvider === 'fal'
                                    ? 'bg-ember-500 hover:bg-ember-400 text-white font-bold shadow-sm'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-ink border border-stone-200'
                            }`}
                        >
                            FAL
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                        <button
                            onClick={handleSeaArtClick}
                            className={`text-[9px] font-body py-2 rounded-lg transition-all ${
                                activeProject?.imageProvider === 'seaart'
                                    ? 'bg-pink-600 hover:bg-pink-500 text-white font-bold shadow-sm'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-ink border border-stone-200'
                            }`}
                            title="SeaArt - Creative image generation"
                        >
                            SEAART
                        </button>
                        <button
                            onClick={handleOpenAIClick}
                            className={`text-[9px] font-body py-2 rounded-lg transition-all ${
                                activeProject?.imageProvider === 'openai'
                                    ? 'bg-green-600 hover:bg-green-500 text-white font-bold shadow-sm'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-ink border border-stone-200'
                            }`}
                            title="OpenAI GPT Image - gpt-image-1"
                        >
                            OPENAI
                        </button>
                    </div>
                </div>

                {/* API Key Input */}
                <div className="mt-3 pt-3 border-t border-stone-200 space-y-2">
                    <label className="text-[9px] font-body text-stone-600 uppercase flex justify-between items-center">
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
                            className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-[10px] text-ink focus:border-ink outline-none"
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
                            className="bg-ember-500 hover:bg-ember-400 text-white px-4 rounded-lg text-[9px] transition-colors font-bold"
                        >
                            SET
                        </button>
                    </div>
                    {activeProject?.imageProvider === 'gemini' ? (
                        <a 
                            href="https://aistudio.google.com/app/apikey" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[8px] text-stone-500 italic hover:underline hover:text-ink cursor-pointer transition-colors"
                        >
                            Get key from ai.google.dev
                        </a>
                    ) : activeProject?.imageProvider === 'leonardo' ? (
                        <a 
                            href="https://leonardo.ai/settings" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[8px] text-stone-500 italic hover:underline hover:text-ink cursor-pointer transition-colors"
                        >
                            Get key from leonardo.ai
                        </a>
                    ) : activeProject?.imageProvider === 'grok' ? (
                        <a 
                            href="https://console.x.ai" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[8px] text-stone-500 italic hover:underline hover:text-ink cursor-pointer transition-colors"
                        >
                            Get key from console.x.ai (experimental)
                        </a>
                    ) : activeProject?.imageProvider === 'fal' ? (
                        <a 
                            href="https://fal.ai/dashboard/keys" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[8px] text-stone-500 italic hover:underline hover:text-ink cursor-pointer transition-colors"
                        >
                            Get key from fal.ai
                        </a>
                    ) : activeProject?.imageProvider === 'seaart' ? (
                        <a 
                            href="https://seaart.ai/api" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[8px] text-stone-500 italic hover:underline hover:text-ink cursor-pointer transition-colors"
                        >
                            Get key from seaart.ai/api
                        </a>
                    ) : activeProject?.imageProvider === 'openai' ? (
                        <a 
                            href="https://platform.openai.com/api-keys" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[8px] text-stone-500 italic hover:underline hover:text-ink cursor-pointer transition-colors"
                        >
                            Get key from platform.openai.com
                        </a>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
