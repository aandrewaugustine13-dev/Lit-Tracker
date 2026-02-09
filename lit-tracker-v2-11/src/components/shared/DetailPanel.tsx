import React, { useMemo } from 'react';
import { useLitStore } from '../../store';
import { LORE_TYPE_CONFIG } from '../../utils/loreConfig';
import { Character, LoreEntry, LoreType, Panel, Page, Issue, InkProject } from '../../types';
import { timeAgo } from '../../utils/helpers';
import {
  X,
  ArrowLeft,
  User,
  BookOpen,
  PenTool,
  Tag,
  Link2,
  Edit3,
  Clock,
  Layers,
  ChevronRight,
  Users,
  Shield,
  Map,
  Calendar,
  Brain,
  Lock,
  Gem,
  Zap,
  ImageIcon,
} from 'lucide-react';

// ─── Panel appearance data for storyboard cross-refs ─────────────────────

interface PanelAppearance {
  panel: Panel;
  page: Page;
  issue: Issue;
  project: InkProject;
}

function findCharacterPanels(characterId: string, projects: InkProject[]): PanelAppearance[] {
  const results: PanelAppearance[] = [];
  for (const project of projects) {
    for (const issue of project.issues) {
      for (const page of issue.pages) {
        for (const panel of page.panels) {
          if (panel.characterIds.includes(characterId)) {
            results.push({ panel, page, issue, project });
          }
        }
      }
    }
  }
  return results;
}

function findLoreMentions(loreEntry: LoreEntry, characters: Character[]): Character[] {
  return characters.filter(c => c.loreEntryIds.includes(loreEntry.id));
}

// ─── Section wrapper ─────────────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  count?: number;
  accentColor?: string;
  children: React.ReactNode;
}> = ({ title, icon, count, accentColor = 'text-steel-500', children }) => (
  <div className="py-4 border-t border-ink-800/60">
    <div className="flex items-center gap-2 mb-3 px-5">
      <span className={accentColor}>{icon}</span>
      <span className="text-[10px] font-mono font-bold text-steel-500 uppercase tracking-[0.15em]">{title}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[9px] font-mono text-steel-600 bg-ink-800 px-1.5 py-0.5 rounded">{count}</span>
      )}
    </div>
    <div className="px-5">{children}</div>
  </div>
);

// ─── Clickable entity chip ───────────────────────────────────────────────

const EntityChip: React.FC<{
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  accentBg: string;
  accentText: string;
  onClick: () => void;
}> = ({ label, sublabel, icon, accentBg, accentText, onClick }) => (
  <button
    onClick={onClick}
    className={`group flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg border border-ink-800/60 bg-ink-900/40 hover:bg-ink-800 hover:border-ink-700 transition-all`}
  >
    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${accentBg} ${accentText}`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-semibold text-steel-200 truncate group-hover:text-steel-100 transition-colors">{label}</p>
      {sublabel && <p className="text-[9px] font-mono text-steel-600 truncate">{sublabel}</p>}
    </div>
    <ChevronRight size={12} className="text-steel-700 group-hover:text-steel-500 transition-colors flex-shrink-0" />
  </button>
);

// ─── Panel thumbnail for storyboard appearances ─────────────────────────

const PanelThumb: React.FC<{
  appearance: PanelAppearance;
}> = ({ appearance }) => {
  const { panel, page, issue } = appearance;
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-ink-900/40 border border-ink-800/60">
      {/* Tiny image preview or placeholder */}
      <div className="w-12 h-12 rounded bg-ink-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {panel.imageUrl ? (
          <img
            src={panel.imageUrl.startsWith('idb://') ? undefined : panel.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon size={14} className="text-steel-700" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-steel-300 truncate">
          {panel.prompt ? panel.prompt.slice(0, 60) + (panel.prompt.length > 60 ? '...' : '') : 'No prompt'}
        </p>
        <p className="text-[9px] font-mono text-steel-600 mt-0.5">
          {issue.title} · Page {page.number} · Panel {page.panels.indexOf(panel) + 1}
        </p>
      </div>
    </div>
  );
};

// ─── Character detail view ──────────────────────────────────────────────

const CharacterDetail: React.FC<{ character: Character }> = ({ character }) => {
  const { loreEntries, relationships, characters, inkState, openDetail, setActiveCharacter, setCharacterEditorOpen } = useLitStore();

  const linkedLore = useMemo(() =>
    loreEntries.filter(e => character.loreEntryIds.includes(e.id)),
    [loreEntries, character.loreEntryIds]
  );

  const charRelationships = useMemo(() =>
    relationships.filter(r => r.fromId === character.id || r.toId === character.id),
    [relationships, character.id]
  );

  const panelAppearances = useMemo(() =>
    findCharacterPanels(character.id, inkState.projects),
    [character.id, inkState.projects]
  );

  const handleEdit = () => {
    setActiveCharacter(character.id);
    setCharacterEditorOpen(true);
  };

  const roleColors: Record<string, string> = {
    Protagonist: 'bg-blue-500/15 text-blue-400',
    Antagonist: 'bg-red-500/15 text-red-400',
    Supporting: 'bg-emerald-500/15 text-emerald-400',
    Minor: 'bg-steel-700/30 text-steel-400',
  };

  return (
    <>
      {/* Identity header */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-4">
          {/* Avatar / gallery image */}
          <div className="w-16 h-16 rounded-xl bg-ink-800 border border-ink-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {character.gallery?.[0] ? (
              <img src={character.gallery[0]} alt={character.name} className="w-full h-full object-cover" />
            ) : (
              <User size={24} className="text-steel-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-display font-bold text-steel-100 leading-tight">{character.name}</h3>
            <p className="text-[11px] text-steel-400 mt-0.5">{character.archetype || 'No archetype'}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${roleColors[character.role] || roleColors.Minor}`}>
                {character.role}
              </span>
              {character.smart_tags?.Faction && (
                <span className="text-[9px] font-mono text-steel-500 bg-ink-800 px-1.5 py-0.5 rounded">
                  {character.smart_tags.Faction}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleEdit}
            className="p-2 text-steel-500 hover:text-char-400 hover:bg-char-900/30 rounded-lg transition-all flex-shrink-0"
            title="Edit dossier"
          >
            <Edit3 size={16} />
          </button>
        </div>
      </div>

      {/* Eras */}
      {character.eras.length > 0 && (
        <Section title="Eras" icon={<Clock size={13} />} count={character.eras.length} accentColor="text-ember-400">
          <div className="space-y-1.5">
            {character.eras.map(era => (
              <div key={era.id} className="flex items-center gap-3 p-2 rounded-lg bg-ink-900/40 border border-ink-800/60">
                <div className="w-1.5 h-8 rounded-full bg-ember-500/40 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-steel-200">{era.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {era.age_appearance && (
                      <span className="text-[9px] font-mono text-steel-500">{era.age_appearance}</span>
                    )}
                    {era.visual_tags.length > 0 && (
                      <span className="text-[9px] text-steel-600 truncate">{era.visual_tags.join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Storyboard appearances */}
      <Section title="Storyboard" icon={<PenTool size={13} />} count={panelAppearances.length} accentColor="text-ember-400">
        {panelAppearances.length === 0 ? (
          <p className="text-[11px] text-steel-600 italic">Not yet placed in any panels</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
            {panelAppearances.slice(0, 20).map((app, i) => (
              <PanelThumb key={`${app.panel.id}-${i}`} appearance={app} />
            ))}
            {panelAppearances.length > 20 && (
              <p className="text-[9px] text-steel-600 font-mono text-center py-1">
                +{panelAppearances.length - 20} more appearances
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Linked Lore */}
      <Section title="Lore Connections" icon={<BookOpen size={13} />} count={linkedLore.length} accentColor="text-lore-400">
        {linkedLore.length === 0 ? (
          <p className="text-[11px] text-steel-600 italic">No lore entries linked</p>
        ) : (
          <div className="space-y-1.5">
            {linkedLore.map(entry => {
              const cfg = LORE_TYPE_CONFIG[entry.type];
              return (
                <EntityChip
                  key={entry.id}
                  label={entry.name}
                  sublabel={cfg.label}
                  icon={cfg.icon}
                  accentBg={cfg.bgColor}
                  accentText={cfg.color}
                  onClick={() => openDetail({ kind: 'lore', id: entry.id })}
                />
              );
            })}
          </div>
        )}
      </Section>

      {/* Relationships */}
      {charRelationships.length > 0 && (
        <Section title="Relationships" icon={<Link2 size={13} />} count={charRelationships.length} accentColor="text-char-400">
          <div className="space-y-1.5">
            {charRelationships.map(rel => {
              const otherId = rel.fromId === character.id ? rel.toId : rel.fromId;
              const other = characters.find(c => c.id === otherId);
              if (!other) return null;
              return (
                <EntityChip
                  key={rel.id}
                  label={other.name}
                  sublabel={rel.label}
                  icon={<User size={13} />}
                  accentBg="bg-char-500/15"
                  accentText="text-char-400"
                  onClick={() => openDetail({ kind: 'character', id: otherId })}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* Smart Tags */}
      {Object.keys(character.smart_tags || {}).length > 0 && (
        <Section title="Tags" icon={<Tag size={13} />} accentColor="text-steel-500">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(character.smart_tags).map(([key, val]) => val ? (
              <span key={key} className="text-[10px] bg-ink-800 border border-ink-700 text-steel-300 px-2 py-1 rounded-md">
                <span className="text-steel-500">{key}:</span> {val}
              </span>
            ) : null)}
          </div>
        </Section>
      )}

      {/* Meta */}
      <div className="px-5 py-3 border-t border-ink-800/60">
        <p className="text-[9px] font-mono text-steel-700">
          Created {timeAgo(character.createdAt)} · Updated {timeAgo(character.updatedAt)}
        </p>
      </div>
    </>
  );
};

// ─── Lore detail view ───────────────────────────────────────────────────

const LoreDetail: React.FC<{ entry: LoreEntry }> = ({ entry }) => {
  const { characters, loreEntries, openDetail } = useLitStore();
  const cfg = LORE_TYPE_CONFIG[entry.type];

  const linkedCharacters = useMemo(() =>
    characters.filter(c => entry.characterIds.includes(c.id)),
    [characters, entry.characterIds]
  );

  const relatedEntries = useMemo(() =>
    loreEntries.filter(e => entry.relatedEntryIds.includes(e.id)),
    [loreEntries, entry.relatedEntryIds]
  );

  // Also find characters that link TO this entry
  const backlinkedCharacters = useMemo(() =>
    characters.filter(c => c.loreEntryIds.includes(entry.id) && !entry.characterIds.includes(c.id)),
    [characters, entry.id, entry.characterIds]
  );

  const allLinkedChars = useMemo(() => {
    const combined = [...linkedCharacters, ...backlinkedCharacters];
    const seen = new Set<string>();
    return combined.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  }, [linkedCharacters, backlinkedCharacters]);

  // Type-specific fields
  const renderTypeFields = () => {
    const fieldClass = "flex items-center gap-2 text-[11px]";
    const labelClass = "text-steel-500 flex-shrink-0";
    const valueClass = "text-steel-300";

    switch (entry.type) {
      case LoreType.FACTION: {
        const f = entry as any;
        return (
          <div className="space-y-2">
            {f.leader && <div className={fieldClass}><Shield size={12} className="text-blue-400" /><span className={labelClass}>Leader</span><span className={valueClass}>{f.leader}</span></div>}
            {f.ideology && <div className={fieldClass}><span className={labelClass}>Ideology</span><span className={valueClass}>{f.ideology}</span></div>}
            {f.influence && (
              <div className={fieldClass}>
                <span className={labelClass}>Influence</span>
                <div className="flex-1 h-1.5 bg-ink-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${(f.influence / 10) * 100}%` }} />
                </div>
                <span className="text-[9px] font-mono text-steel-600">{f.influence}/10</span>
              </div>
            )}
          </div>
        );
      }
      case LoreType.LOCATION: {
        const l = entry as any;
        return (
          <div className="space-y-2">
            {l.region && <div className={fieldClass}><Map size={12} className="text-emerald-400" /><span className={labelClass}>Region</span><span className={valueClass}>{l.region}</span></div>}
            {l.climate && <div className={fieldClass}><span className={labelClass}>Climate</span><span className={valueClass}>{l.climate}</span></div>}
            {l.importance && <div className={fieldClass}><span className={labelClass}>Importance</span><span className={valueClass}>{l.importance}</span></div>}
          </div>
        );
      }
      case LoreType.EVENT: {
        const ev = entry as any;
        return (
          <div className="space-y-2">
            {ev.date && <div className={fieldClass}><Calendar size={12} className="text-amber-400" /><span className={labelClass}>Date</span><span className={valueClass}>{ev.date}</span></div>}
            {ev.participants && <div className={fieldClass}><span className={labelClass}>Participants</span><span className={valueClass}>{ev.participants}</span></div>}
            {ev.consequences && <div className={fieldClass}><span className={labelClass}>Consequences</span><span className={valueClass}>{ev.consequences}</span></div>}
          </div>
        );
      }
      case LoreType.CONCEPT: {
        const c = entry as any;
        return (
          <div className="space-y-2">
            {c.origin && <div className={fieldClass}><Brain size={12} className="text-purple-400" /><span className={labelClass}>Origin</span><span className={valueClass}>{c.origin}</span></div>}
            {c.rules && <div className={fieldClass}><span className={labelClass}>Rules</span><span className={valueClass}>{c.rules}</span></div>}
          </div>
        );
      }
      case LoreType.ARTIFACT: {
        const a = entry as any;
        return (
          <div className="space-y-2">
            {a.currentHolder && <div className={fieldClass}><Gem size={12} className="text-rose-400" /><span className={labelClass}>Holder</span><span className={valueClass}>{a.currentHolder}</span></div>}
            {a.origin && <div className={fieldClass}><span className={labelClass}>Origin</span><span className={valueClass}>{a.origin}</span></div>}
            {a.properties && <div className={fieldClass}><span className={labelClass}>Properties</span><span className={valueClass}>{a.properties}</span></div>}
          </div>
        );
      }
      case LoreType.RULE: {
        const r = entry as any;
        return (
          <div className="space-y-2">
            <div className={fieldClass}>
              <Lock size={12} className={r.canonLocked ? 'text-amber-400' : 'text-steel-600'} />
              <span className={r.canonLocked ? 'text-amber-400 font-bold text-[10px] uppercase' : 'text-steel-500 text-[10px]'}>
                {r.canonLocked ? 'Canon Locked' : 'Unlocked'}
              </span>
            </div>
            {r.scope && <div className={fieldClass}><span className={labelClass}>Scope</span><span className={valueClass}>{r.scope}</span></div>}
            {r.exceptions && <div className={fieldClass}><span className={labelClass}>Exceptions</span><span className={valueClass}>{r.exceptions}</span></div>}
          </div>
        );
      }
      default: return null;
    }
  };

  return (
    <>
      {/* Identity header */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bgColor} ${cfg.color}`}>
            {cfg.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${cfg.color}`}>
              {cfg.label}
            </div>
            <h3 className="text-xl font-display font-bold text-steel-100 leading-tight">{entry.name}</h3>
          </div>
        </div>

        {/* Description */}
        {entry.description && (
          <p className="text-[12px] text-steel-300 leading-relaxed mt-3">
            {entry.description}
          </p>
        )}

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {entry.tags.map(tag => (
              <span key={tag} className="text-[9px] bg-ink-800 border border-ink-700 text-steel-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Type-specific fields */}
      <Section title="Details" icon={<Layers size={13} />} accentColor={cfg.color}>
        {renderTypeFields()}
      </Section>

      {/* Linked Characters */}
      <Section title="Characters" icon={<Users size={13} />} count={allLinkedChars.length} accentColor="text-char-400">
        {allLinkedChars.length === 0 ? (
          <p className="text-[11px] text-steel-600 italic">No characters linked</p>
        ) : (
          <div className="space-y-1.5">
            {allLinkedChars.map(char => (
              <EntityChip
                key={char.id}
                label={char.name}
                sublabel={`${char.role} · ${char.archetype || 'No archetype'}`}
                icon={<User size={13} />}
                accentBg="bg-char-500/15"
                accentText="text-char-400"
                onClick={() => openDetail({ kind: 'character', id: char.id })}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Related Lore */}
      {relatedEntries.length > 0 && (
        <Section title="Related Lore" icon={<Link2 size={13} />} count={relatedEntries.length} accentColor="text-lore-400">
          <div className="space-y-1.5">
            {relatedEntries.map(rel => {
              const relCfg = LORE_TYPE_CONFIG[rel.type];
              return (
                <EntityChip
                  key={rel.id}
                  label={rel.name}
                  sublabel={relCfg.label}
                  icon={relCfg.icon}
                  accentBg={relCfg.bgColor}
                  accentText={relCfg.color}
                  onClick={() => openDetail({ kind: 'lore', id: rel.id })}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* Meta */}
      <div className="px-5 py-3 border-t border-ink-800/60">
        <p className="text-[9px] font-mono text-steel-700">
          Created {timeAgo(entry.createdAt)} · Updated {timeAgo(entry.updatedAt)}
        </p>
      </div>
    </>
  );
};

// ─── Main DetailPanel ───────────────────────────────────────────────────

const DetailPanel: React.FC = () => {
  const { detailTarget, detailHistory, closeDetail, goBackDetail, characters, loreEntries } = useLitStore();

  if (!detailTarget) return null;

  const entity = detailTarget.kind === 'character'
    ? characters.find(c => c.id === detailTarget.id)
    : loreEntries.find(e => e.id === detailTarget.id);

  if (!entity) return null;

  const canGoBack = detailHistory.length > 0;
  const accentColor = detailTarget.kind === 'character' ? 'char' : 'lore';

  return (
    <div className="fixed inset-0 z-[90] flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/15 backdrop-blur-[2px] pointer-events-auto"
        onClick={closeDetail}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-ink-950 border-l border-ink-700 h-full flex flex-col pointer-events-auto animate-slide-in shadow-2xl">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700 bg-ink-900 flex-shrink-0">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={goBackDetail}
                className="p-1.5 text-steel-500 hover:text-steel-200 hover:bg-ink-800 rounded-lg transition-all"
                title="Go back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className={`w-1.5 h-1.5 rounded-full ${accentColor === 'char' ? 'bg-char-500' : 'bg-lore-500'}`} />
            <span className="text-[10px] font-mono text-steel-500 uppercase tracking-widest">
              {detailTarget.kind === 'character' ? 'Character' : 'Lore Entry'}
            </span>
          </div>
          <button
            onClick={closeDetail}
            className="p-1.5 text-steel-500 hover:text-steel-200 hover:bg-ink-800 rounded-lg transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {detailTarget.kind === 'character' ? (
            <CharacterDetail character={entity as Character} />
          ) : (
            <LoreDetail entry={entity as LoreEntry} />
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailPanel;
