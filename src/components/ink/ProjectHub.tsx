import React, { useState, useEffect } from 'react';
import { AppState } from '../../types';
import { InkAction as Action } from '../../store/inkSlice';
import { Icons } from '../../constants';
import NewProjectModal from './NewProjectModal';
import EmptyState from './EmptyState';
import { useLitStore } from '../../store';

interface ProjectHubProps {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    onClose: () => void;
}

const ProjectHub: React.FC<ProjectHubProps> = ({ state, dispatch, onClose }) => {
    const deleteProjectCascade = useLitStore((s) => s.deleteProjectCascade);
    const deleteAllProjects = useLitStore((s) => s.deleteAllProjects);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [localGeminiKey, setLocalGeminiKey] = useState<string>('');
    const [localLeonardoKey, setLocalLeonardoKey] = useState<string>('');
    const [localGrokKey, setLocalGrokKey] = useState<string>('');
    const [localFalKey, setLocalFalKey] = useState<string>('');
    const [localSeaArtKey, setLocalSeaArtKey] = useState<string>('');
    const [localOpenAIKey, setLocalOpenAIKey] = useState<string>('');

    useEffect(() => {
        if (editingId) {
            const proj = state.projects.find(p => p.id === editingId);
            setLocalGeminiKey(proj?.geminiApiKey || '');
            setLocalLeonardoKey(proj?.leonardoApiKey || '');
            setLocalGrokKey(proj?.grokApiKey || '');
            setLocalFalKey(proj?.falApiKey || '');
            setLocalSeaArtKey(proj?.seaartApiKey || '');
            setLocalOpenAIKey(proj?.openaiApiKey || '');
        }
    }, [editingId, state.projects]);

    return (
        <div className="fixed inset-0 z-[500] bg-black/10 flex items-center justify-center p-8 animate-fade-in">
        <div className="max-w-5xl w-full bg-paper border border-stone-200 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-10 border-b border-stone-200 flex items-center justify-between">
        <div>
        <h2 className="font-display text-5xl tracking-widest text-ink uppercase text-center">Archive</h2>
        <p className="font-body text-xs text-ember-500 mt-2 tracking-[0.3em] uppercase text-center">Storyboard Management</p>
        </div>
        <button
        onClick={onClose}
        className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 hover:text-red-500 transition-all"
        >
        <Icons.X />
        </button>
        </div>

        <div className="p-10 overflow-y-auto">
        {state.projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
                <EmptyState
                    variant="projects"
                    onAction={() => setShowNewProjectModal(true)}
                    actionLabel="Create First Project"
                />
            </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {state.projects.map(proj => (
            <div
            key={proj.id}
            onClick={() => { dispatch({ type: 'SET_ACTIVE_PROJECT', id: proj.id }); onClose(); }}
            className={`p-8 rounded-sm border-2 cursor-pointer transition-all group relative overflow-hidden flex flex-col ${
                state.activeProjectId === proj.id
                ? 'border-stone-400 bg-stone-50 ring-4 ring-ink/10'
                : 'border-stone-200 hover:border-stone-300 bg-card'
            }`}
            >
            <div className="relative z-10 flex-1">
            <div className="flex justify-between items-start">
            <h3 className="font-display text-3xl text-ink transition-colors mb-2 uppercase truncate pr-4">
            {proj.title}
            </h3>
            <button
            onClick={(e) => { e.stopPropagation(); setEditingId(proj.id === editingId ? null : proj.id); }}
            className={`p-2 rounded-full border transition-all flex-shrink-0 ${
                editingId === proj.id ? 'bg-ink text-white border-ink' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-100'
            }`}
            >
            <Icons.Edit />
            </button>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-body text-stone-500 uppercase tracking-widest">
            <span>{proj.issues.reduce((acc, i) => acc + i.pages.length, 0)} Pages</span>
            <div className="w-1 h-1 rounded-full bg-stone-300"></div>
            <span>{proj?.characters?.length || 0} Cast</span>
            </div>
            </div>

            <div className="mt-6 flex justify-between items-center relative z-10">
            <span className={`text-[10px] font-body px-3 py-1 rounded-full border uppercase ${
                proj.imageProvider === 'gemini' ? 'bg-blue-600/20 text-blue-400 border-blue-600/50' :
                proj.imageProvider === 'leonardo' ? 'bg-orange-600/20 text-orange-400 border-orange-600/50' :
                proj.imageProvider === 'grok' ? 'bg-gray-600/20 text-gray-400 border-gray-600/50' :
                proj.imageProvider === 'fal' ? 'bg-ink/10 text-ink border-stone-300' :
                proj.imageProvider === 'seaart' ? 'bg-pink-600/20 text-pink-400 border-pink-600/50' :
                proj.imageProvider === 'openai' ? 'bg-green-600/20 text-green-400 border-green-600/50' :
                'bg-stone-100 text-stone-600 border-stone-200'
            }`}>
            {proj.imageProvider}
            </span>
            <button
            onClick={(e) => {
                e.stopPropagation();
                if(confirm('Delete Project?')) deleteProjectCascade(proj.id);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
            >
            <Icons.Trash />
            </button>
            </div>

            {editingId === proj.id && (
                <div onClick={e => e.stopPropagation()} className="mt-6 p-4 bg-white rounded-lg border border-stone-200 space-y-4 animate-fade-in shadow-2xl">
                <div>
                <label className="text-[9px] font-body text-stone-600 uppercase block mb-2">Image Provider</label>
                <div className="grid grid-cols-2 gap-1.5">
                <button
                onClick={() => dispatch({ type: 'UPDATE_PROJECT', id: proj.id, updates: { imageProvider: 'gemini' } })}
                className={`text-[10px] font-body py-2 rounded border transition-all ${proj.imageProvider === 'gemini' ? 'bg-ink text-white border-ink font-bold' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-100'}`}
                >
                GEMINI
                </button>
                <button
                onClick={() => dispatch({ type: 'UPDATE_PROJECT', id: proj.id, updates: { imageProvider: 'leonardo' } })}
                className={`text-[10px] font-body py-2 rounded border transition-all ${proj.imageProvider === 'leonardo' ? 'bg-ink text-white border-ink font-bold' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-100'}`}
                >
                LEONARDO
                </button>
                <button
                onClick={() => dispatch({ type: 'UPDATE_PROJECT', id: proj.id, updates: { imageProvider: 'grok' } })}
                className={`text-[10px] font-body py-2 rounded border transition-all ${proj.imageProvider === 'grok' ? 'bg-ink text-white border-ink font-bold' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-100'}`}
                >
                GROK
                </button>
                <button
                onClick={() => dispatch({ type: 'UPDATE_PROJECT', id: proj.id, updates: { imageProvider: 'fal' } })}
                className={`text-[10px] font-body py-2 rounded border transition-all ${proj.imageProvider === 'fal' ? 'bg-ink text-white border-ink font-bold' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-100'}`}
                >
                FAL
                </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <button
                onClick={() => dispatch({ type: 'UPDATE_PROJECT', id: proj.id, updates: { imageProvider: 'seaart' } })}
                className={`text-[10px] font-body py-2 rounded border transition-all ${proj.imageProvider === 'seaart' ? 'bg-ink text-white border-ink font-bold' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-100'}`}
                >
                SEAART
                </button>
                <button
                onClick={() => dispatch({ type: 'UPDATE_PROJECT', id: proj.id, updates: { imageProvider: 'openai' } })}
                className={`text-[10px] font-body py-2 rounded border transition-all ${proj.imageProvider === 'openai' ? 'bg-ink text-white border-ink font-bold' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-100'}`}
                >
                OPENAI
                </button>
                </div>
                </div>

                {/* API Key input for selected provider */}
                <div className="mt-3 p-3 bg-paper rounded-lg border border-stone-200 space-y-2">
                <label className="block text-[9px] font-body text-stone-600 uppercase mb-1">
                {proj.imageProvider === 'gemini' ? 'Gemini' :
                 proj.imageProvider === 'leonardo' ? 'Leonardo' :
                 proj.imageProvider === 'grok' ? 'Grok (xAI)' :
                 proj.imageProvider === 'fal' ? 'FAL' :
                 proj.imageProvider === 'seaart' ? 'SeaArt' :
                 proj.imageProvider === 'openai' ? 'OpenAI' : ''} API Key
                </label>
                <div className="flex gap-2">
                <input
                type="password"
                placeholder="Enter API key..."
                value={
                    proj.imageProvider === 'gemini' ? localGeminiKey :
                    proj.imageProvider === 'leonardo' ? localLeonardoKey :
                    proj.imageProvider === 'grok' ? localGrokKey :
                    proj.imageProvider === 'fal' ? localFalKey :
                    proj.imageProvider === 'seaart' ? localSeaArtKey :
                    proj.imageProvider === 'openai' ? localOpenAIKey : ''
                }
                onChange={e => {
                    if (proj.imageProvider === 'gemini') setLocalGeminiKey(e.target.value);
                    else if (proj.imageProvider === 'leonardo') setLocalLeonardoKey(e.target.value);
                    else if (proj.imageProvider === 'grok') setLocalGrokKey(e.target.value);
                    else if (proj.imageProvider === 'fal') setLocalFalKey(e.target.value);
                    else if (proj.imageProvider === 'seaart') setLocalSeaArtKey(e.target.value);
                    else if (proj.imageProvider === 'openai') setLocalOpenAIKey(e.target.value);
                }}
                className="flex-1 bg-white border border-stone-200 rounded px-3 py-2 text-xs text-ink font-body outline-none focus:border-stone-400"
                />
                <button
                onClick={() => {
                    if (proj.imageProvider === 'gemini' && localGeminiKey.trim()) {
                        dispatch({ type: 'UPDATE_PROJECT_GEMINI_KEY', projectId: proj.id, apiKey: localGeminiKey.trim() });
                        alert('Gemini Key saved!');
                    } else if (proj.imageProvider === 'leonardo' && localLeonardoKey.trim()) {
                        dispatch({ type: 'UPDATE_PROJECT_LEONARDO_KEY', projectId: proj.id, apiKey: localLeonardoKey.trim() });
                        alert('Leonardo Key saved!');
                    } else if (proj.imageProvider === 'grok' && localGrokKey.trim()) {
                        dispatch({ type: 'UPDATE_PROJECT_GROK_KEY', projectId: proj.id, apiKey: localGrokKey.trim() });
                        alert('Grok Key saved!');
                    } else if (proj.imageProvider === 'fal' && localFalKey.trim()) {
                        dispatch({ type: 'UPDATE_PROJECT_FAL_KEY', projectId: proj.id, apiKey: localFalKey.trim() });
                        alert('FAL Key saved!');
                    } else if (proj.imageProvider === 'seaart' && localSeaArtKey.trim()) {
                        dispatch({ type: 'UPDATE_PROJECT_SEAART_KEY', projectId: proj.id, apiKey: localSeaArtKey.trim() });
                        alert('SeaArt Key saved!');
                    } else if (proj.imageProvider === 'openai' && localOpenAIKey.trim()) {
                        dispatch({ type: 'UPDATE_PROJECT_OPENAI_KEY', projectId: proj.id, apiKey: localOpenAIKey.trim() });
                        alert('OpenAI Key saved!');
                    }
                }}
                className="bg-ink hover:bg-stone-800 text-white font-bold px-4 py-2 rounded uppercase text-[9px] transition-colors"
                >
                Save
                </button>
                </div>
                {proj.imageProvider === 'gemini' ? (
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[8px] text-stone-500 italic hover:underline hover:text-stone-700 cursor-pointer transition-colors mt-1 block"
                    >
                        Get key from ai.google.dev
                    </a>
                ) : proj.imageProvider === 'leonardo' ? (
                    <a 
                        href="https://leonardo.ai/settings" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[8px] text-stone-500 italic hover:underline hover:text-stone-700 cursor-pointer transition-colors mt-1 block"
                    >
                        Get key from leonardo.ai
                    </a>
                ) : proj.imageProvider === 'grok' ? (
                    <a 
                        href="https://console.x.ai" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[8px] text-stone-500 italic hover:underline hover:text-stone-700 cursor-pointer transition-colors mt-1 block"
                    >
                        Get key from console.x.ai (experimental)
                    </a>
                ) : proj.imageProvider === 'fal' ? (
                    <a 
                        href="https://fal.ai/dashboard/keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[8px] text-stone-500 italic hover:underline hover:text-stone-700 cursor-pointer transition-colors mt-1 block"
                    >
                        Get key from fal.ai
                    </a>
                ) : proj.imageProvider === 'seaart' ? (
                    <a 
                        href="https://seaart.ai/api" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[8px] text-stone-500 italic hover:underline hover:text-stone-700 cursor-pointer transition-colors mt-1 block"
                    >
                        Get key from seaart.ai/api
                    </a>
                ) : proj.imageProvider === 'openai' ? (
                    <a 
                        href="https://platform.openai.com/api-keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[8px] text-stone-500 italic hover:underline hover:text-stone-700 cursor-pointer transition-colors mt-1 block"
                    >
                        Get key from platform.openai.com
                    </a>
                ) : null}
                </div>
                </div>
            )}
            </div>
        ))}

        <button
        onClick={() => setShowNewProjectModal(true)}
        className="p-8 rounded-sm border-2 border-dashed border-stone-200 hover:border-stone-400 hover:bg-stone-50 flex flex-col items-center justify-center gap-6 text-stone-400 hover:text-ink transition-all group min-h-[220px]"
        >
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center transition-transform">
        <Icons.Plus />
        </div>
        <span className="font-display text-2xl uppercase tracking-widest text-center">Initialize Sequence</span>
        </button>
        </div>
        )}

        {state.projects.length > 0 && (
          <div className="px-10 pb-6 border-t border-stone-200 pt-6">
            <button
              onClick={() => {
                if (confirm('⚠️ DELETE ALL PROJECTS?\n\nThis will permanently remove ALL projects, characters, lore entries, locations, timeline events, and cached images.\n\nThis cannot be undone.')) {
                  if (confirm('Are you absolutely sure? Type-level confirmation: this nukes EVERYTHING.')) {
                    deleteAllProjects();
                    onClose();
                  }
                }
              }}
              className="w-full py-3 px-4 rounded border-2 border-red-300 text-red-500 hover:bg-red-50 hover:border-red-500 transition-all font-display text-xs uppercase tracking-widest"
            >
              🔥 Delete All Projects
            </button>
          </div>
        )}
        </div>
        </div>
        {showNewProjectModal && <NewProjectModal onClose={() => setShowNewProjectModal(false)} dispatch={dispatch} />}
        </div>
    );
};

export default ProjectHub;
