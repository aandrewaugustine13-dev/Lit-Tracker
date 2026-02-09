import React, { useMemo } from 'react';
import { useLitStore } from '../../store';
import { ModuleId } from '../../types';
import {
  PenTool,
  Users,
  BookOpen,
  Flame,
  CloudOff,
  RefreshCcw,
  Cloud,
  ChevronRight,
  Layers,
  FileText,
} from 'lucide-react';

const MODULE_CONFIG: {
  id: ModuleId;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    id: 'ink',
    label: 'Storyboard',
    shortLabel: 'INK',
    description: 'Visual layout',
    icon: <PenTool size={18} />,
    accent: 'ember',
  },
  {
    id: 'characters',
    label: 'Characters',
    shortLabel: 'CHAR',
    description: 'Cast & voices',
    icon: <Users size={18} />,
    accent: 'char',
  },
  {
    id: 'lore',
    label: 'Lore Tracker',
    shortLabel: 'LORE',
    description: 'Rules & canon',
    icon: <BookOpen size={18} />,
    accent: 'lore',
  },
];

const accentMap: Record<string, {
  active: string;
  activeBg: string;
  indicator: string;
  iconBg: string;
  hoverBg: string;
}> = {
  ember: {
    active: 'text-ember-400',
    activeBg: 'bg-ember-900/40',
    indicator: 'bg-ember-500',
    iconBg: 'bg-ember-500/15 text-ember-400',
    hoverBg: 'hover:bg-ink-800/80',
  },
  char: {
    active: 'text-char-400',
    activeBg: 'bg-char-900/40',
    indicator: 'bg-char-500',
    iconBg: 'bg-char-500/15 text-char-400',
    hoverBg: 'hover:bg-ink-800/80',
  },
  lore: {
    active: 'text-lore-400',
    activeBg: 'bg-lore-900/40',
    indicator: 'bg-lore-500',
    iconBg: 'bg-lore-500/15 text-lore-400',
    hoverBg: 'hover:bg-ink-800/80',
  },
};

const GlobalSidebar: React.FC = () => {
  const { activeModule, setActiveModule, syncStatus, projectName, characters, loreEntries, inkState } = useLitStore();

  const stats = useMemo(() => {
    const totalPanels = inkState.projects.reduce((sum, p) =>
      sum + p.issues.reduce((iSum, i) =>
        iSum + i.pages.reduce((pSum, pg) => pSum + pg.panels.length, 0), 0), 0);
    const totalPages = inkState.projects.reduce((sum, p) =>
      sum + p.issues.reduce((iSum, i) => iSum + i.pages.length, 0), 0);
    const totalIssues = inkState.projects.reduce((sum, p) => sum + p.issues.length, 0);
    return { totalPanels, totalPages, totalIssues };
  }, [inkState.projects]);

  const moduleStats: Record<ModuleId, string> = {
    ink: stats.totalPanels > 0 ? `${stats.totalPanels} panels` : '',
    characters: characters.length > 0 ? `${characters.length} cast` : '',
    lore: loreEntries.length > 0 ? `${loreEntries.length} entries` : '',
  };

  return (
    <aside className="w-16 lg:w-60 bg-ink-900 border-r border-ink-750 h-screen flex flex-col flex-shrink-0 transition-all duration-300 z-50">
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-3 lg:px-4 border-b border-ink-750 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ember-500 to-ember-600 flex items-center justify-center shadow-lg shadow-ember-500/20 flex-shrink-0 relative">
          <Flame size={16} className="text-white" />
          <div className="absolute inset-0 rounded-xl bg-ember-500/20 animate-pulse-glow" />
        </div>
        <div className="hidden lg:block min-w-0">
          <h1 className="text-sm font-display font-bold text-steel-100 tracking-tight leading-tight truncate">
            LIT Tracker
          </h1>
          <p className="text-[9px] font-mono text-steel-600 uppercase tracking-[0.15em] truncate mt-0.5">
            {projectName}
          </p>
        </div>
      </div>

      {/* Module Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto custom-scrollbar">
        <div className="hidden lg:block px-4 mb-2">
          <p className="text-[8px] font-mono text-steel-700 uppercase tracking-[0.25em]">
            Modules
          </p>
        </div>

        <div className="space-y-0.5 px-2">
          {MODULE_CONFIG.map((mod) => {
            const isActive = activeModule === mod.id;
            const colors = accentMap[mod.accent];
            const stat = moduleStats[mod.id];

            return (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                className={`
                  w-full flex items-center gap-3 px-2 lg:px-3 py-2.5 transition-all duration-200 group relative rounded-lg
                  ${isActive
                    ? `${colors.activeBg} ${colors.active}`
                    : `text-steel-500 ${colors.hoverBg} hover:text-steel-300`
                  }
                `}
              >
                {isActive && (
                  <div className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${colors.indicator}`} />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  isActive ? colors.iconBg : 'bg-ink-800/50 text-steel-500 group-hover:bg-ink-750 group-hover:text-steel-300'
                }`}>
                  {mod.icon}
                </div>
                <div className="hidden lg:flex flex-col items-start min-w-0 flex-1">
                  <span className="text-[13px] font-semibold truncate leading-tight">{mod.label}</span>
                  <span className={`text-[9px] font-mono tracking-wider mt-0.5 ${
                    isActive ? 'opacity-60' : 'text-steel-600'
                  }`}>
                    {stat || mod.description}
                  </span>
                </div>
                {isActive && (
                  <ChevronRight size={14} className="ml-auto hidden lg:block opacity-40" />
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="sidebar-divider my-4" />

        {/* Project stats — desktop */}
        <div className="hidden lg:block px-4 pb-2">
          <p className="text-[8px] font-mono text-steel-700 uppercase tracking-[0.25em] mb-3">
            Project
          </p>
          <div className="space-y-2">
            {[
              { icon: <Layers size={12} />, label: 'Issues', value: stats.totalIssues, color: 'text-ember-400' },
              { icon: <FileText size={12} />, label: 'Pages', value: stats.totalPages, color: 'text-ember-400' },
              { icon: <Users size={12} />, label: 'Cast', value: characters.length, color: 'text-char-400' },
              { icon: <BookOpen size={12} />, label: 'Lore', value: loreEntries.length, color: 'text-lore-400' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="text-steel-600">{s.icon}</span>
                <span className="text-[10px] text-steel-500 flex-1">{s.label}</span>
                <span className={`text-[11px] font-mono font-bold ${s.value > 0 ? s.color : 'text-steel-700'}`}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer — sync status */}
      <div className="p-3 lg:px-4 lg:py-3 border-t border-ink-750">
        <div className="hidden lg:flex items-center gap-2.5">
          {syncStatus === 'saving' ? (
            <RefreshCcw size={12} className="text-ember-400 animate-spin flex-shrink-0" />
          ) : syncStatus === 'synced' ? (
            <Cloud size={12} className="text-emerald-500 flex-shrink-0" />
          ) : syncStatus === 'error' ? (
            <CloudOff size={12} className="text-red-400 flex-shrink-0" />
          ) : (
            <CloudOff size={12} className="text-steel-600 flex-shrink-0" />
          )}
          <span className={`text-[9px] font-mono uppercase tracking-wider ${
            syncStatus === 'saving' ? 'text-ember-400'
            : syncStatus === 'synced' ? 'text-emerald-500'
            : syncStatus === 'error' ? 'text-red-400'
            : 'text-steel-600'
          }`}>
            {syncStatus === 'saving' ? 'Saving...'
              : syncStatus === 'synced' ? 'Cloud synced'
              : syncStatus === 'error' ? 'Sync error'
              : 'Local only'}
          </span>
        </div>
        <div className="lg:hidden flex justify-center">
          {syncStatus === 'saving' ? (
            <RefreshCcw size={14} className="text-ember-400 animate-spin" />
          ) : syncStatus === 'synced' ? (
            <Cloud size={14} className="text-emerald-500" />
          ) : (
            <CloudOff size={14} className="text-steel-600" />
          )}
        </div>
      </div>
    </aside>
  );
};

export default GlobalSidebar;
