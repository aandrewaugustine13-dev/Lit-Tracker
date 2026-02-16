import React from 'react';
import { AppState } from '../../types';
import { InkAction as Action } from '../../store/inkSlice';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../services/supabase';
import { ScriptPanel } from './sidebar/ScriptPanel';
import { NavigationPanel } from './sidebar/NavigationPanel';
import { AssetPanel } from './sidebar/AssetPanel';

interface SidebarProps {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    onOpenProjects: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ state, dispatch, onOpenProjects }) => {
    const { user, signInWithGoogle } = useAuth();
    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    const activeIssue = activeProject?.issues.find(i => i.id === state.activeIssueId);
    const activePage = activeIssue?.pages.find(p => p.id === state.activePageId);
    const typeLabel = activeProject?.issueType === 'issue' ? 'Issue' : 'Chapter';

    return (
        <aside className="w-72 bg-card border-r border-stone-200 flex flex-col overflow-hidden z-30">
            <div className="p-6 border-b border-stone-200">
                <h1 className="font-display text-3xl text-ink mb-1 text-center">Ink Tracker</h1>
                <p className="font-body text-[10px] text-stone-500 uppercase tracking-tighter text-center">Script System v1.7</p>
                
                {isSupabaseConfigured() && !user && (
                    <button
                        onClick={signInWithGoogle}
                        aria-label="Sign in with Google for cloud sync"
                        className="w-full mt-4 py-2 px-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-[10px] font-body uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2"
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
                <ScriptPanel
                    state={state}
                    dispatch={dispatch}
                    onOpenProjects={onOpenProjects}
                    activeProject={activeProject}
                />

                <NavigationPanel
                    state={state}
                    dispatch={dispatch}
                    activeProject={activeProject}
                    activeIssue={activeIssue}
                    activePage={activePage}
                    typeLabel={typeLabel}
                />
            </div>

            <AssetPanel
                activeProject={activeProject}
                dispatch={dispatch}
            />
        </aside>
    );
};

export default Sidebar;
