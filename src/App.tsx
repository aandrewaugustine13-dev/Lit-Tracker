import React, { useEffect } from 'react';
import { useLitStore } from './store';
import GlobalSidebar from './components/shared/GlobalSidebar';
import DetailPanel from './components/shared/DetailPanel';
import InkModule from './components/ink/InkModule';
import CharactersModule from './components/characters/CharactersModule';
import LoreModule from './components/lore/LoreModule';
import { AuthProvider } from './context/AuthContext';

function AppContent() {
  const { activeModule } = useLitStore();

  // Keyboard shortcuts
  useEffect(() => {
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
  }, []);

  const renderModule = () => {
    switch (activeModule) {
      case 'ink': return <InkModule />;
      case 'characters': return <CharactersModule />;
      case 'lore': return <LoreModule />;
      default: return <CharactersModule />;
    }
  };

  return (
    <div className="flex h-screen bg-ink-950 text-steel-300 overflow-hidden">
      <GlobalSidebar />
      {renderModule()}
      <DetailPanel />
    </div>
  );
}

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
