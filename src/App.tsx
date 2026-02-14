import React, { useEffect, useState, Suspense, lazy } from 'react';
import { useLitStore } from './store';
import Gatekeeper from './components/shared/Gatekeeper';
import { AuthProvider } from './context/AuthContext';
import { ScriptInput } from './components/ScriptInput';
import { LoreTracker } from './components/LoreTracker';
import { saveParsedScript } from './services/storage';
import type { ParsedScript } from './utils/scriptParser';

// Lazy load workspace components for code splitting
const GlobalSidebar = lazy(() => import('./components/shared/GlobalSidebar'));
const DetailPanel = lazy(() => import('./components/shared/DetailPanel'));
const InkModule = lazy(() => import('./components/ink/InkModule'));
const CharactersModule = lazy(() => import('./components/characters/CharactersModule'));
const LoreModule = lazy(() => import('./components/lore/LoreModule'));
const ParserTestPage = lazy(() => import('./components/parser/ParserTestPage').then(m => ({ default: m.ParserTestPage })));

// Loading fallback component with branded workspace theme
const WorkspaceLoadingFallback: React.FC = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-paper">
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <div className="w-12 h-12 border-4 border-stone-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-stone-500 font-body text-sm uppercase tracking-widest">Loading Workspace...</p>
    </div>
  </div>
);

function AppContent() {
  const { activeModule, inkState } = useLitStore();

  // Check if we're in parser test mode
  const isParserTestMode = window.location.search.includes('parser-test');
  
  // Check if we're in script parser mode
  const isScriptParserMode = window.location.search.includes('script-parser');
  
  // State for script parser mode
  const [parsedData, setParsedData] = useState<ParsedScript | null>(null);
  const [highlightedPanels, setHighlightedPanels] = useState<string[]>([]);

  // Keyboard shortcuts (only when app is active, not on Gatekeeper)
  useEffect(() => {
    if (!inkState.activeProjectId) return;

    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') useLitStore.getState().setActiveModule('ink');
      if (e.altKey && e.key === '2') useLitStore.getState().setActiveModule('characters');
      if (e.altKey && e.key === '3') useLitStore.getState().setActiveModule('lore');
      // Escape closes detail panel
      if (e.key === 'Escape' && useLitStore.getState().detailTarget) {
        useLitStore.getState().closeDetail();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [inkState.activeProjectId]);

  // Render parser test page if in test mode
  if (isParserTestMode) {
    return (
      <Suspense fallback={<WorkspaceLoadingFallback />}>
        <ParserTestPage />
      </Suspense>
    );
  }
  
  // Render script parser mode if in script-parser mode
  if (isScriptParserMode) {
    const handleParsed = async (result: ParsedScript) => {
      setParsedData(result);
      
      // Fire-and-forget save to database
      if (inkState.activeProjectId) {
        saveParsedScript(result, inkState.activeProjectId).catch((error) => {
          console.error('Failed to save parsed script:', error);
        });
      }
    };
    
    return (
      <div className="flex h-screen bg-paper text-ink overflow-hidden">
        {/* Sidebar with Lore Tracker */}
        <div className="w-96 border-r border-stone-200 overflow-hidden">
          <LoreTracker 
            parsedData={parsedData} 
            onHighlightPanels={setHighlightedPanels}
          />
        </div>
        
        {/* Main area with Script Input */}
        <div className="flex-1 overflow-hidden">
          <ScriptInput onParsed={handleParsed} />
          
          {/* Display highlighted panel refs when hovering lore items */}
          {highlightedPanels.length > 0 && (
            <div className="fixed bottom-4 right-4 px-4 py-2 bg-ink text-paper rounded-lg shadow-lg">
              <p className="text-sm font-mono">
                Highlighted panels: {highlightedPanels.join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderModule = () => {
    switch (activeModule) {
      case 'ink': return <InkModule />;
      case 'characters': return <CharactersModule />;
      case 'lore': return <LoreModule />;
      default: return <CharactersModule />;
    }
  };

  if (!inkState.activeProjectId) {
    return <Gatekeeper />;
  }

  return (
    <Suspense fallback={<WorkspaceLoadingFallback />}>
      <div className="flex h-screen bg-paper text-ink overflow-hidden">
        <GlobalSidebar />
        {renderModule()}
        <DetailPanel />
      </div>
    </Suspense>
  );
}

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
