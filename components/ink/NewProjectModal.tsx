import React, { useState } from 'react';
import { InkAction as Action } from '../../store/inkSlice';

interface NewProjectModalProps {
    onClose: () => void;
    dispatch: React.Dispatch<Action>;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, dispatch }) => {
    const [projectTitle, setProjectTitle] = useState('');
    const [projectType, setProjectType] = useState<'comic' | 'screenplay' | 'stage-play' | 'tv-series'>('comic');

    const handleCreate = () => {
        if (!projectTitle.trim()) {
            alert('Please enter a project title');
            return;
        }
        
        dispatch({ type: 'ADD_PROJECT', title: projectTitle.trim(), projectType });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-xl flex items-center justify-center z-[600] p-8">
            <div className="w-full max-w-md bg-ink-950 border border-ink-700 rounded-2xl shadow-2xl overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-ink-700 flex items-center justify-between">
                    <div>
                        <h2 className="font-display text-3xl tracking-widest text-ember-500 uppercase">New Project</h2>
                        <p className="text-[10px] font-mono text-steel-500 mt-1 uppercase tracking-widest">Initialize Sequence</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-ink-800 hover:bg-red-500 text-steel-400 hover:text-white transition-all text-xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Project Title Input */}
                    <div>
                        <label className="block text-[10px] font-mono text-steel-400 uppercase tracking-widest mb-2">
                            Project Title
                        </label>
                        <input
                            type="text"
                            value={projectTitle}
                            onChange={(e) => setProjectTitle(e.target.value)}
                            placeholder="Enter project title..."
                            className="w-full bg-ink-950 border border-ink-700 rounded-lg px-4 py-3 text-sm text-steel-300 font-mono outline-none focus:border-ember-500 transition-colors"
                            autoFocus
                        />
                    </div>

                    {/* Project Type Dropdown */}
                    <div>
                        <label className="block text-[10px] font-mono text-steel-400 uppercase tracking-widest mb-2">
                            Project Type
                        </label>
                        <select
                            value={projectType}
                            onChange={(e) => setProjectType(e.target.value as typeof projectType)}
                            className="w-full bg-ink-950 border border-ink-700 rounded-lg px-4 py-3 text-sm text-steel-300 font-mono outline-none focus:border-ember-500 transition-colors cursor-pointer"
                        >
                            <option value="comic">Comic / Graphic Novel</option>
                            <option value="screenplay">Screenplay</option>
                            <option value="stage-play">Stage Play</option>
                            <option value="tv-series">TV Series</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-ink-700 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-ink-800 hover:bg-ink-700 text-steel-400 hover:text-steel-300 font-bold py-3 rounded-lg uppercase text-xs transition-colors border border-ink-700"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex-1 bg-ember-500 hover:bg-ember-400 text-ink-950 font-bold py-3 rounded-lg uppercase text-xs transition-colors"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewProjectModal;
