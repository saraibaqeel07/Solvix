import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../../components/Skeleton';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl">
        <p className="font-semibold">{label}</p>
        <p className="text-slate-300">{payload[0].value} booking{payload[0].value !== 1 ? 's' : ''}</p>
      </div>
    );
  }
  return null;
};

function StatCard({ label, value, gradient, icon, sub }) {
  return (
    <div className="card p-6 hover:shadow-card-hover transition-all duration-300 group">
      <div className="mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CricketDashboard() {
  const { userProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;
    getDocs(collection(db, 'tenants', userProfile.uid, 'bookings'))
      .then((snap) => setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((err) => console.error('Firestore error:', err))
      .finally(() => setLoading(false));
  }, [userProfile]);

  const today = new Date().toISOString().split('T')[0];
  const confirmed  = bookings.filter((b) => b.status !== 'cancelled');
  const todayBkgs  = confirmed.filter((b) => b.date === today);
  const cancelled  = bookings.filter((b) => b.status === 'cancelled').length;
  const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekBkgs   = confirmed.filter((b) => new Date(b.date) >= weekStart).length;

  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      bookings: confirmed.filter((b) => b.date === key).length,
    };
  });

  const slotMap = {};
  confirmed.forEach((b) => { slotMap[b.timeSlot] = (slotMap[b.timeSlot] || 0) + 1; });
  const slotData = Object.entries(slotMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([slot, count]) => ({ slot: slot.split(' ')[0], count }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Cricket Dashboard</h2>
          <p className="page-subtitle">{userProfile?.name}</p>
        </div>
        <Link to="/cricket/calendar" className="btn-primary" style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>+ New Booking</Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">{[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-up">
          <StatCard label="Total Bookings" value={confirmed.length} gradient="from-rose-500 to-red-600"       icon="🏏" />
          <StatCard label="Today"          value={todayBkgs.length} gradient="from-indigo-500 to-purple-600"  icon="📅" sub={new Date().toLocaleDateString('en-US',{weekday:'long'})} />
          <StatCard label="This Week"      value={weekBkgs}         gradient="from-emerald-500 to-teal-600"   icon="📊" />
          <StatCard label="Cancelled"      value={cancelled}        gradient="from-slate-400 to-slate-600"    icon="❌" />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><ChartSkeleton /><ChartSkeleton /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="card">
            <div className="card-header">
              <p className="card-title">7-Day Booking Trend</p>
              <span className="text-xs text-slate-400">Last 7 days</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="roseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="bookings" stroke="#ef4444" strokeWidth={2} fill="url(#roseGrad)" dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><p className="card-title">Popular Time Slots</p></div>
            <div className="card-body">
              {slotData.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No bookings yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={slotData} barSize={28} layout="vertical">
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="slot" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(239,68,68,0.06)' }} />
                    <Bar dataKey="count" fill="#ef4444" radius={[0,6,6,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card animate-fade-up" style={{ animationDelay: '160ms' }}>
        <div className="card-header">
          <p className="card-title">Today's Schedule</p>
          <span className="text-xs text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
        <div className="overflow-x-auto">
          {todayBkgs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">🏏</p>
              <p className="text-slate-500 text-sm">No bookings today</p>
              <Link to="/cricket/calendar" className="inline-flex btn mt-3 px-4 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl">+ Book a slot</Link>
            </div>
          ) : (
            <table className="simple-table w-full">
              <thead><tr><th>Time</th><th>Customer</th><th>Phone</th><th>Notes</th></tr></thead>
              <tbody>
                {todayBkgs.sort((a,b) => a.timeSlot.localeCompare(b.timeSlot)).map((b) => (
                  <tr key={b.id}>
                    <td><span className="font-semibold text-rose-600">{b.timeSlot}</span></td>
                    <td className="font-medium text-slate-800">{b.customerName}</td>
                    <td className="text-slate-500">{b.phone || '—'}</td>
                    <td className="text-slate-400">{b.notes || '—'}</td>
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
