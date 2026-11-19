import { useState } from 'react';

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function BookingCalendar({ bookings, onDateClick, accentColor = '#2563eb' }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const getBookingsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter((b) => b.date === dateStr && b.status !== 'cancelled');
  };

  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button className="cal-nav" onClick={prevMonth}>‹</button>
        <span className="cal-title">{MONTHS[month]} {year}</span>
        <button className="cal-nav" onClick={nextMonth}>›</button>
      </div>
      <div className="calendar-grid">
        {DAYS.map((d) => <div key={d} className="cal-day-label">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="cal-cell empty" />;
          const dayBookings = getBookingsForDay(day);
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return (
            <div
              key={day}
              className={`cal-cell ${isToday(day) ? 'cal-today' : ''} ${dayBookings.length > 0 ? 'cal-has-bookings' : ''}`}
              style={dayBookings.length > 0 ? { '--accent': accentColor } : {}}
              onClick={() => onDateClick(dateStr, dayBookings)}
            >
              <span className="cal-date">{day}</span>
              {dayBookings.length > 0 && (
                <span className="cal-booking-count">{dayBookings.length}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
