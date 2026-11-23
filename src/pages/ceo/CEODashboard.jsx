import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../../components/Skeleton';
import { StatTile, ExportButtons, ChartTooltip, EmptyState } from '../../components/ui';
import TenantPaymentModal from '../../components/TenantPaymentModal';
import { ACCESS_META, daysLeftText, fmtPKR, loadBilling, tenantAccess, tenantDues } from '../../lib/tenants';
import { fmtDate, lastMonths, monthKey, monthLabel, todayISO } from '../../lib/dates';
import { exportCSV, exportPDF } from '../../utils/export';

const STATE_COLORS = { active: '#6cc9a0', demo: '#8ec5ef', unpaid: '#f28aa2', suspended: '#b8b4c8' };
const TYPE_ICON = { gym: '💪', padel: '🎾', cricket: '🏏' };

const TABS = [
  { key: 'dues', label: 'Dues Unpaid' },
  { key: 'billing', label: 'Billing by Tenant' },
  { key: 'payments', label: 'Payments Received' },
];

export default function CEODashboard() {
  const [tenants, setTenants] = useState([]);
  const [billing, setBilling] = useState([]);
  const [billingError, setBillingError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);
  const [tab, setTab] = useState('dues');

  const load = useCallback(() => Promise.all([
    getDocs(collection(db, 'tenants')).then((snap) => setTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    loadBilling().then(setBilling).catch((err) => { console.error('Billing load failed:', err); setBillingError(true); }),
  ])
    .catch((err) => console.error('Firestore error:', err))
    .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  const today = todayISO();
  const thisMonth = monthKey(today);

  const rows = useMemo(() => tenants.map((t) => {
    const access = tenantAccess(t, today);
    const dues = tenantDues(t, today);
    const pays = billing.filter((b) => b.tenantId === t.id);
    return {
      ...t,
      access,
      dues,
      fee: Number(t.monthlyFee) || 0,
      paidTotal: pays.reduce((s, b) => s + (Number(b.amount) || 0), 0),
      lastPayment: pays[0] || null,
    };
  }), [tenants, billing, today]);

  const stats = useMemo(() => {
    const by = (s) => rows.filter((r) => r.access.state === s);
    const paid = by('active');
    const demo = by('demo');
    const owing = rows.filter((r) => r.dues.amount > 0);
    return {
      paid, demo, owing,
      unpaidCount: by('unpaid').length,
      expectedMonthly: paid.reduce((s, r) => s + r.fee, 0),
      demoPipeline: demo.reduce((s, r) => s + r.fee, 0),
      duesTotal: owing.reduce((s, r) => s + r.dues.amount, 0),
      collectedMonth: billing.filter((b) => monthKey(b.date) === thisMonth).reduce((s, b) => s + (Number(b.amount) || 0), 0),
      collectedAll: billing.reduce((s, b) => s + (Number(b.amount) || 0), 0),
      endingSoon: rows
        .filter((r) => !r.access.locked && r.access.daysLeft !== null && r.access.daysLeft <= 7)
        .sort((a, b) => a.access.daysLeft - b.access.daysLeft),
    };
  }, [rows, billing, thisMonth]);

  const monthly = useMemo(() => lastMonths(6).map((k) => ({
    month: monthLabel(k),
    Collected: billing.filter((b) => monthKey(b.date) === k).reduce((s, b) => s + (Number(b.amount) || 0), 0),
  })), [billing]);

  const statusPie = useMemo(() => Object.keys(STATE_COLORS)
    .map((s) => ({ key: s, name: ACCESS_META[s].label, value: rows.filter((r) => r.access.state === s).length }))
    .filter((d) => d.value > 0), [rows]);

  // ── Exports ──
  const duesCols = [
    { header: 'Tenant', value: (r) => r.name },
    { header: 'Type', value: (r) => r.role },
    { header: 'Phone', value: (r) => r.phone || '' },
    { header: 'Status', value: (r) => (r.status === 'demo' ? 'Demo ended' : ACCESS_META[r.access.state].label) },
    { header: 'Ended On', value: (r) => fmtDate(r.accessUntil) },
    { header: 'Fee / Month', value: (r) => r.fee, align: 'right' },
    { header: 'Months Due', value: (r) => r.dues.months, align: 'right' },
    { header: 'Amount Due', value: (r) => r.dues.amount, align: 'right' },
  ];
  const billingCols = [
    { header: 'Tenant', value: (r) => r.name },
    { header: 'Type', value: (r) => r.role },
    { header: 'Status', value: (r) => ACCESS_META[r.access.state].label },
    { header: 'Fee / Month', value: (r) => r.fee, align: 'right' },
    { header: 'Total Paid', value: (r) => r.paidTotal, align: 'right' },
    { header: 'Last Payment', value: (r) => (r.lastPayment ? fmtDate(r.lastPayment.date) : '') },
    { header: 'Access Until', value: (r) => (r.accessUntil ? fmtDate(r.accessUntil) : 'No end date') },
    { header: 'Due', value: (r) => r.dues.amount, align: 'right' },
  ];
  const paymentCols = [
    { header: 'Date', value: (b) => fmtDate(b.date) },
    { header: 'Tenant', value: (b) => b.tenantName },
    { header: 'Months', value: (b) => b.months, align: 'right' },
    { header: 'Period', value: (b) => `${fmtDate(b.fromDate)} – ${fmtDate(b.toDate)}` },
    { header: 'Method', value: (b) => b.method },
    { header: 'Note', value: (b) => b.note || '' },
    { header: 'Amount', value: (b) => b.amount, align: 'right' },
  ];

  const tabData = {
    dues: { cols: duesCols, rows: stats.owing, totals: { Tenant: 'Total', 'Amount Due': stats.duesTotal }, title: 'Tenant Dues Unpaid' },
    billing: {
      cols: billingCols, rows,
      totals: {
        Tenant: 'Total',
        'Fee / Month': rows.reduce((s, r) => s + r.fee, 0),
        'Total Paid': rows.reduce((s, r) => s + r.paidTotal, 0),
        Due: stats.duesTotal,
      },
      title: 'Billing by Tenant',
    },
    payments: { cols: paymentCols, rows: billing, totals: { Date: 'Total', Amount: stats.collectedAll }, title: 'Payments Received from Tenants' },
  }[tab];

  const doCSV = () => exportCSV(tabData.title.replace(/\s+/g, '_'), tabData.cols, tabData.rows, tabData.totals);
  const doPDF = () => exportPDF({
    title: tabData.title,
    subtitle: `As of ${fmtDate(today)}`,
    columns: tabData.cols,
    rows: tabData.rows,
    totals: tabData.totals,
    summary: [
      { label: 'Expected / month', value: fmtPKR(stats.expectedMonthly) },
      { label: 'Collected this month', value: fmtPKR(stats.collectedMonth) },
      { label: 'Dues unpaid', value: fmtPKR(stats.duesTotal) },
      { label: 'Collected all-time', value: fmtPKR(stats.collectedAll) },
    ],
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">CEO Dashboard</h2>
          <p className="page-subtitle">Tenants, subscriptions and what you're owed</p>
        </div>
        <Link to="/ceo/tenants" className="btn-primary">+ Enroll Tenant</Link>
      </div>

      {!loading && stats.owing.length > 0 && (
        <button
          onClick={() => setTab('dues')}
          className="w-full text-left mb-5 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm bg-blush-50 ring-1 ring-blush-100 text-blush-800 hover:bg-blush-100/70 transition-colors"
        >
          <span className="text-base">⚠️</span>
          <span className="font-semibold">{stats.owing.length} tenant{stats.owing.length > 1 ? 's have' : ' has'} unpaid dues</span>
          <span>· {fmtPKR(stats.duesTotal)} to collect</span>
          <span className="ml-auto text-xs font-semibold">View ↓</span>
        </button>
      )}

      {billingError && (
        <div className="mb-5 rounded-2xl px-4 py-3 text-sm bg-butter-50 ring-1 ring-butter-100 text-butter-800">
          Couldn't load tenant payments. Allow the CEO account to read and write the <code>billing</code> collection in your Firestore rules.
        </div>
      )}

      {/* KPI tiles */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-up">
          <StatTile label="Expected / Month" value={fmtPKR(stats.expectedMonthly)} sub={`from ${stats.paid.length} paid tenant${stats.paid.length === 1 ? '' : 's'}`} icon="📈" tone="lavender" onClick={() => setTab('billing')} />
          <StatTile label="Collected This Month" value={fmtPKR(stats.collectedMonth)} sub={new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} icon="💰" tone="mint" onClick={() => setTab('payments')} />
          <StatTile label="Dues Unpaid" value={fmtPKR(stats.duesTotal)} sub={`${stats.owing.length} tenant${stats.owing.length === 1 ? '' : 's'} owe you`} icon="⚠️" tone="blush" onClick={() => setTab('dues')} />
          <StatTile label="Collected All-time" value={fmtPKR(stats.collectedAll)} sub={`${billing.length} payment${billing.length === 1 ? '' : 's'}`} icon="🏦" tone="aqua" onClick={() => setTab('payments')} />
          <StatTile label="Total Tenants" value={tenants.length} sub={`💪 ${rows.filter((r) => r.role === 'gym').length} · 🎾 ${rows.filter((r) => r.role === 'padel').length} · 🏏 ${rows.filter((r) => r.role === 'cricket').length}`} icon="🏢" tone="powder" />
          <Link to="/ceo/tenants?filter=active"><StatTile label="Paid Tenants" value={stats.paid.length} sub="active subscriptions" icon="✅" tone="mint" /></Link>
          <Link to="/ceo/tenants?filter=demo"><StatTile label="On Demo" value={stats.demo.length} sub={stats.demoPipeline ? `${fmtPKR(stats.demoPipeline)}/mo if they convert` : 'trial accounts'} icon="🧪" tone="butter" /></Link>
          <Link to="/ceo/tenants?filter=unpaid"><StatTile label="Locked Out" value={stats.unpaidCount} sub="demo or subscription ended" icon="🔒" tone="peach" /></Link>
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6"><div className="lg:col-span-2"><ChartSkeleton /></div><ChartSkeleton /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 animate-fade-up">
          <div className="card lg:col-span-2">
            <div className="card-header"><p className="card-title">Collections — last 6 months</p></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={monthly} barSize={30}>
                  <CartesianGrid vertical={false} stroke="#f1eefb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(171,156,243,0.08)' }} />
                  <Bar dataKey="Collected" fill="#ab9cf3" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><p className="card-title">Tenants by status</p></div>
            <div className="card-body flex items-center justify-center">
              {statusPie.length === 0 ? (
                <p className="text-sm text-slate-400 py-16">No tenants yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {statusPie.map((d) => <Cell key={d.key} fill={STATE_COLORS[d.key]} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip money={false} />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ending soon */}
      {!loading && stats.endingSoon.length > 0 && (
        <div className="card mb-6 animate-fade-up">
          <div className="card-header">
            <p className="card-title">⏳ Ending within 7 days</p>
            <span className="text-xs text-slate-400">Follow up before they get locked out</span>
          </div>
          <div className="overflow-x-auto">
            <table className="simple-table">
              <thead><tr><th>Tenant</th><th>Status</th><th>Ends</th><th>Fee / Month</th><th></th></tr></thead>
              <tbody>
                {stats.endingSoon.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-slate-800">{TYPE_ICON[r.role]} {r.name}</td>
                    <td><span className={`badge ${ACCESS_META[r.access.state].badge}`}>{ACCESS_META[r.access.state].label}</span></td>
                    <td>{fmtDate(r.accessUntil)} <span className="text-xs text-butter-700">· {daysLeftText(r.access)}</span></td>
                    <td>{r.fee ? fmtPKR(r.fee) : '—'}</td>
                    <td className="text-right"><button className="btn-mint btn-sm" onClick={() => setPaying(r)}>Receive</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Billing report */}
      <div className="card animate-fade-up">
        <div className="card-header">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? 'chip-on' : 'chip-off'} onClick={() => setTab(t.key)}>
                {t.label}{t.key === 'dues' && stats.owing.length > 0 ? ` (${stats.owing.length})` : ''}
              </button>
            ))}
          </div>
          <ExportButtons onCSV={doCSV} onPDF={doPDF} disabled={loading || tabData.rows.length === 0} />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : tab === 'dues' ? (
            stats.owing.length === 0 ? (
              <EmptyState icon="🎉" title="No unpaid dues" hint="Every tenant is paid up or still within their demo." />
            ) : (
              <table className="simple-table">
                <thead><tr><th>Tenant</th><th>Status</th><th>Ended On</th><th>Fee / Month</th><th className="text-right">Amount Due</th><th></th></tr></thead>
                <tbody>
                  {stats.owing.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <p className="font-medium text-slate-800">{TYPE_ICON[r.role]} {r.name}</p>
                        <p className="text-xs text-slate-400">{r.phone || r.email}</p>
                      </td>
                      <td><span className="badge badge-unpaid">{r.status === 'demo' ? 'Demo ended' : ACCESS_META[r.access.state].label}</span></td>
                      <td>{fmtDate(r.accessUntil)} <span className="text-xs text-blush-600">· {daysLeftText(r.access)}</span></td>
                      <td>{r.fee ? fmtPKR(r.fee) : <Link to="/ceo/tenants" className="text-xs text-lavender-600 font-semibold">Set fee →</Link>}</td>
                      <td className="text-right font-semibold text-blush-700">
                        {fmtPKR(r.dues.amount)}{r.dues.months > 1 && <span className="text-xs font-normal text-slate-400"> · {r.dues.months} mo</span>}
                      </td>
                      <td className="text-right"><button className="btn-mint btn-sm" onClick={() => setPaying(r)}>Receive</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={4} className="font-semibold text-slate-600">Total</td><td className="text-right font-bold text-blush-700">{fmtPKR(stats.duesTotal)}</td><td /></tr>
                </tfoot>
              </table>
            )
          ) : tab === 'billing' ? (
            rows.length === 0 ? (
              <EmptyState icon="🏢" title="No tenants yet" hint="Enroll your first tenant to start billing." />
            ) : (
              <table className="simple-table">
                <thead><tr><th>Tenant</th><th>Status</th><th>Fee / Month</th><th>Total Paid</th><th>Last Payment</th><th>Access Until</th><th className="text-right">Due</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium text-slate-800">{TYPE_ICON[r.role]} {r.name}</td>
                      <td><span className={`badge ${ACCESS_META[r.access.state].badge}`}>{ACCESS_META[r.access.state].label}</span></td>
                      <td>{r.fee ? fmtPKR(r.fee) : '—'}</td>
                      <td>{fmtPKR(r.paidTotal)}</td>
                      <td>{r.lastPayment ? fmtDate(r.lastPayment.date) : <span className="text-slate-400">Never</span>}</td>
                      <td>{r.accessUntil ? fmtDate(r.accessUntil) : <span className="text-slate-400">No end date</span>}</td>
                      <td className="text-right">{r.dues.amount ? <span className="badge badge-unpaid">{fmtPKR(r.dues.amount)}</span> : <span className="badge badge-paid">Clear</span>}</td>
                      <td className="text-right"><button className="btn-mint btn-sm" onClick={() => setPaying(r)}>Receive</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : billing.length === 0 ? (
            <EmptyState icon="💰" title="No payments yet" hint="Use “Receive” on a tenant to record their subscription payment." />
          ) : (
            <table className="simple-table">
              <thead><tr><th>Date</th><th>Tenant</th><th>Covers</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {billing.map((b) => (
                  <tr key={b.id}>
                    <td>{fmtDate(b.date)}</td>
                    <td className="font-medium text-slate-800">{TYPE_ICON[b.tenantRole] || ''} {b.tenantName}</td>
                    <td>
                      {b.months} month{b.months > 1 ? 's' : ''}
                      <span className="text-xs text-slate-400"> · {fmtDate(b.fromDate)} – {fmtDate(b.toDate)}</span>
                    </td>
                    <td>{b.method}{b.note && <span className="text-xs text-slate-400"> · {b.note}</span>}</td>
                    <td className="text-right font-semibold text-mint-700">{fmtPKR(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {paying && <TenantPaymentModal tenant={paying} onClose={() => setPaying(null)} onSaved={load} />}
    </div>
  );
}
