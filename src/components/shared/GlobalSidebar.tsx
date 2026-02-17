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
  ScrollText,
} from 'lucide-react';

const MODULE_CONFIG: {
  id: ModuleId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    id: 'lore',
    label: 'Lore',
    shortLabel: 'L',
    icon: <BookOpen size={16} />,
    accent: 'lore',
  },
  {
    id: 'ink',
    label: 'Storyboard',
    shortLabel: 'S',
    icon: <PenTool size={16} />,
    accent: 'ember',
  },
  {
    id: 'characters',
    label: 'Characters',
    shortLabel: 'C',
    icon: <Users size={16} />,
    accent: 'char',
  },
  {
    id: 'proof',
    label: 'Proof',
    shortLabel: 'P',
    icon: <ScrollText size={16} />,
    accent: 'proof',
  },
];

const indicatorColor: Record<string, string> = {
  ember: 'bg-ember-500',
  char: 'bg-char-500',
  lore: 'bg-lore-500',
  proof: 'bg-proof-500',
};

const GlobalSidebar: React.FC = () => {
  const { activeModule, setActiveModule, syncStatus, projectName, characters, loreEntries, inkState } = useLitStore();

  const stats = useMemo(() => {
    const totalPanels = inkState.projects.reduce((sum, p) =>
      sum + p.issues.reduce((iSum, i) =>
        iSum + i.pages.reduce((pSum, pg) => pSum + pg.panels.length, 0), 0), 0);
    const totalPages = inkState.projects.reduce((sum, p) =>
      sum + p.issues.reduce((iSum, i) => iSum + i.pages.length, 0), 0);
    return { totalPanels, totalPages };
  }, [inkState.projects]);

  const moduleStats: Record<ModuleId, string> = {
    ink: stats.totalPanels > 0 ? `${stats.totalPanels}` : '',
    characters: characters.length > 0 ? `${characters.length}` : '',
    lore: loreEntries.length > 0 ? `${loreEntries.length}` : '',
    proof: stats.totalPages > 0 ? `${stats.totalPages}` : '',
  };

  return (
    <aside className="w-16 lg:w-60 bg-card border-r border-border h-screen flex flex-col flex-shrink-0 transition-all duration-300 z-50">
      {/* Brand */}
      <div className="h-16 flex items-center px-3 lg:px-5 border-b border-border flex-shrink-0">
        <div className="hidden lg:block">
          <h1 className="text-[22px] font-display font-semibold text-ink tracking-tight leading-none">
            Lit<span className="font-normal text-steel-500">Tracker</span>
          </h1>
          <p className="text-[10px] font-body text-steel-500 tracking-wide mt-1 truncate">
            {projectName}
          </p>
        </div>
        <div className="lg:hidden flex items-center justify-center w-full">
          <span className="text-lg font-display font-semibold text-ink">L</span>
        </div>
      </div>

      {/* Module Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto custom-scrollbar">
        <div className="hidden lg:block px-5 mb-2">
          <p className="text-[11px] font-display font-semibold text-steel-600 uppercase tracking-[0.18em]">
            Modules
          </p>
        </div>

        <div className="space-y-0.5 px-2 lg:px-3">
          {MODULE_CONFIG.map((mod) => {
            const isActive = activeModule === mod.id;
            const stat = moduleStats[mod.id];

            return (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                className={`
                  w-full flex items-center gap-2.5 px-2 lg:px-2.5 py-2 transition-all duration-150 group relative rounded-md
                  ${isActive
                    ? 'text-ink font-semibold bg-ink-900'
                    : 'text-steel-500 hover:text-ink hover:bg-ink-900'
                  }
                `}
              >
                <span className={`flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-50 group-hover:opacity-75'}`}>
                  {mod.icon}
                </span>
                <span className="hidden lg:block text-[13px] truncate leading-tight flex-1 text-left">
                  {mod.label}
                </span>
                {stat && (
                  <span className="hidden lg:block text-[11px] text-steel-600 tabular-nums">
                    {stat}
                  </span>
                )}
                {isActive && (
                  <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-sm ${indicatorColor[mod.accent]}`} />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer — sync status */}
      <div className="p-3 lg:px-5 lg:py-3 border-t border-border">
        <div className="hidden lg:flex items-center gap-2">
          {syncStatus === 'saving' ? (
            <RefreshCcw size={11} className="text-ember-500 animate-spin flex-shrink-0" />
          ) : syncStatus === 'synced' ? (
            <Cloud size={11} className="text-emerald-500 flex-shrink-0" />
          ) : syncStatus === 'error' ? (
            <CloudOff size={11} className="text-red-500 flex-shrink-0" />
          ) : (
            <CloudOff size={11} className="text-steel-600 flex-shrink-0" />
          )}
          <span className={`text-[10px] font-body ${
            syncStatus === 'saving' ? 'text-ember-500'
            : syncStatus === 'synced' ? 'text-emerald-500'
            : syncStatus === 'error' ? 'text-red-500'
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
            <RefreshCcw size={14} className="text-ember-500 animate-spin" />
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
