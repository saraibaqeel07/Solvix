import { useState } from 'react';
import BookingCalendar, { DaySchedule } from '../../components/BookingCalendar';
import { Spinner } from '../../components/ui';
import { fmtDate, todayISO } from '../../lib/dates';
import { fmtPKR } from '../../lib/gym';
import { isActive, openSlots } from '../../lib/bookings';
import useBookingData from './useBookingData';
import useBookingActions from './useBookingActions';

export default function BookingCalendarPage({ sport }) {
  const { bookings, settings, loading, refresh, uid, cfg } = useBookingData(sport);
  const actions = useBookingActions({ uid, bookings, settings, cfg, refresh });
  const [date, setDate] = useState(todayISO());

  const slots = settings ? openSlots(settings) : [];
  const capacity = slots.length * (settings?.courts.length || 1);
  const day = bookings.filter((b) => isActive(b) && b.date === date);
  const dayHours = day.reduce((s, b) => s + (Number(b.hours) || 1), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">{cfg.label} Calendar</h2>
          <p className="page-subtitle">Pick a day, then click a free slot to book</p>
        </div>
        <button className="btn-primary" onClick={() => actions.openNew({ date })}>+ New Booking</button>
      </div>

      {loading || !settings ? <Spinner /> : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="card xl:col-span-2 self-start">
            <div className="card-body">
              <BookingCalendar bookings={bookings} onDateClick={setDate} selected={date} capacity={capacity} accent={cfg.accent} />
            </div>
          </div>
          <div className="card xl:col-span-3">
            <div className="card-header">
              <div>
                <p className="card-title">{fmtDate(date)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {day.length} booking{day.length === 1 ? '' : 's'} · {dayHours}/{capacity} hours · {fmtPKR(day.reduce((s, b) => s + b.paidAmount, 0))} collected
                </p>
              </div>
            </div>
            <div className="p-4 max-h-[620px] overflow-y-auto">
              <DaySchedule date={date} bookings={bookings} settings={settings} slots={slots}
                onFree={(p) => actions.openNew(p)} onBooked={(b) => actions.view(b)} />
            </div>
          </div>
        </div>
      )}
      {actions.modals}
    </div>
  );
}
