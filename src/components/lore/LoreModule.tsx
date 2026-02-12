import React, { useMemo, useState } from 'react';
import { useLitStore } from '../../store';
import { LoreEntry, LoreType } from '../../types';
import { LORE_TYPE_CONFIG } from '../../utils/loreConfig';
import LoreCard from './LoreCard';
import LoreEditor from './LoreEditor';
import { Search, Plus, BookOpen, Sparkles } from 'lucide-react';
import { genId } from '../../utils/helpers';
import { ScriptExtractionTrigger, ExtractionPreviewModal } from '../parser';

const LoreModule: React.FC = () => {
  const {
    loreEntries, loreSearchTerm, setLoreSearchTerm,
    loreFilterType, setLoreFilterType,
  } = useLitStore();
  
  const parserStatus = useLitStore((s) => s.parserStatus);
  const currentProposal = useLitStore((s) => s.currentProposal);
  const setCurrentProposal = useLitStore((s) => s.setCurrentProposal);

  const [editingEntry, setEditingEntry] = useState<LoreEntry | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showScriptExtraction, setShowScriptExtraction] = useState(false);

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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-paper">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-stone-200 bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5 flex-1">
            {/* Module identity */}
            <div className="hidden md:flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-lore-500" />
                <h1 className="text-lg font-display font-bold text-ink tracking-tight">Lore Tracker</h1>
              </div>
              <p className="text-[9px] font-body text-stone-500 uppercase tracking-[0.15em] pl-4">
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
                className="w-full bg-white border border-stone-200 rounded-lg pl-9 pr-4 py-2 text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-lore-500/20 transition-all"
              />
            </div>

            {/* Type filter pills */}
            <div className="hidden md:flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-lg p-0.5">
              <button
                onClick={() => setLoreFilterType('all')}
                className={`px-2.5 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                  loreFilterType === 'all' ? 'bg-lore-500/15 text-lore-400' : 'text-stone-600 hover:text-ink'
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
                    className={`px-2 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                      loreFilterType === t ? `${cfg.bgColor} ${cfg.color}` : 'text-stone-600 hover:text-ink'
                    }`}
                  >
                    {cfg.icon}
                    {count > 0 && <span className="hidden lg:inline">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScriptExtraction(true)}
              className="ml-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all active:scale-95 text-sm"
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">Extract from Script</span>
            </button>
            <button
              onClick={handleCreate}
              className="ml-2 bg-lore-500 hover:bg-lore-400 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-lore-500/20 transition-all active:scale-95 text-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New Entry</span>
            </button>
          </div>
        </div>
        {/* Accent underline */}
        <div className="h-[1px] header-gradient-lore" />
      </header>

      {/* Mobile filter */}
      <div className="md:hidden px-5 py-2 border-b border-stone-200 bg-stone-50">
        <select
          value={loreFilterType}
          onChange={(e) => setLoreFilterType(e.target.value as LoreType | 'all')}
          className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-ink cursor-pointer"
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
            <div className="w-20 h-20 bg-lore-900/30 border border-lore-500/20 rounded-3xl flex items-center justify-center mb-6 text-lore-400">
              <BookOpen size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-ink mb-3">Lore Tracker is Empty</h2>
            <p className="text-stone-600 mb-8 leading-relaxed text-sm">
              Build your universe from the ground up. Factions, locations, events, concepts, artifacts, and canon rules — everything lives here.
            </p>
            <button
              onClick={handleCreate}
              className="bg-lore-500 hover:bg-lore-400 text-white px-8 py-3 rounded-xl font-bold transition-all text-sm shadow-lg shadow-lore-500/20 active:scale-95"
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
    </div>
  );
};

export default LoreModule;
