import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../../components/Skeleton';
import { StatTile, ChartTooltip, EmptyState } from '../../components/ui';
import { DaySchedule } from '../../components/BookingCalendar';
import { addDays, fmtDate, inRange, rangeFor, todayISO } from '../../lib/dates';
import { fmtPKR } from '../../lib/gym';
import {
  balance, isActive, openSlots, occupiedSlots, payState, PAY_META, slotHour, timeRange,
} from '../../lib/bookings';
import useBookingData from './useBookingData';
import useBookingActions from './useBookingActions';

const k = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v);
const sumPaid = (list) => list.reduce((s, b) => s + (Number(b.paidAmount) || 0), 0);
const sumHours = (list) => list.reduce((s, b) => s + (Number(b.hours) || 1), 0);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function BookingDashboard({ sport }) {
  const { bookings, settings, loading, refresh, uid, userProfile, cfg } = useBookingData(sport);
  const actions = useBookingActions({ uid, bookings, settings, cfg, refresh });
  const [scheduleDate, setScheduleDate] = useState(todayISO());

  const m = useMemo(() => {
    if (!settings) return null;
    const today = todayISO();
    const active = bookings.filter(isActive);
    const month = rangeFor('month');
    const lm = rangeFor('lastMonth');
    const dom = Number(today.slice(8, 10));
    const lmTo = `${lm.from.slice(0, 8)}${String(Math.min(dom, Number(lm.to.slice(8, 10)))).padStart(2, '0')}`;

    const todayB = active.filter((b) => b.date === today);
    const monthB = active.filter((b) => inRange(b.date, month.from, month.to));
    const lastMonthSoFar = sumPaid(active.filter((b) => inRange(b.date, lm.from, lmTo)));
    const slotsPerDay = openSlots(settings).length * settings.courts.length;

    // 14-day trend of bookings & collected money
    const trend = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(today, i - 13);
      const list = active.filter((b) => b.date === d);
      return { label: fmtDate(d).slice(0, 6), revenue: sumPaid(list), hours: sumHours(list) };
    });

    // Peak hours over the last 60 days
    const since = addDays(today, -60);
    const hourMap = {};
    active.filter((b) => b.date >= since).forEach((b) => occupiedSlots(b).forEach((s) => { hourMap[slotHour(s)] = (hourMap[slotHour(s)] || 0) + 1; }));
    const peak = openSlots(settings).map((s) => ({ label: s.slice(0, 2), bookings: hourMap[slotHour(s)] || 0 }));

    const courtUse = settings.courts.map((c) => ({ name: c, hours: sumHours(monthB.filter((b) => b.court === c)) }));

    const nowHour = new Date().getHours();
    const upcoming = active
      .filter((b) => b.date > today || (b.date === today && slotHour(b.timeSlot) >= nowHour))
      .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot))
      .slice(0, 8);
    const dues = active.filter((b) => balance(b) > 0).sort((a, b) => a.date.localeCompare(b.date));
    const customers = new Set(monthB.map((b) => (b.phone || b.customerName || '').trim().toLowerCase())).size;

    return {
      todayCount: todayB.length,
      todayHours: sumHours(todayB),
      todayRevenue: sumPaid(todayB),
      utilization: slotsPerDay ? Math.round((sumHours(todayB) / slotsPerDay) * 100) : 0,
      monthRevenue: sumPaid(monthB),
      monthCount: monthB.length,
      monthHours: sumHours(monthB),
      growth: lastMonthSoFar > 0 ? Math.round(((sumPaid(monthB) - lastMonthSoFar) / lastMonthSoFar) * 100) : null,
      duesTotal: dues.reduce((s, b) => s + balance(b), 0),
      dues,
      cancelledMonth: bookings.filter((b) => b.status === 'cancelled' && inRange(b.date, month.from, month.to)).length,
      customers,
      trend, peak, courtUse, upcoming,
      noRates: !Number(settings.offPeakRate) && !Number(settings.peakRate),
    };
  }, [bookings, settings]);

  const slots = settings ? openSlots(settings) : [];

  return (
    <div className="page">
      <div className={`rounded-3xl p-6 mb-6 bg-gradient-to-br ${cfg.header} ring-1 ring-lavender-100 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <p className="text-sm text-slate-500">{greeting()} 👋</p>
          <h2 className="text-2xl font-bold text-slate-800 mt-0.5">{cfg.icon} {userProfile?.name || `${cfg.label} Dashboard`}</h2>
          <p className="text-sm text-slate-500 mt-1">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" onClick={() => actions.openNew()}>+ New Booking</button>
          <Link to={`${cfg.base}/calendar`} className="btn-secondary">📅 Calendar</Link>
          <Link to={`${cfg.base}/reports`} className="btn-secondary">📊 Reports</Link>
        </div>
      </div>

      {m?.noRates && (
        <div className="mb-4 rounded-2xl bg-butter-50 ring-1 ring-butter-200 px-5 py-3 text-sm text-butter-800 flex items-center justify-between gap-3 flex-wrap">
          <span>💡 Set your hourly rates and {cfg.unit.toLowerCase()}s so booking prices fill in automatically and revenue shows up in reports.</span>
          <Link to={`${cfg.base}/settings`} className="btn-secondary btn-sm">Open settings →</Link>
        </div>
      )}

      {loading || !m ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{[...Array(8)].map((_, i) => <StatCardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-up">
          <StatTile label="Today's Bookings" value={m.todayCount} sub={`${m.todayHours} hours booked`} icon="📅" tone="lavender" />
          <StatTile label="Today's Collection" value={fmtPKR(m.todayRevenue)} icon="💰" tone="mint" />
          <StatTile label="Utilization Today" value={`${m.utilization}%`} sub={`of ${slots.length * settings.courts.length} slot-hours`} icon="📈" tone="powder" />
          <StatTile label="Pending Balance" value={fmtPKR(m.duesTotal)} sub={`${m.dues.length} bookings`} icon="⏳" tone="blush" />
          <StatTile label="This Month" value={fmtPKR(m.monthRevenue)} icon="🏦" tone="aqua"
            sub={m.growth === null ? `${m.monthCount} bookings` : `${m.growth >= 0 ? '▲' : '▼'} ${Math.abs(m.growth)}% vs last month`} />
          <StatTile label="Hours This Month" value={m.monthHours} sub={`${m.monthCount} bookings`} icon="⏱️" tone="butter" />
          <StatTile label="Customers This Month" value={m.customers} sub="unique players" icon="👥" tone="peach" />
          <StatTile label="Cancelled This Month" value={m.cancelledMonth} icon="❌" tone="lavender" />
        </div>
      )}

      {/* Day schedule */}
      {!loading && settings && (
        <div className="card mb-6 animate-fade-up">
          <div className="card-header">
            <div>
              <p className="card-title">Schedule — {fmtDate(scheduleDate)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Click a free slot to book · click a booking to view</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="btn-ghost btn-sm" onClick={() => setScheduleDate((d) => addDays(d, -1))}>‹</button>
              <input type="date" className="input !py-1.5 !w-auto text-xs" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value || todayISO())} />
              <button className="btn-ghost btn-sm" onClick={() => setScheduleDate((d) => addDays(d, 1))}>›</button>
              {scheduleDate !== todayISO() && <button className="chip-off" onClick={() => setScheduleDate(todayISO())}>Today</button>}
            </div>
          </div>
          <div className="p-4 max-h-[460px] overflow-y-auto">
            <DaySchedule date={scheduleDate} bookings={bookings} settings={settings} slots={slots}
              onFree={(p) => actions.openNew(p)} onBooked={(b) => actions.view(b)} />
          </div>
          <div className="px-6 pb-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
            {['paid', 'partial', 'unpaid', 'none'].map((s) => (
              <span key={s} className={`badge ${PAY_META[s].badge}`}>{PAY_META[s].label}</span>
            ))}
          </div>
        </div>
      )}

      {loading || !m ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6"><ChartSkeleton /><ChartSkeleton /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 animate-fade-up">
          <div className="card">
            <div className="card-header"><p className="card-title">Last 14 days</p><span className="text-xs text-slate-400">collected · hours</span></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={m.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1eefb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis yAxisId="r" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={k} />
                  <YAxis yAxisId="h" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip money={false} />} cursor={{ fill: 'rgba(171,156,243,0.08)' }} />
                  <Legend iconType="circle" iconSize={7} formatter={(v) => <span className="text-xs text-slate-500">{v}</span>} />
                  <Bar yAxisId="r" dataKey="revenue" name="Collected (PKR)" fill={cfg.accent} radius={[5, 5, 0, 0]} />
                  <Bar yAxisId="h" dataKey="hours" name="Hours" fill="#ab9cf3" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><p className="card-title">Peak hours</p><span className="text-xs text-slate-400">last 60 days</span></div>
            <div className="card-body">
              {m.peak.every((p) => !p.bookings) ? <EmptyState icon="⏰" title="No bookings yet" /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={m.peak}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1eefb" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip money={false} />} cursor={{ fill: 'rgba(171,156,243,0.08)' }} />
                    <Bar dataKey="bookings" name="Hours booked" fill="#80b4ef" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && m && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up">
          <div className="card">
            <div className="card-header"><p className="card-title">Upcoming</p><Link to={`${cfg.base}/bookings`} className="text-xs font-semibold text-lavender-700 hover:underline">All →</Link></div>
            {m.upcoming.length === 0 ? <EmptyState icon="🌤️" title="No upcoming bookings" /> : (
              <ul className="divide-y divide-lavender-50 max-h-80 overflow-y-auto">
                {m.upcoming.map((b) => (
                  <li key={b.id}>
                    <button className="w-full px-6 py-3 flex items-center justify-between gap-3 text-left hover:bg-lavender-50/40" onClick={() => actions.view(b)}>
                      <div className="min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{b.customerName}</p><p className="text-xs text-slate-400">{fmtDate(b.date)} · {timeRange(b)} · {b.court}</p></div>
                      <span className={`badge ${PAY_META[payState(b)].badge}`}>{PAY_META[payState(b)].label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <div className="card-header"><p className="card-title">Pending balance</p>{m.dues.length > 0 && <span className="badge badge-unpaid">{m.dues.length}</span>}</div>
            {m.dues.length === 0 ? <EmptyState icon="🎉" title="Everything is paid" /> : (
              <ul className="divide-y divide-lavender-50 max-h-80 overflow-y-auto">
                {m.dues.map((b) => (
                  <li key={b.id}>
                    <button className="w-full px-6 py-3 flex items-center justify-between gap-3 text-left hover:bg-lavender-50/40" onClick={() => actions.view(b)}>
                      <div className="min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{b.customerName}</p><p className="text-xs text-slate-400">{fmtDate(b.date)} · {b.phone || '—'}</p></div>
                      <span className="text-sm font-semibold text-blush-700 whitespace-nowrap">{fmtPKR(balance(b))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <div className="card-header"><p className="card-title">{cfg.unit} usage this month</p></div>
            <div className="card-body space-y-3">
              {m.courtUse.map((c) => {
                const max = Math.max(1, ...m.courtUse.map((x) => x.hours));
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-xs mb-1"><span className="font-semibold text-slate-700">{c.name}</span><span className="text-slate-500">{c.hours} h</span></div>
                    <div className="h-2.5 rounded-full bg-lavender-50 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c.hours / max) * 100}%`, background: cfg.accent }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {actions.modals}
    </div>
  );
}
