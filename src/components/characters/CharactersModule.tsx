import React from 'react';
import { useLitStore } from '../../store';
import CharacterCard from './CharacterCard';
import CharacterEditor from './CharacterEditor';
import { Search, Plus, UserPlus, Users, Network, PenTool } from 'lucide-react';

const CharactersModule: React.FC = () => {
  const {
    characters, characterSearchTerm, setCharacterSearchTerm,
    setActiveCharacter, setCharacterEditorOpen, characterView, setCharacterView,
  } = useLitStore();

  const handleNew = () => {
    setActiveCharacter(null);
    setCharacterEditorOpen(true);
  };

  const filtered = characters.filter(c => {
    const term = characterSearchTerm.toLowerCase();
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      c.archetype.toLowerCase().includes(term) ||
      c.role.toLowerCase().includes(term) ||
      c.eras.some(e => e.visual_tags.some(t => t.toLowerCase().includes(term))) ||
      Object.values(c.smart_tags).some(v => v.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-ink-950">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-ink-750 bg-ink-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5 flex-1">
            {/* Module identity */}
            <div className="hidden md:flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-char-500" />
                <h1 className="text-lg font-display font-bold text-steel-100 tracking-tight">Character Tracker</h1>
              </div>
              <p className="text-[9px] font-mono text-steel-600 uppercase tracking-[0.15em] pl-4">
                {characters.length} dossier{characters.length !== 1 ? 's' : ''} on file
              </p>
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-600 group-focus-within:text-char-400 transition-colors" size={15} />
              <input
                type="text"
                placeholder="Search characters, archetypes, tags..."
                value={characterSearchTerm}
                onChange={(e) => setCharacterSearchTerm(e.target.value)}
                className="w-full bg-ink-950 border border-ink-700 rounded-lg pl-9 pr-4 py-2 text-sm text-steel-100 placeholder:text-steel-600 focus:outline-none focus:border-char-500/50 focus:ring-1 focus:ring-char-500/20 transition-all"
              />
            </div>

            {/* View toggles */}
            <div className="hidden md:flex items-center bg-ink-900 border border-ink-700 rounded-lg p-0.5">
              {([
                { id: 'grid' as const, icon: <Users size={14} />, label: 'Grid' },
                { id: 'graph' as const, icon: <Network size={14} />, label: 'Graph' },
                { id: 'writer' as const, icon: <PenTool size={14} />, label: 'Writer' },
              ]).map(v => (
                <button
                  key={v.id}
                  onClick={() => setCharacterView(v.id)}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    characterView === v.id
                      ? 'bg-char-500/15 text-char-400'
                      : 'text-steel-500 hover:text-steel-200'
                  }`}
                >
                  {v.icon}
                  <span className="hidden lg:inline">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleNew}
            className="ml-4 bg-char-500 hover:bg-char-400 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-char-500/20 transition-all active:scale-95 text-sm"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Dossier</span>
          </button>
        </div>
        {/* Accent underline */}
        <div className="h-[1px] header-gradient-char" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-8">
        {characters.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-20 animate-fade-in">
            <div className="w-20 h-20 bg-char-900/30 border border-char-500/20 rounded-3xl flex items-center justify-center mb-6 text-char-400">
              <UserPlus size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-steel-100 mb-3">Character Tracker is Empty</h2>
            <p className="text-steel-400 mb-8 leading-relaxed text-sm">
              Begin your narrative journey by defining your first character. Archetypes, visual traits, eras, and story arcs start here.
            </p>
            <button
              onClick={handleNew}
              className="bg-char-500 hover:bg-char-400 text-white px-8 py-3 rounded-xl font-bold transition-all text-sm shadow-lg shadow-char-500/20 active:scale-95"
            >
              Create First Character
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <p className="text-steel-500 text-base">No dossiers matching "{characterSearchTerm}"</p>
            <button onClick={() => setCharacterSearchTerm('')} className="mt-3 text-char-400 hover:underline text-xs font-bold uppercase tracking-widest">
              Clear Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 animate-fade-in">
            {filtered.map(c => <CharacterCard key={c.id} character={c} />)}
          </div>
        )}
      </div>

      {/* Global editor overlay */}
      <CharacterEditor />
    </div>
  );
};

export default CharactersModule;
