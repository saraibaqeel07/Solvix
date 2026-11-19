import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import BookingModal from '../../components/BookingModal';
import Table from '../../components/Table';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '../../components/Modal';

export default function CricketBookings() {
  const { userProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
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
      fetchBookings();
    } catch {
      toast.error('Failed to save booking');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await updateDoc(doc(db, 'tenants', userProfile.uid, 'bookings', cancelTarget.id), { status: 'cancelled' });
      toast.success('Booking cancelled');
      setCancelTarget(null);
      fetchBookings();
    } catch {
      toast.error('Failed to cancel booking');
    }
  };

  const columns = [
    { title: 'Date', data: 'date', render: (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString() : '—' },
    { title: 'Time Slot', data: 'timeSlot' },
    { title: 'Customer', data: 'customerName' },
    { title: 'Phone', data: 'phone', defaultContent: '—' },
    { title: 'Notes', data: 'notes', defaultContent: '—' },
    {
      title: 'Status', data: 'status',
      render: (d) => `<span class="badge badge-${d === 'confirmed' ? 'paid' : 'unpaid'}">${d}</span>`,
    },
    {
      title: 'Actions', data: null, orderable: false,
      render: (_, __, row) => row.status === 'cancelled'
        ? '<span class="text-slate-300 text-xs">—</span>'
        : `<div class="flex gap-1.5">
             <button class="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" data-action="edit" data-id="${row.id}">Edit</button>
             <button class="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100" data-action="cancel" data-id="${row.id}" data-name="${row.customerName}">Cancel</button>
           </div>`,
    },
  ];

  const handleTableClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const booking = bookings.find((b) => b.id === btn.dataset.id);
    if (btn.dataset.action === 'edit') { setEditTarget(booking); setShowModal(true); }
    if (btn.dataset.action === 'cancel') setCancelTarget(booking);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Cricket Bookings</h2>
        <button className="btn-primary" onClick={() => { setEditTarget(null); setShowModal(true); }}>+ New Booking</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-slate-200 border-t-rose-500 rounded-full animate-spin" /></div>
        ) : (
          <Table data={bookings} columns={columns} onClick={handleTableClick} />
        )}
      </div>

      <BookingModal
        show={showModal}
        onClose={() => { setShowModal(false); setEditTarget(null); }}
        onSubmit={handleSubmit}
        editData={editTarget}
        bookedSlots={bookings}
        saving={saving}
      />

      <Modal show={!!cancelTarget} onClose={() => setCancelTarget(null)} size="sm">
        <ModalHeader
          icon="🏏"
          title="Cancel Booking"
          subtitle="The slot will become available again"
          onClose={() => setCancelTarget(null)}
        />
        <ModalBody>
          <p className="text-sm text-slate-600 leading-relaxed">
            Cancel booking for <span className="font-semibold text-slate-900">{cancelTarget?.customerName}</span> on{' '}
            <span className="font-semibold text-slate-900">{cancelTarget?.date}</span> at{' '}
            <span className="font-semibold text-slate-900">{cancelTarget?.timeSlot}</span>?
          </p>
        </ModalBody>
        <ModalFooter>
          <button className="btn-secondary" onClick={() => setCancelTarget(null)}>Keep Booking</button>
          <button className="btn-danger" onClick={handleCancel}>Cancel Booking</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
