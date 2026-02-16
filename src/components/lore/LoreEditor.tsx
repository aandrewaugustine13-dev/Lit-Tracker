import React, { useState, useEffect } from 'react';
import { LoreEntry, LoreType } from '../../types';
import { LORE_TYPE_CONFIG } from '../../utils/loreConfig';
import { useLitStore } from '../../store';
import { X, Save, Tag, Link2, ChevronRight, Users, Check, Lock, Unlock } from 'lucide-react';
import { genId } from '../../utils/helpers';

interface Props {
  entry: LoreEntry | null;
  onClose: () => void;
}

function createBlankEntry(): LoreEntry {
  return {
    id: genId(), name: '', type: LoreType.CONCEPT, description: '', tags: [],
    relatedEntryIds: [], characterIds: [], origin: '', rules: '', complexity: 'Low',
    createdAt: Date.now(), updatedAt: Date.now(),
  } as any;
}

const LoreEditor: React.FC<Props> = ({ entry, onClose }) => {
  const { addLoreEntry, updateLoreEntry, loreEntries, characters, linkLoreToCharacter, unlinkLoreFromCharacter } = useLitStore();

  const [formData, setFormData] = useState<any>(entry || createBlankEntry());
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (entry) { setFormData({ ...entry }); setTagInput(entry.tags.join(', ')); }
    else { const b = createBlankEntry(); setFormData(b); setTagInput(''); }
  }, [entry]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTypeChange = (newType: LoreType) => {
    const base = { ...formData, type: newType };
    const defaults: Record<LoreType, object> = {
      [LoreType.FACTION]: { ideology: '', leader: '', influence: 5 },
      [LoreType.LOCATION]: { region: '', climate: '', importance: '' },
      [LoreType.EVENT]: { date: '', participants: '', consequences: '' },
      [LoreType.CONCEPT]: { origin: '', rules: '', complexity: 'Low' },
      [LoreType.ARTIFACT]: { origin: '', currentHolder: '', properties: '' },
      [LoreType.RULE]: { scope: '', exceptions: '', canonLocked: false },
    };
    setFormData({ ...base, ...defaults[newType] });
  };

  const handleSave = () => {
    if (!formData.name?.trim()) return;
    const tags = tagInput.split(',').map((t: string) => t.trim()).filter(Boolean);
    const final = { ...formData, tags, updatedAt: Date.now() };
    if (entry) updateLoreEntry(entry.id, final);
    else addLoreEntry({ ...final, createdAt: Date.now() });
    onClose();
  };

  const toggleRelation = (id: string) => {
    setFormData((prev: any) => ({
      ...prev,
      relatedEntryIds: prev.relatedEntryIds.includes(id)
        ? prev.relatedEntryIds.filter((rid: string) => rid !== id)
        : [...prev.relatedEntryIds, id],
    }));
  };

  const toggleCharacter = (charId: string) => {
    const linked = formData.characterIds?.includes(charId);
    setFormData((prev: any) => ({
      ...prev,
      characterIds: linked
        ? prev.characterIds.filter((id: string) => id !== charId)
        : [...(prev.characterIds || []), charId],
    }));
    if (entry) {
      if (linked) unlinkLoreFromCharacter(entry.id, charId);
      else linkLoreToCharacter(entry.id, charId);
    }
  };

  const config = LORE_TYPE_CONFIG[formData.type as LoreType];
  const InputCls = "w-full bg-white border border-stone-200 rounded px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-stone-400 transition-colors";
  const LabelCls = "text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em] mb-1.5 block";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/10 animate-fade-in">
      <div className="bg-card border border-stone-200 w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>{config.icon}</div>
            <div>
              <h2 className="text-base font-display font-bold text-ink">
                {entry ? `Edit: ${formData.name || 'Untitled'}` : 'New Lore Entry'}
              </h2>
              <p className="text-[9px] text-stone-500 uppercase tracking-[0.15em] font-body">Lore Tracker</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-500 hover:text-ink transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Name + Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LabelCls}>Entry Name</label>
              <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className={InputCls} placeholder="e.g., Drain Metaphysics" />
            </div>
            <div>
              <label className={LabelCls}>Type</label>
              <select value={formData.type} onChange={e => handleTypeChange(e.target.value as LoreType)} className={`${InputCls} cursor-pointer capitalize`}>
                {Object.values(LoreType).map(t => (
                  <option key={t} value={t}>{LORE_TYPE_CONFIG[t].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={LabelCls}>Description</label>
            <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={3} className={`${InputCls} resize-none`} placeholder="Core description of this entry..." />
          </div>

          {/* Type-specific fields */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 rounded-full" style={{ background: config.accentHex }} />
              <h3 className="text-xs font-bold text-stone-700 capitalize">{LORE_TYPE_CONFIG[formData.type as LoreType].label} Details</h3>
            </div>

            {formData.type === LoreType.FACTION && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={LabelCls}>Ideology</label><input name="ideology" value={formData.ideology || ''} onChange={handleChange} className={InputCls} /></div>
                <div><label className={LabelCls}>Leader</label><input name="leader" value={formData.leader || ''} onChange={handleChange} className={InputCls} /></div>
              </div>
            )}
            {formData.type === LoreType.LOCATION && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={LabelCls}>Region</label><input name="region" value={formData.region || ''} onChange={handleChange} className={InputCls} /></div>
                <div><label className={LabelCls}>Climate / Vibe</label><input name="climate" value={formData.climate || ''} onChange={handleChange} className={InputCls} /></div>
              </div>
            )}
            {formData.type === LoreType.EVENT && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={LabelCls}>Date/Timeline</label><input name="date" value={formData.date || ''} onChange={handleChange} className={InputCls} /></div>
                <div><label className={LabelCls}>Key Participants</label><input name="participants" value={formData.participants || ''} onChange={handleChange} className={InputCls} /></div>
                <div className="col-span-2"><label className={LabelCls}>Consequences</label><textarea name="consequences" value={formData.consequences || ''} onChange={handleChange} rows={2} className={`${InputCls} resize-none`} /></div>
              </div>
            )}
            {formData.type === LoreType.CONCEPT && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={LabelCls}>Origin Point</label><input name="origin" value={formData.origin || ''} onChange={handleChange} className={InputCls} /></div>
                <div>
                  <label className={LabelCls}>Complexity</label>
                  <select name="complexity" value={formData.complexity || 'Low'} onChange={handleChange} className={`${InputCls} cursor-pointer`}>
                    <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Extreme">Extreme</option>
                  </select>
                </div>
                <div className="col-span-2"><label className={LabelCls}>Rules / Mechanics</label><textarea name="rules" value={formData.rules || ''} onChange={handleChange} rows={2} className={`${InputCls} resize-none`} /></div>
              </div>
            )}
            {formData.type === LoreType.ARTIFACT && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={LabelCls}>Origin</label><input name="origin" value={formData.origin || ''} onChange={handleChange} className={InputCls} /></div>
                <div><label className={LabelCls}>Current Holder</label><input name="currentHolder" value={formData.currentHolder || ''} onChange={handleChange} className={InputCls} /></div>
                <div className="col-span-2"><label className={LabelCls}>Properties</label><textarea name="properties" value={formData.properties || ''} onChange={handleChange} rows={2} className={`${InputCls} resize-none`} /></div>
              </div>
            )}
            {formData.type === LoreType.RULE && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={LabelCls}>Scope</label><input name="scope" value={formData.scope || ''} onChange={handleChange} className={InputCls} /></div>
                  <div className="flex items-end pb-1">
                    <button
                      onClick={() => setFormData((p: any) => ({ ...p, canonLocked: !p.canonLocked }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold transition-all ${
                        formData.canonLocked ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white border-stone-200 text-stone-500'
                      }`}
                    >
                      {formData.canonLocked ? <Lock size={13} /> : <Unlock size={13} />}
                      {formData.canonLocked ? 'Canon Locked' : 'Unlocked'}
                    </button>
                  </div>
                </div>
                <div><label className={LabelCls}>Exceptions</label><textarea name="exceptions" value={formData.exceptions || ''} onChange={handleChange} rows={2} className={`${InputCls} resize-none`} /></div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-1.5 text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em] mb-1.5">
              <Tag size={10} /> Tags (comma separated)
            </label>
            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} className={InputCls} placeholder="mythology, drain, canon..." />
          </div>

          {/* Character connections */}
          <div>
            <label className="flex items-center gap-1.5 text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em] mb-1.5">
              <Users size={10} /> Character Connections
            </label>
            <div className="bg-white border border-stone-200 rounded-lg p-2.5 max-h-36 overflow-y-auto custom-scrollbar space-y-1">
              {characters.length === 0 ? (
                <p className="text-[10px] text-stone-500 italic text-center py-3">No characters created yet</p>
              ) : characters.map(char => (
                <button
                  key={char.id}
                  onClick={() => toggleCharacter(char.id)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all text-xs ${
                    formData.characterIds?.includes(char.id) ? 'bg-char-500/10 border border-char-400/30' : 'hover:bg-stone-100 border border-transparent'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-char-500/60" />
                  <span className="text-ink flex-1 truncate">{char.name}</span>
                  <span className="text-[9px] text-stone-500">{char.role}</span>
                  {formData.characterIds?.includes(char.id) && <Check size={12} className="text-char-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Related Lore */}
          <div>
            <label className="flex items-center gap-1.5 text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em] mb-1.5">
              <Link2 size={10} /> Related Lore Entries
            </label>
            <div className="bg-white border border-stone-200 rounded-lg p-2.5 max-h-36 overflow-y-auto custom-scrollbar space-y-1">
              {loreEntries.filter(e => e.id !== formData.id).map(other => {
                const otherConfig = LORE_TYPE_CONFIG[other.type];
                return (
                  <button
                    key={other.id}
                    onClick={() => toggleRelation(other.id)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all text-xs ${
                      formData.relatedEntryIds?.includes(other.id) ? 'bg-lore-500/10 border border-lore-500/30' : 'hover:bg-stone-100 border border-transparent'
                    }`}
                  >
                    <span className={otherConfig.color}>{otherConfig.icon}</span>
                    <span className="text-ink flex-1 truncate">{other.name}</span>
                    {formData.relatedEntryIds?.includes(other.id) && <ChevronRight size={12} className="text-lore-400" />}
                  </button>
                );
              })}
              {loreEntries.length <= 1 && (
                <p className="text-[10px] text-stone-500 italic text-center py-3">Create more entries to establish connections</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 text-stone-500 hover:text-ink transition-colors text-sm font-medium">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-lore-500 hover:bg-lore-400 text-white rounded-lg flex items-center gap-2 font-bold transition-all shadow-lore-500/10 text-sm">
            <Save size={15} /> Save Entry
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoreEditor;
