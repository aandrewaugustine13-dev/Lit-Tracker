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
    <div className="flex-1 flex flex-col min-w-0 bg-paper">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-stone-200 bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5 flex-1">
            {/* Module identity */}
            <div className="hidden md:flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-display font-medium text-ink tracking-tight">Character Tracker</h1>
              </div>
              <p className="text-[11px] font-display font-semibold text-stone-500 uppercase tracking-[0.14em]">
                {characters.length} dossier{characters.length !== 1 ? 's' : ''} on file
              </p>
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-char-400 transition-colors" size={15} />
              <input
                type="text"
                placeholder="Search characters, archetypes, tags..."
                value={characterSearchTerm}
                onChange={(e) => setCharacterSearchTerm(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded pl-9 pr-4 py-2 text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:border-char-500/50 focus:ring-1 focus:ring-char-500/20 transition-all"
              />
            </div>

            {/* View toggles */}
            <div className="hidden md:flex border border-stone-200 rounded overflow-hidden">
              {([
                { id: 'grid' as const, icon: <Users size={14} />, label: 'Grid' },
                { id: 'graph' as const, icon: <Network size={14} />, label: 'Graph' },
                { id: 'writer' as const, icon: <PenTool size={14} />, label: 'Writer' },
              ]).map(v => (
                <button
                  key={v.id}
                  onClick={() => setCharacterView(v.id)}
                  className={`px-3 py-1.5 text-xs font-body font-medium border-r border-stone-200 last:border-r-0 transition-all flex items-center gap-1.5 ${
                    characterView === v.id
                      ? 'bg-stone-100 text-ink font-semibold'
                      : 'bg-white text-stone-500 hover:text-ink'
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
            className="ml-4 bg-ink text-white hover:bg-stone-800 rounded font-body font-semibold text-sm px-5 py-2 flex items-center gap-2 transition-all"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Dossier</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-8">
        {characters.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-20 animate-fade-in">
            <div className="w-20 h-20 bg-char-500/10 border border-char-500/20 rounded-lg flex items-center justify-center mb-6 text-char-400">
              <UserPlus size={32} />
            </div>
            <h2 className="text-2xl font-display font-medium text-ink mb-3">Character Tracker is Empty</h2>
            <p className="text-stone-600 mb-8 leading-relaxed text-sm">
              Begin your narrative journey by defining your first character. Archetypes, visual traits, eras, and story arcs start here.
            </p>
            <button
              onClick={handleNew}
              className="bg-ink hover:bg-stone-800 text-white px-8 py-3 rounded font-bold transition-all text-sm "
            >
              Create First Character
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <p className="text-stone-600 text-base">No dossiers matching "{characterSearchTerm}"</p>
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
