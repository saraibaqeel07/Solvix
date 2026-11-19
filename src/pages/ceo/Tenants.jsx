import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../../config/firebase';
import { toast } from 'sonner';
import Table from '../../components/Table';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalSection } from '../../components/Modal';

const EMPTY_FORM = { name: '', email: '', password: '', phone: '', address: '', role: 'gym' };

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        createdAt: Date.now(),
      });

      toast.success(`Tenant "${form.name}" enrolled successfully`);
      setForm(EMPTY_FORM);
      setShowModal(false);
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
    { title: 'Name', data: 'name' },
    { title: 'Type', data: 'role', render: (data) => `<span class="badge badge-${data}">${data}</span>` },
    { title: 'Email', data: 'email' },
    { title: 'Phone', data: 'phone', defaultContent: '—' },
    { title: 'Address', data: 'address', defaultContent: '—' },
    {
      title: 'Enrolled',
      data: 'createdAt',
      render: (data) => data ? new Date(data).toLocaleDateString() : '—',
    },
    {
      title: 'Actions',
      data: null,
      orderable: false,
      render: (_, __, row) =>
        `<button class="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100" data-id="${row.id}" data-name="${row.name}">Remove</button>`,
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Tenant Management</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Enroll Tenant</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" /></div>
        ) : (
          <Table
            data={tenants}
            columns={columns}
            onClick={(e) => {
              const btn = e.target.closest('[data-id]');
              if (btn) setDeleteTarget({ id: btn.dataset.id, name: btn.dataset.name });
            }}
          />
        )}
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader
          icon="🏢"
          title="Enroll New Tenant"
          subtitle="Create a new business account on Solvix"
          onClose={() => setShowModal(false)}
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
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enrolling...
                </span>
              ) : 'Enroll Tenant'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal show={!!deleteTarget} onClose={() => setDeleteTarget(null)} size="sm">
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
