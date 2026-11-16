import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AIAssistantPanel } from './AIAssistantPanel';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  return (
    <div className="min-h-screen bg-db-main text-db-text">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuClick={() => setSidebarOpen(true)} />
      
      <main className="lg:ml-72 min-h-screen pb-16">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>

      <AIAssistantPanel isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
      
      <button
        className="fixed bottom-4 right-4 lg:hidden z-50 p-3 rounded-full bg-db-primary text-db-text shadow-lg hover:bg-db-primary/90 transition-colors"
        onClick={() => setAiPanelOpen(true)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div>
  );
}