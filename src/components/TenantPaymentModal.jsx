import { useState } from 'react';
import { toast } from 'sonner';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalSection } from './Modal';
import { BILLING_METHODS, fmtPKR, nextPeriod, recordTenantPayment, tenantDues } from '../lib/tenants';
import { fmtDate, todayISO } from '../lib/dates';

const MONTH_OPTIONS = [1, 2, 3, 6, 12];

// Mount only while open (parent renders it conditionally) so the form starts fresh each time.
export default function TenantPaymentModal({ tenant, onClose, onSaved }) {
  const fee = Number(tenant.monthlyFee) || 0;
  const dues = tenantDues(tenant);
  const [months, setMonths] = useState(Math.max(1, dues.months));
  const [amount, setAmount] = useState(fee * Math.max(1, dues.months));
  const [amountEdited, setAmountEdited] = useState(false);
  const [method, setMethod] = useState('Cash');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const period = nextPeriod(tenant, months);

  const pickMonths = (m) => {
    setMonths(m);
    if (!amountEdited) setAmount(fee * m);
  };

  const save = async () => {
    if (!(Number(amount) > 0)) { toast.error('Enter the amount received'); return; }
    setSaving(true);
    try {
      const { to } = await recordTenantPayment(tenant, { months, amount, method, date, note });
      toast.success(`Payment recorded — ${tenant.name} active until ${fmtDate(to)}`);
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to record payment');
      setSaving(false);
    }
  };

  return (
    <Modal show size="md">
      <ModalHeader icon="💰" title="Receive Payment" subtitle={tenant.name} onClose={onClose} />
      <ModalBody>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-lavender-50 ring-1 ring-lavender-100 p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Monthly fee</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{fee ? fmtPKR(fee) : 'Not set'}</p>
          </div>
          <div className={`rounded-xl p-3 ring-1 ${dues.amount ? 'bg-blush-50 ring-blush-100' : 'bg-mint-50 ring-mint-100'}`}>
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Due now</p>
            <p className={`text-sm font-bold mt-0.5 ${dues.amount ? 'text-blush-700' : 'text-mint-700'}`}>
              {dues.amount ? fmtPKR(dues.amount) : 'Nothing'}
            </p>
          </div>
          <div className="rounded-xl bg-powder-50 ring-1 ring-powder-100 p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Access until</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{tenant.accessUntil ? fmtDate(tenant.accessUntil) : '—'}</p>
          </div>
        </div>

        <ModalSection label="Payment covers">
          <div className="flex flex-wrap gap-2">
            {MONTH_OPTIONS.map((m) => (
              <button key={m} type="button" className={months === m ? 'chip-on' : 'chip-off'} onClick={() => pickMonths(m)}>
                {m === 12 ? '1 year' : `${m} month${m > 1 ? 's' : ''}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Period: <span className="font-semibold text-slate-700">{fmtDate(period.from)} → {fmtDate(period.to)}</span>
            {period.to < todayISO() && <span className="text-blush-600"> · still overdue after this payment</span>}
          </p>
        </ModalSection>

        <ModalSection label="Payment">
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label>Amount (PKR)</label>
              <input type="number" min="0" value={amount} onChange={(e) => { setAmount(e.target.value); setAmountEdited(true); }} />
            </div>
            <div className="form-group">
              <label>Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {BILLING_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Received on</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </ModalSection>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : `Receive ${fmtPKR(amount)}`}
        </button>
      </ModalFooter>
    </Modal>
  );
}
