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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
      {/* Animated blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full opacity-20 blur-3xl animate-pulse" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full opacity-20 blur-3xl animate-pulse" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl animate-pulse" style={{ background: 'radial-gradient(circle, #4f46e5, transparent)', animationDelay: '2s' }} />

      <div className="relative w-full max-w-md mx-4 animate-scale-in">
        {/* Glass card */}
        <div className="rounded-3xl p-8 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-glow-indigo" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <span className="text-2xl">⚡</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Solvix</h1>
            <p className="text-slate-400 text-sm mt-1">Sports & Fitness Management</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm text-white placeholder-slate-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors text-lg"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm mt-2 transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: loading ? '#4f46e5' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 24px rgba(99,102,241,0.4)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600 mt-6">Solvix — Multi-Tenant Management Platform</p>
        </div>
      </div>
    </div>
  );
}
