import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../../components/Skeleton';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl">
        <p className="font-semibold">{label || payload[0].name}</p>
        <p className="text-slate-300">{payload[0].name === 'Revenue' || payload[0].name === 'revenue'
          ? `PKR ${Number(payload[0].value).toLocaleString()}`
          : `${payload[0].value} member${payload[0].value !== 1 ? 's' : ''}`}
        </p>
      </div>
    );
  }
  return null;
};

function StatCard({ label, value, gradient, icon, sub }) {
  return (
    <div className="card p-6 hover:shadow-card-hover transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function applyExpiry(c) {
  if (c.status === 'paid' && c.endDate && new Date(c.endDate + 'T00:00:00') < new Date()) {
    return { ...c, status: 'unpaid' };
  }
  return c;
}

function fmt(n) { return `PKR ${Number(n).toLocaleString()}`; }

export default function GymDashboard() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;
    getDocs(collection(db, 'tenants', userProfile.uid, 'customers'))
      .then((snap) => setCustomers(snap.docs.map((d) => applyExpiry({ id: d.id, ...d.data() }))))
      .catch((err) => console.error('Firestore error:', err))
      .finally(() => setLoading(false));
  }, [userProfile]);

  const paid   = customers.filter((c) => c.status === 'paid');
  const unpaid = customers.filter((c) => c.status === 'unpaid');
  const active = customers.filter((c) => c.endDate && new Date(c.endDate) >= new Date()).length;
  const expired = customers.filter((c) => c.endDate && new Date(c.endDate) < new Date()).length;

  const totalRevenue   = paid.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const unpaidBalance  = unpaid.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const now = new Date();
  const thisMonth = paid.filter((c) => {
    if (!c.startDate) return false;
    const d = new Date(c.startDate + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRevenue = thisMonth.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const pieData = [
    { name: 'Paid', value: paid.length },
    { name: 'Unpaid', value: unpaid.length },
  ].filter((d) => d.value > 0);

  const membershipData = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Daily'].map((type) => ({
    name: type.replace('Semi-Annual', 'Semi'),
    count: customers.filter((c) => c.membershipType === type).length,
  })).filter((d) => d.count > 0);

  const unpaidList = unpaid;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Gym Dashboard</h2>
          <p className="page-subtitle">{userProfile?.name}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/gym/reports" className="btn-secondary">📊 Reports</Link>
          <Link to="/gym/customers" className="btn-primary">Manage Customers</Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">{[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-up">
          <StatCard label="Total Members"    value={customers.length}   gradient="from-indigo-500 to-purple-600"  icon="👥" />
          <StatCard label="Revenue Collected" value={fmt(totalRevenue)}  gradient="from-emerald-500 to-teal-600"   icon="💰" sub={`${paid.length} paid members`} />
          <StatCard label="This Month"       value={fmt(monthRevenue)}  gradient="from-amber-500 to-orange-500"   icon="📅" sub={`${thisMonth.length} payments`} />
          <StatCard label="Unpaid Balance"   value={fmt(unpaidBalance)} gradient="from-rose-500 to-red-600"       icon="⚠️" sub={`${unpaid.length} members`} />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><ChartSkeleton /><ChartSkeleton /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="card">
            <div className="card-header">
              <p className="card-title">Payment Status</p>
              <span className="text-xs text-slate-400">{customers.length} members</span>
            </div>
            <div className="card-body flex items-center justify-center">
              {customers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No members yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      <Cell fill="#10b981" strokeWidth={0} />
                      <Cell fill="#ef4444" strokeWidth={0} />
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><p className="card-title">Membership Breakdown</p></div>
            <div className="card-body">
              {membershipData.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={membershipData} barSize={32}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
                    <Bar dataKey="count" fill="#10b981" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card animate-fade-up" style={{ animationDelay: '160ms' }}>
        <div className="card-header">
          <p className="card-title">Unpaid Members</p>
          {unpaidList.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 ring-1 ring-rose-200">
              {unpaidList.length} pending
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6"><div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div></div>
          ) : unpaidList.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-emerald-600 font-semibold text-sm">All members are up to date!</p>
            </div>
          ) : (
            <table className="simple-table w-full">
              <thead><tr><th>Name</th><th>Phone</th><th>Membership</th><th>Fee</th><th>Expiry</th></tr></thead>
              <tbody>
                {unpaidList.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-slate-800">{c.name}</td>
                    <td className="text-slate-500">{c.phone || '—'}</td>
                    <td><span className="badge badge-unpaid">{c.membershipType || '—'}</span></td>
                    <td className="text-slate-700 font-medium">{c.amount ? fmt(c.amount) : '—'}</td>
                    <td className="text-slate-400">{c.endDate ? new Date(c.endDate + 'T00:00:00').toLocaleDateString() : '—'}</td>
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
