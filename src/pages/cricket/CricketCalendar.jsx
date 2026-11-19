import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import BookingCalendar from '../../components/BookingCalendar';
import BookingModal from '../../components/BookingModal';

export default function CricketCalendar() {
  const { userProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [dayBookings, setDayBookings] = useState([]);
  const [showDayPanel, setShowDayPanel] = useState(false);
  const [saving, setSaving] = useState(false);

  const colRef = () => collection(db, 'tenants', userProfile.uid, 'bookings');

  const fetchBookings = async () => {
    try {
      const snap = await getDocs(colRef());
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Firestore error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userProfile?.uid) fetchBookings(); }, [userProfile]);

  const handleDateClick = (dateStr, dayBkgs) => {
    setSelectedDate(dateStr);
    setDayBookings(dayBkgs);
    setShowDayPanel(true);
  };

  const checkDoubleBooking = (form, excludeId = null) =>
    bookings.some((b) => b.date === form.date && b.timeSlot === form.timeSlot &&
      b.status !== 'cancelled' && b.id !== excludeId);

  const handleSubmit = async (form) => {
    if (!form.customerName || !form.date || !form.timeSlot) {
      toast.error('Please fill all required fields');
      return;
    }
    if (checkDoubleBooking(form, editTarget?.id)) {
      toast.error('This time slot is already booked!');
      return;
    }
    setSaving(true);
    try {
      const data = {
        customerName: form.customerName, phone: form.phone,
        date: form.date, timeSlot: form.timeSlot,
        notes: form.notes, status: 'confirmed', updatedAt: Date.now(),
      };
      if (editTarget) {
        await updateDoc(doc(db, 'tenants', userProfile.uid, 'bookings', editTarget.id), data);
        toast.success('Booking updated');
      } else {
        await addDoc(colRef(), { ...data, createdAt: Date.now() });
        toast.success('Booking confirmed');
      }
      setShowModal(false);
      setEditTarget(null);
      await fetchBookings();
      if (selectedDate) {
        const updated = (await getDocs(colRef())).docs.map((d) => ({ id: d.id, ...d.data() }));
        setDayBookings(updated.filter((b) => b.date === selectedDate && b.status !== 'cancelled'));
      }
    } catch {
      toast.error('Failed to save booking');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBooking = async (booking) => {
    try {
      await updateDoc(doc(db, 'tenants', userProfile.uid, 'bookings', booking.id), { status: 'cancelled' });
      toast.success('Booking cancelled');
      fetchBookings();
      setDayBookings((prev) => prev.filter((b) => b.id !== booking.id));
    } catch {
      toast.error('Failed to cancel booking');
    }
  };

  const prefilledEdit = editTarget ? editTarget : (selectedDate ? { date: selectedDate } : null);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Cricket Calendar</h2>
        <button className="btn-primary" onClick={() => { setEditTarget(null); setShowModal(true); }}>+ New Booking</button>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <div className="calendar-layout">
          <div className="card calendar-card">
            <div className="card-body">
              <BookingCalendar
                bookings={bookings}
                onDateClick={handleDateClick}
                accentColor="#dc2626"
              />
            </div>
          </div>

          {showDayPanel && (
            <div className="card day-panel">
              <div className="card-header">
                <h3 className="card-title">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric'
                  })}
                </h3>
                <button className="modal-close" onClick={() => setShowDayPanel(false)}>✕</button>
              </div>
              <div className="card-body">
                {dayBookings.length === 0 ? (
                  <div className="empty-state">
                    <p>No bookings for this day.</p>
                    <button className="btn-primary mt-2" onClick={() => { setEditTarget(null); setShowModal(true); }}>Book a Slot</button>
                  </div>
                ) : (
                  <div className="day-bookings-list">
                    {dayBookings.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map((b) => (
                      <div key={b.id} className="day-booking-item">
                        <div className="day-booking-time">{b.timeSlot}</div>
                        <div className="day-booking-info">
                          <strong>{b.customerName}</strong>
                          {b.phone && <span> · {b.phone}</span>}
                          {b.notes && <p className="day-booking-notes">{b.notes}</p>}
                        </div>
                        <div className="day-booking-actions">
                          <button className="btn-secondary-sm" onClick={() => { setEditTarget(b); setShowModal(true); setShowDayPanel(false); }}>Edit</button>
                          <button className="btn-danger-sm" onClick={() => handleCancelBooking(b)}>Cancel</button>
                        </div>
                      </div>
                    ))}
                    <button className="btn-primary mt-3" onClick={() => { setEditTarget(null); setShowModal(true); }}>+ Add Booking</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <BookingModal
        show={showModal}
        onClose={() => { setShowModal(false); setEditTarget(null); }}
        onSubmit={handleSubmit}
        editData={prefilledEdit}
        bookedSlots={bookings}
        saving={saving}
      />
    </div>
  );
}
