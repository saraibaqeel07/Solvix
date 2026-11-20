import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import Table from '../../components/Table';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalSection } from '../../components/Modal';
import { ExportButtons, Spinner, EmptyState } from '../../components/ui';
import { exportCSV, exportPDF } from '../../utils/export';
import { addDays, fmtDate, todayISO } from '../../lib/dates';
import {
  loadGymData, createMember, updateMember, renewMember, collectDues, deleteMember,
  computeEndDate, durationLabel, memberState, memberDues, fmtPKR, num,
  STATE_META, PAYMENT_METHODS, PAY_KINDS, groupPayments, DURATION_UNITS,
} from '../../lib/gym';

const CUSTOM = '__custom';
const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'active',   label: 'Active' },
  { key: 'expiring', label: 'Expiring soon' },
  { key: 'expired',  label: 'Expired' },
  { key: 'dues',     label: 'Dues pending' },
];

const EMPTY_FORM = {
  name: '', phone: '', email: '', gender: '', cnic: '',
  admissionDate: '', admissionFee: '', admissionPaid: true,
  packageId: CUSTOM, membershipType: '', startDate: '', endDate: '',
  amount: '', status: 'paid', method: 'Cash', notes: '',
  durationValue: 1, durationUnit: 'months',
};

// Duration + end-date block. With a package selected both are locked to the package;
// for a custom plan the user picks a duration and the end date is still calculated.
function DurationFields({ pkg, value, unit, onValue, onUnit }) {
  const locked = !!pkg;
  return (
    <div className="form-group">
      <label>Duration {locked && <span className="text-slate-300 font-normal normal-case">(from package)</span>}</label>
      <div className="flex gap-2">
        <input type="number" min="1" className="!w-20" value={locked ? pkg.durationValue : value} disabled={locked}
          onChange={(e) => onValue(e.target.value)} />
        <select value={locked ? pkg.durationUnit : unit} disabled={locked} onChange={(e) => onUnit(e.target.value)} className="flex-1">
          {Object.entries(DURATION_UNITS).map(([k, v]) => <option key={k} value={k}>{v}s</option>)}
        </select>
      </div>
    </div>
  );
}

function PackagePicker({ packages, value, onChange }) {
  const opt = (p) => (
    <option key={p.id} value={p.id}>
      {p.name} — {fmtPKR(p.price)} / {durationLabel(p.durationValue, p.durationUnit)}{p.active === false ? ' (inactive)' : ''}
    </option>
  );
  const active = packages.filter((p) => p.active !== false);
  const inactive = packages.filter((p) => p.active === false);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {active.length > 0 && <optgroup label="Packages">{active.map(opt)}</optgroup>}
      {inactive.length > 0 && <optgroup label="Inactive packages">{inactive.map(opt)}</optgroup>}
      <option value={CUSTOM}>Custom (enter manually)</option>
    </select>
  );
}

export default function Customers() {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'all';

  const [data, setData] = useState({ customers: [], packages: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [renewTarget, setRenewTarget] = useState(null);
  const [renew, setRenew] = useState(null);
  const [collectTarget, setCollectTarget] = useState(null);
  const [collect, setCollect] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = () => loadGymData(uid)
    .then(setData)
    .catch((e) => { console.error(e); toast.error('Failed to load members'); })
    .finally(() => setLoading(false));

  useEffect(() => { if (uid) refresh(); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const pkgById = useMemo(() => Object.fromEntries(data.packages.map((p) => [p.id, p])), [data.packages]);
  const signupPackages = data.packages;
  const renewPackages = data.packages;

  const rows = useMemo(() => data.customers.map((c) => {
    const st = memberState(c);
    const dues = memberDues(c);
    return { ...c, _state: st.state, _daysLeft: st.daysLeft, _dues: dues.total, _duesObj: dues };
  }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [data.customers]);

  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter((r) => r._state === 'active' || r._state === 'expiring').length,
    expiring: rows.filter((r) => r._state === 'expiring').length,
    expired: rows.filter((r) => r._state === 'expired').length,
    dues: rows.filter((r) => r._dues > 0).length,
  }), [rows]);

  const visible = rows.filter((r) => {
    if (filter === 'active') return r._state === 'active' || r._state === 'expiring';
    if (filter === 'expiring') return r._state === 'expiring';
    if (filter === 'expired') return r._state === 'expired';
    if (filter === 'dues') return r._dues > 0;
    return true;
  });

  // ── Add / edit ────────────────────────────────────────────────────────────

  const applyPackage = (f, pkgId) => {
    const p = pkgById[pkgId];
    if (!p) {
      const prev = pkgById[f.packageId];
      const durationValue = prev ? prev.durationValue : f.durationValue;
      const durationUnit = prev ? prev.durationUnit : f.durationUnit;
      return { ...f, packageId: CUSTOM, durationValue, durationUnit,
        endDate: f.startDate ? computeEndDate(f.startDate, durationValue, durationUnit) : f.endDate };
    }
    return {
      ...f,
      packageId: pkgId,
      membershipType: p.name,
      amount: p.price,
      admissionFee: editTarget ? f.admissionFee : (num(p.admissionFee) || f.admissionFee),
      endDate: f.startDate ? computeEndDate(f.startDate, p.durationValue, p.durationUnit) : f.endDate,
    };
  };

  const openAdd = async () => {
    const today = todayISO();
    setEditTarget(null);
    // Reload so packages created in another tab/page show up in the dropdown.
    let packages = data.packages;
    try { const fresh = await loadGymData(uid); setData(fresh); packages = fresh.packages; } catch { /* use cached */ }
    const first = packages.find((p) => p.active !== false) || packages[0];
    let f = { ...EMPTY_FORM, admissionDate: today, startDate: today, endDate: computeEndDate(today, 1, 'months') };
    if (first) {
      f = { ...f, packageId: first.id, membershipType: first.name, amount: first.price,
        admissionFee: num(first.admissionFee) || '', endDate: computeEndDate(today, first.durationValue, first.durationUnit) };
    }
    setForm(f);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditTarget(c);
    setForm({
      ...EMPTY_FORM, ...c,
      packageId: c.packageId && pkgById[c.packageId] ? c.packageId : CUSTOM,
      admissionPaid: !!c.admissionPaid,
      admissionFee: c.admissionFee || '',
      amount: c.amount || '',
    });
    setShowForm(true);
  };

  const onField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: type === 'checkbox' ? checked : value };
      if (['startDate', 'durationValue', 'durationUnit'].includes(name) && next.startDate) {
        const p = pkgById[next.packageId];
        next.endDate = p
          ? computeEndDate(next.startDate, p.durationValue, p.durationUnit)
          : computeEndDate(next.startDate, next.durationValue, next.durationUnit);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { toast.error('End date is before start date'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(), phone: form.phone, email: form.email, gender: form.gender, cnic: form.cnic,
      admissionDate: form.admissionDate,
      admissionFee: num(form.admissionFee),
      admissionPaid: num(form.admissionFee) > 0 ? !!form.admissionPaid : false,
      packageId: form.packageId === CUSTOM ? '' : form.packageId,
      membershipType: form.packageId === CUSTOM ? (form.membershipType || 'Custom') : pkgById[form.packageId]?.name,
      startDate: form.startDate, endDate: form.endDate,
      amount: num(form.amount), status: form.status, notes: form.notes,
    };
    try {
      if (editTarget) {
        await updateMember(uid, editTarget, payload, { method: form.method });
        toast.success('Member updated');
      } else {
        await createMember(uid, payload, { method: form.method });
        toast.success('Member added');
      }
      setShowForm(false);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save member');
    } finally {
      setSaving(false);
    }
  };

  // ── Renew ─────────────────────────────────────────────────────────────────

  const openRenew = (c) => {
    const today = todayISO();
    // Continue from the old end date if still running; otherwise start today.
    const start = c.endDate && c.endDate >= today ? addDays(c.endDate, 1) : today;
    const p = pkgById[c.packageId] || data.packages.find((x) => x.active !== false);
    setRenewTarget(c);
    setRenew({
      packageId: p ? p.id : CUSTOM,
      packageName: p ? p.name : (c.membershipType || 'Custom'),
      startDate: start,
      endDate: p ? computeEndDate(start, p.durationValue, p.durationUnit) : '',
      amount: p ? p.price : (c.amount || ''),
      paid: true, method: 'Cash', date: today, durationValue: 1, durationUnit: 'months',
    });
  };

  const onRenewPackage = (pkgId) => {
    const p = pkgById[pkgId];
    setRenew((r) => p
      ? { ...r, packageId: pkgId, packageName: p.name, amount: p.price, endDate: computeEndDate(r.startDate, p.durationValue, p.durationUnit) }
      : { ...r, packageId: CUSTOM, endDate: computeEndDate(r.startDate, r.durationValue, r.durationUnit) });
  };

  const onRenewStart = (v) => {
    setRenew((r) => {
      const p = pkgById[r.packageId];
      return { ...r, startDate: v, endDate: p ? computeEndDate(v, p.durationValue, p.durationUnit) : computeEndDate(v, r.durationValue, r.durationUnit) };
    });
  };

  const submitRenew = async (e) => {
    e.preventDefault();
    if (!renew.startDate || !renew.endDate) { toast.error('Select start and end dates'); return; }
    if (renew.endDate < renew.startDate) { toast.error('End date is before start date'); return; }
    setSaving(true);
    try {
      await renewMember(uid, renewTarget, { ...renew, packageId: renew.packageId === CUSTOM ? '' : renew.packageId });
      toast.success(`${renewTarget.name} renewed until ${fmtDate(renew.endDate)}`);
      setRenewTarget(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to renew');
    } finally { setSaving(false); }
  };

  // ── Collect dues ──────────────────────────────────────────────────────────

  const openCollect = (c) => {
    const d = memberDues(c);
    setCollectTarget(c);
    setCollect({ membership: d.membership > 0, admission: d.admission > 0, method: 'Cash', date: todayISO() });
  };

  const submitCollect = async (e) => {
    e.preventDefault();
    if (!collect.membership && !collect.admission) { toast.error('Select what is being paid'); return; }
    setSaving(true);
    try {
      await collectDues(uid, collectTarget, collect);
      toast.success('Payment recorded');
      setCollectTarget(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to record payment');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteMember(uid, deleteTarget.id);
      toast.success('Member deleted — payment history kept for reports');
      setDeleteTarget(null);
      refresh();
    } catch { toast.error('Failed to delete member'); }
  };

  // ── Table ─────────────────────────────────────────────────────────────────

  const columns = [
    {
      title: 'Member', data: 'name',
      render: (_, __, r) => (
        <button className="text-left" onClick={() => setHistoryTarget(r)}>
          <p className="font-semibold text-slate-800 hover:text-lavender-700">{r.name}</p>
          <p className="text-xs text-slate-400">{r.phone || r.email || '—'}</p>
        </button>
      ),
    },
    { title: 'Package', data: 'membershipType', render: (d) => d ? <span className="badge badge-confirmed">{d}</span> : '—' },
    { title: 'Joined', data: 'admissionDate', render: (d) => fmtDate(d) },
    {
      title: 'Expiry', data: 'endDate',
      render: (d, __, r) => (
        <div>
          <p className="text-slate-700">{fmtDate(d)}</p>
          {r._daysLeft !== null && (
            <p className={`text-[11px] ${r._daysLeft < 0 ? 'text-peach-700' : r._daysLeft <= 7 ? 'text-butter-700' : 'text-slate-400'}`}>
              {r._daysLeft < 0 ? `${-r._daysLeft}d ago` : r._daysLeft === 0 ? 'today' : `in ${r._daysLeft}d`}
            </p>
          )}
        </div>
      ),
    },
    { title: 'Fee', data: 'amount', render: (d) => d ? fmtPKR(d) : '—' },
    {
      title: 'Admission Fee', data: 'admissionFee',
      render: (d) => (num(d) > 0 ? fmtPKR(d) : <span className="text-slate-300">—</span>),
    },
    { title: 'Membership', data: '_state', render: (d) => <span className={`badge ${STATE_META[d].badge}`}>{STATE_META[d].label}</span> },
    {
      title: 'Payment', data: '_dues',
      render: (d) => (d > 0
        ? <span className="badge badge-unpaid" title="Fee and/or admission fee still due">Unpaid · {fmtPKR(d)}</span>
        : <span className="badge badge-paid">Paid</span>),
    },
    {
      title: 'Actions', data: null, orderable: false,
      render: (_, __, r) => (
        <div className="flex gap-1.5">
          {r._dues > 0 && <button className="btn-mint btn-sm" onClick={() => openCollect(r)}>Collect</button>}
          <button className="btn-soft btn-sm" onClick={() => openRenew(r)}>Renew</button>
          <button className="btn-secondary btn-sm" onClick={() => openEdit(r)}>Edit</button>
          <button className="btn-sm btn bg-blush-50 text-blush-700 hover:bg-blush-100 border border-blush-100" onClick={() => setDeleteTarget(r)} aria-label="Delete">🗑</button>
        </div>
      ),
    },
  ];

  const exportCols = [
    { header: 'Name', value: (r) => r.name },
    { header: 'Phone', value: (r) => r.phone || '' },
    { header: 'Email', value: (r) => r.email || '' },
    { header: 'Package', value: (r) => r.membershipType || '' },
    { header: 'Joined', value: (r) => r.admissionDate || '' },
    { header: 'Start', value: (r) => r.startDate || '' },
    { header: 'Expiry', value: (r) => r.endDate || '' },
    { header: 'Fee (PKR)', value: (r) => num(r.amount), align: 'right' },
    { header: 'Admission Fee (PKR)', value: (r) => num(r.admissionFee), align: 'right' },
    { header: 'Status', value: (r) => STATE_META[r._state].label },
    { header: 'Dues (PKR)', value: (r) => r._dues, align: 'right' },
  ];
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label || 'All';
  const totals = { Name: 'TOTAL', 'Dues (PKR)': visible.reduce((s, r) => s + r._dues, 0) };

  const history = historyTarget ? groupPayments(data.payments.filter((p) => p.customerId === historyTarget.id)) : [];
  const renewPkg = renew && pkgById[renew.packageId];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Members</h2>
          <p className="page-subtitle">{counts.active} active · {counts.expiring} expiring soon · {counts.dues} with dues</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButtons
            disabled={!visible.length}
            onCSV={() => exportCSV(`members_${filter}`, exportCols, visible, totals)}
            onPDF={() => exportPDF({ title: `Members — ${filterLabel}`, subtitle: userProfile?.name, columns: exportCols, rows: visible, totals })}
          />
          <button className="btn-primary" onClick={openAdd}>+ Add Member</button>
        </div>
      </div>

      {!loading && data.packages.length === 0 && (
        <div className="mb-4 rounded-2xl bg-butter-50 ring-1 ring-butter-200 px-5 py-3 text-sm text-butter-800 flex items-center justify-between gap-3 flex-wrap">
          <span>💡 Create packages (e.g. PKR 5,000 for 3 months) so fees and expiry dates fill in automatically.</span>
          <Link to="/gym/packages" className="btn-secondary btn-sm">Set up packages →</Link>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'chip-on' : 'chip-off'}
            onClick={() => setParams(f.key === 'all' ? {} : { filter: f.key })}>
            {f.label} <span className="opacity-70">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <Spinner /> : <Table data={visible} columns={columns} />}
      </div>

      {/* ── Add / Edit ── */}
      <Modal show={showForm} onClose={() => setShowForm(false)} size="lg">
        <ModalHeader icon={editTarget ? '✏️' : '👤'} title={editTarget ? 'Edit Member' : 'Add New Member'}
          subtitle={editTarget ? 'Update member information' : 'Register a new member and record their payment'} onClose={() => setShowForm(false)} />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <ModalSection label="1 · Member Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label>Full Name <span className="text-blush-400">*</span></label>
                  <input name="name" value={form.name} onChange={onField} placeholder="Ali Khan" required />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input name="phone" value={form.phone} onChange={onField} placeholder="+92 300 0000000" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" value={form.email} onChange={onField} placeholder="member@email.com" />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select name="gender" value={form.gender} onChange={onField}>
                    <option value="">Select…</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>
            </ModalSection>

            <ModalSection label="2 · Package">
              <div className="form-group">
                <label>Select Package</label>
                <PackagePicker packages={signupPackages} value={form.packageId} onChange={(id) => setForm((f) => applyPackage(f, id))} />
              </div>

              {signupPackages.length === 0 && (
                <p className="mt-2 text-xs text-butter-800 bg-butter-50 rounded-xl px-3 py-2">
                  No packages yet. <Link to="/gym/packages" className="font-semibold underline">Create a package</Link> (e.g. PKR 5,000 for 3 months) to pick it here, or use Custom below.
                </p>
              )}

              {pkgById[form.packageId] ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-lavender-50 px-3 py-2.5"><p className="text-[11px] text-slate-500">Fee</p><p className="font-bold text-slate-800">{fmtPKR(form.amount)}</p></div>
                  <div className="rounded-xl bg-mint-50 px-3 py-2.5"><p className="text-[11px] text-slate-500">Duration</p><p className="font-bold text-slate-800">{durationLabel(pkgById[form.packageId].durationValue, pkgById[form.packageId].durationUnit)}</p></div>
                  <div className="rounded-xl bg-peach-50 px-3 py-2.5"><p className="text-[11px] text-slate-500">Admission fee</p><p className="font-bold text-slate-800">{num(pkgById[form.packageId].admissionFee) ? fmtPKR(pkgById[form.packageId].admissionFee) : '—'}</p></div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="form-group">
                    <label>Plan Name</label>
                    <input name="membershipType" value={form.membershipType} onChange={onField} placeholder="e.g. Monthly" />
                  </div>
                  <DurationFields pkg={null} value={form.durationValue} unit={form.durationUnit}
                    onValue={(v) => onField({ target: { name: 'durationValue', value: v } })}
                    onUnit={(v) => onField({ target: { name: 'durationUnit', value: v } })} />
                  <div className="form-group">
                    <label>Fee (PKR)</label>
                    <input name="amount" type="number" min="0" value={form.amount} onChange={onField} placeholder="e.g. 3000" />
                  </div>
                </div>
              )}
            </ModalSection>

            <ModalSection label="3 · Dates">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="form-group">
                  <label>Joined On</label>
                  <input name="admissionDate" type="date" value={form.admissionDate} onChange={onField} />
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input name="startDate" type="date" value={form.startDate} onChange={onField} />
                </div>
                <div className="form-group">
                  <label>End Date <span className="text-slate-300 font-normal normal-case">(auto)</span></label>
                  <input name="endDate" type="date" value={form.endDate} disabled />
                </div>
              </div>
            </ModalSection>

            <ModalSection label="4 · Payment">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="form-group">
                  <label>Membership Fee</label>
                  <select name="status" value={form.status} onChange={onField}>
                    <option value="paid">✅ Paid</option>
                    <option value="unpaid">⏳ Unpaid (due)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Admission Fee (PKR)</label>
                  <input name="admissionFee" type="number" min="0" value={form.admissionFee} onChange={onField} placeholder="One-time" />
                </div>
                <div className="form-group">
                  <label>Method</label>
                  <select name="method" value={form.method} onChange={onField}>
                    {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              {num(form.admissionFee) > 0 && (
                <label className="flex items-center gap-2 mt-3 text-sm text-slate-600 cursor-pointer w-fit">
                  <input type="checkbox" name="admissionPaid" checked={!!form.admissionPaid} onChange={onField} className="accent-lavender-500 w-4 h-4" />
                  Admission fee received
                </label>
              )}
              <div className="mt-3 rounded-xl bg-lavender-50 px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-slate-500">Total: <b className="text-slate-800">{fmtPKR(num(form.amount) + num(form.admissionFee))}</b></span>
                <span className="text-slate-500">Collected now: <b className="text-mint-700">{fmtPKR((form.status === 'paid' ? num(form.amount) : 0) + (form.admissionPaid ? num(form.admissionFee) : 0))}</b></span>
                {editTarget && <span className="text-xs text-slate-400 w-full">Switching a fee from unpaid to paid records a payment dated today.</span>}
              </div>
            </ModalSection>

            <div className="form-group">
              <label>Notes <span className="text-slate-300 font-normal normal-case">(optional)</span></label>
              <input name="notes" value={form.notes} onChange={onField} placeholder="Any additional notes…" />
            </div>
          </ModalBody>
          <ModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editTarget ? 'Update Member' : 'Add Member'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ── Renew ── */}
      <Modal show={!!renewTarget} onClose={() => setRenewTarget(null)}>
        <ModalHeader icon="🔄" title={`Renew — ${renewTarget?.name || ''}`}
          subtitle={renewTarget?.endDate ? `Current plan ends ${fmtDate(renewTarget.endDate)}` : 'Start a new membership period'} onClose={() => setRenewTarget(null)} />
        {renew && (
          <form onSubmit={submitRenew}>
            <ModalBody>
              <div className="form-group">
                <label>Package</label>
                <PackagePicker packages={renewPackages} value={renew.packageId} onChange={onRenewPackage} />
              </div>
              {renew.packageId === CUSTOM && (
                <div className="form-group">
                  <label>Plan Name</label>
                  <input value={renew.packageName} onChange={(e) => setRenew((r) => ({ ...r, packageName: e.target.value }))} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group"><label>Start</label><input type="date" value={renew.startDate} onChange={(e) => onRenewStart(e.target.value)} /></div>
                <div className="form-group"><label>End <span className="text-slate-300 font-normal normal-case">(auto)</span></label><input type="date" value={renew.endDate} disabled /></div>
                <div className="col-span-2">
                  <DurationFields pkg={renewPkg} value={renew.durationValue} unit={renew.durationUnit}
                    onValue={(v) => setRenew((r) => ({ ...r, durationValue: v, endDate: computeEndDate(r.startDate, v, r.durationUnit) }))}
                    onUnit={(v) => setRenew((r) => ({ ...r, durationUnit: v, endDate: computeEndDate(r.startDate, r.durationValue, v) }))} />
                </div>
                <div className="form-group"><label>Amount (PKR) {renewPkg && <span className="text-slate-300 font-normal normal-case">(from package)</span>}</label><input type="number" min="0" value={renew.amount} disabled={!!renewPkg} onChange={(e) => setRenew((r) => ({ ...r, amount: e.target.value }))} /></div>
                <div className="form-group">
                  <label>Payment</label>
                  <select value={renew.paid ? 'paid' : 'unpaid'} onChange={(e) => setRenew((r) => ({ ...r, paid: e.target.value === 'paid' }))}>
                    <option value="paid">✅ Paid now</option><option value="unpaid">⏳ Pay later</option>
                  </select>
                </div>
                {renew.paid && (
                  <>
                    <div className="form-group"><label>Method</label>
                      <select value={renew.method} onChange={(e) => setRenew((r) => ({ ...r, method: e.target.value }))}>
                        {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Paid On</label><input type="date" value={renew.date} onChange={(e) => setRenew((r) => ({ ...r, date: e.target.value }))} /></div>
                  </>
                )}
              </div>
              {renewPkg && <p className="text-xs text-slate-500">{renewPkg.name}: {durationLabel(renewPkg.durationValue, renewPkg.durationUnit)} · {fmtDate(renew.startDate)} → {fmtDate(renew.endDate)}</p>}
            </ModalBody>
            <ModalFooter>
              <button type="button" className="btn-secondary" onClick={() => setRenewTarget(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Renew Membership'}</button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* ── Collect dues ── */}
      <Modal show={!!collectTarget} onClose={() => setCollectTarget(null)} size="sm">
        <ModalHeader icon="💰" title="Collect Payment" subtitle={collectTarget?.name} onClose={() => setCollectTarget(null)} />
        {collect && collectTarget && (
          <form onSubmit={submitCollect}>
            <ModalBody>
              <div className="space-y-2">
                {memberDues(collectTarget).membership > 0 && (
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-mint-50 ring-1 ring-mint-100 px-4 py-3 cursor-pointer">
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={collect.membership} onChange={(e) => setCollect((c) => ({ ...c, membership: e.target.checked }))} className="accent-lavender-500 w-4 h-4" />
                      Membership fee
                    </span>
                    <b className="text-slate-800">{fmtPKR(collectTarget.amount)}</b>
                  </label>
                )}
                {memberDues(collectTarget).admission > 0 && (
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-lavender-50 ring-1 ring-lavender-100 px-4 py-3 cursor-pointer">
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={collect.admission} onChange={(e) => setCollect((c) => ({ ...c, admission: e.target.checked }))} className="accent-lavender-500 w-4 h-4" />
                      Admission fee
                    </span>
                    <b className="text-slate-800">{fmtPKR(collectTarget.admissionFee)}</b>
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group"><label>Method</label>
                  <select value={collect.method} onChange={(e) => setCollect((c) => ({ ...c, method: e.target.value }))}>
                    {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Date</label><input type="date" value={collect.date} onChange={(e) => setCollect((c) => ({ ...c, date: e.target.value }))} /></div>
              </div>
              <p className="text-sm text-slate-600">Collecting <b className="text-mint-700">{fmtPKR((collect.membership ? num(collectTarget.amount) : 0) + (collect.admission ? num(collectTarget.admissionFee) : 0))}</b></p>
            </ModalBody>
            <ModalFooter>
              <button type="button" className="btn-secondary" onClick={() => setCollectTarget(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* ── Member profile + payment history ── */}
      <Modal show={!!historyTarget} onClose={() => setHistoryTarget(null)} size="lg">
        <ModalHeader icon="🧾" title={historyTarget?.name} subtitle={[historyTarget?.phone, historyTarget?.email].filter(Boolean).join(' · ') || 'Member profile'} onClose={() => setHistoryTarget(null)} />
        {historyTarget && (
          <ModalBody>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-xl bg-lavender-50 p-3"><p className="text-[11px] text-slate-500">Package</p><p className="font-semibold text-slate-800 truncate">{historyTarget.membershipType || '—'}</p></div>
              <div className="rounded-xl bg-mint-50 p-3"><p className="text-[11px] text-slate-500">Valid till</p><p className="font-semibold text-slate-800">{fmtDate(historyTarget.endDate)}</p></div>
              <div className="rounded-xl bg-powder-50 p-3"><p className="text-[11px] text-slate-500">Total paid</p><p className="font-semibold text-slate-800">{fmtPKR(history.reduce((s, p) => s + p.total, 0))}</p></div>
              <div className="rounded-xl bg-blush-50 p-3"><p className="text-[11px] text-slate-500">Dues</p><p className="font-semibold text-slate-800">{fmtPKR(historyTarget._dues)}</p></div>
            </div>
            <div className="rounded-xl ring-1 ring-lavender-100 overflow-hidden">
              {history.length === 0 ? <EmptyState icon="🧾" title="No payments recorded yet" /> : (
                <div className="overflow-x-auto">
                  <table className="simple-table">
                    <thead><tr><th>Date</th><th>Type</th><th>Package</th><th>Method</th><th className="text-right">Fee</th><th className="text-right">Admission</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {history.map((p) => (
                        <tr key={p.id}>
                          <td>{fmtDate(p.date)}</td>
                          <td><span className={`badge ${PAY_KINDS[p.kind].badge}`}>{PAY_KINDS[p.kind].label}</span></td>
                          <td className="text-slate-500">{p.packageName || '—'}</td>
                          <td className="text-slate-500">{p.method || '—'}</td>
                          <td className="text-right">{p.fee ? fmtPKR(p.fee) : '—'}</td>
                          <td className="text-right text-slate-500">{p.admission ? fmtPKR(p.admission) : '—'}</td>
                          <td className="text-right font-semibold">{fmtPKR(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </ModalBody>
        )}
        <ModalFooter>
          <button className="btn-secondary" onClick={() => setHistoryTarget(null)}>Close</button>
          {historyTarget && <button className="btn-primary" onClick={() => { const t = historyTarget; setHistoryTarget(null); openRenew(t); }}>Renew</button>}
        </ModalFooter>
      </Modal>

      {/* ── Delete ── */}
      <Modal show={!!deleteTarget} onClose={() => setDeleteTarget(null)} size="sm">
        <ModalHeader icon="🗑️" title="Delete Member" subtitle="This cannot be undone" onClose={() => setDeleteTarget(null)} />
        <ModalBody>
          <p className="text-sm text-slate-600 leading-relaxed">
            Delete <span className="font-semibold text-slate-900">{deleteTarget?.name}</span>? Their past payments stay in reports so revenue totals don't change.
          </p>
        </ModalBody>
        <ModalFooter>
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete Member</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
