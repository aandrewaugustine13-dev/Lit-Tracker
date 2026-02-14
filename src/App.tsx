import React, { useEffect, useState, Suspense, lazy } from 'react';
import { useLitStore } from './store';
import Gatekeeper from './components/shared/Gatekeeper';
import { AuthProvider } from './context/AuthContext';

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
