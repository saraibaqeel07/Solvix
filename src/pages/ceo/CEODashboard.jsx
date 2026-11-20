import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../../components/Skeleton';

const COLORS = {
  gym:     { bg: 'from-emerald-500 to-teal-600',   light: 'bg-emerald-50',  text: 'text-emerald-600',  hex: '#6cc9a0' },
  padel:   { bg: 'from-amber-500 to-orange-500',   light: 'bg-amber-50',    text: 'text-amber-600',    hex: '#f5bf5c' },
  cricket: { bg: 'from-rose-500 to-red-600',       light: 'bg-rose-50',     text: 'text-rose-600',     hex: '#f28aa2' },
  total:   { bg: 'from-indigo-500 to-purple-600',  light: 'bg-indigo-50',   text: 'text-indigo-600',   hex: '#ab9cf3' },
};

const PIE_COLORS = ['#6cc9a0', '#f5bf5c', '#f28aa2'];

function StatCard({ label, value, gradient, icon, delay = 0 }) {
  return (
    <div className="card p-6 hover:shadow-card-hover transition-all duration-300 group" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white text-slate-700 ring-1 ring-lavender-100 px-3 py-2 rounded-xl text-xs shadow-lg">
        <p className="font-semibold">{label || payload[0].name}</p>
        <p className="text-slate-500">{payload[0].value} tenant{payload[0].value !== 1 ? 's' : ''}</p>
      </div>
    );
  }
  return null;
};

export default function CEODashboard() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'tenants'))
      .then((snap) => setTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((err) => console.error('Firestore error:', err))
      .finally(() => setLoading(false));
  }, []);

  const gymCount     = tenants.filter((t) => t.role === 'gym').length;
  const padelCount   = tenants.filter((t) => t.role === 'padel').length;
  const cricketCount = tenants.filter((t) => t.role === 'cricket').length;

  const pieData = [
    { name: 'Gym', value: gymCount },
    { name: 'Padel', value: padelCount },
    { name: 'Cricket', value: cricketCount },
  ].filter((d) => d.value > 0);

  const barData = [
    { name: 'Gym', tenants: gymCount },
    { name: 'Padel', tenants: padelCount },
    { name: 'Cricket', tenants: cricketCount },
  ];

  // Group tenants by month enrolled
  const monthlyData = (() => {
    const map = {};
    tenants.forEach((t) => {
      if (!t.createdAt) return;
      const key = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short' });
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([month, count]) => ({ month, count }));
  })();

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">CEO Dashboard</h2>
          <p className="page-subtitle">Welcome back — here's what's happening</p>
        </div>
        <Link to="/ceo/tenants" className="btn-primary">+ Enroll Tenant</Link>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-up">
          <StatCard label="Total Tenants"   value={tenants.length} gradient={COLORS.total.bg}   icon="🏢" delay={0} />
          <StatCard label="Gym Tenants"     value={gymCount}       gradient={COLORS.gym.bg}     icon="💪" delay={50} />
          <StatCard label="Padel Tenants"   value={padelCount}     gradient={COLORS.padel.bg}   icon="🎾" delay={100} />
          <StatCard label="Cricket Tenants" value={cricketCount}   gradient={COLORS.cricket.bg} icon="🏏" delay={150} />
        </div>
      )}

      {/* Charts row */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <ChartSkeleton /><ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-fade-up" style={{ animationDelay: '100ms' }}>
          {/* Pie chart */}
          <div className="card">
            <div className="card-header">
              <p className="card-title">Tenant Distribution</p>
              <span className="text-xs text-slate-400">{tenants.length} total</span>
            </div>
            <div className="card-body flex items-center justify-center">
              {pieData.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No tenants yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Bar chart */}
          <div className="card">
            <div className="card-header">
              <p className="card-title">Tenants by Type</p>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} barSize={36}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                  <Bar dataKey="tenants" radius={[6,6,0,0]}>
                    {barData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Recent tenants table */}
      <div className="card animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="card-header">
          <p className="card-title">Recent Tenants</p>
          <Link to="/ceo/tenants" className="text-xs text-indigo-600 font-semibold hover:text-indigo-700">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6"><div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div></div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🏢</p>
              <p className="text-slate-500 text-sm font-medium">No tenants enrolled yet</p>
              <Link to="/ceo/tenants" className="btn-primary mt-4 inline-flex">Enroll First Tenant</Link>
            </div>
          ) : (
            <table className="simple-table w-full">
              <thead>
                <tr><th>Business</th><th>Type</th><th>Email</th><th>Phone</th><th>Enrolled</th></tr>
              </thead>
              <tbody>
                {tenants.slice(0, 6).map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-slate-800">{t.name}</td>
                    <td><span className={`badge badge-${t.role}`}>{t.role}</span></td>
                    <td className="text-slate-500">{t.email}</td>
                    <td className="text-slate-500">{t.phone || '—'}</td>
                    <td className="text-slate-400">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
