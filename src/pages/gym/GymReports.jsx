import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Legend,
} from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../../components/Skeleton';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function applyExpiry(c) {
  if (c.status === 'paid' && c.endDate && new Date(c.endDate + 'T00:00:00') < new Date()) {
    return { ...c, status: 'unpaid' };
  }
  return c;
}

function fmt(n) { return `PKR ${Number(n || 0).toLocaleString()}`; }

function getPast6Months() {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ month: d.getMonth(), year: d.getFullYear(), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return result;
}

const RevenueTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl space-y-1">
        <p className="font-semibold text-slate-200">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {p.dataKey === 'unpaid' || p.dataKey === 'revenue' || p.dataKey === 'unpaidAmt'
              ? fmt(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function StatCard({ label, value, gradient, icon, sub }) {
  return (
    <div className="card p-6 group hover:shadow-card-hover transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1 leading-tight">{value}</p>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function GymReports() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!userProfile?.uid) return;
    getDocs(collection(db, 'tenants', userProfile.uid, 'customers'))
      .then((snap) => setCustomers(snap.docs.map((d) => applyExpiry({ id: d.id, ...d.data() }))))
      .catch((err) => console.error('Firestore error:', err))
      .finally(() => setLoading(false));
  }, [userProfile]);

  const paid   = customers.filter((c) => c.status === 'paid');
  const unpaid = customers.filter((c) => c.status === 'unpaid');

  const totalRevenue  = paid.reduce((s, c) => s + (Number(c.amount) || 0) + (Number(c.admissionFee) || 0), 0);
  const unpaidBalance = unpaid.reduce((s, c) => s + (Number(c.amount) || 0) + (Number(c.admissionFee) || 0), 0);

  const now = new Date();
  const thisMonthPaid = paid.filter((c) => {
    if (!c.startDate) return false;
    const d = new Date(c.startDate + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRevenue = thisMonthPaid.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const past6 = getPast6Months();
  const monthlyData = past6.map(({ month, year, label }) => {
    const paidInMonth = paid.filter((c) => {
      if (!c.startDate) return false;
      const d = new Date(c.startDate + 'T00:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const unpaidInMonth = unpaid.filter((c) => {
      if (!c.startDate) return false;
      const d = new Date(c.startDate + 'T00:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });
    return {
      label,
      revenue: paidInMonth.reduce((s, c) => s + (Number(c.amount) || 0), 0),
      unpaidAmt: unpaidInMonth.reduce((s, c) => s + (Number(c.amount) || 0), 0),
      members: paidInMonth.length + unpaidInMonth.length,
    };
  });

  const admissionsData = past6.map(({ month, year, label }) => ({
    label,
    admitted: customers.filter((c) => {
      if (!c.admissionDate) return false;
      const d = new Date(c.admissionDate + 'T00:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    }).length,
  }));

  const membershipRevenue = ['Monthly','Quarterly','Semi-Annual','Annual','Daily'].map((type) => {
    const group = paid.filter((c) => c.membershipType === type);
    return {
      name: type.replace('Semi-Annual', 'Semi'),
      revenue: group.reduce((s, c) => s + (Number(c.amount) || 0), 0),
      count: group.length,
    };
  }).filter((d) => d.count > 0);

  const filtered = filter === 'all' ? customers : customers.filter((c) => c.status === filter);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Revenue Reports</h2>
          <p className="page-subtitle">Financial summary for {userProfile?.name}</p>
        </div>
        <Link to="/gym/customers" className="btn-secondary">← Customers</Link>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">{[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-up">
          <StatCard label="Total Revenue"     value={fmt(totalRevenue)}  gradient="from-emerald-500 to-teal-600"  icon="💰" sub={`${paid.length} paid members`} />
          <StatCard label="This Month"        value={fmt(monthRevenue)}  gradient="from-indigo-500 to-purple-600" icon="📅" sub={`${thisMonthPaid.length} payments`} />
          <StatCard label="Unpaid Balance"    value={fmt(unpaidBalance)} gradient="from-rose-500 to-red-600"      icon="⚠️" sub={`${unpaid.length} members`} />
          <StatCard label="Total Members"     value={customers.length}   gradient="from-amber-500 to-orange-500"  icon="👥" sub={`${unpaid.length} unpaid`} />
        </div>
      )}

      {/* Charts row 1: Monthly revenue + admissions */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><ChartSkeleton /><ChartSkeleton /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="card">
            <div className="card-header">
              <p className="card-title">Monthly Revenue (Last 6 Months)</p>
            </div>
            <div className="card-body">
              {monthlyData.every(d => d.revenue === 0 && d.unpaidAmt === 0) ? (
                <div className="text-center py-8 text-slate-400 text-sm">No payment data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={monthlyData} barSize={18} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
                    <Legend iconType="circle" iconSize={7} formatter={(v) => <span className="text-xs text-slate-500">{v === 'revenue' ? 'Collected' : 'Pending'}</span>} />
                    <Bar dataKey="revenue"   name="revenue"   fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="unpaidAmt" name="unpaidAmt" fill="#f87171" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <p className="card-title">New Admissions (Last 6 Months)</p>
            </div>
            <div className="card-body">
              {admissionsData.every(d => d.admitted === 0) ? (
                <div className="text-center py-8 text-slate-400 text-sm">No admissions recorded yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={admissionsData}>
                    <defs>
                      <linearGradient id="admGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 2' }} />
                    <Area type="monotone" dataKey="admitted" name="New Members" stroke="#6366f1" strokeWidth={2} fill="url(#admGrad)" dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revenue by membership type */}
      {!loading && membershipRevenue.length > 0 && (
        <div className="card mb-6 animate-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="card-header"><p className="card-title">Revenue by Membership Type</p></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={membershipRevenue} layout="vertical" barSize={20}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
                <Bar dataKey="revenue" name="revenue" fill="#10b981" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Payment details table */}
      <div className="card animate-fade-up" style={{ animationDelay: '160ms' }}>
        <div className="card-header">
          <p className="card-title">Payment Details</p>
          <div className="flex items-center gap-2">
            {['all','paid','unpaid'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors capitalize ${
                  filter === f
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f === 'all' ? `All (${customers.length})` : f === 'paid' ? `Paid (${paid.length})` : `Unpaid (${unpaid.length})`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">{[0,1,2,3].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="simple-table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Admission Date</th>
                  <th>Membership</th>
                  <th>Period</th>
                  <th>Admission Fee</th>
                  <th>Monthly Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.phone || c.email || ''}</p>
                    </td>
                    <td className="text-slate-500">
                      {c.admissionDate ? new Date(c.admissionDate + 'T00:00:00').toLocaleDateString() : '—'}
                    </td>
                    <td><span className={`badge badge-${c.membershipType === 'Annual' ? 'confirmed' : 'gym'}`}>{c.membershipType || '—'}</span></td>
                    <td className="text-slate-500 text-xs">
                      {c.startDate ? new Date(c.startDate + 'T00:00:00').toLocaleDateString() : '—'}
                      {c.endDate ? ` → ${new Date(c.endDate + 'T00:00:00').toLocaleDateString()}` : ''}
                    </td>
                    <td className="text-slate-500">
                      {c.admissionFee ? fmt(c.admissionFee) : '—'}
                    </td>
                    <td className={`font-semibold ${c.status === 'paid' ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {c.amount ? fmt(c.amount) : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${c.status === 'paid' ? 'paid' : 'unpaid'}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50">
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {filter === 'paid' ? 'Total Collected' : filter === 'unpaid' ? 'Total Pending' : 'Grand Total'}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">
                    {fmt(filtered.reduce((s, c) => s + (Number(c.admissionFee) || 0), 0))}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {fmt(filtered.reduce((s, c) => s + (Number(c.amount) || 0), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
