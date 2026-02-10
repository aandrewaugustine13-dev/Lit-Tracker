import React, { useMemo } from 'react';
import { DndContext, Modifier } from '@dnd-kit/core';
import { useTransformContext } from 'react-zoom-pan-pinch';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Page, AspectRatio } from '../../types';
import { useLitStore } from '../../store';
import PanelCard from './PanelCard';
import EmptyState from './EmptyState';
import { StatusBarIndicator } from './GenerationSpinner';

/**
 * Custom modifier for dnd-kit to handle the scale factor from react-zoom-pan-pinch.
 * Without this, the drag overlay moves at a different speed than the mouse when zoomed.
 */
export const createScaleModifier = (scale: number): Modifier => ({ transform }) => {
  return {
    ...transform,
    x: transform.x / scale,
    y: transform.y / scale,
  };
};

// Canvas constants
export const DEFAULT_CANVAS_WIDTH = 2000;
export const DEFAULT_CANVAS_HEIGHT = 1500;

// Interface for canvas component props
export interface CanvasProps {
  activePage: Page | undefined;
  activeProject: any;
  activeIssue?: any;
  dispatch: any;
  sensors: any;
  handleDragStart: any;
  handleDragEnd: any;
  activeId: string | null;
  activePanelForOverlay: any;
  showGutters: boolean;
  zoomEnabled: boolean;
  selectedPanelId: string | null;
  setSelectedPanelId: (id: string | null) => void;
  copiedPanelSettings: { aspectRatio: AspectRatio; characterIds: string[] } | null;
  setCopiedPanelSettings: (settings: { aspectRatio: AspectRatio; characterIds: string[] } | null) => void;
}

interface InkCanvasProps {
  activePage: any;
  activeProject: any;
  activeIssue: any;
  dispatch: any;
  sensors: any;
  handleDragStart: any;
  handleDragEnd: any;
  activeId: string | null;
  activePanelForOverlay: any;
  showGutters: boolean;
  zoomEnabled: boolean;
  selectedPanelId: string | null;
  setSelectedPanelId: (id: string | null) => void;
  copiedPanelSettings: { aspectRatio: AspectRatio; characterIds: string[] } | null;
  setCopiedPanelSettings: (settings: { aspectRatio: AspectRatio; characterIds: string[] } | null) => void;
  showSpreadView: boolean;
  batching: boolean;
  exporting: boolean;
  isGeneratingAll: boolean;
  currentPanel: number;
  totalPanels: number;
  handlePreviousPage: () => void;
  handleNextPage: () => void;
}

/**
 * Sub-component to hold DndContext and freeform canvas inside the TransformWrapper.
 * This allows panels to be positioned anywhere on the canvas.
 */
export function ZoomableCanvas({
  activePage, activeProject, dispatch, sensors, handleDragStart, handleDragEnd,
  activeId, activePanelForOverlay, showGutters, zoomEnabled,
  selectedPanelId, setSelectedPanelId, copiedPanelSettings, setCopiedPanelSettings
}: any) {
  const { characters } = useLitStore();
  const { state: transformState } = useTransformContext() as any;
  const scale = transformState?.scale || 1;

  // Create scale modifier inside the component so it updates with scale changes
  const modifiers = useMemo(() => [createScaleModifier(scale)], [scale]);

  // Calculate canvas size based on panel positions
  const canvasSize = useMemo(() => {
    if (!activePage?.panels.length) return { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT };
    let maxX = DEFAULT_CANVAS_WIDTH;
    let maxY = DEFAULT_CANVAS_HEIGHT;
    activePage.panels.forEach((p: any) => {
      const panelRight = (p.x || 0) + (p.width || 360) + 100;
      const panelBottom = (p.y || 0) + (p.height || 420) + 100;
      if (panelRight > maxX) maxX = panelRight;
      if (panelBottom > maxY) maxY = panelBottom;
    });
    return { width: Math.max(DEFAULT_CANVAS_WIDTH, maxX), height: Math.max(DEFAULT_CANVAS_HEIGHT, maxY) };
  }, [activePage?.panels]);

  return (
    <div 
      className={`relative transition-all ${zoomEnabled ? 'pointer-events-none [&>*]:pointer-events-auto' : ''}`}
      style={{ 
        width: canvasSize.width, 
        height: canvasSize.height,
        minWidth: '100%',
        minHeight: '100%',
        background: showGutters 
          ? 'repeating-linear-gradient(0deg, transparent, transparent 39px, #e5e5e5 39px, #e5e5e5 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #e5e5e5 39px, #e5e5e5 40px)'
          : 'repeating-linear-gradient(0deg, transparent, transparent 39px, #e7e5e4 39px, #e7e5e4 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #e7e5e4 39px, #e7e5e4 40px)'
      }}
    >
    {!activePage || activePage.panels.length === 0 ? (
      <div className="sticky top-4 right-0 w-full flex justify-start pl-2 pointer-events-none" style={{ zIndex: 10 }}>
        <p className={`font-body text-sm tracking-wide pointer-events-auto ${showGutters ? 'text-gray-500' : 'text-stone-500'}`}>
          ← Click the 📁 in the sidebar to start storyboarding
        </p>
      </div>
    ) : (
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} modifiers={modifiers}>
      {activePage.panels.map((panel: any, idx: number) => (
        <PanelCard
        key={panel.id}
        panel={panel}
        pageId={activePage.id}
        dispatch={dispatch}
        project={activeProject!}
        characters={characters as any}
        index={idx}
        total={activePage.panels.length}
        showGutters={showGutters}
        activePage={activePage}
        isDragging={activeId === panel.id}
        isSelected={selectedPanelId === panel.id}
        onSelect={() => setSelectedPanelId(panel.id)}
        copiedSettings={copiedPanelSettings}
        onCopySettings={() => setCopiedPanelSettings({ aspectRatio: panel.aspectRatio, characterIds: panel.characterIds })}
        onPasteSettings={() => {
          if (copiedPanelSettings) {
            dispatch({ 
              type: 'UPDATE_PANEL', 
              panelId: panel.id, 
              updates: { 
                aspectRatio: copiedPanelSettings.aspectRatio, 
                characterIds: copiedPanelSettings.characterIds 
              } 
            });
          }
        }}
        panelFrameStyle={activeProject?.panelFrameStyle || 'opaque-black'}
        textOverlayStyle={activeProject?.textOverlayStyle || 'opaque'}
        />
      ))}
      </DndContext>
    )}
    </div>
  );
}

/**
 * Component to display two pages side-by-side in spread view
 */
export function SpreadCanvas({
  activePage, activeProject, dispatch, sensors, handleDragStart, handleDragEnd,
  activeId, activePanelForOverlay, showGutters, zoomEnabled,
  selectedPanelId, setSelectedPanelId, copiedPanelSettings, setCopiedPanelSettings,
  activeIssue
}: CanvasProps) {
  const { characters } = useLitStore();
  const { state: transformState } = useTransformContext() as any;
  const scale = transformState?.scale || 1;
  const modifiers = useMemo(() => [createScaleModifier(scale)], [scale]);

  if (!activePage || !activeIssue) return null;

  // Determine which pages to show
  const currentPageIndex = activeIssue.pages.findIndex((p: Page) => p.id === activePage.id);
  
  // For even-numbered pages (2, 4, 6...), show current (even) on left, next (odd) on right
  // For odd-numbered pages (1, 3, 5...), show previous (even) on left, current (odd) on right
  let leftPage: Page | null = null;
  let rightPage: Page | null = null;

  if (activePage.number % 2 === 0) {
    // Current page is even - goes on left
    leftPage = activePage;
    rightPage = currentPageIndex < activeIssue.pages.length - 1 ? activeIssue.pages[currentPageIndex + 1] : null;
  } else {
    // Current page is odd - goes on right
    leftPage = currentPageIndex > 0 ? activeIssue.pages[currentPageIndex - 1] : null;
    rightPage = activePage;
  }

  const renderPageCanvas = (page: Page | null, side: 'left' | 'right') => {
    if (!page) {
      return (
        <div className={`flex-1 flex items-center justify-center ${showGutters ? 'bg-gray-100' : 'bg-paper'}`}>
          <p className={`font-body text-sm ${showGutters ? 'text-gray-400' : 'text-stone-500'}`}>No page</p>
        </div>
      );
    }

    const canvasSize = { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT };
    page.panels.forEach((p: any) => {
      const panelRight = (p.x || 0) + (p.width || 360) + 100;
      const panelBottom = (p.y || 0) + (p.height || 420) + 100;
      canvasSize.width = Math.max(canvasSize.width, panelRight);
      canvasSize.height = Math.max(canvasSize.height, panelBottom);
    });

    return (
      <div className="flex-1 flex flex-col">
        <div 
          className={`relative transition-all ${zoomEnabled ? 'pointer-events-none [&>*]:pointer-events-auto' : ''}`}
          style={{ 
            width: canvasSize.width, 
            height: canvasSize.height,
            minWidth: '100%',
            minHeight: '100%',
            background: showGutters 
              ? 'repeating-linear-gradient(0deg, transparent, transparent 39px, #e5e5e5 39px, #e5e5e5 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #e5e5e5 39px, #e5e5e5 40px)'
              : 'repeating-linear-gradient(0deg, transparent, transparent 39px, #e7e5e4 39px, #e7e5e4 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #e7e5e4 39px, #e7e5e4 40px)'
          }}
        >
          {page.panels.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <EmptyState
                variant="page-spread"
                showGutters={showGutters}
                onAction={() => dispatch({ type: 'ADD_PANEL', pageId: page.id })}
                actionLabel="Add Frame"
              />
            </div>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} modifiers={modifiers}>
              {page.panels.map((panel: any, idx: number) => (
                <PanelCard
                  key={panel.id}
                  panel={panel}
                  pageId={page.id}
                  dispatch={dispatch}
                  project={activeProject!}
                  characters={characters as any}
                  index={idx}
                  total={page.panels.length}
                  showGutters={showGutters}
                  activePage={page}
                  isDragging={activeId === panel.id}
                  isSelected={selectedPanelId === panel.id}
                  onSelect={() => setSelectedPanelId(panel.id)}
                  copiedSettings={copiedPanelSettings}
                  onCopySettings={() => setCopiedPanelSettings({ aspectRatio: panel.aspectRatio, characterIds: panel.characterIds })}
                  onPasteSettings={() => {
                    if (copiedPanelSettings) {
                      dispatch({ 
                        type: 'UPDATE_PANEL', 
                        panelId: panel.id, 
                        updates: { 
                          aspectRatio: copiedPanelSettings.aspectRatio, 
                          characterIds: copiedPanelSettings.characterIds 
                        } 
                      });
                    }
                  }}
                  panelFrameStyle={activeProject?.panelFrameStyle || 'opaque-black'}
                  textOverlayStyle={activeProject?.textOverlayStyle || 'opaque'}
                />
              ))}
            </DndContext>
          )}
        </div>
        {/* Page number label */}
        <div className={`text-center py-2 text-xs font-body ${showGutters ? 'text-gray-600 bg-gray-50' : 'text-stone-600 bg-card'}`}>
          Page {page.number}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex">
      {/* Left page */}
      <div className="flex-1 flex flex-col border-r-2" style={{ 
        borderColor: showGutters ? '#d1d5db' : '#e7e5e4',
        boxShadow: showGutters 
          ? 'inset -8px 0 12px -8px rgba(0,0,0,0.15)' 
          : 'inset -8px 0 12px -8px rgba(0,0,0,0.1)'
      }}>
        {renderPageCanvas(leftPage, 'left')}
      </div>

      {/* Center gutter (book spine) */}
      <div 
        className="w-1"
        style={{ 
          background: showGutters 
            ? 'linear-gradient(90deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.1) 100%)'
            : 'linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.15) 100%)'
        }}
      />

      {/* Right page */}
      <div className="flex-1 flex flex-col border-l-2" style={{ 
        borderColor: showGutters ? '#d1d5db' : '#e7e5e4',
        boxShadow: showGutters 
          ? 'inset 8px 0 12px -8px rgba(0,0,0,0.15)' 
          : 'inset 8px 0 12px -8px rgba(0,0,0,0.1)'
      }}>
        {renderPageCanvas(rightPage, 'right')}
      </div>
    </div>
  );
}

/**
 * Main canvas component with status bar
 */
const InkCanvas: React.FC<InkCanvasProps> = ({
  activePage,
  activeProject,
  activeIssue,
  dispatch,
  sensors,
  handleDragStart,
  handleDragEnd,
  activeId,
  activePanelForOverlay,
  showGutters,
  zoomEnabled,
  selectedPanelId,
  setSelectedPanelId,
  copiedPanelSettings,
  setCopiedPanelSettings,
  showSpreadView,
  batching,
  exporting,
  isGeneratingAll,
  currentPanel,
  totalPanels,
  handlePreviousPage,
  handleNextPage,
}) => {
  return (
    <>
      {/* Status bar with page navigation */}
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 border rounded-full px-8 py-4 flex items-center gap-10 z-[400] transition-all ${showGutters ? 'bg-white border-black text-black shadow-2xl' : 'bg-card border-stone-200 shadow-sm text-ink'}`}>
        <div className="flex items-center gap-4">
          <StatusBarIndicator
            batching={batching}
            exporting={exporting}
            isGeneratingAll={isGeneratingAll}
            provider={activeProject?.imageProvider}
            currentPanel={currentPanel}
            totalPanels={totalPanels}
            showGutters={showGutters}
          />
        </div>
        <div className={`h-5 w-px ${showGutters ? 'bg-black/20' : 'bg-stone-200'}`}></div>
        <div className="flex gap-8">
          <div className="flex flex-col">
            <span className="text-[9px] font-body uppercase mb-0.5 opacity-60">Project</span>
            <span className={`text-[11px] font-body uppercase font-bold truncate max-w-[120px] ${showGutters ? 'text-black' : 'text-ink'}`}>{activeProject?.title}</span>
          </div>
        </div>
        <div className={`h-5 w-px ${showGutters ? 'bg-black/20' : 'bg-stone-200'}`}></div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePreviousPage}
            disabled={!activeIssue || activeIssue.pages.findIndex((p: Page) => p.id === activePage?.id) === 0}
            className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              showGutters 
                ? 'hover:bg-gray-200 text-gray-600' 
                : 'hover:bg-stone-100 text-stone-600 hover:text-ink'
            }`}
            title="Previous Page"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-[10px] font-body uppercase tracking-wide">
            {showSpreadView && activeIssue && activePage ? (() => {
              const currentIndex = activeIssue.pages.findIndex((p: Page) => p.id === activePage.id);
              const leftPage = activePage.number % 2 === 0 ? activePage : (currentIndex > 0 ? activeIssue.pages[currentIndex - 1] : null);
              const rightPage = activePage.number % 2 === 0 ? (currentIndex < activeIssue.pages.length - 1 ? activeIssue.pages[currentIndex + 1] : null) : activePage;
              if (leftPage && rightPage) {
                return `Pages ${leftPage.number}-${rightPage.number}`;
              } else if (rightPage) {
                return `Page ${rightPage.number}`;
              } else if (leftPage) {
                return `Page ${leftPage.number}`;
              }
              return 'Page 1';
            })() : `Page ${activePage?.number || 1}`}
          </span>
          <button 
            onClick={handleNextPage}
            disabled={!activeIssue || !activePage || activeIssue.pages.findIndex((p: Page) => p.id === activePage.id) >= activeIssue.pages.length - 1}
            className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              showGutters 
                ? 'hover:bg-gray-200 text-gray-600' 
                : 'hover:bg-stone-100 text-stone-600 hover:text-ink'
            }`}
            title="Next Page"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </>
  );
};

export default InkCanvas;
