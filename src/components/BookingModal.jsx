import { useState, useEffect } from 'react';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalSection } from './Modal';

const TIME_SLOTS = [
  '06:00 - 07:00', '07:00 - 08:00', '08:00 - 09:00', '09:00 - 10:00',
  '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00', '13:00 - 14:00',
  '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00',
  '18:00 - 19:00', '19:00 - 20:00', '20:00 - 21:00', '21:00 - 22:00',
  '22:00 - 23:00',
];

const EMPTY_FORM = { customerName: '', phone: '', date: '', timeSlot: TIME_SLOTS[4], notes: '' };

export default function BookingModal({ show, onClose, onSubmit, editData, bookedSlots, saving }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (editData) setForm({ ...EMPTY_FORM, ...editData });
    else setForm(EMPTY_FORM);
  }, [editData, show]);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const isSlotTaken = (slot) => {
    if (!form.date) return false;
    return bookedSlots.some(
      (b) => b.date === form.date && b.timeSlot === slot &&
        b.status !== 'cancelled' && (!editData || b.id !== editData.id)
    );
  };

  const currentSlotTaken = isSlotTaken(form.timeSlot);

  return (
    <Modal show={show} onClose={onClose}>
      <ModalHeader
        icon={editData ? '✏️' : '📅'}
        title={editData ? 'Edit Booking' : 'New Booking'}
        subtitle={editData ? 'Update booking details' : 'Reserve a time slot'}
        onClose={onClose}
      />
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
        <ModalBody>
          <ModalSection label="Customer Details">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label>Customer Name <span className="text-rose-400">*</span></label>
                <input name="customerName" value={form.customerName} onChange={handleChange} placeholder="Full name" required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="+92 300 0000000" />
              </div>
            </div>
          </ModalSection>

          <ModalSection label="Booking Slot">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label>Date <span className="text-rose-400">*</span></label>
                <input name="date" type="date" value={form.date} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Time Slot <span className="text-rose-400">*</span></label>
                <select name="timeSlot" value={form.timeSlot} onChange={handleChange} required>
                  {TIME_SLOTS.map((slot) => {
                    const taken = isSlotTaken(slot);
                    return (
                      <option key={slot} value={slot} disabled={taken}>
                        {slot}{taken ? ' — Booked' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {currentSlotTaken && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                <span className="text-rose-500">⚠️</span>
                <p className="text-xs text-rose-600 font-medium">This slot is already booked. Please choose another time.</p>
              </div>
            )}

            {form.date && !currentSlotTaken && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <span className="text-emerald-500">✓</span>
                <p className="text-xs text-emerald-600 font-medium">This slot is available</p>
              </div>
            )}
          </ModalSection>

          <div className="form-group">
            <label>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
            <input name="notes" value={form.notes} onChange={handleChange} placeholder="Any special requirements..." />
          </div>
        </ModalBody>

        <ModalFooter>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving || currentSlotTaken}>
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : editData ? 'Update Booking' : 'Confirm Booking'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export { TIME_SLOTS };
