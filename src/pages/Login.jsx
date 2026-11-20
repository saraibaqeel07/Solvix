import { LogoMark } from '../components/Logo';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { CEO_EMAIL } from '../contexts/AuthContext';

const ROLE_REDIRECTS = {
  ceo: '/ceo/dashboard',
  gym: '/gym/dashboard',
  padel: '/padel/dashboard',
  cricket: '/cricket/dashboard',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login, userProfile } = useAuth();
  const navigate = useNavigate();

  if (userProfile) {
    navigate(ROLE_REDIRECTS[userProfile.role] || '/login');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
    } catch {
      toast.error('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f6f4ff, #fff4f6 50%, #effbf5)' }}>
      {/* Animated blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full opacity-60 blur-3xl animate-pulse" style={{ background: 'radial-gradient(circle, #ddd5fe, transparent)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full opacity-60 blur-3xl animate-pulse" style={{ background: 'radial-gradient(circle, #fecad6, transparent)', animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-50 blur-3xl animate-pulse" style={{ background: 'radial-gradient(circle, #b8ead3, transparent)', animationDelay: '2s' }} />

      <div className="relative w-full max-w-md mx-4 animate-scale-in">
        {/* Glass card */}
        <div className="rounded-3xl p-8 border border-lavender-100 shadow-card-hover" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)' }}>

          {/* Logo */}
          <div className="text-center mb-8">
            <LogoMark size={68} className="mx-auto mb-4 drop-shadow-[0_8px_24px_rgba(179,164,246,0.45)]" />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Slot<span className="text-lavender-600">ify</span></h1>
            <p className="text-slate-500 text-sm mt-1">Bookings & memberships for gyms, courts and pitches</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 border border-lavender-100 focus:outline-none focus:ring-4 focus:ring-lavender-100 focus:border-lavender-300 transition-all"
                style={{ background: '#ffffff' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm text-slate-800 placeholder-slate-400 border border-lavender-100 focus:outline-none focus:ring-4 focus:ring-lavender-100 focus:border-lavender-300 transition-all"
                  style={{ background: '#ffffff' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-lg"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm mt-2 transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: loading ? '#9583ea' : 'linear-gradient(135deg, #9583ea, #c19af0)', boxShadow: '0 4px 24px rgba(149,131,234,0.35)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">Slotify — Bookings & Memberships Platform</p>
        </div>
      </div>
    </div>
  );
}
