import React, { useMemo } from 'react';
import { useLitStore } from '../../store';
import { ModuleId } from '../../types';
import {
  PenTool,
  Users,
  BookOpen,
  CloudOff,
  RefreshCcw,
  Cloud,
  Layers,
  FileText,
  ScrollText,
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
    id: 'lore',
    label: 'Lore Tracker',
    shortLabel: 'LORE',
    description: '🏠 Home & Hub',
    icon: <BookOpen size={18} />,
    accent: 'lore',
  },
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
    id: 'proof',
    label: 'Proof',
    shortLabel: 'PROOF',
    description: 'Read & revise',
    icon: <ScrollText size={18} />,
    accent: 'proof',
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
  proof: {
    active: 'text-proof-400',
    activeBg: 'bg-proof-900/40',
    indicator: 'bg-proof-500',
    iconBg: 'bg-proof-500/15 text-proof-400',
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
    proof: stats.totalPages > 0 ? `${stats.totalPages} pages` : '',
  };

  return (
    <aside className="w-16 lg:w-60 bg-card border-r border-stone-200 h-screen flex flex-col flex-shrink-0 transition-all duration-300 z-50">
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-3 lg:px-4 border-b border-stone-200 flex-shrink-0">
        <div className="hidden lg:flex flex-col min-w-0 flex-1">
          <h1 className="text-xl font-display font-semibold text-ink tracking-tight leading-tight">
            Lit<span className="font-normal text-stone-400">Tracker</span>
          </h1>
          <p className="text-[11px] font-display font-semibold text-stone-500 uppercase tracking-[0.14em] truncate mt-0.5">
            {projectName}
          </p>
        </div>
        {/* Collapsed sidebar - show just "L" */}
        <div className="lg:hidden flex items-center justify-center w-full">
          <span className="text-xl font-display font-semibold text-ink">L</span>
        </div>
      </div>

      {/* Module Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto custom-scrollbar">
        <div className="hidden lg:block px-4 mb-2">
          <p className="text-[11px] font-display font-semibold text-stone-500 uppercase tracking-[0.14em]">
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
                  w-full flex items-center gap-3 px-2 lg:px-3 py-2.5 transition-all duration-200 group relative rounded
                  ${isActive
                    ? `${colors.active} font-semibold bg-stone-50`
                    : `text-stone-500 hover:bg-stone-50 hover:text-ink`
                  }
                `}
              >
                {/* Icon - no box wrapper */}
                <div className="flex-shrink-0">
                  {mod.icon}
                </div>
                <div className="hidden lg:flex flex-col items-start min-w-0 flex-1">
                  <span className="text-[13px] truncate leading-tight">{mod.label}</span>
                  {stat && (
                    <span className="text-[9px] font-body text-stone-400 tracking-wider mt-0.5">
                      {stat}
                    </span>
                  )}
                </div>
                {/* Active indicator on right */}
                {isActive && (
                  <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-sm ${colors.indicator}`} />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer — sync status */}
      <div className="p-3 lg:px-4 lg:py-3 border-t border-stone-200">
        <div className="hidden lg:flex items-center gap-2.5">
          {syncStatus === 'saving' ? (
            <RefreshCcw size={12} className="text-ember-500 animate-spin flex-shrink-0" />
          ) : syncStatus === 'synced' ? (
            <Cloud size={12} className="text-emerald-500 flex-shrink-0" />
          ) : syncStatus === 'error' ? (
            <CloudOff size={12} className="text-red-500 flex-shrink-0" />
          ) : (
            <CloudOff size={12} className="text-stone-400 flex-shrink-0" />
          )}
          <span className={`text-[9px] font-body uppercase tracking-wider ${
            syncStatus === 'saving' ? 'text-ember-500'
            : syncStatus === 'synced' ? 'text-emerald-500'
            : syncStatus === 'error' ? 'text-red-500'
            : 'text-stone-400'
          }`}>
            {syncStatus === 'saving' ? 'Saving...'
              : syncStatus === 'synced' ? 'Cloud synced'
              : syncStatus === 'error' ? 'Sync error'
              : 'Local only'}
          </span>
        </div>
        <div className="lg:hidden flex justify-center">
          {syncStatus === 'saving' ? (
            <RefreshCcw size={14} className="text-ember-500 animate-spin" />
          ) : syncStatus === 'synced' ? (
            <Cloud size={14} className="text-emerald-500" />
          ) : (
            <CloudOff size={14} className="text-stone-400" />
          )}
        </div>
      </div>
    </aside>
  );
};

export default GlobalSidebar;
