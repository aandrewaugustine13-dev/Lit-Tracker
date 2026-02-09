import React from 'react';
import { Character } from '../../types';
import { useLitStore } from '../../store';
import { User, Tag, Trash2, Edit3, MessageSquare } from 'lucide-react';

interface Props {
  character: Character;
}

const ROLE_COLORS: Record<string, string> = {
  Protagonist: 'bg-blue-100 text-blue-700 border-blue-300',
  Antagonist: 'bg-red-100 text-red-700 border-red-300',
  Supporting: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  Minor: 'bg-gray-100 text-gray-600 border-gray-300',
};

const CharacterCard: React.FC<Props> = ({ character }) => {
  const { setActiveCharacter, setCharacterEditorOpen, deleteCharacter, setCharacterChatOpen, openDetail } = useLitStore();
  const visualTags = character.eras?.[0]?.visual_tags || [];
  const referenceImage = character.gallery?.[0];

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveCharacter(character.id);
    setCharacterEditorOpen(true);
  };

  const handleClick = () => {
    openDetail({ kind: 'character', id: character.id });
  };

  const handleChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCharacterChatOpen(true, character.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete ${character.name}?`)) deleteCharacter(character.id);
  };

  return (
    <div
      onClick={handleClick}
      className="group relative bg-ink-900 border border-ink-700 rounded-xl overflow-hidden hover:border-ember-500/40 transition-all duration-300 flex flex-col cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1"
    >
      {/* Image / Placeholder */}
      <div className="aspect-[3/4] bg-ink-800 relative overflow-hidden flex items-center justify-center">
        {referenceImage ? (
          <img src={referenceImage} alt={character.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-steel-500">
            <User size={40} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-steel-600">No Reference</span>
          </div>
        )}

        {/* Role badge */}
        <div className="absolute top-2 left-2">
          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${ROLE_COLORS[character.role] || ROLE_COLORS.Minor}`}>
            {character.role}
          </span>
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-80" />

        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-display text-xl font-bold text-white truncate leading-tight drop-shadow-sm">
            {character.name || 'Unnamed'}
          </h3>
          <p className="text-white/70 text-[10px] mt-0.5 uppercase tracking-[0.15em] font-mono">
            {character.archetype || 'No Archetype'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
          <button onClick={handleChat} title="Interview" className="p-2 bg-ember-600/90 hover:bg-ember-500 text-white rounded-lg backdrop-blur-md border border-ember-500/50 transition-colors">
            <MessageSquare size={13} />
          </button>
          <button onClick={handleEdit} className="p-2 bg-white/80 hover:bg-white text-steel-200 rounded-lg backdrop-blur-md border border-ink-700 transition-colors">
            <Edit3 size={13} />
          </button>
          <button onClick={handleDelete} className="p-2 bg-red-50/80 hover:bg-red-100 text-red-600 rounded-lg backdrop-blur-md border border-red-200/50 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Tags footer */}
      <div className="p-3 flex flex-wrap gap-1.5 min-h-[2.5rem]">
        {visualTags.length > 0 ? (
          visualTags.slice(0, 3).map((tag, i) => (
            <span key={i} className="flex items-center gap-1 text-[9px] bg-ink-700/60 text-steel-400 px-2 py-0.5 rounded-full border border-ink-600/50">
              <Tag size={8} />
              {tag}
            </span>
          ))
        ) : (
          <span className="text-steel-600 text-[9px] italic">No visual tags</span>
        )}
        {visualTags.length > 3 && (
          <span className="text-steel-600 text-[9px]">+{visualTags.length - 3}</span>
        )}
        {character.loreEntryIds.length > 0 && (
          <span className="ml-auto text-lore-400 text-[9px] font-mono">{character.loreEntryIds.length} lore</span>
        )}
      </div>
    </div>
  );
};

export default CharacterCard;
