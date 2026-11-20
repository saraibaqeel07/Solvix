import { useState } from 'react';
import { toast } from 'sonner';
import BookingModal from '../../components/BookingModal';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '../../components/Modal';
import {
  cleanBooking, createBooking, updateBooking, cancelBooking, collectBalance, slotTaken, timeRange, balance, PAYMENT_METHODS, PAY_META, payState,
} from '../../lib/bookings';
import { fmtDate } from '../../lib/dates';
import { fmtPKR } from '../../lib/gym';

// Shared create / edit / cancel / collect flows used by every booking page.
export default function useBookingActions({ uid, bookings, settings, cfg, refresh }) {
  const [editor, setEditor] = useState(null);      // null | {} new | {date,court,timeSlot} prefill | booking
  const [viewing, setViewing] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [method, setMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);

  const openNew = (prefill = {}) => setEditor({ ...prefill });
  const openEdit = (b) => { setViewing(null); setEditor(b); };

  const submit = async (form) => {
    if (!form.customerName?.trim() || !form.date || !form.timeSlot) { toast.error('Please fill all required fields'); return; }
    if (slotTaken(bookings, form, editor?.id)) { toast.error(`${form.court} is already booked at that time`); return; }
    setSaving(true);
    try {
      const data = cleanBooking(form);
      if (editor?.id) { await updateBooking(uid, editor.id, data); toast.success('Booking updated'); }
      else { await createBooking(uid, data); toast.success(`Booked ${data.court} · ${fmtDate(data.date)} ${timeRange(data)}`); }
      setEditor(null);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save booking');
    } finally { setSaving(false); }
  };

  const doCancel = async () => {
    try {
      await cancelBooking(uid, cancelTarget.id);
      toast.success('Booking cancelled — slot is free again');
      setCancelTarget(null); setViewing(null);
      refresh();
    } catch { toast.error('Failed to cancel'); }
  };

  const doCollect = async (b) => {
    try {
      await collectBalance(uid, b, method);
      toast.success(`Collected ${fmtPKR(balance(b))}`);
      setViewing(null);
      refresh();
    } catch { toast.error('Failed to record payment'); }
  };

  const ps = viewing ? payState(viewing) : null;

  const modals = (
    <>
      {editor && settings && (
        <BookingModal key={editor.id || `${editor.date}|${editor.court}|${editor.timeSlot}`} show onClose={() => setEditor(null)} onSubmit={submit}
          editData={editor} bookings={bookings} settings={settings} saving={saving} unit={cfg.unit} />
      )}

      <Modal show={!!viewing} onClose={() => setViewing(null)} size="sm">
        <ModalHeader icon={cfg.icon} title={viewing?.customerName} subtitle={viewing?.phone || 'Booking details'} onClose={() => setViewing(null)} />
        {viewing && (
          <ModalBody>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-lavender-50 p-3"><p className="text-[11px] text-slate-500">Date</p><p className="font-semibold text-slate-800">{fmtDate(viewing.date)}</p></div>
              <div className="rounded-xl bg-lavender-50 p-3"><p className="text-[11px] text-slate-500">Time</p><p className="font-semibold text-slate-800">{timeRange(viewing)}</p></div>
              <div className="rounded-xl bg-powder-50 p-3"><p className="text-[11px] text-slate-500">{cfg.unit}</p><p className="font-semibold text-slate-800">{viewing.court}</p></div>
              <div className="rounded-xl bg-mint-50 p-3"><p className="text-[11px] text-slate-500">Payment</p><span className={`badge ${PAY_META[ps].badge}`}>{PAY_META[ps].label}</span></div>
            </div>
            {viewing.amount > 0 && (
              <div className="rounded-xl ring-1 ring-lavender-100 px-4 py-3 text-sm space-y-1">
                <p className="flex justify-between"><span className="text-slate-500">Price</span><b>{fmtPKR(viewing.amount)}</b></p>
                <p className="flex justify-between"><span className="text-slate-500">Received</span><b className="text-mint-700">{fmtPKR(viewing.paidAmount)}</b></p>
                <p className="flex justify-between"><span className="text-slate-500">Balance</span><b className="text-blush-700">{fmtPKR(balance(viewing))}</b></p>
              </div>
            )}
            {viewing.notes && <p className="text-sm text-slate-600">📝 {viewing.notes}</p>}
            {balance(viewing) > 0 && viewing.status !== 'cancelled' && (
              <div className="flex gap-2 items-end">
                <div className="form-group flex-1"><label>Method</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
                </div>
                <button className="btn-mint" onClick={() => doCollect(viewing)}>Collect {fmtPKR(balance(viewing))}</button>
              </div>
            )}
          </ModalBody>
        )}
        {viewing && viewing.status !== 'cancelled' && (
          <ModalFooter>
            <button className="btn-sm btn bg-blush-50 text-blush-700 hover:bg-blush-100 mr-auto" onClick={() => setCancelTarget(viewing)}>Cancel booking</button>
            <button className="btn-primary btn-sm" onClick={() => openEdit(viewing)}>Edit</button>
          </ModalFooter>
        )}
      </Modal>

      <Modal show={!!cancelTarget} onClose={() => setCancelTarget(null)} size="sm">
        <ModalHeader icon="🗓️" title="Cancel Booking" subtitle="The slot will become available again" onClose={() => setCancelTarget(null)} />
        <ModalBody>
          <p className="text-sm text-slate-600 leading-relaxed">
            Cancel <b className="text-slate-900">{cancelTarget?.customerName}</b> on <b className="text-slate-900">{fmtDate(cancelTarget?.date)}</b> at <b className="text-slate-900">{cancelTarget && timeRange(cancelTarget)}</b> ({cancelTarget?.court})?
            {cancelTarget?.paidAmount > 0 && <> They have paid <b>{fmtPKR(cancelTarget.paidAmount)}</b> — refund it separately if needed.</>}
          </p>
        </ModalBody>
        <ModalFooter>
          <button className="btn-secondary" onClick={() => setCancelTarget(null)}>Keep Booking</button>
          <button className="btn-danger" onClick={doCancel}>Cancel Booking</button>
        </ModalFooter>
      </Modal>
    </>
  );

  return { openNew, openEdit, view: setViewing, cancel: setCancelTarget, collect: doCollect, modals };
}
