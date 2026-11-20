import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { useMediaQuery } from 'react-responsive';

const CEO_LINKS = [
  { to: '/ceo/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/ceo/tenants',   label: 'Tenants',   icon: '🏢' },
];
const GYM_LINKS = [
  { to: '/gym/dashboard',  label: 'Dashboard', icon: '▦' },
  { to: '/gym/customers',  label: 'Members',   icon: '👥' },
  { to: '/gym/packages',   label: 'Packages',  icon: '🎁' },
  { to: '/gym/reports',    label: 'Reports',   icon: '📊' },
];
const PADEL_LINKS = [
  { to: '/padel/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/padel/bookings',  label: 'Bookings',  icon: '📋' },
  { to: '/padel/calendar',  label: 'Calendar',  icon: '📅' },
  { to: '/padel/reports',  label: 'Reports',   icon: '📊' },
  { to: '/padel/settings', label: 'Rates & Courts', icon: '⚙️' },
];
const CRICKET_LINKS = [
  { to: '/cricket/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/cricket/bookings',  label: 'Bookings',  icon: '📋' },
  { to: '/cricket/calendar',  label: 'Calendar',  icon: '📅' },
  { to: '/cricket/reports',  label: 'Reports',   icon: '📊' },
  { to: '/cricket/settings', label: 'Rates & Pitches', icon: '⚙️' },
];

// Pastel accent per role: logo tile, active nav pill, badge dot
const ROLE_CONFIG = {
  ceo:     { links: CEO_LINKS,     label: 'CEO Admin',      tag: 'CEO',     tile: 'from-lavender-200 to-lilac-300', active: 'bg-lavender-100 text-lavender-800', dot: 'bg-lavender-400' },
  gym:     { links: GYM_LINKS,     label: 'Gym Management', tag: 'GYM',     tile: 'from-mint-200 to-aqua-300',      active: 'bg-mint-100 text-mint-800',         dot: 'bg-mint-400' },
  padel:   { links: PADEL_LINKS,   label: 'Padel Courts',   tag: 'PADEL',   tile: 'from-butter-200 to-peach-300',   active: 'bg-butter-100 text-butter-800',     dot: 'bg-butter-400' },
  cricket: { links: CRICKET_LINKS, label: 'Indoor Cricket', tag: 'CRICKET', tile: 'from-blush-200 to-coral-300',    active: 'bg-blush-100 text-blush-800',       dot: 'bg-blush-400' },
};

export default function Sidebar({ open, onClose }) {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const cfg = ROLE_CONFIG[userProfile?.role] || ROLE_CONFIG.ceo;
  const initials = (userProfile?.name || userProfile?.email || 'U').charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  };

  const sidebarContent = (
    <aside className="w-64 h-screen flex flex-col animate-slide-left border-r border-lavender-100" style={{ background: 'linear-gradient(180deg, #fdfcff 0%, #f5f2fe 100%)' }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-4 border-b border-lavender-100/70">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br ${cfg.tile} shadow-sm`}>
            <span className="text-base">⚡</span>
          </div>
          <div>
            <p className="text-slate-800 font-bold text-base leading-none">Solvix</p>
            <p className="text-slate-400 text-[10px] mt-0.5">Management Platform</p>
          </div>
        </div>

        {/* Role badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white ring-1 ring-lavender-100">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span className="text-slate-600">{cfg.tag}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 mb-3">Navigation</p>
        {cfg.links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={isMobile ? onClose : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? `${cfg.active} font-semibold shadow-sm`
                  : 'text-slate-500 hover:text-slate-800 hover:bg-lavender-50'
              }`
            }
          >
            <span className="text-base w-5 text-center">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-5 border-t border-lavender-100/70 pt-4">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-2 bg-white ring-1 ring-lavender-100">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 text-xs font-bold bg-gradient-to-br ${cfg.tile}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 text-xs font-semibold truncate">{userProfile?.name || cfg.label}</p>
            <p className="text-slate-400 text-[10px] truncate">{userProfile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:text-blush-700 hover:bg-blush-50 transition-all duration-200 text-xs font-medium"
        >
          <span>⎋</span> Sign out
        </button>
      </div>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        {open && <div className="fixed inset-0 z-40 bg-lavender-950/25 backdrop-blur-sm" onClick={onClose} />}
        <div className={`fixed top-0 left-0 bottom-0 z-50 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          {sidebarContent}
        </div>
      </>
    );
  }

  return <div className="sticky top-0 h-screen flex-shrink-0">{sidebarContent}</div>;
}
