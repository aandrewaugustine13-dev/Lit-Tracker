import React from 'react';
import { LoreEntry, LoreType } from '../../types';
import { LORE_TYPE_CONFIG } from '../../utils/loreConfig';
import { useLitStore } from '../../store';
import { Edit2, Trash2, Calendar, Shield, Map, BrainCircuit, Link2, Users, Lock } from 'lucide-react';

interface Props {
  entry: LoreEntry;
  onEdit: (entry: LoreEntry) => void;
}

const LoreCard: React.FC<Props> = ({ entry, onEdit }) => {
  const { deleteLoreEntry, characters, openDetail } = useLitStore();
  const config = LORE_TYPE_CONFIG[entry.type];

  const linkedCharacters = characters.filter(c => entry.characterIds.includes(c.id));

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${entry.name}"?`)) deleteLoreEntry(entry.id);
  };

  const handleClick = () => {
    openDetail({ kind: 'lore', id: entry.id });
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative flex flex-col h-full card rounded-sm overflow-hidden cursor-pointer`}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: config.accentHex }} />

      <div className="p-4 pl-5 flex-1 flex flex-col">{/* pl-5 to account for left bar */}
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${config.bgColor} ${config.color}`}>
            {config.icon}
            {config.label}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
              className="p-1.5 hover:bg-stone-100 rounded transition-colors text-stone-500 hover:text-stone-900"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 hover:bg-stone-100 rounded transition-colors text-stone-500 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Name */}
        <h3 className="text-base font-display font-medium text-ink mb-1.5 leading-tight">
          {entry.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-stone-600 line-clamp-3 mb-3 flex-grow leading-relaxed">
          {entry.description || 'No description provided.'}
        </p>

        {/* Type-specific detail */}
        <div className="space-y-1.5 mb-3 text-[11px] border-t border-stone-200 pt-3">
          {entry.type === LoreType.FACTION && (
            <div className="flex items-center gap-2 text-stone-700">
              <Shield size={12} className="text-blue-400/70" />
              <span className="text-stone-500">Leader:</span> {(entry as any).leader || '???'}
            </div>
          )}
          {entry.type === LoreType.LOCATION && (
            <div className="flex items-center gap-2 text-stone-700">
              <Map size={12} className="text-emerald-400/70" />
              <span className="text-stone-500">Region:</span> {(entry as any).region || '???'}
            </div>
          )}
          {entry.type === LoreType.EVENT && (
            <div className="flex items-center gap-2 text-stone-700">
              <Calendar size={12} className="text-amber-400/70" />
              <span className="text-stone-500">Date:</span> {(entry as any).date || 'Unknown'}
            </div>
          )}
          {entry.type === LoreType.CONCEPT && (
            <div className="flex items-center gap-2 text-stone-700">
              <BrainCircuit size={12} className="text-purple-400/70" />
              <span className="text-stone-500">Origin:</span> {(entry as any).origin || '???'}
            </div>
          )}
          {entry.type === LoreType.ARTIFACT && (
            <div className="flex items-center gap-2 text-stone-700">
              <span className="text-stone-500">Holder:</span> {(entry as any).currentHolder || '???'}
            </div>
          )}
          {entry.type === LoreType.RULE && (
            <div className="flex items-center gap-2 text-stone-700">
              <Lock size={12} className={(entry as any).canonLocked ? 'text-amber-400' : 'text-stone-400'} />
              <span className="text-stone-500">{(entry as any).canonLocked ? 'Canon Locked' : 'Unlocked'}</span>
            </div>
          )}
        </div>

        {/* Footer: tags + connections */}
        <div className="flex flex-wrap gap-1 mt-auto items-center">
          {entry.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[9px] bg-stone-100 border border-stone-200 text-stone-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">
              #{tag}
            </span>
          ))}
          {entry.tags.length > 3 && <span className="text-[9px] text-stone-400">+{entry.tags.length - 3}</span>}

          <div className="ml-auto flex items-center gap-2">
            {linkedCharacters.length > 0 && (
              <div className="flex items-center gap-1 text-char-400 text-[9px]" title={linkedCharacters.map(c => c.name).join(', ')}>
                <Users size={10} />
                {linkedCharacters.length}
              </div>
            )}
            {entry.relatedEntryIds.length > 0 && (
              <div className="flex items-center gap-1 text-stone-400 text-[9px]">
                <Link2 size={10} />
                {entry.relatedEntryIds.length}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoreCard;
