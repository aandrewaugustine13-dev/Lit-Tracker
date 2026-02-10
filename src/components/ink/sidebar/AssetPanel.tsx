import React from 'react';
import { Project, PanelFrameStyle, TextOverlayStyle } from '../../../types';
import { InkAction as Action } from '../../../store/inkSlice';
import { ART_STYLES } from '../../../constants';
import { STYLE_GROUPS } from './ScriptPanel';

interface AssetPanelProps {
    activeProject: Project | undefined;
    dispatch: React.Dispatch<Action>;
}

export const AssetPanel: React.FC<AssetPanelProps> = ({ activeProject, dispatch }) => {
    return (
        <>
            {/* Art Style selector */}
            <div className="p-6 border-t border-ink-700 bg-ink-950 space-y-3">
                <h2 className="text-xs font-mono text-steel-500 uppercase tracking-widest px-1">Art Style</h2>
                <select
                    value={activeProject?.style}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        dispatch({ type: 'UPDATE_PROJECT', id: activeProject!.id, updates: { style: e.target.value } });
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

                {/* Custom style input */}
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
        </>
    );
};
