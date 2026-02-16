import React, { useMemo, useState } from 'react';
import { useLitStore } from '../../store';
import { LoreEntry, LoreType } from '../../types';
import { LORE_TYPE_CONFIG } from '../../utils/loreConfig';
import LoreCard from './LoreCard';
import LoreEditor from './LoreEditor';
import { Search, Plus, BookOpen, Sparkles, FolderOpen, Trash2, AlertTriangle } from 'lucide-react';
import { genId } from '../../utils/helpers';
import { ScriptExtractionTrigger, ExtractionPreviewModal } from '../parser';
import NewProjectModal from '../ink/NewProjectModal';

const LoreModule: React.FC = () => {
  const {
    loreEntries, loreSearchTerm, setLoreSearchTerm,
    loreFilterType, setLoreFilterType,
    inkState, inkDispatch,
  } = useLitStore();
  
  const deleteProjectCascade = useLitStore((s) => s.deleteProjectCascade);
  const deleteAllProjects = useLitStore((s) => s.deleteAllProjects);
  const parserStatus = useLitStore((s) => s.parserStatus);
  const currentProposal = useLitStore((s) => s.currentProposal);
  const setCurrentProposal = useLitStore((s) => s.setCurrentProposal);

  const [editingEntry, setEditingEntry] = useState<LoreEntry | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showScriptExtraction, setShowScriptExtraction] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const activeProject = inkState.projects.find(p => p.id === inkState.activeProjectId);

  const filtered = useMemo(() => {
    return loreEntries.filter(e => {
      const term = loreSearchTerm.toLowerCase();
      const matchesSearch = !term ||
        e.name.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term) ||
        e.tags.some(t => t.toLowerCase().includes(term));
      const matchesFilter = loreFilterType === 'all' || e.type === loreFilterType;
      return matchesSearch && matchesFilter;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [loreEntries, loreSearchTerm, loreFilterType]);

  const handleCreate = () => {
    setEditingEntry(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (entry: LoreEntry) => {
    setEditingEntry(entry);
    setIsEditorOpen(true);
  };

  // Stats
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    loreEntries.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });
    return counts;
  }, [loreEntries]);

  const handleDeleteProject = () => {
    if (!activeProject) return;
    deleteProjectCascade(activeProject.id);
    setShowDeleteProjectConfirm(false);
  };

  const handleDeleteAllProjects = () => {
    deleteAllProjects();
    setShowDeleteAllConfirm(false);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-paper">
      {/* Project Management Bar */}
      {activeProject && (
        <div className="flex-shrink-0 bg-gradient-to-r from-lore-500/10 to-lore-600/10 border-b border-lore-200">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-lore-500/20 flex items-center justify-center">
                  <FolderOpen size={16} className="text-lore-600" />
                </div>
                <div>
                  <p className="text-xs font-body text-stone-500 uppercase tracking-wider">Active Project</p>
                  <h2 className="font-display text-lg font-bold text-ink">{activeProject.title}</h2>
                </div>
              </div>
              <button
                onClick={() => setShowProjectSelector(!showProjectSelector)}
                className="text-xs text-lore-600 hover:text-lore-700 font-bold uppercase tracking-wider hover:underline transition-colors"
              >
                Switch Project
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="text-xs bg-white hover:bg-stone-50 text-lore-600 px-3 py-1.5 rounded-lg border border-lore-200 font-bold uppercase tracking-wider transition-all"
              >
                New Project
              </button>
              <button
                onClick={() => setShowDeleteProjectConfirm(!showDeleteProjectConfirm)}
                className="text-xs bg-white hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-200 font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
              >
                <Trash2 size={12} />
                Delete
              </button>
              <button
                onClick={() => setShowDeleteAllConfirm(!showDeleteAllConfirm)}
                className="text-xs bg-white hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-200 font-bold uppercase tracking-wider transition-all"
                title="Delete all projects"
              >
                <AlertTriangle size={14} />
              </button>
            </div>
          </div>
          
          {/* Project Selector Dropdown */}
          {showProjectSelector && inkState.projects.length > 1 && (
            <div className="px-6 pb-4">
              <div className="bg-white rounded-lg border border-lore-200 p-2 max-h-64 overflow-y-auto">
                {inkState.projects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      inkDispatch({ type: 'SET_ACTIVE_PROJECT', id: proj.id });
                      setShowProjectSelector(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                      proj.id === activeProject.id
                        ? 'bg-lore-500/10 text-lore-700 font-bold'
                        : 'hover:bg-stone-50 text-ink'
                    }`}
                  >
                    <div className="font-display text-sm">{proj.title}</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {proj.issues.length} {proj.issueType === 'issue' ? 'issues' : 'chapters'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Delete Project Confirmation */}
          {showDeleteProjectConfirm && activeProject && (
            <div className="px-6 pb-4">
              <div className="bg-red-50 rounded-lg border-2 border-red-200 p-4">
                <div className="flex items-start gap-3">
                  <Trash2 size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-display text-sm font-bold text-red-900 mb-1">Delete Project</h3>
                    <p className="text-xs text-red-800 mb-3">
                      Are you sure you want to delete "{activeProject.title}"? This will remove all associated data including issues, pages, and linked characters. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteProject}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-all"
                      >
                        Delete Project
                      </button>
                      <button
                        onClick={() => setShowDeleteProjectConfirm(false)}
                        className="text-xs bg-white hover:bg-stone-100 text-stone-700 px-4 py-2 rounded-lg border border-stone-200 font-bold uppercase tracking-wider transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Delete All Confirmation */}
          {showDeleteAllConfirm && (
            <div className="px-6 pb-4">
              <div className="bg-red-50 rounded-lg border-2 border-red-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-display text-sm font-bold text-red-900 mb-1">Danger Zone</h3>
                    <p className="text-xs text-red-800 mb-3">
                      This will permanently delete all projects, characters, lore, and images. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAllProjects}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-all"
                      >
                        Delete Everything
                      </button>
                      <button
                        onClick={() => setShowDeleteAllConfirm(false)}
                        className="text-xs bg-white hover:bg-stone-100 text-stone-700 px-4 py-2 rounded-lg border border-stone-200 font-bold uppercase tracking-wider transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 border-b border-stone-200 bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5 flex-1">
            {/* Module identity */}
            <div className="hidden md:flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-display font-medium text-ink tracking-tight">Lore Tracker</h1>
              </div>
              <p className="text-[11px] font-display font-semibold text-stone-500 uppercase tracking-[0.14em]">
                {loreEntries.length} entr{loreEntries.length !== 1 ? 'ies' : 'y'} cataloged
              </p>
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-lore-400 transition-colors" size={15} />
              <input
                type="text"
                placeholder="Search lore entries, tags..."
                value={loreSearchTerm}
                onChange={(e) => setLoreSearchTerm(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded pl-9 pr-4 py-2 text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-lore-500/20 transition-all"
              />
            </div>

            {/* Type filter pills */}
            <div className="hidden md:flex border border-stone-200 rounded overflow-hidden">
              <button
                onClick={() => setLoreFilterType('all')}
                className={`px-3 py-1.5 text-xs font-body font-medium border-r border-stone-200 transition-all ${
                  loreFilterType === 'all' ? 'bg-stone-100 text-ink font-semibold' : 'bg-white text-stone-500 hover:text-ink'
                }`}
              >
                All
              </button>
              {Object.values(LoreType).map(t => {
                const cfg = LORE_TYPE_CONFIG[t];
                const count = typeCounts[t] || 0;
                return (
                  <button
                    key={t}
                    onClick={() => setLoreFilterType(t)}
                    className={`px-3 py-1.5 text-xs font-body font-medium border-r border-stone-200 last:border-r-0 transition-all ${
                      loreFilterType === t ? 'bg-stone-100 text-ink font-semibold' : 'bg-white text-stone-500 hover:text-ink'
                    }`}
                  >
                    {cfg.label}
                    {count > 0 && <span className="hidden lg:inline ml-1">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScriptExtraction(true)}
              className="bg-transparent text-ink border border-stone-200 hover:border-stone-400 hover:bg-stone-50 rounded font-body font-semibold text-sm px-4 py-2 flex items-center gap-2 transition-all"
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">Extract from Script</span>
            </button>
            <button
              onClick={handleCreate}
              className="bg-ink text-white hover:bg-stone-800 rounded font-body font-semibold text-sm px-5 py-2 flex items-center gap-2 transition-all"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New Entry</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile filter */}
      <div className="md:hidden px-5 py-2 border-b border-stone-200 bg-stone-50">
        <select
          value={loreFilterType}
          onChange={(e) => setLoreFilterType(e.target.value as LoreType | 'all')}
          className="w-full bg-white border border-stone-200 rounded px-3 py-2 text-sm text-ink cursor-pointer"
        >
          <option value="all">All Types</option>
          {Object.values(LoreType).map(t => (
            <option key={t} value={t}>{LORE_TYPE_CONFIG[t].label} ({typeCounts[t] || 0})</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-8">
        {loreEntries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-20 animate-fade-in">
            <div className="w-20 h-20 bg-lore-900/30 border border-lore-500/20 rounded-lg flex items-center justify-center mb-6 text-lore-400">
              <BookOpen size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-ink mb-3">Lore Tracker is Empty</h2>
            <p className="text-stone-600 mb-8 leading-relaxed text-sm">
              Build your universe from the ground up. Factions, locations, events, concepts, artifacts, and canon rules — everything lives here.
            </p>
            <button
              onClick={handleCreate}
              className="bg-ink hover:bg-stone-800 text-white px-8 py-3 rounded-xl font-bold transition-all text-sm "
            >
              Create First Entry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <p className="text-stone-500">No entries matching your filter</p>
            <button onClick={() => { setLoreSearchTerm(''); setLoreFilterType('all'); }} className="mt-3 text-lore-400 hover:underline text-xs font-bold uppercase tracking-widest">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
            {filtered.map(entry => (
              <LoreCard key={entry.id} entry={entry} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      {isEditorOpen && (
        <LoreEditor entry={editingEntry} onClose={() => setIsEditorOpen(false)} />
      )}
      
      {/* Script Extraction Trigger */}
      {showScriptExtraction && (
        <ScriptExtractionTrigger onClose={() => setShowScriptExtraction(false)} />
      )}
      
      {/* Extraction Preview Modal */}
      {parserStatus === 'awaiting-review' && currentProposal && (
        <ExtractionPreviewModal onClose={() => setCurrentProposal(null)} />
      )}
      
      {/* New Project Modal */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          dispatch={inkDispatch}
        />
      )}
    </div>
  );
};

export default LoreModule;
