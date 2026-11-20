import { useState } from 'react';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalSection } from './Modal';
import {
  openSlots, slotTaken, priceFor, isPeak, PAYMENT_METHODS, timeRange, slotHour,
} from '../lib/bookings';
import { fmtPKR } from '../lib/gym';
import { todayISO } from '../lib/dates';

const EMPTY = { customerName: '', phone: '', date: '', timeSlot: '', court: '', hours: 1, notes: '', amount: '', paidAmount: '', method: 'Cash', pay: 'none' };

// Mount this only while open (the parent renders it conditionally), so the
// initial form is built once from the props — no syncing effects needed.
function initialForm(editData, settings, slots) {
  const base = { ...EMPTY, date: todayISO(), court: settings.courts[0], timeSlot: slots[0] || '', ...(editData || {}) };
  if (editData?.id) {
    const pay = base.paidAmount >= base.amount && base.amount > 0 ? 'full' : base.paidAmount > 0 ? 'advance' : 'none';
    return { ...base, pay, amount: base.amount || '', paidAmount: base.paidAmount || '' };
  }
  return { ...base, amount: priceFor(settings, base.date, base.timeSlot, base.hours) || '' };
}

export default function BookingModal({ show, onClose, onSubmit, editData, bookings = [], settings, saving, unit = 'Court' }) {
  const slots = settings ? openSlots(settings) : [];
  const isEdit = !!editData?.id;
  const [form, setForm] = useState(() => (settings ? initialForm(editData, settings, slots) : EMPTY));
  const [priceTouched, setPriceTouched] = useState(isEdit);

  if (!settings) return null;

  // Price follows date / start / hours until the user types their own.
  const set = (k, v) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (!priceTouched && ['date', 'timeSlot', 'hours'].includes(k) && next.date && next.timeSlot) {
      next.amount = priceFor(settings, next.date, next.timeSlot, next.hours) || '';
    }
    return next;
  });
  const onField = (e) => set(e.target.name, e.target.value);

  const taken = (slot, hours = 1) => !!form.date && slotTaken(bookings, { date: form.date, court: form.court, timeSlot: slot, hours }, editData?.id);
  const clash = form.timeSlot && taken(form.timeSlot, form.hours);
  const overClose = slotHour(form.timeSlot) + Number(form.hours) > settings.closeHour;
  const amount = Number(form.amount) || 0;
  const paid = form.pay === 'full' ? amount : form.pay === 'advance' ? Math.min(Number(form.paidAmount) || 0, amount) : 0;

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, paidAmount: paid });
  };

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <ModalHeader icon={isEdit ? '✏️' : '📅'} title={isEdit ? 'Edit Booking' : 'New Booking'}
        subtitle={isEdit ? 'Update booking details' : `Reserve a ${unit.toLowerCase()}`} onClose={onClose} />
      <form onSubmit={submit}>
        <ModalBody>
          <ModalSection label="Customer">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label>Customer Name <span className="text-blush-400">*</span></label>
                <input name="customerName" value={form.customerName} onChange={onField} placeholder="Full name" required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input name="phone" value={form.phone} onChange={onField} placeholder="+92 300 0000000" />
              </div>
            </div>
          </ModalSection>

          <ModalSection label="Slot">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="form-group col-span-2 sm:col-span-1">
                <label>Date <span className="text-blush-400">*</span></label>
                <input name="date" type="date" value={form.date} onChange={onField} required />
              </div>
              <div className="form-group col-span-2 sm:col-span-1">
                <label>{unit}</label>
                <select name="court" value={form.court} onChange={onField}>
                  {settings.courts.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Start</label>
                <select name="timeSlot" value={form.timeSlot} onChange={onField} required>
                  {slots.map((s) => <option key={s} value={s} disabled={taken(s)}>{s.slice(0, 5)}{taken(s) ? ' — booked' : isPeak(settings, form.date, s) ? ' ★' : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Hours</label>
                <select name="hours" value={form.hours} onChange={(e) => set('hours', Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h} hr{h > 1 ? 's' : ''}</option>)}
                </select>
              </div>
            </div>

            {/* Availability strip for the chosen day + court */}
            {form.date && (
              <div className="mt-3 flex flex-wrap gap-1">
                {slots.map((s) => {
                  const busy = taken(s);
                  const mine = form.timeSlot && slotHour(s) >= slotHour(form.timeSlot) && slotHour(s) < slotHour(form.timeSlot) + Number(form.hours);
                  return (
                    <button type="button" key={s} disabled={busy}
                      onClick={() => set('timeSlot', s)}
                      title={busy ? 'Booked' : s}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                        busy ? 'bg-slate-100 text-slate-300 line-through cursor-not-allowed'
                          : mine ? 'bg-lavender-500 text-white'
                          : isPeak(settings, form.date, s) ? 'bg-butter-50 text-butter-800 hover:bg-butter-100'
                          : 'bg-mint-50 text-mint-800 hover:bg-mint-100'}`}>
                      {s.slice(0, 2)}
                    </button>
                  );
                })}
              </div>
            )}

            {clash ? (
              <p className="mt-2 px-3 py-2 rounded-xl bg-blush-50 text-xs font-medium text-blush-700">⚠️ {form.court} is already booked during {timeRange(form)}. Pick another time or {unit.toLowerCase()}.</p>
            ) : overClose ? (
              <p className="mt-2 px-3 py-2 rounded-xl bg-butter-50 text-xs font-medium text-butter-800">⚠️ This booking runs past closing time ({String(settings.closeHour).padStart(2, '0')}:00).</p>
            ) : form.date && form.timeSlot && (
              <p className="mt-2 px-3 py-2 rounded-xl bg-mint-50 text-xs font-medium text-mint-700">✓ {form.court} is free · {timeRange(form)}</p>
            )}
          </ModalSection>

          <ModalSection label="Payment">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="form-group">
                <label>Price (PKR)</label>
                <input type="number" min="0" value={form.amount} onChange={(e) => { setPriceTouched(true); set('amount', e.target.value); }} placeholder="Set rates in Settings" />
              </div>
              <div className="form-group">
                <label>Received</label>
                <select value={form.pay} onChange={(e) => set('pay', e.target.value)}>
                  <option value="none">Nothing yet</option>
                  <option value="advance">Advance</option>
                  <option value="full">Full payment</option>
                </select>
              </div>
              {form.pay === 'advance' ? (
                <div className="form-group">
                  <label>Advance (PKR)</label>
                  <input type="number" min="0" value={form.paidAmount} onChange={onField} name="paidAmount" />
                </div>
              ) : (
                <div className="form-group">
                  <label>Method</label>
                  <select name="method" value={form.method} onChange={onField}>
                    {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
            {amount > 0 && (
              <div className="mt-3 rounded-xl bg-lavender-50 px-4 py-2.5 text-sm flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-slate-500">Total <b className="text-slate-800">{fmtPKR(amount)}</b></span>
                <span className="text-slate-500">Received <b className="text-mint-700">{fmtPKR(paid)}</b></span>
                <span className="text-slate-500">Balance <b className="text-blush-700">{fmtPKR(amount - paid)}</b></span>
              </div>
            )}
          </ModalSection>

          <div className="form-group">
            <label>Notes <span className="text-slate-300 font-normal normal-case">(optional)</span></label>
            <input name="notes" value={form.notes} onChange={onField} placeholder="Team name, equipment, special requests…" />
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving || clash}>
            {saving ? 'Saving…' : isEdit ? 'Update Booking' : 'Confirm Booking'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
