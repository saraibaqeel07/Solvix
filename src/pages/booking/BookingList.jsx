import { useMemo, useState } from 'react';
import Table from '../../components/Table';
import { ExportButtons, Spinner } from '../../components/ui';
import { exportCSV, exportPDF } from '../../utils/export';
import { fmtDate, todayISO } from '../../lib/dates';
import { fmtPKR } from '../../lib/gym';
import { balance, isActive, payState, PAY_META, timeRange } from '../../lib/bookings';
import useBookingData from './useBookingData';
import useBookingActions from './useBookingActions';

const FILTERS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'past', label: 'Past' },
  { key: 'balance', label: 'Balance due' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

export default function BookingList({ sport }) {
  const { bookings, settings, loading, refresh, uid, userProfile, cfg } = useBookingData(sport);
  const actions = useBookingActions({ uid, bookings, settings, cfg, refresh });
  const [filter, setFilter] = useState('upcoming');
  const [court, setCourt] = useState('all');

  const today = todayISO();
  const test = {
    upcoming: (b) => isActive(b) && b.date >= today,
    today: (b) => isActive(b) && b.date === today,
    past: (b) => isActive(b) && b.date < today,
    balance: (b) => isActive(b) && balance(b) > 0,
    cancelled: (b) => b.status === 'cancelled',
    all: () => true,
  };

  const rows = useMemo(() => bookings
    .map((b) => ({ ...b, _time: timeRange(b), _pay: payState(b), _bal: balance(b) }))
    .filter((b) => court === 'all' || b.court === court),
  [bookings, court]);

  const visible = rows.filter(test[filter]);
  if (filter === 'upcoming' || filter === 'today') visible.sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));

  const columns = [
    { title: 'Date', data: 'date', render: (d) => <span className="whitespace-nowrap">{fmtDate(d)}</span> },
    { title: 'Time', data: '_time', render: (d, _, r) => <span className="font-semibold text-slate-700">{d}{r.hours > 1 && <span className="text-xs text-slate-400"> · {r.hours}h</span>}</span> },
    { title: cfg.unit, data: 'court' },
    {
      title: 'Customer', data: 'customerName',
      render: (_, __, r) => <div><p className="font-semibold text-slate-800">{r.customerName}</p><p className="text-xs text-slate-400">{r.phone || '—'}</p></div>,
    },
    { title: 'Price', data: 'amount', render: (d) => (d ? fmtPKR(d) : '—') },
    { title: 'Balance', data: '_bal', render: (d) => (d ? <span className="font-semibold text-blush-700">{fmtPKR(d)}</span> : <span className="text-slate-300">—</span>) },
    { title: 'Payment', data: '_pay', render: (d) => <span className={`badge ${PAY_META[d].badge}`}>{PAY_META[d].label}</span> },
    {
      title: 'Actions', data: null, orderable: false,
      render: (_, __, r) => r.status === 'cancelled' ? <span className="text-slate-300 text-xs">—</span> : (
        <div className="flex gap-1.5">
          {r._bal > 0 && <button className="btn-mint btn-sm" onClick={() => actions.view(r)}>Collect</button>}
          <button className="btn-secondary btn-sm" onClick={() => actions.openEdit(r)}>Edit</button>
          <button className="btn-sm btn bg-blush-50 text-blush-700 hover:bg-blush-100 border border-blush-100" onClick={() => actions.cancel(r)}>Cancel</button>
        </div>
      ),
    },
  ];

  const exportCols = [
    { header: 'Date', value: (b) => b.date },
    { header: 'Time', value: (b) => b._time },
    { header: cfg.unit, value: (b) => b.court },
    { header: 'Customer', value: (b) => b.customerName },
    { header: 'Phone', value: (b) => b.phone },
    { header: 'Price (PKR)', value: (b) => b.amount, align: 'right' },
    { header: 'Paid (PKR)', value: (b) => b.paidAmount, align: 'right' },
    { header: 'Balance (PKR)', value: (b) => b._bal, align: 'right' },
    { header: 'Status', value: (b) => PAY_META[b._pay].label },
    { header: 'Notes', value: (b) => b.notes },
  ];
  const totals = {
    Date: 'TOTAL',
    'Price (PKR)': visible.filter(isActive).reduce((s, b) => s + b.amount, 0),
    'Paid (PKR)': visible.filter(isActive).reduce((s, b) => s + b.paidAmount, 0),
    'Balance (PKR)': visible.reduce((s, b) => s + b._bal, 0),
  };
  const label = FILTERS.find((f) => f.key === filter).label;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">{cfg.label} Bookings</h2>
          <p className="page-subtitle">{rows.filter(test.upcoming).length} upcoming · {rows.filter(test.balance).length} with balance due</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButtons disabled={!visible.length}
            onCSV={() => exportCSV(`${sport}_bookings_${filter}`, exportCols, visible, totals)}
            onPDF={() => exportPDF({ title: `${cfg.label} Bookings — ${label}`, subtitle: userProfile?.name, columns: exportCols, rows: visible, totals })} />
          <button className="btn-primary" onClick={() => actions.openNew()}>+ New Booking</button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4 items-center">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'chip-on' : 'chip-off'} onClick={() => setFilter(f.key)}>
            {f.label} <span className="opacity-70">({rows.filter(test[f.key]).length})</span>
          </button>
        ))}
        {settings?.courts.length > 1 && (
          <select className="input !py-1.5 !w-auto text-xs ml-auto" value={court} onChange={(e) => setCourt(e.target.value)}>
            <option value="all">All {cfg.unit.toLowerCase()}s</option>
            {settings.courts.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
      </div>

      <div className="card">{loading ? <Spinner /> : <Table data={visible} columns={columns} />}</div>
      {actions.modals}
    </div>
  );
}
