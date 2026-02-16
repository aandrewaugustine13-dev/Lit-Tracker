import React, { useEffect, useRef } from 'react';
import { ChevronDown, Link2, Unlink, MessageCircle, Cloud, Type, Smartphone, Copy, ClipboardPaste, History } from 'lucide-react';
import { Panel, Project, Character, Page, AspectRatio, TextElementType } from '../../types';
import { InkAction as Action } from '../../store/inkSlice';

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

interface PanelSettingsPopoverProps {
    panel: Panel;
    dispatch: React.Dispatch<Action>;
    characters: Character[];
    activePage: Page;
    imageDataUrl: string | null;
    copiedSettings?: { aspectRatio: AspectRatio; characterIds: string[] } | null;
    onCopySettings?: () => void;
    onPasteSettings?: () => void;
    onAddTextElement: (type: TextElementType) => void;
    onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onClose: () => void;
}

const PanelSettingsPopover: React.FC<PanelSettingsPopoverProps> = ({
    panel,
    dispatch,
    characters,
    activePage,
    imageDataUrl,
    copiedSettings,
    onCopySettings,
    onPasteSettings,
    onAddTextElement,
    onPromptChange,
    onClose,
}) => {
    const [showCharMenu, setShowCharMenu] = React.useState(false);
    const [showRefMenu, setShowRefMenu] = React.useState(false);
    const [showPromptHistory, setShowPromptHistory] = React.useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const toggleCharacter = (charId: string) => {
        const newIds = panel.characterIds.includes(charId)
            ? panel.characterIds.filter(id => id !== charId)
            : [...panel.characterIds, charId];
        dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { characterIds: newIds } });
    };

    const selectedChars = characters.filter(c => panel.characterIds.includes(c.id));

    return (
        <div 
            ref={popoverRef}
            className="absolute right-0 top-full mt-1.5 z-[200] w-72 bg-card border border-stone-200 shadow-2xl rounded-xl p-4 space-y-4"
        >
            {/* Character selector */}
            <div className="relative">
                <label className="block text-[10px] font-body uppercase tracking-wider mb-1.5 text-stone-500">Characters</label>
                {characters.length > 0 ? (
                    <>
                        <button 
                            onClick={() => setShowCharMenu(!showCharMenu)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-body flex items-center justify-between transition-colors ${
                                selectedChars.length > 0 
                                    ? 'bg-ink/10 border border-stone-400/30 text-ink' 
                                    : 'bg-stone-50 border border-stone-200 text-stone-600 hover:bg-stone-100'
                            }`}
                        >
                            <span>{selectedChars.length > 0 ? selectedChars.map(c => c.name).join(', ') : 'Select characters...'}</span>
                            <ChevronDown size={14} />
                        </button>
                        {showCharMenu && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border py-1 max-h-48 overflow-y-auto bg-card border-stone-200">
                                {characters.map(char => {
                                    const isSelected = panel.characterIds.includes(char.id);
                                    const appearanceSummary = getAppearanceSummary(char);
                                    return (
                                        <button 
                                            key={char.id} 
                                            onClick={() => toggleCharacter(char.id)}
                                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                                isSelected ? 'bg-ink/20' : 'hover:bg-stone-100'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`w-3 h-3 rounded border flex-shrink-0 ${
                                                    isSelected ? 'bg-ink border-stone-400' : 'border-stone-300'
                                                }`} />
                                                <span className={`font-bold ${isSelected ? 'text-ink' : 'text-ink'}`}>
                                                    {char.name}
                                                </span>
                                            </div>
                                            {appearanceSummary && (
                                                <p className="mt-1 ml-5 text-[10px] leading-tight text-stone-500">
                                                    {appearanceSummary}
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {selectedChars.length > 0 && (
                            <div className="mt-2 space-y-1 text-[10px] text-stone-600">
                                {selectedChars.map(char => {
                                    const summary = getAppearanceSummary(char);
                                    return summary ? (
                                        <div key={char.id} className="flex gap-1">
                                            <span className="font-bold text-ember-500">{char.name}:</span>
                                            <span className="truncate">{summary}</span>
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-xs text-stone-500">No characters defined</p>
                )}
            </div>

            {/* Reference panel linker */}
            {activePage.panels.length > 1 && (
                <div className="relative">
                    <label className="block text-[10px] font-body uppercase tracking-wider mb-1.5 text-stone-500">Reference Panel</label>
                    <button 
                        onClick={() => setShowRefMenu(!showRefMenu)} 
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-body flex items-center justify-between transition-colors ${
                            panel.referencePanelId 
                                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-600' 
                                : 'bg-stone-50 border border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <Link2 size={12} />
                            {panel.referencePanelId 
                                ? `Panel ${activePage.panels.findIndex(p => p.id === panel.referencePanelId) + 1}` 
                                : 'Link to previous...'}
                        </span>
                        <ChevronDown size={14} />
                    </button>
                    {showRefMenu && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border py-1 max-h-48 overflow-y-auto bg-card border-stone-200">
                            <button 
                                onClick={() => {
                                    dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { referencePanelId: undefined } });
                                    setShowRefMenu(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                                    !panel.referencePanelId ? 'bg-ink/20 text-ink' : 'text-stone-600 hover:bg-stone-100'
                                }`}
                            >
                                <Unlink size={12} />
                                <span>No reference</span>
                            </button>
                            {activePage.panels.filter(p => p.id !== panel.id && p.imageUrl).map((refPanel) => {
                                const panelNum = activePage.panels.findIndex(p => p.id === refPanel.id) + 1;
                                return (
                                    <button 
                                        key={refPanel.id} 
                                        onClick={() => {
                                            dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { referencePanelId: refPanel.id } });
                                            setShowRefMenu(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                                            panel.referencePanelId === refPanel.id 
                                                ? 'bg-cyan-500/20 text-cyan-600' 
                                                : 'text-stone-600 hover:bg-stone-100'
                                        }`}
                                    >
                                        <Link2 size={12} />
                                        <span className="font-bold">Panel {panelNum}</span>
                                        <span className="opacity-60 text-[10px] truncate flex-1">
                                            {refPanel.prompt?.slice(0, 30) || 'No prompt'}...
                                        </span>
                                    </button>
                                );
                            })}
                            {activePage.panels.filter(p => p.id !== panel.id && p.imageUrl).length === 0 && (
                                <div className="px-3 py-2 text-xs italic text-stone-500">No other panels with images yet</div>
                            )}
                        </div>
                    )}
                    {panel.referencePanelId && (
                        <div className="mt-2 px-1">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-body uppercase text-stone-500">Consistency Strength</span>
                                <span className="text-[9px] font-body text-stone-600">
                                    {Math.round((panel.referenceStrength || 0.7) * 100)}%
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="0.1" 
                                max="1" 
                                step="0.1" 
                                value={panel.referenceStrength || 0.7}
                                onChange={(e) => dispatch({ 
                                    type: 'UPDATE_PANEL', 
                                    panelId: panel.id, 
                                    updates: { referenceStrength: parseFloat(e.target.value) } 
                                })}
                                className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
                            />
                            <div className="flex justify-between text-[8px] font-body mt-0.5 text-stone-400">
                                <span>Creative</span>
                                <span>Consistent</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Overlay tools (only shown when image exists) */}
            {imageDataUrl && (
                <div>
                    <label className="block text-[10px] font-body uppercase tracking-wider mb-1.5 text-stone-500">Image Overlays</label>
                    <div className="grid grid-cols-2 gap-1">
                        <button 
                            onClick={() => onAddTextElement('dialogue')} 
                            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-body transition-colors bg-stone-100 text-stone-600 hover:bg-stone-200" 
                            title="Add dialogue bubble"
                        >
                            <MessageCircle size={12} />Bubble
                        </button>
                        <button 
                            onClick={() => onAddTextElement('thought')} 
                            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-body transition-colors bg-stone-100 text-stone-600 hover:bg-stone-200" 
                            title="Add thought cloud"
                        >
                            <Cloud size={12} />Thought
                        </button>
                        <button 
                            onClick={() => onAddTextElement('caption')} 
                            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-body transition-colors bg-stone-100 text-stone-600 hover:bg-stone-200" 
                            title="Add caption box"
                        >
                            <Type size={12} />Caption
                        </button>
                        <button 
                            onClick={() => onAddTextElement('phone')} 
                            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-body transition-colors bg-stone-100 text-stone-600 hover:bg-stone-200" 
                            title="Add phone/text"
                        >
                            <Smartphone size={12} />Phone
                        </button>
                    </div>
                </div>
            )}

            {/* Copy/Paste settings */}
            <div>
                <label className="block text-[10px] font-body uppercase tracking-wider mb-1.5 text-stone-500">Settings</label>
                <div className="flex items-center gap-2">
                    {onCopySettings && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onCopySettings();
                            }} 
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-body transition-colors bg-stone-100 text-stone-600 hover:bg-stone-200" 
                            title="Copy panel settings"
                        >
                            <Copy size={12} />Copy
                        </button>
                    )}
                    {onPasteSettings && copiedSettings && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onPasteSettings();
                            }} 
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-body transition-colors bg-stone-100 text-stone-600 hover:bg-stone-200" 
                            title="Paste panel settings"
                        >
                            <ClipboardPaste size={12} />Paste
                        </button>
                    )}
                </div>
            </div>

            {/* Prompt History */}
            {panel.promptHistory && panel.promptHistory.length > 0 && (
                <div className="relative">
                    <label className="block text-[10px] font-body uppercase tracking-wider mb-1.5 text-stone-500">History</label>
                    <button 
                        onClick={() => setShowPromptHistory(!showPromptHistory)} 
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-body transition-colors bg-stone-100 text-stone-600 hover:bg-stone-200"
                    >
                        <History size={12} />View ({panel.promptHistory.length})
                    </button>
                    {showPromptHistory && (
                        <div className="mt-1 rounded-lg border py-1 max-h-48 overflow-y-auto bg-card border-stone-200">
                            {[...panel.promptHistory].reverse().map((historyPrompt, idx) => {
                                const historyLength = panel.promptHistory?.length || 0;
                                const versionsAgo = historyLength - idx;
                                return (
                                    <button 
                                        key={idx} 
                                        onClick={() => {
                                            onPromptChange({ target: { value: historyPrompt } } as React.ChangeEvent<HTMLTextAreaElement>);
                                            setShowPromptHistory(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs transition-colors text-stone-700 hover:bg-stone-100"
                                    >
                                        <div className="text-[10px] mb-1 text-stone-500">
                                            {versionsAgo} version{versionsAgo === 1 ? '' : 's'} ago
                                        </div>
                                        <div className="line-clamp-3">{historyPrompt}</div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PanelSettingsPopover;
