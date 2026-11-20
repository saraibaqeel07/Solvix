import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { StatCardSkeleton, ChartSkeleton } from '../../components/Skeleton';
import { StatTile, ChartTooltip, EmptyState } from '../../components/ui';
import { fmtDate, inRange, lastMonths, monthKey, monthLabel, rangeFor, todayISO } from '../../lib/dates';
import { loadGymData, memberState, memberDues, fmtPKR, num, PAY_KINDS, payKind, groupPayments, STATE_META } from '../../lib/gym';

const PIE = ['#ab9cf3', '#6cc9a0', '#f49a70', '#80b4ef', '#f28aa2', '#f5bf5c', '#66c1b8', '#c19af0'];
const k = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function ListCard({ title, badge, badgeClass, action, children }) {
  return (
    <div className="card flex flex-col">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <p className="card-title">{title}</p>
          {badge > 0 && <span className={`badge ${badgeClass}`}>{badge}</span>}
        </div>
        {action}
      </div>
      <div className="flex-1 max-h-80 overflow-y-auto">{children}</div>
    </div>
  );
}

export default function GymDashboard() {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const navigate = useNavigate();
  const [data, setData] = useState({ customers: [], packages: [], payments: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    loadGymData(uid)
      .then(setData)
      .catch((e) => { console.error(e); toast.error('Failed to load dashboard'); })
      .finally(() => setLoading(false));
  }, [uid]);

  const m = useMemo(() => {
    const today = todayISO();
    const month = rangeFor('month');
    const { customers, payments } = data;
    const withState = customers.map((c) => ({ ...c, ...memberState(c, today), _dues: memberDues(c).total }));

    const sum = (list) => list.reduce((s, p) => s + num(p.amount), 0);
    const monthPays = payments.filter((p) => inRange(p.date, month.from, month.to));
    const todayPays = payments.filter((p) => p.date === today);

    // Last month to date, for a like-for-like comparison.
    const lm = rangeFor('lastMonth');
    const dayOfMonth = Number(today.slice(8, 10));
    const lmTo = `${lm.from.slice(0, 8)}${String(Math.min(dayOfMonth, Number(lm.to.slice(8, 10)))).padStart(2, '0')}`;
    const lastMonthSoFar = sum(payments.filter((p) => inRange(p.date, lm.from, lmTo)));

    const months = lastMonths(6);
    const trend = months.map((key) => {
      const row = { key, label: monthLabel(key), package: 0, monthly: 0, joins: 0 };
      payments.forEach((p) => { if (monthKey(p.date) === key) row[payKind(p)] += num(p.amount); });
      customers.forEach((c) => { if (monthKey(c.admissionDate) === key) row.joins += 1; });
      return row;
    });

    const running = withState.filter((c) => c.state === 'active' || c.state === 'expiring');
    const pkgCounts = {};
    running.forEach((c) => { const n = c.membershipType || 'Custom'; pkgCounts[n] = (pkgCounts[n] || 0) + 1; });

    return {
      total: customers.length,
      active: running.length,
      expiring: withState.filter((c) => c.state === 'expiring').sort((a, b) => a.daysLeft - b.daysLeft),
      expired: withState.filter((c) => c.state === 'expired').sort((a, b) => b.daysLeft - a.daysLeft),
      dues: withState.filter((c) => c._dues > 0).sort((a, b) => b._dues - a._dues),
      duesTotal: withState.reduce((s, c) => s + c._dues, 0),
      monthTotal: sum(monthPays),
      monthAdmission: sum(monthPays.filter((p) => p.type === 'admission')),
      monthCount: monthPays.length,
      lastMonthSoFar,
      todayTotal: sum(todayPays),
      todayCount: todayPays.length,
      allTime: sum(payments),
      newThisMonth: customers.filter((c) => inRange(c.admissionDate, month.from, month.to)).length,
      trend,
      pkgData: Object.entries(pkgCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      recent: groupPayments(payments).slice(0, 8),
      retention: customers.length ? Math.round((running.length / customers.length) * 100) : 0,
    };
  }, [data]);

  const growth = m.lastMonthSoFar > 0 ? Math.round(((m.monthTotal - m.lastMonthSoFar) / m.lastMonthSoFar) * 100) : null;
  const go = (filter) => navigate(`/gym/customers?filter=${filter}`);

  return (
    <div className="page">
      {/* Header */}
      <div className="rounded-3xl p-6 mb-6 bg-gradient-to-br from-lavender-100 via-blush-50 to-mint-100 ring-1 ring-lavender-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{greeting()} 👋</p>
          <h2 className="text-2xl font-bold text-slate-800 mt-0.5">{userProfile?.name || 'Gym Dashboard'}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/gym/customers" className="btn-primary">+ Add Member</Link>
          <Link to="/gym/packages" className="btn-secondary">🎁 Packages</Link>
          <Link to="/gym/reports" className="btn-secondary">📊 Reports</Link>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{[...Array(8)].map((_, i) => <StatCardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-up">
          <StatTile label="This Month" value={fmtPKR(m.monthTotal)} icon="💰" tone="mint"
            sub={growth === null ? `${m.monthCount} payments · incl. admission` : `${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth)}% vs last month`} />
          <StatTile label="Today's Collection" value={fmtPKR(m.todayTotal)} sub={`${m.todayCount} payment${m.todayCount === 1 ? '' : 's'}`} icon="📅" tone="lavender" />
          <StatTile label="Admission Fees" value={fmtPKR(m.monthAdmission)} sub={`${m.newThisMonth} new members this month`} icon="🎟️" tone="peach" />
          <StatTile label="Outstanding Dues" value={fmtPKR(m.duesTotal)} sub={`${m.dues.length} members`} icon="⏳" tone="blush" onClick={() => go('dues')} />
          <StatTile label="Active Members" value={m.active} sub={`${m.retention}% of ${m.total} total`} icon="💪" tone="aqua" onClick={() => go('active')} />
          <StatTile label="Expiring in 7 days" value={m.expiring.length} sub="follow up for renewal" icon="⏰" tone="butter" onClick={() => go('expiring')} />
          <StatTile label="Expired" value={m.expired.length} sub="renewal due" icon="🔁" tone="peach" onClick={() => go('expired')} />
          <StatTile label="All-time Revenue" value={fmtPKR(m.allTime)} sub={`${data.payments.length} payments`} icon="🏦" tone="powder" />
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6"><div className="lg:col-span-2"><ChartSkeleton /></div><ChartSkeleton /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 animate-fade-up">
          <div className="card lg:col-span-2">
            <div className="card-header"><p className="card-title">Revenue — last 6 months</p><span className="text-xs text-slate-400">package · monthly (incl. admission)</span></div>
            <div className="card-body">
              {m.trend.every((t) => !t.package && !t.monthly) ? <EmptyState icon="📈" title="No payments yet" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={m.trend} barSize={26}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1eefb" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={k} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(171,156,243,0.08)' }} />
                    <Legend iconType="circle" iconSize={7} formatter={(v) => <span className="text-xs text-slate-500">{v}</span>} />
                    <Bar dataKey="package" name="Package" stackId="a" fill={PAY_KINDS.package.color} />
                    <Bar dataKey="monthly" name="Monthly" stackId="a" fill={PAY_KINDS.monthly.color} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><p className="card-title">Active members by package</p></div>
            <div className="card-body">
              {m.pkgData.length === 0 ? <EmptyState icon="🎁" title="No active members" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={m.pkgData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {m.pkgData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip money={false} />} />
                    <Legend iconType="circle" iconSize={7} formatter={(v) => <span className="text-xs text-slate-500">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* New members trend */}
          <div className="card mb-6 animate-fade-up">
            <div className="card-header"><p className="card-title">New admissions — last 6 months</p></div>
            <div className="card-body grid grid-cols-3 sm:grid-cols-6 gap-3">
              {m.trend.map((t) => (
                <div key={t.key} className="rounded-xl bg-lavender-50 py-3 text-center">
                  <p className="text-xl font-bold text-lavender-800">{t.joins}</p>
                  <p className="text-[11px] text-slate-500">{t.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action lists */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up">
            <ListCard title="Expiring soon" badge={m.expiring.length} badgeClass="badge-expiring"
              action={<button className="text-xs font-semibold text-lavender-700 hover:underline" onClick={() => go('expiring')}>View all →</button>}>
              {m.expiring.length === 0 ? <EmptyState icon="✨" title="Nothing expiring this week" /> : (
                <ul className="divide-y divide-lavender-50">
                  {m.expiring.map((c) => (
                    <li key={c.id} className="px-6 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p><p className="text-xs text-slate-400">{c.membershipType} · {c.phone || '—'}</p></div>
                      <span className="badge badge-expiring">{c.daysLeft === 0 ? 'Today' : `${c.daysLeft}d left`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ListCard>

            <ListCard title="Pending dues" badge={m.dues.length} badgeClass="badge-unpaid"
              action={<button className="text-xs font-semibold text-lavender-700 hover:underline" onClick={() => go('dues')}>Collect →</button>}>
              {m.dues.length === 0 ? <EmptyState icon="🎉" title="All members are paid up" /> : (
                <ul className="divide-y divide-lavender-50">
                  {m.dues.map((c) => (
                    <li key={c.id} className="px-6 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p><p className="text-xs text-slate-400">{c.phone || '—'}</p></div>
                      <span className="text-sm font-semibold text-blush-700 whitespace-nowrap">{fmtPKR(c._dues)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ListCard>

            <ListCard title="Recent payments"
              action={<Link to="/gym/reports" className="text-xs font-semibold text-lavender-700 hover:underline">Report →</Link>}>
              {m.recent.length === 0 ? <EmptyState icon="🧾" title="No payments yet" /> : (
                <ul className="divide-y divide-lavender-50">
                  {m.recent.map((p) => (
                    <li key={p.id} className="px-6 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.customerName}</p>
                        <p className="text-xs text-slate-400">{fmtDate(p.date)} · <span className={`badge ${PAY_KINDS[p.kind].badge} !px-1.5 !py-0 !text-[10px]`}>{PAY_KINDS[p.kind].label}</span>{p.admission > 0 && <span className="ml-1">+ admission</span>}</p>
                      </div>
                      <span className="text-sm font-semibold text-mint-700 whitespace-nowrap">{fmtPKR(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ListCard>
          </div>

          {m.expired.length > 0 && (
            <div className="card mt-4 animate-fade-up">
              <div className="card-header">
                <div className="flex items-center gap-2"><p className="card-title">Expired — renewal due</p><span className="badge badge-expired">{m.expired.length}</span></div>
                <button className="text-xs font-semibold text-lavender-700 hover:underline" onClick={() => go('expired')}>Renew members →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="simple-table">
                  <thead><tr><th>Member</th><th>Phone</th><th>Package</th><th>Expired on</th><th>Status</th></tr></thead>
                  <tbody>
                    {m.expired.slice(0, 10).map((c) => (
                      <tr key={c.id}>
                        <td className="font-semibold text-slate-800">{c.name}</td>
                        <td className="text-slate-500">{c.phone || '—'}</td>
                        <td className="text-slate-500">{c.membershipType || '—'}</td>
                        <td className="text-slate-500">{fmtDate(c.endDate)} <span className="text-xs text-slate-400">({-c.daysLeft}d ago)</span></td>
                        <td><span className={`badge ${STATE_META.expired.badge}`}>Expired</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
