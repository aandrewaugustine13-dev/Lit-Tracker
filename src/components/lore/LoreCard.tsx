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
      className="group relative flex flex-col h-full card overflow-hidden cursor-pointer"
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: config.accentHex }} />

      <div className="p-4 pl-5 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          {/* Serif type label — editorial style */}
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: config.accentHex }}>
            {config.label}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
              className="p-1.5 hover:bg-ink-900 rounded transition-colors text-steel-500 hover:text-ink"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 hover:bg-ink-900 rounded transition-colors text-steel-500 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Name — serif, hover to accent */}
        <h3 className="text-[17px] font-display font-semibold text-ink mb-1.5 leading-tight tracking-tight group-hover:text-ember-500 transition-colors">
          {entry.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-steel-500 line-clamp-3 mb-3 flex-grow leading-relaxed">
          {entry.description || 'No description provided.'}
        </p>

        {/* Type-specific detail */}
        <div className="space-y-1.5 mb-3 text-[11px] border-t border-border pt-3">
          {entry.type === LoreType.FACTION && (
            <div className="flex items-center gap-2 text-steel-300">
              <Shield size={12} className="text-steel-500" />
              <span className="text-steel-500">Leader:</span> {(entry as any).leader || '???'}
            </div>
          )}
          {entry.type === LoreType.LOCATION && (
            <div className="flex items-center gap-2 text-steel-300">
              <Map size={12} className="text-steel-500" />
              <span className="text-steel-500">Region:</span> {(entry as any).region || '???'}
            </div>
          )}
          {entry.type === LoreType.EVENT && (
            <div className="flex items-center gap-2 text-steel-300">
              <Calendar size={12} className="text-steel-500" />
              <span className="text-steel-500">Date:</span> {(entry as any).date || 'Unknown'}
            </div>
          )}
          {entry.type === LoreType.CONCEPT && (
            <div className="flex items-center gap-2 text-steel-300">
              <BrainCircuit size={12} className="text-steel-500" />
              <span className="text-steel-500">Origin:</span> {(entry as any).origin || '???'}
            </div>
          )}
          {entry.type === LoreType.ARTIFACT && (
            <div className="flex items-center gap-2 text-steel-300">
              <span className="text-steel-500">Holder:</span> {(entry as any).currentHolder || '???'}
            </div>
          )}
          {entry.type === LoreType.RULE && (
            <div className="flex items-center gap-2 text-steel-300">
              <Lock size={12} className={(entry as any).canonLocked ? 'text-ember-400' : 'text-steel-500'} />
              <span className="text-steel-500">{(entry as any).canonLocked ? 'Canon Locked' : 'Unlocked'}</span>
            </div>
          )}
        </div>

        {/* Footer: meta */}
        <div className="flex items-center gap-2 mt-auto text-[11px] text-steel-600">
          {entry.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-steel-500">
              #{tag}
            </span>
          ))}
          {entry.tags.length > 2 && <span>+{entry.tags.length - 2}</span>}

          {(linkedCharacters.length > 0 || entry.relatedEntryIds.length > 0) && (
            <>
              <div className="w-px h-2.5 bg-border" />
              <div className="flex items-center gap-2">
                {linkedCharacters.length > 0 && (
                  <span className="flex items-center gap-1 text-char-500" title={linkedCharacters.map(c => c.name).join(', ')}>
                    <Users size={10} />
                    {linkedCharacters.length}
                  </span>
                )}
                {entry.relatedEntryIds.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Link2 size={10} />
                    {entry.relatedEntryIds.length}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoreCard;
