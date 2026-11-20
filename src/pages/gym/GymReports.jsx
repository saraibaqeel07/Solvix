import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { StatCardSkeleton, ChartSkeleton } from '../../components/Skeleton';
import { StatTile, ExportButtons, ChartTooltip, EmptyState } from '../../components/ui';
import { exportCSV, exportPDF } from '../../utils/export';
import { fmtDate, inRange, rangeFor, monthLabel, monthKey } from '../../lib/dates';
import {
  loadGymData, memberState, memberDues, fmtPKR, num, PAY_KINDS, payKind, groupPayments, PAYMENT_METHODS, STATE_META,
} from '../../lib/gym';

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

const TABS = [
  { key: 'collections', label: '💰 Collections' },
  { key: 'members',     label: '👥 Members' },
  { key: 'dues',        label: '⏳ Dues & Renewals' },
  { key: 'packages',    label: '🎁 Packages' },
];

const PIE = ['#ab9cf3', '#6cc9a0', '#f49a70', '#80b4ef', '#f28aa2', '#f5bf5c', '#66c1b8', '#c19af0'];
const k = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v);

function Th({ children, right }) { return <th className={right ? 'text-right' : ''}>{children}</th>; }

export default function GymReports() {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const [data, setData] = useState({ customers: [], packages: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [tab, setTab] = useState('collections');
  const [typeFilter, setTypeFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!uid) return;
    loadGymData(uid)
      .then(setData)
      .catch((e) => { console.error(e); toast.error('Failed to load reports'); })
      .finally(() => setLoading(false));
  }, [uid]);

  const range = preset === 'custom' ? { from: custom.from || null, to: custom.to || null } : rangeFor(preset);
  const rangeText = range.from || range.to
    ? `${range.from ? fmtDate(range.from) : 'Start'} – ${range.to ? fmtDate(range.to) : 'Today'}`
    : 'All time';
  const q = search.trim().toLowerCase();
  const matches = (...vals) => !q || vals.some((v) => String(v || '').toLowerCase().includes(q));

  // ── Collections ─────────────────────────────────────────────────────────────
  const paymentsInRange = useMemo(
    () => data.payments.filter((p) => inRange(p.date, range.from, range.to)),
    [data.payments, range.from, range.to],
  );
  const payments = groupPayments(paymentsInRange).filter((p) =>
    (typeFilter === 'all' || p.kind === typeFilter) &&
    (methodFilter === 'all' || (p.method || 'Cash') === methodFilter) &&
    matches(p.customerName, p.phone, p.packageName));

  const sumType = (t) => paymentsInRange.filter((p) => payKind(p) === t).reduce((s, p) => s + num(p.amount), 0);
  const totalCollected = paymentsInRange.reduce((s, p) => s + num(p.amount), 0);
  const admissionTotal = paymentsInRange.filter((p) => p.type === 'admission').reduce((s, p) => s + num(p.amount), 0);
  const packageTotal = sumType('package');
  const monthlyTotal = sumType('monthly');

  const newMembers = data.customers.filter((c) => inRange(c.admissionDate, range.from, range.to));
  const totalDues = data.customers.reduce((s, c) => s + memberDues(c).total, 0);

  // Group by day for short ranges, by month for long ones.
  const chartData = useMemo(() => {
    const short = preset === 'today' || preset === 'week' || preset === 'month' || preset === 'lastMonth';
    const buckets = {};
    paymentsInRange.forEach((p) => {
      const key = short ? p.date : monthKey(p.date);
      if (!key) return;
      buckets[key] ||= { key, package: 0, monthly: 0 };
      buckets[key][payKind(p)] += num(p.amount);
    });
    return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => ({ ...b, label: short ? fmtDate(b.key).slice(0, 6) : monthLabel(b.key) }));
  }, [paymentsInRange, preset]);

  const methodData = PAYMENT_METHODS.map((m) => ({
    name: m,
    value: paymentsInRange.filter((p) => (p.method || 'Cash') === m).reduce((s, p) => s + num(p.amount), 0),
  })).filter((d) => d.value > 0);

  // ── Members ─────────────────────────────────────────────────────────────────
  const memberRows = useMemo(() => data.customers.map((c) => {
    const paid = data.payments.filter((p) => p.customerId === c.id);
    return {
      ...c,
      _state: memberState(c).state,
      _dues: memberDues(c).total,
      _paidRange: paid.filter((p) => inRange(p.date, range.from, range.to)).reduce((s, p) => s + num(p.amount), 0),
      _paidAll: paid.reduce((s, p) => s + num(p.amount), 0),
    };
  }).sort((a, b) => (a.name || '').localeCompare(b.name || '')), [data, range.from, range.to]);
  const membersView = memberRows.filter((r) => matches(r.name, r.phone, r.email, r.membershipType));

  // ── Dues & renewals ────────────────────────────────────────────────────────
  const dueRows = memberRows
    .filter((r) => r._dues > 0 || r._state === 'expired' || r._state === 'expiring')
    .map((r) => ({ ...r, _reason: [r._dues > 0 && 'Unpaid fee', r._state === 'expired' && 'Renewal due', r._state === 'expiring' && 'Expiring soon'].filter(Boolean).join(', ') }))
    .sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''))
    .filter((r) => matches(r.name, r.phone, r.membershipType));

  // ── Packages ───────────────────────────────────────────────────────────────
  const packageRows = useMemo(() => {
    const rows = data.packages.map((p) => ({ id: p.id, name: p.name, price: p.price, members: 0, active: 0, sold: 0, revenue: 0 }));
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    const other = { id: '', name: 'Custom / no package', price: null, members: 0, active: 0, sold: 0, revenue: 0 };
    data.customers.forEach((c) => {
      const r = byId[c.packageId] || other;
      r.members += 1;
      if (['active', 'expiring'].includes(memberState(c).state)) r.active += 1;
    });
    paymentsInRange.filter((p) => p.type !== 'admission').forEach((p) => {
      const r = byId[p.packageId] || other;
      r.sold += 1;
      r.revenue += num(p.amount);
    });
    return [...rows, ...(other.members || other.sold ? [other] : [])].sort((a, b) => b.revenue - a.revenue);
  }, [data, paymentsInRange]);

  // ── Export definitions per tab ─────────────────────────────────────────────
  const exportDef = () => {
    if (tab === 'collections') {
      const cols = [
        { header: 'Date', value: (p) => p.date },
        { header: 'Member', value: (p) => p.customerName },
        { header: 'Phone', value: (p) => p.phone },
        { header: 'Type', value: (p) => PAY_KINDS[p.kind].label },
        { header: 'Package', value: (p) => p.packageName },
        { header: 'Period', value: (p) => (p.periodStart ? `${p.periodStart} to ${p.periodEnd}` : '') },
        { header: 'Method', value: (p) => p.method || 'Cash' },
        { header: 'Fee (PKR)', value: (p) => p.fee, align: 'right' },
        { header: 'Admission (PKR)', value: (p) => p.admission, align: 'right' },
        { header: 'Total (PKR)', value: (p) => p.total, align: 'right' },
      ];
      return { name: 'collections', title: 'Collections Report', cols, rows: payments,
        totals: { Date: 'TOTAL', 'Fee (PKR)': payments.reduce((s, p) => s + p.fee, 0), 'Admission (PKR)': payments.reduce((s, p) => s + p.admission, 0), 'Total (PKR)': payments.reduce((s, p) => s + p.total, 0) },
        summary: [
          { label: 'Total collected', value: fmtPKR(totalCollected) },
          { label: 'Package fees', value: fmtPKR(packageTotal) },
          { label: 'Monthly fees', value: fmtPKR(monthlyTotal) },
          { label: 'Incl. admission fees', value: fmtPKR(admissionTotal) },
        ] };
    }
    if (tab === 'members') {
      const cols = [
        { header: 'Name', value: (r) => r.name },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'Package', value: (r) => r.membershipType },
        { header: 'Joined', value: (r) => r.admissionDate },
        { header: 'Expiry', value: (r) => r.endDate },
        { header: 'Status', value: (r) => STATE_META[r._state].label },
        { header: 'Paid in period (PKR)', value: (r) => r._paidRange, align: 'right' },
        { header: 'Paid all-time (PKR)', value: (r) => r._paidAll, align: 'right' },
        { header: 'Dues (PKR)', value: (r) => r._dues, align: 'right' },
      ];
      return { name: 'members', title: 'Members Report', cols, rows: membersView,
        totals: { Name: 'TOTAL', 'Paid in period (PKR)': membersView.reduce((s, r) => s + r._paidRange, 0), 'Paid all-time (PKR)': membersView.reduce((s, r) => s + r._paidAll, 0), 'Dues (PKR)': membersView.reduce((s, r) => s + r._dues, 0) },
        summary: [{ label: 'Members', value: membersView.length }, { label: 'New in period', value: newMembers.length }] };
    }
    if (tab === 'dues') {
      const cols = [
        { header: 'Name', value: (r) => r.name },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'Package', value: (r) => r.membershipType },
        { header: 'Expiry', value: (r) => r.endDate },
        { header: 'Reason', value: (r) => r._reason },
        { header: 'Dues (PKR)', value: (r) => r._dues, align: 'right' },
      ];
      return { name: 'dues_renewals', title: 'Dues & Renewals Report', cols, rows: dueRows,
        totals: { Name: 'TOTAL', 'Dues (PKR)': dueRows.reduce((s, r) => s + r._dues, 0) },
        summary: [{ label: 'Outstanding dues', value: fmtPKR(totalDues) }, { label: 'Members listed', value: dueRows.length }] };
    }
    const cols = [
      { header: 'Package', value: (r) => r.name },
      { header: 'Price (PKR)', value: (r) => (r.price === null ? '' : num(r.price)), align: 'right' },
      { header: 'Active members', value: (r) => r.active, align: 'right' },
      { header: 'All members', value: (r) => r.members, align: 'right' },
      { header: 'Sold in period', value: (r) => r.sold, align: 'right' },
      { header: 'Revenue in period (PKR)', value: (r) => r.revenue, align: 'right' },
    ];
    return { name: 'packages', title: 'Package Performance', cols, rows: packageRows,
      totals: { Package: 'TOTAL', 'Revenue in period (PKR)': packageRows.reduce((s, r) => s + r.revenue, 0) } };
  };

  const doCSV = () => { const d = exportDef(); exportCSV(`gym_${d.name}`, d.cols, d.rows, d.totals); };
  const doPDF = () => {
    const d = exportDef();
    exportPDF({ title: d.title, subtitle: `${userProfile?.name || ''} · ${tab === 'dues' ? 'As of today' : rangeText}`, columns: d.cols, rows: d.rows, totals: d.totals, summary: d.summary });
  };
  const currentCount = { collections: payments.length, members: membersView.length, dues: dueRows.length, packages: packageRows.length }[tab];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Reports</h2>
          <p className="page-subtitle">{rangeText} · all fees including admission</p>
        </div>
        <ExportButtons onCSV={doCSV} onPDF={doPDF} disabled={loading || !currentCount} />
      </div>

      {/* Date range */}
      <div className="card px-5 py-4 mb-6 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.key} className={preset === p.key ? 'chip-on' : 'chip-off'} onClick={() => setPreset(p.key)}>{p.label}</button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" className="input !py-1.5 !w-auto" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <span className="text-slate-400 text-xs">to</span>
            <input type="date" className="input !py-1.5 !w-auto" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        )}
      </div>

      {/* Summary */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">{[0, 1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6 animate-fade-up">
          <StatTile label="Total Collected" value={fmtPKR(totalCollected)} sub={`${paymentsInRange.length} payments`} icon="💰" tone="mint" />
          <StatTile label="Package" value={fmtPKR(packageTotal)} sub="incl. admission fees" icon="🎁" tone="lavender" />
          <StatTile label="Admission Fees" value={fmtPKR(admissionTotal)} sub={`one-time · included above · ${newMembers.length} new`} icon="🎟️" tone="peach" />
          <StatTile label="Monthly" value={fmtPKR(monthlyTotal)} sub="incl. admission fees" icon="📆" tone="powder" />
          <StatTile label="Outstanding Dues" value={fmtPKR(totalDues)} sub="as of today" icon="⏳" tone="blush" />
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6"><div className="lg:col-span-2"><ChartSkeleton /></div><ChartSkeleton /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 animate-fade-up">
          <div className="card lg:col-span-2">
            <div className="card-header"><p className="card-title">Collections breakdown</p><span className="text-xs text-slate-400">{rangeText}</span></div>
            <div className="card-body">
              {chartData.length === 0 ? <EmptyState icon="📉" title="No payments in this period" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} barSize={chartData.length > 12 ? 10 : 22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1eefb" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
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
            <div className="card-header"><p className="card-title">By payment method</p></div>
            <div className="card-body">
              {methodData.length === 0 ? <EmptyState icon="💳" title="No payments" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={methodData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {methodData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={7} formatter={(v) => <span className="text-xs text-slate-500">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Listings */}
      <div className="card animate-fade-up">
        <div className="card-header">
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? 'chip-on' : 'chip-off'} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {tab === 'collections' && (
              <>
                <select className="input !py-1.5 !w-auto text-xs" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">All types</option>
                  {Object.entries(PAY_KINDS).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
                </select>
                <select className="input !py-1.5 !w-auto text-xs" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                  <option value="all">All methods</option>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </>
            )}
            {tab !== 'packages' && (
              <input className="input !py-1.5 !w-44 text-xs" placeholder="Search name / phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            {tab === 'collections' && (payments.length === 0 ? <EmptyState icon="🧾" title="No payments match" hint="Try a different date range or filter." /> : (
              <table className="simple-table">
                <thead className="sticky top-0"><tr><Th>Date</Th><Th>Member</Th><Th>Type</Th><Th>Package</Th><Th>Period</Th><Th>Method</Th><Th right>Fee</Th><Th right>Admission</Th><Th right>Total</Th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{fmtDate(p.date)}</td>
                      <td><p className="font-semibold text-slate-800">{p.customerName}</p><p className="text-xs text-slate-400">{p.phone}</p></td>
                      <td><span className={`badge ${PAY_KINDS[p.kind].badge}`}>{PAY_KINDS[p.kind].label}</span></td>
                      <td className="text-slate-500">{p.packageName || '—'}</td>
                      <td className="text-slate-500 text-xs whitespace-nowrap">{p.periodStart ? `${fmtDate(p.periodStart)} → ${fmtDate(p.periodEnd)}` : '—'}</td>
                      <td className="text-slate-500">{p.method || 'Cash'}</td>
                      <td className="text-right whitespace-nowrap">{p.fee ? fmtPKR(p.fee) : '—'}</td>
                      <td className="text-right whitespace-nowrap text-slate-500">{p.admission ? fmtPKR(p.admission) : '—'}</td>
                      <td className="text-right font-semibold text-slate-800 whitespace-nowrap">{fmtPKR(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-lavender-50/60">
                  <td colSpan={6} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Total ({payments.length})</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{fmtPKR(payments.reduce((s, p) => s + p.fee, 0))}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{fmtPKR(payments.reduce((s, p) => s + p.admission, 0))}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{fmtPKR(payments.reduce((s, p) => s + p.total, 0))}</td>
                </tr></tfoot>
              </table>
            ))}

            {tab === 'members' && (membersView.length === 0 ? <EmptyState icon="👥" title="No members" /> : (
              <table className="simple-table">
                <thead className="sticky top-0"><tr><Th>Member</Th><Th>Package</Th><Th>Joined</Th><Th>Expiry</Th><Th>Status</Th><Th right>Paid (period)</Th><Th right>Paid (all)</Th><Th right>Dues</Th></tr></thead>
                <tbody>
                  {membersView.map((r) => (
                    <tr key={r.id}>
                      <td><p className="font-semibold text-slate-800">{r.name}</p><p className="text-xs text-slate-400">{r.phone}</p></td>
                      <td className="text-slate-500">{r.membershipType || '—'}</td>
                      <td className="text-slate-500 whitespace-nowrap">{fmtDate(r.admissionDate)}</td>
                      <td className="text-slate-500 whitespace-nowrap">{fmtDate(r.endDate)}</td>
                      <td><span className={`badge ${STATE_META[r._state].badge}`}>{STATE_META[r._state].label}</span></td>
                      <td className="text-right whitespace-nowrap">{fmtPKR(r._paidRange)}</td>
                      <td className="text-right whitespace-nowrap">{fmtPKR(r._paidAll)}</td>
                      <td className={`text-right font-semibold whitespace-nowrap ${r._dues ? 'text-blush-700' : 'text-slate-400'}`}>{fmtPKR(r._dues)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-lavender-50/60">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Total ({membersView.length})</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{fmtPKR(membersView.reduce((s, r) => s + r._paidRange, 0))}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{fmtPKR(membersView.reduce((s, r) => s + r._paidAll, 0))}</td>
                  <td className="px-4 py-3 text-right font-bold text-blush-700 whitespace-nowrap">{fmtPKR(membersView.reduce((s, r) => s + r._dues, 0))}</td>
                </tr></tfoot>
              </table>
            ))}

            {tab === 'dues' && (dueRows.length === 0 ? <EmptyState icon="🎉" title="No dues or pending renewals" /> : (
              <table className="simple-table">
                <thead className="sticky top-0"><tr><Th>Member</Th><Th>Package</Th><Th>Expiry</Th><Th>Reason</Th><Th right>Dues</Th></tr></thead>
                <tbody>
                  {dueRows.map((r) => (
                    <tr key={r.id}>
                      <td><p className="font-semibold text-slate-800">{r.name}</p><p className="text-xs text-slate-400">{r.phone}</p></td>
                      <td className="text-slate-500">{r.membershipType || '—'}</td>
                      <td className="whitespace-nowrap"><span className={`badge ${STATE_META[r._state].badge}`}>{fmtDate(r.endDate)}</span></td>
                      <td className="text-slate-500 text-xs">{r._reason}</td>
                      <td className="text-right font-semibold text-blush-700 whitespace-nowrap">{fmtPKR(r._dues)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-lavender-50/60">
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Total outstanding</td>
                  <td className="px-4 py-3 text-right font-bold text-blush-700 whitespace-nowrap">{fmtPKR(dueRows.reduce((s, r) => s + r._dues, 0))}</td>
                </tr></tfoot>
              </table>
            ))}

            {tab === 'packages' && (packageRows.length === 0 ? <EmptyState icon="🎁" title="No packages yet" /> : (
              <table className="simple-table">
                <thead className="sticky top-0"><tr><Th>Package</Th><Th right>Price</Th><Th right>Active</Th><Th right>All members</Th><Th right>Sold (period)</Th><Th right>Revenue (period)</Th></tr></thead>
                <tbody>
                  {packageRows.map((r) => (
                    <tr key={r.id || 'other'}>
                      <td className="font-semibold text-slate-800">{r.name}</td>
                      <td className="text-right">{r.price === null ? '—' : fmtPKR(r.price)}</td>
                      <td className="text-right">{r.active}</td>
                      <td className="text-right">{r.members}</td>
                      <td className="text-right">{r.sold}</td>
                      <td className="text-right font-semibold whitespace-nowrap">{fmtPKR(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-lavender-50/60">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Total (excl. admission fees)</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{fmtPKR(packageRows.reduce((s, r) => s + r.revenue, 0))}</td>
                </tr></tfoot>
              </table>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
