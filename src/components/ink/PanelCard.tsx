import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Trash2, ImageIcon, Sparkles, Loader2, Move, Upload, RefreshCw, Plus, X, Settings2 } from 'lucide-react';
import { Panel, Project, Character, AspectRatio, Page, TextElement, TextElementType, PanelFrameStyle, TextOverlayStyle } from '../../types';
import { InkAction as Action } from '../../store/inkSlice';
import { ASPECT_CONFIGS, ART_STYLES } from '../../constants';
import { getImage, saveImage } from '../../services/imageStorage';
import { genId } from '../../utils/helpers';
import TextOverlay from './TextOverlay';
import { PanelGenerationOverlay } from './GenerationSpinner';
import PanelSettingsPopover from './PanelSettingsPopover';

import { generateImage as generateGeminiImage } from '../../services/geminiService';
import { generateLeonardoImage } from '../../services/leonardoService';
import { generateGrokImage } from '../../services/grokService';
import { generateFluxImage as generateFalFlux } from '../../services/falFluxService';
import { generateSeaArtImage } from '../../services/seaartService';
import { generateOpenAIImage } from '../../services/openaiService';

function getAppearanceSummary(char: Character): string {
    if (!char.appearance) return char.description || '';
    const parts: string[] = [];
    const a = char.appearance;
    if (a.build) parts.push(a.build);
    if (a.hairColor) parts.push(`${a.hairColor} hair`);
    if (a.eyeColor) parts.push(`${a.eyeColor} eyes`);
    if (a.distinguishingMarks) parts.push(a.distinguishingMarks);
    if (parts.length === 0 && char.description) return char.description;
    return parts.join(', ');
}

function buildCharacterPrompt(char: Character): string {
    const parts: string[] = [char.name];
    if (char.appearance) {
        const a = char.appearance;
        const desc: string[] = [];
        if (a.age) desc.push(a.age);
        if (a.gender) desc.push(a.gender);
        if (a.ethnicity) desc.push(a.ethnicity);
        if (a.height) desc.push(a.height);
        if (a.build) desc.push(a.build);
        if (a.skinTone) desc.push(`${a.skinTone} skin`);
        if (a.hairColor && a.hairStyle) desc.push(`${a.hairColor} ${a.hairStyle} hair`);
        else if (a.hairColor) desc.push(`${a.hairColor} hair`);
        else if (a.hairStyle) desc.push(`${a.hairStyle} hair`);
        if (a.eyeColor) desc.push(`${a.eyeColor} eyes`);
        if (a.facialFeatures) desc.push(a.facialFeatures);
        if (a.distinguishingMarks) desc.push(a.distinguishingMarks);
        if (a.clothing) desc.push(`wearing ${a.clothing}`);
        if (a.accessories) desc.push(`with ${a.accessories}`);
        if (a.additionalNotes) desc.push(a.additionalNotes);
        if (desc.length > 0) parts.push(`(${desc.join(', ')})`);
    } else if (char.description) {
        parts.push(`(${char.description})`);
    }
    return parts.join(' ');
}

interface PanelCardProps {
    panel: Panel; pageId: string; dispatch: React.Dispatch<Action>; project: Project;
    characters: Character[]; index: number; total: number; showGutters?: boolean;
    activePage: Page; isOverlay?: boolean; isDragging?: boolean; isSelected?: boolean;
    onSelect?: () => void; copiedSettings?: { aspectRatio: AspectRatio; characterIds: string[] } | null;
    onCopySettings?: () => void; onPasteSettings?: () => void;
    panelFrameStyle?: PanelFrameStyle; textOverlayStyle?: TextOverlayStyle;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;

const PanelCard: React.FC<PanelCardProps> = ({
    panel, pageId, dispatch, project, characters, index, total,
    showGutters = false, activePage, isOverlay = false,
    isDragging: isDraggingProp = false, isSelected = false, onSelect,
    copiedSettings, onCopySettings, onPasteSettings,
    panelFrameStyle = 'opaque-black', textOverlayStyle = 'opaque',
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [promptFocused, setPromptFocused] = useState(false);
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const panelWidth = panel.width || 360;
    const panelHeight = panel.height || 420;

    const { attributes, listeners, setNodeRef, transform, isDragging: isDraggingLocal } = useDraggable({ 
        id: panel.id, disabled: isOverlay || isResizing
    });
    const isDragging = isDraggingProp || isDraggingLocal;

    const style: React.CSSProperties = {
        position: 'absolute', left: panel.x || 0, top: panel.y || 0,
        width: panelWidth, minHeight: panelHeight,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 1000 : (isSelected ? 100 : 1),
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        transition: isResizing ? 'none' : 'box-shadow 0.2s',
        outline: isSelected ? '3px solid #60a5fa' : undefined,
        outlineOffset: isSelected ? '2px' : undefined,
    };

    useEffect(() => {
        const loadImage = async () => {
            if (panel.imageUrl?.startsWith('idb://')) {
                const id = panel.imageUrl.replace('idb://', '');
                const dataUrl = await getImage(id);
                setImageDataUrl(dataUrl || null);
            } else if (panel.imageUrl) { setImageDataUrl(panel.imageUrl); }
            else { setImageDataUrl(null); }
        };
        loadImage();
    }, [panel.imageUrl]);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsResizing(true);
        resizeRef.current = { startX: e.clientX, startY: e.clientY, startWidth: panelWidth, startHeight: panelHeight };
    }, [panelWidth, panelHeight]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !resizeRef.current) return;
            const newWidth = Math.max(MIN_WIDTH, resizeRef.current.startWidth + (e.clientX - resizeRef.current.startX));
            const newHeight = Math.max(MIN_HEIGHT, resizeRef.current.startHeight + (e.clientY - resizeRef.current.startY));
            dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { width: newWidth, height: newHeight } });
        };
        const handleMouseUp = () => { setIsResizing(false); resizeRef.current = null; };
        if (isResizing) { document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); }
        return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
    }, [isResizing]);

    const handleGenerateImage = async () => {
        if (!panel.prompt?.trim() && panel.characterIds.length === 0) { alert('Please enter a prompt or select characters first.'); return; }
        setIsGenerating(true);
        try {
            const styleConfig = ART_STYLES.find(s => s.id === project.style);
            const stylePrompt = project.style === 'custom' ? (project.customStylePrompt || '') : (styleConfig?.prompt || '');
            const activeChars = characters.filter(c => panel.characterIds.includes(c.id));
            const charSection = activeChars.length > 0 ? `Characters: ${activeChars.map(c => buildCharacterPrompt(c)).join('; ')}.` : '';
            const config = ASPECT_CONFIGS[panel.aspectRatio];
            let initImage: string | undefined;
            if (panel.referencePanelId) {
                const refPanel = activePage.panels.find(p => p.id === panel.referencePanelId);
                if (refPanel?.imageUrl) { const id = refPanel.imageUrl.startsWith('idb://') ? refPanel.imageUrl.slice(6) : null; if (id) initImage = await getImage(id) || undefined; }
            }
            const consistencySuffix = initImage ? " Maintain strong visual and character consistency with the reference image. Same lighting, angle, style." : '';
            const fullPrompt = `${stylePrompt}. ${charSection} ${panel.prompt || ''}.${consistencySuffix}`.trim();
            let url: string | undefined;
            if (project.imageProvider === 'gemini' && project.geminiApiKey) url = await generateGeminiImage(fullPrompt, config.ratio, project.geminiApiKey, initImage, panel.referenceStrength ?? 0.7);
            else if (project.imageProvider === 'leonardo' && project.leonardoApiKey) url = await generateLeonardoImage(fullPrompt, panel.aspectRatio, project.leonardoApiKey, initImage, panel.referenceStrength ?? 0.7);
            else if (project.imageProvider === 'grok' && project.grokApiKey) url = await generateGrokImage(fullPrompt, panel.aspectRatio, project.grokApiKey, initImage, panel.referenceStrength ?? 0.7);
            else if (project.imageProvider === 'fal' && project.falApiKey) url = await generateFalFlux(fullPrompt, panel.aspectRatio, project.falApiKey, project.fluxModel || 'fal-ai/flux-pro', initImage, panel.referenceStrength ?? 0.7);
            else if (project.imageProvider === 'seaart' && project.seaartApiKey) url = await generateSeaArtImage(fullPrompt, panel.aspectRatio, project.seaartApiKey, initImage, panel.referenceStrength ?? 0.7);
            else if (project.imageProvider === 'openai' && project.openaiApiKey) url = await generateOpenAIImage(fullPrompt, panel.aspectRatio, project.openaiApiKey, initImage, panel.referenceStrength ?? 0.7);
            else throw new Error(`No API key configured for ${project.imageProvider}. Please add your API key in the sidebar.`);
            if (url) { const storedRef = await saveImage(panel.id, url); dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { imageUrl: storedRef } }); }
        } catch (err: any) { console.error('Image generation failed:', err); alert(`Generation failed: ${err.message}`); }
        finally { setIsGenerating(false); }
    };

    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { prompt: e.target.value } }); };
    const handleDelete = () => { if (confirm('Delete this frame?')) dispatch({ type: 'DELETE_PANEL', panelId: panel.id, pageId }); };
    const handleClearImage = () => { dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { imageUrl: undefined } }); setImageDataUrl(null); };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
        if (file.size > 10 * 1024 * 1024) { alert('Image must be less than 10MB'); return; }
        try { const reader = new FileReader(); reader.onload = async (event) => { const dataUrl = event.target?.result as string; if (dataUrl) { const storedRef = await saveImage(panel.id, dataUrl); dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { imageUrl: storedRef } }); } }; reader.readAsDataURL(file); }
        catch (err: any) { console.error('Image upload failed:', err); alert('Failed to upload image'); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddTextElement = (type: TextElementType) => {
        const newElement: TextElement = { id: genId(), type, content: type === 'caption' ? 'Caption text...' : type === 'phone' ? 'Text message...' : 'Click to edit...', x: 10 + Math.random() * 20, y: 10 + Math.random() * 20, width: 30, height: 15, fontSize: type === 'caption' ? 14 : 16, color: '#000000', tailStyle: type === 'thought' ? 'cloud' : type === 'dialogue' ? 'pointy' : 'none' };
        dispatch({ type: 'ADD_TEXT_ELEMENT', panelId: panel.id, element: newElement });
    };

    const handleAddDialogueLine = () => {
        const newElement: TextElement = { id: genId(), type: 'dialogue', content: '', x: -1, y: -1, width: 100, height: 10, fontSize: 14, color: '#000000', tailStyle: 'none' };
        dispatch({ type: 'ADD_TEXT_ELEMENT', panelId: panel.id, element: newElement });
    };

    const aspectConfig = ASPECT_CONFIGS[panel.aspectRatio];
    const dialogueLines = panel.textElements.filter(el => el.x === -1 && el.y === -1);
    const overlayElements = panel.textElements.filter(el => !(el.x === -1 && el.y === -1));

    return (
        <div ref={setNodeRef} style={style}
            onClick={(e) => { if (onSelect && (e.target as HTMLElement).closest('button, input, textarea, [contenteditable]') === null) onSelect(); }}
            className={`group rounded-xl border transition-all flex flex-col ${
                panelFrameStyle === 'translucent' ? 'bg-transparent border border-stone-300 shadow-sm hover:shadow-md'
                    : 'bg-paper border-2 border-stone-200 shadow-md hover:shadow-lg'
            } ${isDragging ? 'ring-2 ring-ember-500 shadow-2xl' : ''} ${isResizing ? 'cursor-nwse-resize' : ''}`}
        >
            {/* HEADER */}
            <div className={`flex items-center justify-between px-2 py-1 border-b ${
                panelFrameStyle === 'translucent' ? 'border-stone-300 bg-stone-50/50'
                    : 'border-stone-200 bg-stone-50'
            } rounded-t-xl`}>
                <div className="flex items-center gap-1.5">
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none hover:text-ember-500 transition-colors p-0.5 rounded hover:bg-stone-100" title="Drag to move">
                        <Move size={14} className="text-stone-500" />
                    </div>
                    <div className="w-5 h-5 rounded-full bg-ember-500 text-white flex items-center justify-center font-bold text-[10px]">
                        {index + 1}
                    </div>
                    <span className="text-[10px] font-body text-stone-500">{aspectConfig?.label.split(' ')[0]}</span>
                </div>
                <div className="flex items-center gap-1 relative">
                    <button 
                        onClick={() => setShowSettings(!showSettings)} 
                        className="p-1 text-stone-500 hover:text-ember-500 transition-colors" 
                        title="Settings"
                    >
                        <Settings2 size={14} />
                    </button>
                    <button onClick={handleDelete} className="p-1 text-stone-500 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={14} />
                    </button>
                    {showSettings && (
                        <PanelSettingsPopover
                            panel={panel}
                            dispatch={dispatch}
                            characters={characters}
                            activePage={activePage}
                            imageDataUrl={imageDataUrl}
                            copiedSettings={copiedSettings}
                            onCopySettings={onCopySettings}
                            onPasteSettings={onPasteSettings}
                            onAddTextElement={handleAddTextElement}
                            onPromptChange={handlePromptChange}
                            onClose={() => setShowSettings(false)}
                        />
                    )}
                </div>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

                {/* IMAGE */}
                <div className={`relative rounded-lg overflow-hidden ${aspectConfig?.class || 'aspect-video'} bg-stone-100 border border-stone-200 group`}>
                    {imageDataUrl ? (
                        <>
                            <img src={imageDataUrl} alt={`Panel ${index + 1}`} className="w-full h-full object-cover" />
                            {overlayElements.map(element => (<TextOverlay key={element.id} element={element} panelId={panel.id} dispatch={dispatch} textOverlayStyle={textOverlayStyle} />))}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={handleAddDialogueLine} className="p-1.5 bg-black/60 hover:bg-ember-500 text-white rounded-full transition-colors" title="Add dialogue line" aria-label="Add dialogue line"><Plus size={12} /></button>
                                <button onClick={handleGenerateImage} disabled={isGenerating} className="p-1.5 bg-black/60 hover:bg-ember-500 text-white rounded-full transition-colors disabled:opacity-50" title="Regenerate" aria-label="Regenerate image"><RefreshCw size={12} className={isGenerating ? 'animate-spin' : ''} /></button>
                                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 bg-black/60 hover:bg-ember-500 text-white rounded-full transition-colors" title="Upload" aria-label="Upload image"><Upload size={12} /></button>
                                <button onClick={handleClearImage} className="p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors" title="Clear" aria-label="Clear image"><Trash2 size={12} /></button>
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <ImageIcon size={32} className="text-stone-400" />
                            <div className="flex items-center gap-2">
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-body bg-ember-500 hover:bg-ember-400 text-white transition-colors"><Upload size={14} />Upload Image</button>
                                <button onClick={handleAddDialogueLine} className="p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-200 transition-colors" title="Add dialogue line" aria-label="Add dialogue line"><Plus size={16} /></button>
                            </div>
                            <span className="text-[10px] font-body text-stone-400">No image yet</span>
                        </div>
                    )}
                    {isGenerating && <PanelGenerationOverlay provider={project.imageProvider} />}
                </div>

                {/* DIALOGUE BOX (below image) */}
                {dialogueLines.length > 0 && (
                    <div className="rounded-lg border border-stone-200 bg-stone-50">
                        <div className="px-3 py-1.5 text-[10px] font-body uppercase tracking-wider border-b text-stone-500 border-stone-200">Dialogue</div>
                        <div className="p-2 space-y-1">
                            {dialogueLines.map((line) => (
                                <div key={line.id} className="flex items-start gap-1 group/line">
                                    <textarea value={line.content}
                                        onChange={(e) => dispatch({ type: 'UPDATE_TEXT_ELEMENT', panelId: panel.id, elementId: line.id, updates: { content: e.target.value } })}
                                        placeholder="CHARACTER: Dialogue text..."
                                        rows={1}
                                        className="flex-1 rounded px-2 py-1 text-xs resize-none transition-colors outline-none bg-paper border border-stone-200 text-ink placeholder-stone-400 focus:border-ember-500"
                                        onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                                    />
                                    <button onClick={() => dispatch({ type: 'DELETE_TEXT_ELEMENT', panelId: panel.id, elementId: line.id })} className="p-1 text-stone-400 hover:text-red-500 transition-colors opacity-0 group-hover/line:opacity-100 flex-shrink-0" title="Remove"><X size={12} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PROMPT - Auto-collapse */}
                {promptFocused ? (
                    <textarea 
                        value={panel.prompt || ''} 
                        onChange={handlePromptChange}
                        onBlur={() => setPromptFocused(false)}
                        placeholder="Describe this panel..." 
                        rows={4}
                        autoFocus
                        className="w-full rounded-lg px-3 py-2 text-sm resize-none transition-colors outline-none bg-stone-50 border border-ember-500 ring-1 ring-ember-500/30 text-ink placeholder-stone-400"
                    />
                ) : (
                    <div
                        onClick={() => setPromptFocused(true)}
                        className="rounded-lg px-3 py-2 text-sm font-body cursor-text bg-stone-50 border border-stone-200 text-ink hover:border-stone-300 truncate min-h-[36px] flex items-center"
                    >
                        {panel.prompt || <span className="text-stone-400">Describe this panel…</span>}
                    </div>
                )}
            </div>

            {/* GENERATE BUTTON */}
            <div className={`px-3 py-2 border-t ${panelFrameStyle === 'translucent' ? 'border-stone-300 bg-stone-50/50' : 'border-stone-200 bg-stone-50'} rounded-b-xl`}>
                <button 
                    onClick={handleGenerateImage} 
                    disabled={isGenerating || (!panel.prompt?.trim() && panel.characterIds.length === 0)}
                    className={`w-full rounded-lg text-xs font-body font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        imageDataUrl 
                            ? 'py-1.5 border border-stone-300 text-stone-600 hover:border-ember-500 hover:text-ember-500 bg-transparent' 
                            : 'py-2.5 bg-ember-500 hover:bg-ember-400 text-paper shadow-sm'
                    }`}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Generating with {project.imageProvider === 'gemini' ? 'Gemini' : project.imageProvider === 'leonardo' ? 'Leonardo' : project.imageProvider === 'grok' ? 'Grok' : project.imageProvider === 'fal' ? 'FAL' : project.imageProvider === 'seaart' ? 'SeaArt' : project.imageProvider === 'openai' ? 'OpenAI' : 'AI'}...
                        </>
                    ) : (
                        <>
                            <Sparkles size={14} />
                            {imageDataUrl ? 'Regenerate' : 'Generate'}
                        </>
                    )}
                </button>
            </div>

            {/* RESIZE HANDLE */}
            <div onMouseDown={handleResizeStart}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity text-stone-400"
                style={{ background: 'linear-gradient(135deg, transparent 50%, currentColor 50%)', borderBottomRightRadius: '0.75rem' }} />
        </div>
    );
};

export default PanelCard;
