import { useState } from 'react';
import { toISO, todayISO } from '../lib/dates';
import { isActive, occupiedSlots, PAY_META, payState, slotHour } from '../lib/bookings';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Month grid. Each day shows booking count and a soft fill by how busy it is.
export default function BookingCalendar({ bookings, onDateClick, selected, capacity = 1, accent = '#f5bf5c' }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = todayISO();

  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  const counts = {};
  bookings.forEach((b) => {
    if (!isActive(b) || !b.date?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) return;
    counts[b.date] = (counts[b.date] || 0) + (Number(b.hours) || 1);
  });

  const shift = (n) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="btn-ghost btn-sm" onClick={() => shift(-1)}>‹</button>
        <div className="flex items-center gap-2">
          <p className="font-bold text-slate-800">{MONTHS[month]} {year}</p>
          <button className="chip-off" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); onDateClick?.(today); }}>Today</button>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => shift(1)}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d) => <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const iso = toISO(new Date(year, month, day));
          const hrs = counts[iso] || 0;
          const load = Math.min(1, hrs / capacity);
          const isSel = selected === iso;
          return (
            <button key={iso} onClick={() => onDateClick?.(iso)}
              className={`relative aspect-square sm:aspect-auto sm:h-16 rounded-xl p-1.5 text-left transition-all ring-1 ${
                isSel ? 'ring-2 ring-lavender-400' : 'ring-lavender-50 hover:ring-lavender-200'} ${iso < today ? 'opacity-60' : ''}`}
              style={{ background: hrs ? `color-mix(in srgb, ${accent} ${Math.round(18 + load * 50)}%, white)` : '#fff' }}>
              <span className={`text-xs font-semibold ${iso === today ? 'bg-lavender-500 text-white rounded-full w-5 h-5 inline-flex items-center justify-center' : 'text-slate-700'}`}>{day}</span>
              {hrs > 0 && <span className="absolute bottom-1 right-1.5 text-[10px] font-bold text-slate-700">{hrs}h</span>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white ring-1 ring-lavender-100" /> Free</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: `color-mix(in srgb, ${accent} 30%, white)` }} /> Some bookings</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: `color-mix(in srgb, ${accent} 68%, white)` }} /> Busy</span>
      </div>
    </div>
  );
}

// Court × hour grid for one day. Click a free cell to book it, a booked cell to open it.
export function DaySchedule({ date, bookings, settings, slots, onFree, onBooked }) {
  const day = bookings.filter((b) => isActive(b) && b.date === date);
  const cellMap = {};
  day.forEach((b) => occupiedSlots(b).forEach((s, i) => { cellMap[`${b.court}|${s}`] = { b, first: i === 0 }; }));
  const nowHour = date === todayISO() ? new Date().getHours() : -1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate" style={{ borderSpacing: 4 }}>
        <thead>
          <tr>
            <th className="w-14" />
            {settings.courts.map((c) => <th key={c} className="text-[11px] font-bold text-slate-500 uppercase tracking-wide pb-1">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s}>
              <td className={`text-[11px] font-semibold whitespace-nowrap pr-1 ${slotHour(s) === nowHour ? 'text-lavender-700' : 'text-slate-400'}`}>{s.slice(0, 5)}</td>
              {settings.courts.map((c) => {
                const cell = cellMap[`${c}|${s}`];
                if (!cell) {
                  return (
                    <td key={c}>
                      <button onClick={() => onFree?.({ date, court: c, timeSlot: s })}
                        className="w-full h-9 rounded-lg bg-lavender-50/50 hover:bg-mint-100 text-transparent hover:text-mint-700 font-semibold transition-colors">
                        + Book
                      </button>
                    </td>
                  );
                }
                const ps = payState(cell.b);
                return (
                  <td key={c}>
                    <button onClick={() => onBooked?.(cell.b)}
                      className={`w-full h-9 rounded-lg px-2 text-left truncate transition-all hover:brightness-95 ${
                        ps === 'paid' ? 'bg-mint-100 text-mint-800' : ps === 'partial' ? 'bg-butter-100 text-butter-800' : ps === 'unpaid' ? 'bg-blush-100 text-blush-800' : 'bg-powder-100 text-powder-800'}`}
                      title={`${cell.b.customerName} · ${PAY_META[ps].label}`}>
                      {cell.first ? <span className="font-semibold">{cell.b.customerName}</span> : <span className="opacity-60">↳ {cell.b.customerName}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
