import { useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 768 });

  return (
    <div className="flex min-h-screen bg-[#f8f6fd]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        {isMobile && (
          <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-lavender-100 bg-white/80 backdrop-blur-md">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-lavender-50 transition-colors text-slate-600"
            >
              ☰
            </button>
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span className="font-bold text-slate-800">Solvix</span>
            </div>
          </header>
        )}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
