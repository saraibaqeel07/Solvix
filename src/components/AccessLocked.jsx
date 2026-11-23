import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogoMark } from './Logo';
import { fmtDate } from '../lib/dates';
import { SUPPORT, fmtPKR, tenantDues } from '../lib/tenants';

// Full-screen block shown to a tenant whose demo / paid period has ended or who is suspended.
export default function AccessLocked({ access }) {
  const { userProfile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const dues = tenantDues(userProfile);
  const wasDemo = (userProfile?.status || 'active') === 'demo';

  const title = access.state === 'suspended'
    ? 'Your account is suspended'
    : wasDemo ? 'Your demo has ended' : 'Subscription dues unpaid';

  const message = access.state === 'suspended'
    ? 'Access to your dashboard has been paused by the administrator.'
    : wasDemo
      ? `Your free demo ended on ${fmtDate(access.until)}. Subscribe to keep using Slotify — your data is safe and waiting for you.`
      : `Your subscription ended on ${fmtDate(access.until)}. Please clear the pending dues to continue using your dashboard.`;

  const waText = `Hi, this is ${userProfile?.name || 'a Slotify tenant'} (${userProfile?.email || ''}). ${
    access.state === 'suspended' ? 'My account is suspended' : wasDemo ? 'My demo has ended' : 'My subscription has ended'
  } — I'd like to ${access.state === 'suspended' ? 'restore access' : 'continue using Slotify'}.`;

  const checkAgain = async () => {
    setChecking(true);
    try { await refreshProfile(); } finally { setChecking(false); }
  };

  const signOut = async () => { await logout(); navigate('/login'); };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f3f0ff 0%, #fdf2f6 55%, #eefaf4 100%)' }}>
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-3xl shadow-2xl ring-1 ring-lavender-100 p-8 text-center animate-fade-up">
        <div className="flex justify-center mb-5"><LogoMark size={56} /></div>
        <div className="w-14 h-14 mx-auto rounded-2xl bg-blush-50 ring-1 ring-blush-100 flex items-center justify-center text-2xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{message}</p>

        {dues.amount > 0 && access.state !== 'suspended' && (
          <div className="mt-5 rounded-2xl bg-blush-50 ring-1 ring-blush-100 px-4 py-3">
            <p className="text-[11px] font-semibold text-blush-700 uppercase tracking-wide">Amount due</p>
            <p className="text-2xl font-bold text-blush-700 mt-0.5">{fmtPKR(dues.amount)}</p>
            {dues.months > 1 && <p className="text-xs text-blush-600 mt-0.5">{dues.months} months pending</p>}
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-lavender-50/70 ring-1 ring-lavender-100 p-4 text-left">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Contact Slotify to {access.state === 'suspended' ? 'restore access' : 'make the payment'}
          </p>
          <div className="space-y-1.5 text-sm">
            <p className="flex items-center gap-2 text-slate-700">📞 <a href={`tel:${SUPPORT.phone}`} className="font-semibold hover:text-lavender-700">{SUPPORT.phone}</a></p>
            <p className="flex items-center gap-2 text-slate-700 break-all">✉️ <a href={`mailto:${SUPPORT.email}`} className="font-semibold hover:text-lavender-700">{SUPPORT.email}</a></p>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <a href={`tel:${SUPPORT.phone}`} className="btn-soft btn-sm">Call</a>
            <a href={`https://wa.me/${SUPPORT.whatsapp}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" className="btn-mint btn-sm">WhatsApp</a>
            <a href={`mailto:${SUPPORT.email}?subject=${encodeURIComponent(`Slotify access — ${userProfile?.name || ''}`)}&body=${encodeURIComponent(waText)}`} className="btn-soft btn-sm">Email</a>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Once {access.state === 'suspended' ? 'access is restored' : 'your payment is recorded'}, press “Check again”.
        </p>

        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={signOut}>Sign out</button>
          <button className="btn-primary flex-1" onClick={checkAgain} disabled={checking}>
            {checking ? 'Checking...' : 'Check again'}
          </button>
        </div>
      </div>
    </div>
  );
}
