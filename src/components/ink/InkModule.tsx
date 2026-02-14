import React from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { X } from 'lucide-react';

import { useInkLogic } from '../../hooks/useInkLogic';
// import { ScriptImportModal } from './ScriptImportModal'; // Removed - using store-based import now

import Sidebar from './Sidebar';
import ProjectHub from './ProjectHub';
import CharacterBank from './CharacterBank';
import UserGuide from './UserGuide';
import PresentMode from './PresentMode';
import { SplitView } from './SplitView';
import InkToolbar from './InkToolbar';
import InkCanvas, { ZoomableCanvas, SpreadCanvas } from './InkCanvas';

const InkModule: React.FC = () => {
  // Use the extracted hook for all business logic
  const logic = useInkLogic();

  // Compute values for toolbar
  const activePanels = logic.activePage ? logic.activePage.panels.filter(
    (panel: any) => (panel.prompt?.trim() || panel.characterIds.length > 0) && !panel.imageUrl
  ) : [];
  
  const totalIssuePanels = logic.activeIssue?.pages.reduce((sum: number, p: any) => sum + p.panels.length, 0) || 0;

  return (
    <div className={`flex-1 flex overflow-hidden font-sans selection:bg-ember-500/30 ${logic.showGutters ? 'bg-paper' : 'bg-paper'}`}>
      <Sidebar
        state={logic.state as any}
        dispatch={logic.dispatch as any}
        onOpenProjects={() => logic.setProjectsOpen(true)}
        onOpenScriptImport={logic.handleImportFromStore}
      />

      <TransformWrapper
        disabled={!logic.zoomEnabled}
        initialScale={1}
        minScale={0.1}
        maxScale={3}
        centerOnInit={true}
        limitToBounds={false}
        panning={{ disabled: !logic.zoomEnabled, velocityDisabled: true }}
        wheel={{ disabled: !logic.zoomEnabled }}
      >
        <main className={`flex-1 flex flex-col overflow-hidden relative transition-colors ${logic.showGutters ? 'bg-paper' : 'bg-paper'} ${logic.zoomEnabled ? 'cursor-grab active:cursor-grabbing' : ''}`}>
          <InkToolbar
            showGutters={logic.showGutters}
            activeProject={logic.activeProject}
            activeIssue={logic.activeIssue}
            activePage={logic.activePage}
            activeTab={logic.activeTab}
            setActiveTab={logic.setActiveTab}
            user={logic.user}
            syncStatus={logic.syncStatus}
            signOut={logic.signOut}
            inkCanUndo={logic.inkCanUndo}
            inkCanRedo={logic.inkCanRedo}
            dispatch={logic.dispatch}
            showExportMenu={logic.showExportMenu}
            setShowExportMenu={logic.setShowExportMenu}
            exporting={logic.exporting}
            handleExportPage={logic.handleExportPage}
            handleExportIssue={logic.handleExportIssue}
            handleExportPagePDF={logic.handleExportPagePDF}
            handleExportIssuePDF={logic.handleExportIssuePDF}
            batching={logic.batching}
            generatePage={logic.generatePage}
            activePanels={activePanels}
            isGeneratingAll={logic.isGeneratingAll}
            currentPanel={logic.currentPanel}
            totalPanels={logic.totalPanels}
            cancelGenerationRef={logic.cancelGenerationRef}
            handleGenerateAll={logic.handleGenerateAll}
            showTemplateMenu={logic.showTemplateMenu}
            setShowTemplateMenu={logic.setShowTemplateMenu}
            setShowScriptPanel={logic.setShowScriptPanel}
            showScriptPanel={logic.showScriptPanel}
            setShowCharacterBank={logic.setShowCharacterBank}
            setShowReadThrough={logic.setShowReadThrough}
            totalIssuePanels={totalIssuePanels}
            handleAutoLink={logic.handleAutoLink}
            characters={logic.characters}
            zoomEnabled={logic.zoomEnabled}
            setZoomEnabled={logic.setZoomEnabled}
            setShowGutters={logic.setShowGutters}
            showSpreadView={logic.showSpreadView}
            setShowSpreadView={logic.setShowSpreadView}
            showSplitView={logic.showSplitView}
            setShowSplitView={logic.setShowSplitView}
          />

          {logic.activeTab === 'canvas' ? (
            <>
              <div className={`flex-1 ${logic.zoomEnabled ? 'overflow-hidden' : 'overflow-scroll'}`}>
                {logic.showSplitView && logic.activeIssue ? (
                  <SplitView
                    issue={logic.activeIssue}
                    activePanelId={logic.selectedPanelId}
                    onPanelClick={(panelId) => logic.setSelectedPanelId(panelId)}
                    onScriptSectionClick={(panelId) => logic.setSelectedPanelId(panelId)}
                    onSyncPrompt={(panelId, newPrompt) => {
                      logic.dispatch({ type: 'UPDATE_PANEL', panelId, updates: { prompt: newPrompt } });
                    }}
                    onReparseApply={(updatedPages) => {
                      if (logic.activeIssue) {
                        logic.dispatch({ 
                          type: 'UPDATE_ISSUE', 
                          issueId: logic.activeIssue.id, 
                          updates: { pages: updatedPages } 
                        });
                      }
                    }}
                  >
                    <TransformComponent 
                      wrapperClass="w-full h-full" 
                      contentClass=""
                    >
                      {logic.showSpreadView ? (
                        <SpreadCanvas
                          activePage={logic.activePage}
                          activeProject={logic.activeProject}
                          activeIssue={logic.activeIssue}
                          dispatch={logic.dispatch}
                          sensors={logic.sensors}
                          handleDragStart={logic.handleDragStart}
                          handleDragEnd={logic.handleDragEnd}
                          activeId={logic.activeId}
                          activePanelForOverlay={logic.activePanelForOverlay}
                          showGutters={logic.showGutters}
                          zoomEnabled={logic.zoomEnabled}
                          selectedPanelId={logic.selectedPanelId}
                          setSelectedPanelId={logic.setSelectedPanelId}
                          copiedPanelSettings={logic.copiedPanelSettings}
                          setCopiedPanelSettings={logic.setCopiedPanelSettings}
                        />
                      ) : (
                        <ZoomableCanvas
                          activePage={logic.activePage}
                          activeProject={logic.activeProject}
                          dispatch={logic.dispatch}
                          sensors={logic.sensors}
                          handleDragStart={logic.handleDragStart}
                          handleDragEnd={logic.handleDragEnd}
                          activeId={logic.activeId}
                          activePanelForOverlay={logic.activePanelForOverlay}
                          showGutters={logic.showGutters}
                          zoomEnabled={logic.zoomEnabled}
                          selectedPanelId={logic.selectedPanelId}
                          setSelectedPanelId={logic.setSelectedPanelId}
                          copiedPanelSettings={logic.copiedPanelSettings}
                          setCopiedPanelSettings={logic.setCopiedPanelSettings}
                        />
                      )}
                    </TransformComponent>
                  </SplitView>
                ) : (
                  <TransformComponent 
                    wrapperClass="w-full h-full" 
                    contentClass=""
                  >
                    {logic.showSpreadView ? (
                      <SpreadCanvas
                        activePage={logic.activePage}
                        activeProject={logic.activeProject}
                        activeIssue={logic.activeIssue}
                        dispatch={logic.dispatch}
                        sensors={logic.sensors}
                        handleDragStart={logic.handleDragStart}
                        handleDragEnd={logic.handleDragEnd}
                        activeId={logic.activeId}
                        activePanelForOverlay={logic.activePanelForOverlay}
                        showGutters={logic.showGutters}
                        zoomEnabled={logic.zoomEnabled}
                        selectedPanelId={logic.selectedPanelId}
                        setSelectedPanelId={logic.setSelectedPanelId}
                        copiedPanelSettings={logic.copiedPanelSettings}
                        setCopiedPanelSettings={logic.setCopiedPanelSettings}
                      />
                    ) : (
                      <ZoomableCanvas
                        activePage={logic.activePage}
                        activeProject={logic.activeProject}
                        dispatch={logic.dispatch}
                        sensors={logic.sensors}
                        handleDragStart={logic.handleDragStart}
                        handleDragEnd={logic.handleDragEnd}
                        activeId={logic.activeId}
                        activePanelForOverlay={logic.activePanelForOverlay}
                        showGutters={logic.showGutters}
                        zoomEnabled={logic.zoomEnabled}
                        selectedPanelId={logic.selectedPanelId}
                        setSelectedPanelId={logic.setSelectedPanelId}
                        copiedPanelSettings={logic.copiedPanelSettings}
                        setCopiedPanelSettings={logic.setCopiedPanelSettings}
                      />
                    )}
                  </TransformComponent>
                )}
              </div>

              <InkCanvas
                activePage={logic.activePage}
                activeProject={logic.activeProject}
                activeIssue={logic.activeIssue}
                dispatch={logic.dispatch}
                sensors={logic.sensors}
                handleDragStart={logic.handleDragStart}
                handleDragEnd={logic.handleDragEnd}
                activeId={logic.activeId}
                activePanelForOverlay={logic.activePanelForOverlay}
                showGutters={logic.showGutters}
                zoomEnabled={logic.zoomEnabled}
                selectedPanelId={logic.selectedPanelId}
                setSelectedPanelId={logic.setSelectedPanelId}
                copiedPanelSettings={logic.copiedPanelSettings}
                setCopiedPanelSettings={logic.setCopiedPanelSettings}
                showSpreadView={logic.showSpreadView}
                batching={logic.batching}
                exporting={logic.exporting}
                isGeneratingAll={logic.isGeneratingAll}
                currentPanel={logic.currentPanel}
                totalPanels={logic.totalPanels}
                handlePreviousPage={logic.handlePreviousPage}
                handleNextPage={logic.handleNextPage}
              />
            </>
          ) : (
            <UserGuide showGutters={logic.showGutters} />
          )}
        </main>
      </TransformWrapper>

      {logic.projectsOpen && <ProjectHub state={logic.state as any} dispatch={logic.dispatch as any} onClose={() => logic.setProjectsOpen(false)} />}
      {/* ScriptImportModal removed - now using handleImportFromStore which reads from Zustand store */}
      {logic.showCharacterBank && logic.activeProject && (
        <CharacterBank 
          characters={logic.characters as any} 
          dispatch={logic.dispatch} 
          onClose={() => logic.setShowCharacterBank(false)} 
        />
      )}
      
      {/* Side-by-side Script Panel */}
      {logic.showScriptPanel && logic.activeIssue?.scriptText && (
        <div className="fixed right-0 top-0 h-full w-[400px] bg-card border-l border-stone-200 shadow-2xl z-[500] flex flex-col animate-slide-in">
          <div className="flex items-center justify-between p-4 border-b border-stone-200">
            <h3 className="font-body text-xs uppercase tracking-widest text-stone-600">Script Reference</h3>
            <button onClick={() => logic.setShowScriptPanel(false)} className="p-2 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-ink transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <pre className="text-ink text-sm font-mono whitespace-pre-wrap leading-relaxed">{logic.activeIssue.scriptText}</pre>
          </div>
        </div>
      )}

      {/* Cinematic Presentation Mode */}
      {logic.showReadThrough && logic.activeIssue && logic.activeIssue.pages.some((p: any) => p.panels.length > 0) && (
        <PresentMode
          issue={logic.activeIssue}
          onClose={() => logic.setShowReadThrough(false)}
          textOverlayStyle={logic.activeProject?.textOverlayStyle || 'opaque'}
        />
      )}
    </div>
  );
}

export default InkModule;