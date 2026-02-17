import React, { useState, useEffect, useMemo } from 'react';
import { useLitStore } from '../../store';
import { Character, CharacterRole, Era } from '../../types';
import { LORE_TYPE_CONFIG } from '../../utils/loreConfig';
import { generateMasterPrompt, createDefaultEra } from '../../utils/helpers';
import {
  X, Save, User, Mic, Hash, Copy, Check, History, Plus, Trash2, Sparkles, BookOpen, Link2,
} from 'lucide-react';

const CharacterEditor: React.FC = () => {
  const {
    isCharacterEditorOpen, setCharacterEditorOpen,
    activeCharacterId, activeEraId, setActiveEra,
    characters, updateCharacter, addCharacter,
    loreEntries, linkCharacterToLore, unlinkCharacterFromLore,
    linkLoreToCharacter, unlinkLoreFromCharacter,
  } = useLitStore();

  const [formData, setFormData] = useState<Partial<Character>>({});
  const [copied, setCopied] = useState(false);
  const [newTagKey, setNewTagKey] = useState('');

  const currentEra = useMemo(() => {
    return formData.eras?.find(e => e.id === activeEraId) || null;
  }, [formData.eras, activeEraId]);

  useEffect(() => {
    if (activeCharacterId) {
      const char = characters.find(c => c.id === activeCharacterId);
      if (char) {
        setFormData({ ...char });
        if (!activeEraId && char.eras.length > 0) setActiveEra(char.eras[0].id);
      }
    } else {
      const initialEra = createDefaultEra();
      setFormData({
        name: '', role: 'Supporting', archetype: '',
        eras: [initialEra],
        voice_profile: { samples: [], style: '' },
        smart_tags: { Faction: '', Status: 'Active' },
        gallery: [], loreEntryIds: [],
      });
      setActiveEra(initialEra.id);
    }
  }, [activeCharacterId, isCharacterEditorOpen]);

  const handleSave = () => {
    if (!formData.name) return;
    if (activeCharacterId) {
      updateCharacter(activeCharacterId, formData);
    } else {
      addCharacter(formData as Omit<Character, 'id' | 'createdAt' | 'updatedAt'>);
    }
    setCharacterEditorOpen(false);
  };

  const updateEra = (id: string, updates: Partial<Era>) => {
    setFormData(prev => ({
      ...prev,
      eras: prev.eras?.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  };

  const addEra = () => {
    const era = createDefaultEra('New Era');
    setFormData(prev => ({ ...prev, eras: [...(prev.eras || []), era] }));
    setActiveEra(era.id);
  };

  const deleteEra = (id: string) => {
    setFormData(prev => ({ ...prev, eras: prev.eras?.filter(e => e.id !== id) }));
    if (activeEraId === id) setActiveEra(formData.eras?.[0]?.id || null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateMasterPrompt(formData as Character, activeEraId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleLoreLink = (loreId: string) => {
    const linked = formData.loreEntryIds?.includes(loreId);
    if (linked) {
      setFormData(prev => ({ ...prev, loreEntryIds: prev.loreEntryIds?.filter(id => id !== loreId) }));
      if (activeCharacterId) {
        unlinkCharacterFromLore(activeCharacterId, loreId);
        unlinkLoreFromCharacter(loreId, activeCharacterId);
      }
    } else {
      setFormData(prev => ({ ...prev, loreEntryIds: [...(prev.loreEntryIds || []), loreId] }));
      if (activeCharacterId) {
        linkCharacterToLore(activeCharacterId, loreId);
        linkLoreToCharacter(loreId, activeCharacterId);
      }
    }
  };

  const addSmartTag = () => {
    if (!newTagKey.trim()) return;
    setFormData(prev => ({ ...prev, smart_tags: { ...prev.smart_tags, [newTagKey.trim()]: '' } }));
    setNewTagKey('');
  };

  const removeSmartTag = (key: string) => {
    setFormData(prev => {
      const tags = { ...prev.smart_tags };
      delete tags[key];
      return { ...prev, smart_tags: tags };
    });
  };

  if (!isCharacterEditorOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={() => setCharacterEditorOpen(false)} />

      <div className="relative w-full max-w-5xl bg-paper border-l border-stone-200 h-full flex flex-col animate-slide-in shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 bg-card flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-ink rounded flex items-center justify-center text-white ">
              <User size={22} />
            </div>
            <div>
              <h2 className="text-lg font-display font-medium text-ink">
                {activeCharacterId ? 'Edit Dossier' : 'New Dossier'}
              </h2>
              <p className="text-[9px] text-stone-500 font-body uppercase tracking-[0.15em]">
                {activeCharacterId ? `ID: ${activeCharacterId.split('-')[0]}` : 'CREATING'}
              </p>
            </div>
          </div>
          <button onClick={() => setCharacterEditorOpen(false)} className="p-2 text-stone-500 hover:text-ink hover:bg-stone-100 rounded-full transition-all">
            <X size={22} />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Identity & Lore */}
          <div className="w-[320px] border-r border-stone-200 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-stone-50 flex-shrink-0">
            {/* Core identity */}
            <section className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em] mb-1.5">Full Name</label>
                <input
                  type="text" value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded px-3.5 py-2 text-ink text-sm focus:border-stone-400 focus:outline-none transition-all"
                  placeholder="Character Name"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em] mb-1.5">Archetype</label>
                <input
                  type="text" value={formData.archetype || ''}
                  onChange={e => setFormData({ ...formData, archetype: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded px-3.5 py-2 text-ink text-sm focus:border-stone-400 focus:outline-none"
                  placeholder="e.g. The Reluctant Hero"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em] mb-1.5">Role</label>
                <select
                  value={formData.role || 'Supporting'}
                  onChange={e => setFormData({ ...formData, role: e.target.value as CharacterRole })}
                  className="w-full bg-white border border-stone-200 rounded px-3.5 py-2 text-ink text-sm cursor-pointer"
                >
                  <option value="Protagonist">Protagonist</option>
                  <option value="Antagonist">Antagonist</option>
                  <option value="Supporting">Supporting</option>
                  <option value="Minor">Minor</option>
                </select>
              </div>
            </section>

            {/* Smart Tags */}
            <section className="space-y-3">
              <label className="flex items-center gap-1.5 text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em]">
                <Hash size={10} /> Smart Tags
              </label>
              <div className="space-y-2">
                {Object.entries(formData.smart_tags || {}).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[9px] text-stone-600 font-bold w-16 truncate flex-shrink-0">{key}</span>
                    <input
                      type="text" value={val}
                      onChange={e => setFormData({ ...formData, smart_tags: { ...formData.smart_tags, [key]: e.target.value } })}
                      className="flex-1 bg-white border border-stone-200 rounded px-2.5 py-1 text-xs text-ink"
                    />
                    <button onClick={() => removeSmartTag(key)} className="text-stone-400 hover:text-red-400 p-0.5">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text" value={newTagKey}
                    onChange={e => setNewTagKey(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSmartTag()}
                    placeholder="Add tag key..."
                    className="flex-1 bg-white border border-stone-200 rounded px-2.5 py-1 text-xs text-ink"
                  />
                  <button onClick={addSmartTag} className="text-ink hover:text-ink p-1"><Plus size={14} /></button>
                </div>
              </div>
            </section>

            {/* Voice Profile */}
            <section className="space-y-2">
              <label className="flex items-center gap-1.5 text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em]">
                <Mic size={10} /> Voice Profile
              </label>
              <textarea
                rows={3}
                value={formData.voice_profile?.style || ''}
                onChange={e => setFormData({ ...formData, voice_profile: { ...formData.voice_profile!, style: e.target.value } })}
                placeholder="Describe their speaking style, accent, verbal tics..."
                className="w-full bg-white border border-stone-200 rounded-lg p-3 text-xs text-ink resize-none"
              />
            </section>

            {/* Lore Connections */}
            <section className="space-y-2">
              <label className="flex items-center gap-1.5 text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em]">
                <Link2 size={10} /> Lore Connections
              </label>
              <div className="bg-white border border-stone-200 rounded-lg p-2 max-h-44 overflow-y-auto custom-scrollbar space-y-1">
                {loreEntries.length === 0 ? (
                  <p className="text-[10px] text-stone-500 italic text-center py-4">No lore entries yet</p>
                ) : (
                  loreEntries.map(entry => {
                    const linked = formData.loreEntryIds?.includes(entry.id);
                    const config = LORE_TYPE_CONFIG[entry.type];
                    return (
                      <button
                        key={entry.id}
                        onClick={() => toggleLoreLink(entry.id)}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all text-xs ${
                          linked ? 'bg-lore-500/10 border border-lore-500/30' : 'hover:bg-stone-100 border border-transparent'
                        }`}
                      >
                        <span className={config.color}>{config.icon}</span>
                        <span className="text-ink flex-1 truncate">{entry.name}</span>
                        {linked && <Check size={12} className="text-lore-400" />}
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* Right: Eras & Visual */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Era selector */}
            <div className="flex items-start gap-6">
              <div className="w-44 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em]">Eras</label>
                  <button onClick={addEra} className="p-1 hover:bg-stone-100 rounded text-ink"><Plus size={13} /></button>
                </div>
                <div className="space-y-1">
                  {(formData.eras || []).map((era) => (
                    <div
                      key={era.id}
                      onClick={() => setActiveEra(era.id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all border text-xs ${
                        activeEraId === era.id
                          ? 'bg-ink/10 border-stone-400 text-ink font-bold'
                          : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <History size={11} />
                        <span className="truncate">{era.name || 'Untitled'}</span>
                      </div>
                      {(formData.eras?.length || 0) > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteEra(era.id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Era detail */}
              <div className="flex-1 space-y-5">
                {currentEra ? (
                  <div className="animate-fade-in space-y-5">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em] mb-1.5">Era Name</label>
                        <input
                          type="text" value={currentEra.name}
                          onChange={e => updateEra(currentEra.id, { name: e.target.value })}
                          className="w-full bg-white border border-stone-200 rounded px-3.5 py-2 text-ink text-sm"
                        />
                      </div>
                      <div className="w-28">
                        <label className="block text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em] mb-1.5">Age App.</label>
                        <input
                          type="text" value={currentEra.age_appearance}
                          onChange={e => updateEra(currentEra.id, { age_appearance: e.target.value })}
                          placeholder="e.g. 40s"
                          className="w-full bg-white border border-stone-200 rounded px-3.5 py-2 text-ink text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em]">Visual Prompt Tags</label>
                        <button className="text-[8px] text-ink font-bold flex items-center gap-1 hover:underline">
                          <Sparkles size={9} /> Suggest
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={currentEra.visual_tags.join(', ')}
                        onChange={e => updateEra(currentEra.id, { visual_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="red hair past collar, black glasses, DBS scar at temple..."
                        className="w-full bg-white border border-stone-200 rounded-lg p-3 text-xs text-ink font-body leading-relaxed"
                      />
                    </div>

                    {/* Prompt preview */}
                    <div className="bg-stone-50 border border-stone-200 p-4 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] font-bold text-stone-600 uppercase tracking-[0.2em]">Master Prompt Preview</p>
                        <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-stone-200 rounded-lg text-[10px] font-bold text-stone-600 hover:text-ink transition-all">
                          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs text-ink font-body italic p-3 bg-white rounded border border-stone-400/20 leading-relaxed">
                        {generateMasterPrompt(formData as Character, activeEraId)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-stone-400 opacity-40">
                    <History size={40} className="mb-3" />
                    <p className="text-sm">Select an era to edit</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-stone-200 bg-card flex items-center justify-between flex-shrink-0">
          <button onClick={() => setCharacterEditorOpen(false)} className="px-5 py-2 text-stone-600 hover:text-ink font-medium transition-colors text-sm">Cancel</button>
          <button onClick={handleSave} className="flex items-center gap-2 bg-ink text-white hover:bg-stone-800 px-7 py-2 rounded font-bold transition-all text-sm">
            <Save size={16} /> Save Dossier
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterEditor;
