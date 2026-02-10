import React from 'react';
import { Undo2, Redo2, LayoutGrid, Grid2X2, Grid3X3, Columns, Square, RectangleHorizontal, FileImage, FileText, Play, X, Users, Sparkles, Link2, BookOpen } from 'lucide-react';
import { Icons } from '../../constants';
import ZoomControls from './ZoomControls';
import { SyncIndicator } from './SyncIndicator';
import { BatchProgressIndicator } from './GenerationSpinner';

interface InkToolbarProps {
  showGutters: boolean;
  activeProject: any;
  activeIssue: any;
  activePage: any;
  activeTab: 'canvas' | 'guide';
  setActiveTab: (tab: 'canvas' | 'guide') => void;
  user: any;
  syncStatus: any;
  signOut: () => void;
  inkCanUndo: boolean;
  inkCanRedo: boolean;
  dispatch: any;
  showExportMenu: boolean;
  setShowExportMenu: (show: boolean) => void;
  exporting: boolean;
  handleExportPage: () => void;
  handleExportIssue: () => void;
  handleExportPagePDF: () => void;
  handleExportIssuePDF: () => void;
  batching: boolean;
  generatePage: () => void;
  activePanels: any[];
  isGeneratingAll: boolean;
  currentPanel: number;
  totalPanels: number;
  cancelGenerationRef: React.MutableRefObject<boolean>;
  handleGenerateAll: () => void;
  showTemplateMenu: boolean;
  setShowTemplateMenu: (show: boolean) => void;
  setShowScriptPanel: (show: boolean) => void;
  showScriptPanel: boolean;
  setShowCharacterBank: (show: boolean) => void;
  setShowReadThrough: (show: boolean) => void;
  totalIssuePanels: number;
  handleAutoLink: () => void;
  characters: any[];
  zoomEnabled: boolean;
  setZoomEnabled: (enabled: boolean) => void;
  setShowGutters: (show: boolean) => void;
  showSpreadView: boolean;
  setShowSpreadView: (show: boolean) => void;
  showSplitView: boolean;
  setShowSplitView: (show: boolean) => void;
}

const InkToolbar: React.FC<InkToolbarProps> = ({
  showGutters,
  activeProject,
  activeIssue,
  activePage,
  activeTab,
  setActiveTab,
  user,
  syncStatus,
  signOut,
  inkCanUndo,
  inkCanRedo,
  dispatch,
  showExportMenu,
  setShowExportMenu,
  exporting,
  handleExportPage,
  handleExportIssue,
  handleExportPagePDF,
  handleExportIssuePDF,
  batching,
  generatePage,
  activePanels,
  isGeneratingAll,
  currentPanel,
  totalPanels,
  cancelGenerationRef,
  handleGenerateAll,
  showTemplateMenu,
  setShowTemplateMenu,
  setShowScriptPanel,
  showScriptPanel,
  setShowCharacterBank,
  setShowReadThrough,
  totalIssuePanels,
  handleAutoLink,
  characters,
  zoomEnabled,
  setZoomEnabled,
  setShowGutters,
  showSpreadView,
  setShowSpreadView,
  showSplitView,
  setShowSplitView,
}) => {
  return (
    <header className={`border-b flex flex-col z-[100] backdrop-blur-xl transition-all shrink-0 ${showGutters ? 'bg-amber-50/80 border-amber-200' : 'bg-ink-900/40 border-ink-750'}`}>
      {/* Top Row: Module identity + breadcrumb + tabs */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-5 overflow-hidden">
          {/* Module identity */}
          <div className="hidden md:flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${showGutters ? 'bg-black' : 'bg-ember-500'}`} />
              <h1 className={`text-lg font-display font-bold tracking-tight ${showGutters ? 'text-black' : 'text-steel-100'}`}>
                Storyboard
              </h1>
            </div>
            <div className={`flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.15em] pl-4 ${showGutters ? 'text-gray-500' : 'text-steel-600'}`}>
              <span>{activeProject?.title}</span>
              <span className="opacity-30">/</span>
              <span className={showGutters ? 'text-gray-700' : 'text-ember-400'}>{activeIssue?.title}</span>
              <span className="opacity-30">/</span>
              <span className={showGutters ? 'text-black' : 'text-steel-300'}>
                {activeTab === 'canvas' ? `Page ${activePage?.number || '-'}` : 'Guide'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-3">
              <SyncIndicator status={syncStatus} />
              <button
                onClick={signOut}
                className={`text-[10px] font-mono uppercase tracking-widest transition-colors ${
                  showGutters
                    ? 'text-gray-500 hover:text-black'
                    : 'text-steel-500 hover:text-ember-500'
                }`}
                title="Sign out"
              >
                Logout
              </button>
            </div>
          )}
          {/* Tab Navigation */}
          <div className={`flex items-center gap-1 rounded-full border p-1 ${showGutters ? 'bg-gray-100 border-gray-300' : 'bg-ink-900 border-ink-700'}`}>
            <button
              onClick={() => setActiveTab('canvas')}
              className={`font-mono text-[10px] px-5 py-1.5 tracking-widest transition-all rounded-full ${
                activeTab === 'canvas'
                  ? showGutters
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-ember-500 text-ink-950 shadow-lg'
                  : showGutters
                    ? 'text-gray-600 hover:text-black'
                    : 'text-steel-400 hover:text-steel-200'
              }`}
            >
              CANVAS
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`font-mono text-[10px] px-5 py-1.5 tracking-widest transition-all rounded-full ${
                activeTab === 'guide'
                  ? showGutters
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-ember-500 text-ink-950 shadow-lg'
                  : showGutters
                    ? 'text-gray-600 hover:text-black'
                    : 'text-steel-400 hover:text-steel-200'
              }`}
            >
              GUIDE
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar Row: Canvas Controls and Action Buttons */}
      <div className="flex items-center justify-between gap-4 px-6 py-2 border-t border-ink-800/50">
        {/* Left Side: Canvas Controls — grouped */}
        <div className="flex items-center gap-2">
          {/* Undo/Redo group */}
          <div className={`flex items-center gap-0.5 rounded-lg border p-0.5 ${showGutters ? 'border-gray-300 bg-gray-100' : 'border-ink-700 bg-ink-850'}`}>
            <button
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={!inkCanUndo}
              className={`p-1.5 rounded transition-all disabled:opacity-20 disabled:cursor-not-allowed ${
                showGutters 
                  ? 'hover:bg-gray-200 text-gray-600' 
                  : 'hover:bg-ink-700 text-steel-400 hover:text-steel-200'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={!inkCanRedo}
              className={`p-1.5 rounded transition-all disabled:opacity-20 disabled:cursor-not-allowed ${
                showGutters 
                  ? 'hover:bg-gray-200 text-gray-600' 
                  : 'hover:bg-ink-700 text-steel-400 hover:text-steel-200'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
          </div>

          {/* View controls group */}
          <div className={`flex items-center gap-0.5 rounded-lg border p-0.5 ${showGutters ? 'border-gray-300 bg-gray-100' : 'border-ink-700 bg-ink-850'}`}>
            <ZoomControls
              zoomEnabled={zoomEnabled}
              setZoomEnabled={setZoomEnabled}
              showGutters={showGutters}
              setShowGutters={setShowGutters}
            />
            
            {/* Spread View Toggle */}
            <button
              onClick={() => setShowSpreadView(!showSpreadView)}
              className={`p-1.5 rounded transition-all ${
                showSpreadView
                  ? showGutters 
                    ? 'bg-ember-500 text-white' 
                    : 'bg-ember-500 text-ink-950'
                  : showGutters 
                    ? 'hover:bg-gray-200 text-gray-600' 
                    : 'hover:bg-ink-700 text-steel-400 hover:text-steel-200'
              }`}
              title="Spread View"
            >
              <BookOpen size={16} />
            </button>
            
            {/* Split View Toggle */}
            {activeIssue?.scriptText && (
              <button
                onClick={() => setShowSplitView(!showSplitView)}
                className={`p-1.5 rounded transition-all ${
                  showSplitView
                    ? showGutters 
                      ? 'bg-ember-500 text-white' 
                      : 'bg-ember-500 text-ink-950'
                    : showGutters 
                      ? 'hover:bg-gray-200 text-gray-600' 
                      : 'hover:bg-ink-700 text-steel-400 hover:text-steel-200'
                }`}
                title="Script Split View"
              >
                <Columns size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end relative pointer-events-auto">
          {/* Secondary actions group */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`font-mono text-[10px] px-3 py-1.5 tracking-widest transition-all rounded-lg border flex items-center gap-2 active:scale-95 ${showGutters ? 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100' : 'bg-ink-850 border-ink-700 text-steel-400 hover:bg-ink-800 hover:text-steel-200'}`}
            >
              {exporting ? <Icons.Loader /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
              {exporting ? 'EXPORTING...' : 'EXPORT'}
            </button>
            {showExportMenu && (
              <div className={`absolute top-full right-0 mt-2 w-56 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in py-1 ${showGutters ? 'bg-white border border-gray-300' : 'bg-ink-900 border border-ink-700'}`}>
                <div className={`px-4 py-2 text-[9px] font-mono uppercase tracking-widest ${showGutters ? 'text-gray-400 border-b border-gray-200' : 'text-steel-600 border-b border-ink-800'}`}>Images</div>
                <button onClick={handleExportPage} className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors uppercase tracking-widest flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}><FileImage size={14} /><span>ZIP Page Images</span></button>
                <button onClick={handleExportIssue} className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors uppercase tracking-widest flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}><FileImage size={14} /><span>CBZ Issue</span></button>
                <div className={`px-4 py-2 text-[9px] font-mono uppercase tracking-widest ${showGutters ? 'text-gray-400 border-y border-gray-200' : 'text-steel-600 border-y border-ink-800'}`}>PDF</div>
                <button onClick={handleExportPagePDF} className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors uppercase tracking-widest flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}><FileImage size={14} /><span>PDF Page</span></button>
                <button onClick={handleExportIssuePDF} className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors uppercase tracking-widest flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}><FileImage size={14} /><span>PDF Issue</span></button>
              </div>
            )}
          </div>
          <button disabled={batching || !activePage?.panels.length} onClick={generatePage} className={`font-mono text-[10px] px-4 py-1.5 tracking-widest transition-all rounded-lg border flex items-center gap-2 disabled:opacity-20 active:scale-95 ${showGutters ? 'bg-black border-black text-white hover:bg-gray-800' : 'bg-ember-500 border-ember-500 text-ink-950 hover:bg-ember-400 shadow-lg shadow-ember-500/20'}`}>
            {batching ? <Icons.Loader /> : <Icons.Magic />}{batching ? `INKING WITH ${(activeProject?.imageProvider || 'AI').toUpperCase()}...` : 'AUTO-INK'}
          </button>
          {/* Generate All Button */}
          {activePanels.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              {isGeneratingAll && activeProject ? (
                <BatchProgressIndicator
                  provider={activeProject.imageProvider}
                  current={currentPanel}
                  total={totalPanels}
                  onCancel={() => { cancelGenerationRef.current = true; }}
                />
              ) : (
                <>
                  <button
                    onClick={handleGenerateAll}
                    disabled={isGeneratingAll || batching}
                    className={`font-mono text-[10px] px-3 py-1.5 tracking-widest transition-all rounded-lg border flex items-center gap-2 disabled:opacity-20 active:scale-95 ${showGutters ? 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100' : 'bg-ink-850 border-ink-700 text-steel-400 hover:bg-ink-800 hover:text-steel-200'}`}
                  >
                    <Sparkles className="w-4 h-4" />
                    GENERATE ALL
                  </button>
                  <p className="text-[9px] font-mono text-steel-600 mt-1 max-w-[200px] text-center">
                    Batch generation may consume significant API credits depending on your provider and plan. Review the panel count before proceeding.
                  </p>
                </>
              )}
            </div>
          )}
          {/* Page Templates */}
          <div className="relative">
            <button
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className={`font-mono text-[10px] px-3 py-1.5 tracking-widest transition-all rounded-lg border flex items-center gap-2 active:scale-95 ${showGutters ? 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100' : 'bg-ink-850 border-ink-700 text-steel-400 hover:bg-ink-800 hover:text-steel-200'}`}
              title="Apply page template"
            >
              <LayoutGrid size={16} />
              TEMPLATES
            </button>
            {showTemplateMenu && (
              <div className={`absolute top-full right-0 mt-2 w-48 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in py-1 ${showGutters ? 'bg-white border border-gray-300' : 'bg-ink-900 border border-ink-700'}`}>
                <button 
                  onClick={() => { activePage && dispatch({ type: 'APPLY_PAGE_TEMPLATE', pageId: activePage.id, template: '2x2' }); setShowTemplateMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}
                >
                  <Grid2X2 size={16} /> 2×2 Grid
                </button>
                <button 
                  onClick={() => { activePage && dispatch({ type: 'APPLY_PAGE_TEMPLATE', pageId: activePage.id, template: '3x3' }); setShowTemplateMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}
                >
                  <Grid3X3 size={16} /> 3×3 Grid
                </button>
                <button 
                  onClick={() => { activePage && dispatch({ type: 'APPLY_PAGE_TEMPLATE', pageId: activePage.id, template: '2x3' }); setShowTemplateMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}
                >
                  <Columns size={16} /> 2×3 Rows
                </button>
                <button 
                  onClick={() => { activePage && dispatch({ type: 'APPLY_PAGE_TEMPLATE', pageId: activePage.id, template: 'manga-right' }); setShowTemplateMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}
                >
                  <LayoutGrid size={16} /> Manga (R→L)
                </button>
                <button 
                  onClick={() => { activePage && dispatch({ type: 'APPLY_PAGE_TEMPLATE', pageId: activePage.id, template: 'manga-left' }); setShowTemplateMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}
                >
                  <LayoutGrid size={16} /> Manga (L→R)
                </button>
                <button 
                  onClick={() => { activePage && dispatch({ type: 'APPLY_PAGE_TEMPLATE', pageId: activePage.id, template: 'single' }); setShowTemplateMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}
                >
                  <Square size={16} /> Single Splash
                </button>
                <button 
                  onClick={() => { activePage && dispatch({ type: 'APPLY_PAGE_TEMPLATE', pageId: activePage.id, template: 'double-wide' }); setShowTemplateMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors flex items-center gap-3 ${showGutters ? 'text-gray-700 hover:bg-gray-100' : 'text-steel-300 hover:bg-ember-500 hover:text-ink-950'}`}
                >
                  <RectangleHorizontal size={16} /> Double Wide
                </button>
              </div>
            )}
          </div>
          {/* Script Panel Toggle */}
          {activeIssue?.scriptText && (
            <button
              onClick={() => setShowScriptPanel(!showScriptPanel)}
              className={`font-mono text-xs px-4 py-2 tracking-widest transition-all rounded-full border flex items-center gap-2 active:scale-95 shadow-lg ${showScriptPanel ? 'bg-ember-500 border-ember-400 text-ink-950' : showGutters ? 'bg-white border-black text-black hover:bg-gray-100' : 'bg-ink-800 border-ink-700 text-steel-200 hover:bg-ink-700'}`}
              title="Toggle script reference panel"
            >
              <FileText size={16} />
              SCRIPT
            </button>
          )}
          {/* Character Bank */}
          <button
            onClick={() => setShowCharacterBank(true)}
            className={`font-mono text-xs px-4 py-2 tracking-widest transition-all rounded-full border flex items-center gap-2 active:scale-95 shadow-lg ${showGutters ? 'bg-white border-black text-black hover:bg-gray-100' : 'bg-ink-800 border-ink-700 text-steel-200 hover:bg-ink-700'}`}
            title="Manage characters"
          >
            <Users size={16} />
            CHARACTERS
          </button>
          {/* Read-through Mode */}
          <button
            onClick={() => setShowReadThrough(true)}
            disabled={totalIssuePanels === 0}
            className={`font-mono text-xs px-4 py-2 tracking-widest transition-all rounded-full border flex items-center gap-2 active:scale-95 shadow-lg disabled:opacity-30 ${showGutters ? 'bg-white border-black text-black hover:bg-gray-100' : 'bg-ink-800 border-ink-700 text-steel-200 hover:bg-ink-700'}`}
            title="Cinematic presentation mode"
          >
            <Play size={16} />
            PRESENT{totalIssuePanels > 0 ? ` (${totalIssuePanels})` : ''}
          </button>
          {/* Auto-Link: scan panels and match characters by name */}
          {activeIssue && characters.length > 0 && (
            <button
              onClick={handleAutoLink}
              className={`font-mono text-[10px] px-3 py-1.5 tracking-widest transition-all rounded-lg border flex items-center gap-2 active:scale-95 ${showGutters ? 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100' : 'bg-ink-850 border-ink-700 text-steel-400 hover:bg-ink-800 hover:text-steel-200'}`}
              title="Scan panels and auto-link characters by name"
            >
              <Link2 size={14} />
              AUTO-LINK
            </button>
          )}
          <button onClick={() => {
            if (activePage) {
              dispatch({ type: 'ADD_PANEL', pageId: activePage.id });
            } else if (activeIssue && activeIssue.pages.length > 0) {
              // activePage is stale - use first page of active issue
              const fallbackPage = activeIssue.pages[0];
              dispatch({ type: 'SET_ACTIVE_PAGE', id: fallbackPage.id });
              dispatch({ type: 'ADD_PANEL', pageId: fallbackPage.id });
            } else if (activeIssue) {
              // No pages at all - create one first
              dispatch({ type: 'ADD_PAGE', issueId: activeIssue.id });
            }
          }} className={`font-display text-xl px-6 py-2 tracking-widest transition-all rounded-full shadow-lg active:translate-y-1 ${showGutters ? 'bg-black text-white hover:bg-gray-800' : 'bg-ember-500 hover:bg-ember-400 text-ink-950'}`}>
            ADD FRAME
          </button>
        </div>
      </div>
      {/* Accent underline */}
      <div className={`h-[1px] ${showGutters ? 'bg-gray-300' : 'header-gradient-ember'}`} />
    </header>
  );
};

export default InkToolbar;
