import { useState } from 'react';
import { EngineProvider } from './core/EngineContext';
import TopAppBar from './components/TopAppBar';
import type { TabId } from './components/TopAppBar';
import SideNavBar from './components/SideNavBar';
import FooterBar from './components/FooterBar';
import DOMPage from './pages/DOMPage';
import LayoutPage from './pages/LayoutPage';
import ScriptingPage from './pages/ScriptingPage';
import PaintPage from './pages/PaintPage';
import GPUPage from './pages/GPUPage';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('DOM');

  const renderPage = () => {
    switch (activeTab) {
      case 'DOM': return <DOMPage />;
      case 'LAYOUT': return <LayoutPage />;
      case 'SCRIPTING': return <ScriptingPage />;
      case 'PAINT': return <PaintPage />;
      case 'GPU': return <GPUPage />;
    }
  };

  return (
    <EngineProvider>
      <div className="h-screen w-screen flex flex-col overflow-hidden">
        <TopAppBar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderPage()}
          </div>
          <SideNavBar />
        </div>
        <FooterBar extraInfo={activeTab === 'GPU' ? 'VRAM: 1.2GB' : undefined} />
      </div>
    </EngineProvider>
  );
}

export default App;
