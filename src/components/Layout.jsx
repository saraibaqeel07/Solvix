import Logo from './Logo';
import { useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { tenantAccess, daysLeftText } from '../lib/tenants';
import { fmtDate } from '../lib/dates';

// Shown to tenants on a demo, or whose paid period ends within a few days.
function AccessBanner() {
  const { userProfile } = useAuth();
  if (!userProfile || userProfile.role === 'ceo') return null;
  const a = tenantAccess(userProfile);
  if (a.locked || !a.until || !(a.state === 'demo' || a.endingSoon)) return null;
  const demo = a.state === 'demo';
  return (
    <div className={`mb-5 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm ring-1 ${a.endingSoon ? 'bg-blush-50 ring-blush-100 text-blush-800' : 'bg-powder-50 ring-powder-100 text-powder-800'}`}>
      <span className="text-base">{demo ? '🧪' : '⏳'}</span>
      <span className="font-semibold">{demo ? 'Demo access' : 'Subscription ending'}</span>
      <span>· {daysLeftText(a)} (until {fmtDate(a.until)})</span>
      <span className="opacity-75">— contact the Slotify administrator to {demo ? 'subscribe' : 'renew'}.</span>
    </div>
  );
}

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
            <Logo size={30} />
          </header>
        )}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto"><AccessBanner />{children}</main>
      </div>
    </div>
  );
}
