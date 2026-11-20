import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../../config/firebase';
import { toast } from 'sonner';
import Table from '../../components/Table';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalSection } from '../../components/Modal';
import TenantPaymentModal from '../../components/TenantPaymentModal';
import {
  ACCESS_META, DEMO_PRESETS, PAID_PRESETS, daysLeftText, fmtPKR, presetUntil, tenantAccess, tenantDues,
} from '../../lib/tenants';
import { fmtDate, toISO, todayISO } from '../../lib/dates';

const EMPTY_FORM = {
  name: '', email: '', password: '', phone: '', address: '', role: 'gym',
  status: 'demo', accessUntil: presetUntil({ days: 7 }), monthlyFee: '',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Dues unpaid' },
  { key: 'demo', label: 'On demo' },
  { key: 'active', label: 'Paid' },
  { key: 'suspended', label: 'Suspended' },
];

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null); // tenant being edited, null = enrolling new
  const [paying, setPaying] = useState(null);   // tenant receiving a payment
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'all';

  const fetchTenants = async () => {
    try {
      const snap = await getDocs(collection(db, 'tenants'));
      setTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Firestore error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const rows = useMemo(() => tenants.map((t) => {
    const access = tenantAccess(t);
    const dues = tenantDues(t);
    return {
      ...t,
      _access: access,
      _state: ACCESS_META[access.state].label,
      _until: t.accessUntil || '',
      _fee: Number(t.monthlyFee) || 0,
      _due: dues.amount,
      _dueMonths: dues.months,
    };
  }).filter((r) => filter === 'all' || r._access.state === filter), [tenants, filter]);

  const counts = useMemo(() => {
    const c = { all: tenants.length };
    tenants.forEach((t) => { const s = tenantAccess(t).state; c[s] = (c[s] || 0) + 1; });
    return c;
  }, [tenants]);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name || '', email: t.email || '', password: '', phone: t.phone || '', address: t.address || '',
      role: t.role || 'gym', status: t.status || 'active', accessUntil: t.accessUntil || '',
      monthlyFee: t.monthlyFee ?? '',
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const setStatus = (status) => setForm((f) => ({
    ...f,
    status,
    // Starting a demo with no (or an old) end date → default to 7 days from today
    accessUntil: status === 'demo' && (!f.accessUntil || f.accessUntil < todayISO()) ? presetUntil({ days: 7 }) : f.accessUntil,
  }));

  const subscriptionFields = () => ({
    status: form.status,
    accessUntil: form.accessUntil || '',
    monthlyFee: Number(form.monthlyFee) || 0,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.status === 'demo' && !form.accessUntil) {
      toast.error('Choose when the demo ends');
      return;
    }
    if (editing) {
      if (!form.name.trim()) { toast.error('Business name is required'); return; }
      setSaving(true);
      try {
        await updateDoc(doc(db, 'tenants', editing.id), {
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          role: form.role,
          ...subscriptionFields(),
          updatedAt: Date.now(),
        });
        toast.success(`Tenant "${form.name.trim()}" updated`);
        closeModal();
        fetchTenants();
      } catch (err) {
        toast.error(err.message || 'Failed to update tenant');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!form.name || !form.email || !form.password || !form.role) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const secondaryApp = initializeApp(firebaseConfig, 'secondary-' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      await deleteApp(secondaryApp);

      await setDoc(doc(db, 'tenants', cred.user.uid), {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        role: form.role,
        ...subscriptionFields(),
        createdAt: Date.now(),
      });

      toast.success(`Tenant "${form.name}" enrolled successfully`);
      closeModal();
      fetchTenants();
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered');
      } else {
        toast.error(err.message || 'Failed to create tenant');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'tenants', deleteTarget.id));
      toast.success(`Tenant "${deleteTarget.name}" removed`);
      setDeleteTarget(null);
      fetchTenants();
    } catch {
      toast.error('Failed to delete tenant');
    }
  };

  const columns = [
    {
      title: 'Name', data: 'name',
      render: (_, __, r) => (
        <div>
          <p className="font-semibold text-slate-800">{r.name}</p>
          <p className="text-xs text-slate-400">{r.email}</p>
        </div>
      ),
    },
    { title: 'Type', data: 'role', render: (d) => <span className={`badge badge-${d}`}>{d}</span> },
    { title: 'Phone', data: 'phone', render: (d) => d || '—' },
    {
      title: 'Status', data: '_state',
      render: (_, __, r) => <span className={`badge ${ACCESS_META[r._access.state].badge}`}>{ACCESS_META[r._access.state].label}</span>,
    },
    {
      title: 'Access Until', data: '_until',
      render: (_, __, r) => r._until ? (
        <div>
          <p>{fmtDate(r._until)}</p>
          <p className={`text-xs ${r._access.locked ? 'text-blush-600' : r._access.endingSoon ? 'text-butter-700' : 'text-slate-400'}`}>
            {daysLeftText(r._access)}
          </p>
        </div>
      ) : <span className="text-slate-400">No end date</span>,
    },
    { title: 'Fee / Month', data: '_fee', render: (d) => d ? fmtPKR(d) : <span className="text-slate-400">—</span> },
    {
      title: 'Due', data: '_due',
      render: (d, __, r) => d
        ? <span className="badge badge-unpaid">{fmtPKR(d)}{r._dueMonths > 1 ? ` · ${r._dueMonths} mo` : ''}</span>
        : <span className="badge badge-paid">Clear</span>,
    },
    { title: 'Enrolled', data: 'createdAt', render: (d) => d ? fmtDate(toISO(new Date(d))) : '—' },
    {
      title: 'Actions', data: null, orderable: false,
      render: (_, __, r) => (
        <div className="flex gap-2">
          <button className="btn-mint btn-sm" onClick={() => setPaying(r)}>Receive</button>
          <button className="btn-soft btn-sm" onClick={() => openEdit(r)}>Edit</button>
          <button className="btn-sm btn text-blush-700 bg-blush-50 hover:bg-blush-100" onClick={() => setDeleteTarget({ id: r.id, name: r.name })}>Remove</button>
        </div>
      ),
    },
  ];

  const presets = form.status === 'demo' ? DEMO_PRESETS : PAID_PRESETS;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Tenant Management</h2>
          <p className="page-subtitle">Demo access, subscription fees and dues</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Enroll Tenant</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? 'chip-on' : 'chip-off'}
            onClick={() => setParams(f.key === 'all' ? {} : { filter: f.key })}
          >
            {f.label} <span className="opacity-70">({counts[f.key] || 0})</span>
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-lavender-100 border-t-lavender-500 rounded-full animate-spin" /></div>
        ) : (
          <Table data={rows} columns={columns} />
        )}
      </div>

      <Modal show={showModal} size="lg">
        <ModalHeader
          icon={editing ? '✏️' : '🏢'}
          title={editing ? 'Edit Tenant' : 'Enroll New Tenant'}
          subtitle={editing ? `Update details for ${editing.name}` : 'Create a new business account on Slotify'}
          onClose={closeModal}
        />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <ModalSection label="Business Details">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label>Business Name <span className="text-rose-400">*</span></label>
                  <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. FitZone Gym" required />
                </div>
                <div className="form-group">
                  <label>Business Type <span className="text-rose-400">*</span></label>
                  <select name="role" value={form.role} onChange={handleChange}>
                    <option value="gym">💪 Gym</option>
                    <option value="padel">🎾 Padel</option>
                    <option value="cricket">🏏 Indoor Cricket</option>
                  </select>
                </div>
              </div>
            </ModalSection>

            {editing ? (
              <ModalSection label="Login">
                <div className="form-group">
                  <label>Email</label>
                  <input value={form.email} disabled />
                </div>
                <p className="text-xs text-slate-400 mt-2">Login email and password can't be changed here.</p>
              </ModalSection>
            ) : (
              <ModalSection label="Login Credentials">
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label>Email <span className="text-rose-400">*</span></label>
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="tenant@email.com" required />
                  </div>
                  <div className="form-group">
                    <label>Password <span className="text-rose-400">*</span></label>
                    <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min 6 characters" required minLength={6} />
                  </div>
                </div>
              </ModalSection>
            )}

            <ModalSection label="Subscription">
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { key: 'demo', label: '🧪 Demo' },
                  { key: 'active', label: '✅ Paid' },
                  { key: 'suspended', label: '⛔ Suspended' },
                ].map((s) => (
                  <button key={s.key} type="button" className={form.status === s.key ? 'chip-on' : 'chip-off'} onClick={() => setStatus(s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>

              {form.status === 'suspended' ? (
                <p className="text-xs text-blush-700 bg-blush-50 ring-1 ring-blush-100 rounded-xl px-3 py-2 mb-3">
                  The tenant is locked out immediately until you change the status back.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-slate-500">{form.status === 'demo' ? 'Demo for' : 'Paid for'}:</span>
                    {presets.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className={form.accessUntil === presetUntil(p) ? 'chip-on' : 'chip-off'}
                        onClick={() => setForm((f) => ({ ...f, accessUntil: presetUntil(p) }))}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label>{form.status === 'demo' ? 'Demo ends on' : 'Access until'}{form.status === 'demo' && <span className="text-rose-400"> *</span>}</label>
                  <input
                    name="accessUntil" type="date" value={form.accessUntil} onChange={handleChange}
                    disabled={form.status === 'suspended'}
                  />
                  {form.status === 'active' && (
                    <p className="text-[11px] text-slate-400">Leave empty for no end date.</p>
                  )}
                </div>
                <div className="form-group">
                  <label>Monthly fee (PKR)</label>
                  <input name="monthlyFee" type="number" min="0" value={form.monthlyFee} onChange={handleChange} placeholder="e.g. 5000" />
                  <p className="text-[11px] text-slate-400">What this tenant pays you each month.</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                After the end date the tenant can't open their dashboard, and they show as <span className="font-semibold text-blush-600">Dues unpaid</span> on your dashboard.
              </p>
            </ModalSection>

            <ModalSection label="Contact Info" optional>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label>Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+92 300 0000000" />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input name="address" value={form.address} onChange={handleChange} placeholder="Shop / office address" />
                </div>
              </div>
            </ModalSection>
          </ModalBody>

          <ModalFooter>
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {editing ? 'Saving...' : 'Enrolling...'}
                </span>
              ) : editing ? 'Save Changes' : 'Enroll Tenant'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {paying && <TenantPaymentModal tenant={paying} onClose={() => setPaying(null)} onSaved={fetchTenants} />}

      <Modal show={!!deleteTarget} size="sm">
        <ModalHeader
          icon="⚠️"
          title="Remove Tenant"
          subtitle="This action cannot be undone"
          onClose={() => setDeleteTarget(null)}
        />
        <ModalBody>
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to remove <span className="font-semibold text-slate-900">{deleteTarget?.name}</span>?
            All their data including customers and bookings will be permanently deleted.
          </p>
        </ModalBody>
        <ModalFooter>
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Remove Tenant</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
