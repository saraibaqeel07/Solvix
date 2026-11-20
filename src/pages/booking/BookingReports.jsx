import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../../components/Skeleton';
import { StatTile, ExportButtons, ChartTooltip, EmptyState } from '../../components/ui';
import { exportCSV, exportPDF } from '../../utils/export';
import { fmtDate, inRange, monthKey, monthLabel, rangeFor } from '../../lib/dates';
import { fmtPKR } from '../../lib/gym';
import { balance, isActive, occupiedSlots, payState, PAY_META, slotHour, timeRange, PAYMENT_METHODS } from '../../lib/bookings';
import useBookingData from './useBookingData';

const PRESETS = [
  { key: 'today', label: 'Today' }, { key: 'week', label: 'This week' }, { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' }, { key: 'year', label: 'This year' }, { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];
const TABS = [
  { key: 'bookings', label: '📋 Bookings' },
  { key: 'daily', label: '📆 Daily summary' },
  { key: 'customers', label: '👥 Customers' },
  { key: 'courts', label: '🏟️ Courts' },
  { key: 'balance', label: '⏳ Balance due' },
];
const PIE = ['#ab9cf3', '#6cc9a0', '#f49a70', '#80b4ef', '#f28aa2', '#f5bf5c'];
const k = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v);
const hrs = (b) => Number(b.hours) || 1;

export default function BookingReports({ sport }) {
  const { bookings, settings, loading, userProfile, cfg } = useBookingData(sport);
  const [preset, setPreset] = useState('month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [tab, setTab] = useState('bookings');
  const [search, setSearch] = useState('');
  const courtsLabel = `${cfg.unit}s`;
  const tabs = TABS.map((t) => (t.key === 'courts' ? { ...t, label: `🏟️ ${courtsLabel}` } : t));

  const range = preset === 'custom' ? { from: custom.from || null, to: custom.to || null } : rangeFor(preset);
  const rangeText = range.from || range.to ? `${range.from ? fmtDate(range.from) : 'Start'} – ${range.to ? fmtDate(range.to) : 'Today'}` : 'All time';
  const q = search.trim().toLowerCase();

  const r = useMemo(() => {
    const all = bookings.filter((b) => inRange(b.date, range.from, range.to));
    const active = all.filter(isActive);
    const sum = (list, f) => list.reduce((s, b) => s + f(b), 0);

    const short = ['today', 'week', 'month', 'lastMonth'].includes(preset);
    const buckets = {};
    active.forEach((b) => {
      const key = short ? b.date : monthKey(b.date);
      buckets[key] ||= { key, collected: 0, balance: 0, hours: 0, bookings: 0 };
      buckets[key].collected += b.paidAmount;
      buckets[key].balance += balance(b);
      buckets[key].hours += hrs(b);
      buckets[key].bookings += 1;
    });
    const chart = Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key))
      .map((x) => ({ ...x, label: short ? fmtDate(x.key).slice(0, 6) : monthLabel(x.key) }));

    // Daily rows (always per day for the table)
    const dayMap = {};
    all.forEach((b) => {
      dayMap[b.date] ||= { date: b.date, bookings: 0, hours: 0, billed: 0, collected: 0, balance: 0, cancelled: 0 };
      const d = dayMap[b.date];
      if (!isActive(b)) { d.cancelled += 1; return; }
      d.bookings += 1; d.hours += hrs(b); d.billed += b.amount; d.collected += b.paidAmount; d.balance += balance(b);
    });
    const daily = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date));

    const custMap = {};
    active.forEach((b) => {
      const key = (b.phone || b.customerName || '').trim().toLowerCase();
      custMap[key] ||= { name: b.customerName, phone: b.phone, bookings: 0, hours: 0, spent: 0, balance: 0, last: '' };
      const c = custMap[key];
      c.bookings += 1; c.hours += hrs(b); c.spent += b.paidAmount; c.balance += balance(b);
      if (b.date > c.last) c.last = b.date;
    });
    const customers = Object.values(custMap).sort((a, b) => b.spent - a.spent || b.bookings - a.bookings);

    const courts = (settings?.courts || []).map((c) => {
      const list = active.filter((b) => b.court === c);
      return { name: c, bookings: list.length, hours: sum(list, hrs), collected: sum(list, (b) => b.paidAmount), balance: sum(list, balance) };
    });

    const hourMap = {};
    active.forEach((b) => occupiedSlots(b).forEach((s) => { hourMap[slotHour(s)] = (hourMap[slotHour(s)] || 0) + 1; }));
    const methods = PAYMENT_METHODS.map((m) => ({ name: m, value: sum(active.filter((b) => (b.method || 'Cash') === m), (b) => b.paidAmount) })).filter((x) => x.value > 0);

    return {
      all, active, chart, daily, customers, courts, methods,
      hourMap,
      collected: sum(active, (b) => b.paidAmount),
      billed: sum(active, (b) => b.amount),
      outstanding: sum(active, balance),
      hours: sum(active, hrs),
      cancelled: all.length - active.length,
      balanceRows: active.filter((b) => balance(b) > 0).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [bookings, settings, range.from, range.to, preset]);

  const match = (...v) => !q || v.some((x) => String(x || '').toLowerCase().includes(q));
  const bookingRows = r.all.filter((b) => match(b.customerName, b.phone, b.court)).map((b) => ({ ...b, _pay: payState(b), _bal: balance(b), _time: timeRange(b) }));
  const customerRows = r.customers.filter((c) => match(c.name, c.phone));
  const balanceRows = r.balanceRows.filter((b) => match(b.customerName, b.phone)).map((b) => ({ ...b, _bal: balance(b), _time: timeRange(b) }));
  const peakHour = Object.entries(r.hourMap).sort((a, b) => b[1] - a[1])[0];

  const def = () => {
    const bk = [
      { header: 'Date', value: (b) => b.date }, { header: 'Time', value: (b) => b._time }, { header: cfg.unit, value: (b) => b.court },
      { header: 'Customer', value: (b) => b.customerName }, { header: 'Phone', value: (b) => b.phone },
      { header: 'Price (PKR)', value: (b) => b.amount, align: 'right' }, { header: 'Paid (PKR)', value: (b) => b.paidAmount, align: 'right' },
      { header: 'Balance (PKR)', value: (b) => b._bal, align: 'right' }, { header: 'Status', value: (b) => PAY_META[b._pay].label },
    ];
    if (tab === 'bookings') return { name: 'bookings', title: `${cfg.label} Bookings Report`, cols: bk, rows: bookingRows,
      totals: { Date: 'TOTAL', 'Price (PKR)': bookingRows.filter(isActive).reduce((s, b) => s + b.amount, 0), 'Paid (PKR)': bookingRows.filter(isActive).reduce((s, b) => s + b.paidAmount, 0), 'Balance (PKR)': bookingRows.reduce((s, b) => s + b._bal, 0) } };
    if (tab === 'daily') {
      const cols = [
        { header: 'Date', value: (d) => d.date }, { header: 'Bookings', value: (d) => d.bookings, align: 'right' }, { header: 'Hours', value: (d) => d.hours, align: 'right' },
        { header: 'Billed (PKR)', value: (d) => d.billed, align: 'right' }, { header: 'Collected (PKR)', value: (d) => d.collected, align: 'right' },
        { header: 'Balance (PKR)', value: (d) => d.balance, align: 'right' }, { header: 'Cancelled', value: (d) => d.cancelled, align: 'right' },
      ];
      const t = (f) => r.daily.reduce((s, d) => s + d[f], 0);
      return { name: 'daily', title: `${cfg.label} Daily Summary`, cols, rows: r.daily,
        totals: { Date: 'TOTAL', Bookings: t('bookings'), Hours: t('hours'), 'Billed (PKR)': t('billed'), 'Collected (PKR)': t('collected'), 'Balance (PKR)': t('balance'), Cancelled: t('cancelled') } };
    }
    if (tab === 'customers') {
      const cols = [
        { header: 'Customer', value: (c) => c.name }, { header: 'Phone', value: (c) => c.phone }, { header: 'Bookings', value: (c) => c.bookings, align: 'right' },
        { header: 'Hours', value: (c) => c.hours, align: 'right' }, { header: 'Paid (PKR)', value: (c) => c.spent, align: 'right' },
        { header: 'Balance (PKR)', value: (c) => c.balance, align: 'right' }, { header: 'Last visit', value: (c) => c.last },
      ];
      return { name: 'customers', title: `${cfg.label} Customers Report`, cols, rows: customerRows,
        totals: { Customer: 'TOTAL', Bookings: customerRows.reduce((s, c) => s + c.bookings, 0), 'Paid (PKR)': customerRows.reduce((s, c) => s + c.spent, 0), 'Balance (PKR)': customerRows.reduce((s, c) => s + c.balance, 0) } };
    }
    if (tab === 'courts') {
      const cols = [
        { header: cfg.unit, value: (c) => c.name }, { header: 'Bookings', value: (c) => c.bookings, align: 'right' }, { header: 'Hours', value: (c) => c.hours, align: 'right' },
        { header: 'Collected (PKR)', value: (c) => c.collected, align: 'right' }, { header: 'Balance (PKR)', value: (c) => c.balance, align: 'right' },
      ];
      return { name: 'courts', title: `${cfg.label} ${courtsLabel} Report`, cols, rows: r.courts,
        totals: { [cfg.unit]: 'TOTAL', Hours: r.courts.reduce((s, c) => s + c.hours, 0), 'Collected (PKR)': r.courts.reduce((s, c) => s + c.collected, 0) } };
    }
    return { name: 'balance_due', title: `${cfg.label} Balance Due`, cols: bk, rows: balanceRows,
      totals: { Date: 'TOTAL', 'Balance (PKR)': balanceRows.reduce((s, b) => s + b._bal, 0) } };
  };

  const summary = [
    { label: 'Collected', value: fmtPKR(r.collected) }, { label: 'Billed', value: fmtPKR(r.billed) },
    { label: 'Balance due', value: fmtPKR(r.outstanding) }, { label: 'Bookings', value: r.active.length }, { label: 'Hours', value: r.hours },
  ];
  const doCSV = () => { const d = def(); exportCSV(`${sport}_${d.name}`, d.cols, d.rows, d.totals); };
  const doPDF = () => { const d = def(); exportPDF({ title: d.title, subtitle: `${userProfile?.name || ''} · ${rangeText}`, columns: d.cols, rows: d.rows, totals: d.totals, summary }); };
  const count = { bookings: bookingRows.length, daily: r.daily.length, customers: customerRows.length, courts: r.courts.length, balance: balanceRows.length }[tab];

  return (
    <div className="page">
      <div className="page-header">
        <div><h2 className="page-title">{cfg.label} Reports</h2><p className="page-subtitle">{rangeText}</p></div>
        <ExportButtons onCSV={doCSV} onPDF={doPDF} disabled={loading || !count} />
      </div>

      <div className="card px-5 py-4 mb-6 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => <button key={p.key} className={preset === p.key ? 'chip-on' : 'chip-off'} onClick={() => setPreset(p.key)}>{p.label}</button>)}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" className="input !py-1.5 !w-auto" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <span className="text-slate-400 text-xs">to</span>
            <input type="date" className="input !py-1.5 !w-auto" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">{[0, 1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6 animate-fade-up">
          <StatTile label="Collected" value={fmtPKR(r.collected)} sub={`of ${fmtPKR(r.billed)} billed`} icon="💰" tone="mint" />
          <StatTile label="Balance Due" value={fmtPKR(r.outstanding)} sub={`${r.balanceRows.length} bookings`} icon="⏳" tone="blush" />
          <StatTile label="Bookings" value={r.active.length} sub={`${r.cancelled} cancelled`} icon="📋" tone="lavender" />
          <StatTile label="Hours Played" value={r.hours} sub={r.active.length ? `avg ${fmtPKR(Math.round(r.billed / Math.max(1, r.hours)))}/hr` : ''} icon="⏱️" tone="powder" />
          <StatTile label="Peak Hour" value={peakHour ? `${String(peakHour[0]).padStart(2, '0')}:00` : '—'} sub={peakHour ? `${peakHour[1]} hours booked` : ''} icon="🔥" tone="butter" />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6"><div className="lg:col-span-2"><ChartSkeleton /></div><ChartSkeleton /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 animate-fade-up">
          <div className="card lg:col-span-2">
            <div className="card-header"><p className="card-title">Collected vs balance</p><span className="text-xs text-slate-400">{rangeText}</span></div>
            <div className="card-body">
              {r.chart.length === 0 ? <EmptyState icon="📉" title="No bookings in this period" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={r.chart} barSize={r.chart.length > 12 ? 10 : 22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1eefb" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={k} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(171,156,243,0.08)' }} />
                    <Legend iconType="circle" iconSize={7} formatter={(v) => <span className="text-xs text-slate-500">{v}</span>} />
                    <Bar dataKey="collected" name="Collected" stackId="a" fill="#6cc9a0" />
                    <Bar dataKey="balance" name="Balance" stackId="a" fill="#f8a99f" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><p className="card-title">By payment method</p></div>
            <div className="card-body">
              {r.methods.length === 0 ? <EmptyState icon="💳" title="No payments" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={r.methods} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {r.methods.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} strokeWidth={0} />)}
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

      <div className="card animate-fade-up">
        <div className="card-header">
          <div className="flex gap-1.5 flex-wrap">{tabs.map((t) => <button key={t.key} className={tab === t.key ? 'chip-on' : 'chip-off'} onClick={() => setTab(t.key)}>{t.label}</button>)}</div>
          {['bookings', 'customers', 'balance'].includes(tab) && (
            <input className="input !py-1.5 !w-44 text-xs" placeholder="Search name / phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          )}
        </div>

        {loading ? <div className="p-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div> : !count ? (
          <EmptyState icon="🗂️" title="Nothing to show" hint="Try a different date range." />
        ) : (
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            {(tab === 'bookings' || tab === 'balance') && (
              <table className="simple-table">
                <thead className="sticky top-0"><tr><th>Date</th><th>Time</th><th>{cfg.unit}</th><th>Customer</th><th className="text-right">Price</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
                <tbody>
                  {(tab === 'bookings' ? bookingRows : balanceRows).map((b) => (
                    <tr key={b.id} className={b.status === 'cancelled' ? 'opacity-50' : ''}>
                      <td className="whitespace-nowrap">{fmtDate(b.date)}</td>
                      <td className="whitespace-nowrap">{b._time}</td>
                      <td>{b.court}</td>
                      <td><p className="font-semibold text-slate-800">{b.customerName}</p><p className="text-xs text-slate-400">{b.phone}</p></td>
                      <td className="text-right whitespace-nowrap">{fmtPKR(b.amount)}</td>
                      <td className="text-right whitespace-nowrap text-mint-700">{fmtPKR(b.paidAmount)}</td>
                      <td className="text-right whitespace-nowrap font-semibold text-blush-700">{b._bal ? fmtPKR(b._bal) : '—'}</td>
                      <td><span className={`badge ${PAY_META[payState(b)].badge}`}>{PAY_META[payState(b)].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'daily' && (
              <table className="simple-table">
                <thead className="sticky top-0"><tr><th>Date</th><th className="text-right">Bookings</th><th className="text-right">Hours</th><th className="text-right">Billed</th><th className="text-right">Collected</th><th className="text-right">Balance</th><th className="text-right">Cancelled</th></tr></thead>
                <tbody>
                  {r.daily.map((d) => (
                    <tr key={d.date}>
                      <td className="whitespace-nowrap font-semibold text-slate-800">{fmtDate(d.date)}</td>
                      <td className="text-right">{d.bookings}</td><td className="text-right">{d.hours}</td>
                      <td className="text-right whitespace-nowrap">{fmtPKR(d.billed)}</td>
                      <td className="text-right whitespace-nowrap text-mint-700 font-semibold">{fmtPKR(d.collected)}</td>
                      <td className="text-right whitespace-nowrap text-blush-700">{d.balance ? fmtPKR(d.balance) : '—'}</td>
                      <td className="text-right text-slate-400">{d.cancelled || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'customers' && (
              <table className="simple-table">
                <thead className="sticky top-0"><tr><th>#</th><th>Customer</th><th className="text-right">Bookings</th><th className="text-right">Hours</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Last visit</th></tr></thead>
                <tbody>
                  {customerRows.map((c, i) => (
                    <tr key={`${c.phone}${c.name}`}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td><p className="font-semibold text-slate-800">{c.name}</p><p className="text-xs text-slate-400">{c.phone || '—'}</p></td>
                      <td className="text-right">{c.bookings}</td><td className="text-right">{c.hours}</td>
                      <td className="text-right whitespace-nowrap font-semibold text-mint-700">{fmtPKR(c.spent)}</td>
                      <td className="text-right whitespace-nowrap text-blush-700">{c.balance ? fmtPKR(c.balance) : '—'}</td>
                      <td className="whitespace-nowrap text-slate-500">{fmtDate(c.last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'courts' && (
              <table className="simple-table">
                <thead className="sticky top-0"><tr><th>{cfg.unit}</th><th className="text-right">Bookings</th><th className="text-right">Hours</th><th className="text-right">Collected</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {r.courts.map((c) => (
                    <tr key={c.name}>
                      <td className="font-semibold text-slate-800">{c.name}</td>
                      <td className="text-right">{c.bookings}</td><td className="text-right">{c.hours}</td>
                      <td className="text-right whitespace-nowrap font-semibold text-mint-700">{fmtPKR(c.collected)}</td>
                      <td className="text-right whitespace-nowrap text-blush-700">{c.balance ? fmtPKR(c.balance) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
