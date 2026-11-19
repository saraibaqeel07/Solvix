import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import Table from '../../components/Table';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalSection } from '../../components/Modal';

function applyExpiry(c) {
  if (c.status === 'paid' && c.endDate && new Date(c.endDate + 'T00:00:00') < new Date()) {
    return { ...c, status: 'unpaid' };
  }
  return c;
}

const MEMBERSHIP_TYPES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Daily'];
const EMPTY_FORM = {
  name: '', phone: '', email: '',
  admissionDate: '', admissionFee: '', membershipType: 'Monthly',
  startDate: '', endDate: '', amount: '', status: 'paid', notes: '',
};

export default function Customers() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const colRef = () => collection(db, 'tenants', userProfile.uid, 'customers');

  const fetchCustomers = async () => {
    try {
      const snap = await getDocs(colRef());
      setCustomers(snap.docs.map((d) => applyExpiry({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Firestore error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userProfile?.uid) fetchCustomers(); }, [userProfile]);

  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (c) => { setEditTarget(c); setForm({ ...EMPTY_FORM, ...c }); setShowModal(true); };
  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        admissionDate: form.admissionDate,
        admissionFee: form.admissionFee ? parseFloat(form.admissionFee) : 0,
        membershipType: form.membershipType,
        startDate: form.startDate,
        endDate: form.endDate,
        amount: form.amount ? parseFloat(form.amount) : 0,
        status: form.status,
        notes: form.notes,
        updatedAt: Date.now(),
      };
      if (editTarget) {
        await updateDoc(doc(db, 'tenants', userProfile.uid, 'customers', editTarget.id), data);
        toast.success('Customer updated');
      } else {
        await addDoc(colRef(), { ...data, createdAt: Date.now() });
        toast.success('Customer added');
      }
      setShowModal(false);
      fetchCustomers();
    } catch {
      toast.error('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'tenants', userProfile.uid, 'customers', deleteTarget.id));
      toast.success('Customer deleted');
      setDeleteTarget(null);
      fetchCustomers();
    } catch {
      toast.error('Failed to delete customer');
    }
  };

  const columns = [
    { title: 'Name', data: 'name' },
    { title: 'Phone', data: 'phone', defaultContent: '—' },
    { title: 'Admission', data: 'admissionDate', render: (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString() : '—' },
    { title: 'Membership', data: 'membershipType', defaultContent: '—' },
    { title: 'Fee (PKR)', data: 'amount', render: (d) => d ? `PKR ${Number(d).toLocaleString()}` : '—' },
    { title: 'Expiry', data: 'endDate', render: (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString() : '—' },
    {
      title: 'Status', data: 'status',
      render: (d) => `<span class="badge badge-${d === 'paid' ? 'paid' : 'unpaid'}">${d}</span>`,
    },
    {
      title: 'Actions', data: null, orderable: false,
      render: (_, __, row) =>
        `<div class="flex gap-1.5">
           <button class="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" data-action="edit" data-id="${row.id}">Edit</button>
           <button class="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100" data-action="delete" data-id="${row.id}" data-name="${row.name}">Delete</button>
         </div>`,
    },
  ];

  const handleTableClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const customer = customers.find((c) => c.id === id);
    if (btn.dataset.action === 'edit') openEdit(customer);
    if (btn.dataset.action === 'delete') setDeleteTarget(customer);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Customers</h2>
        <button className="btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>
        ) : (
          <Table data={customers} columns={columns} onClick={handleTableClick} />
        )}
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader
          icon={editTarget ? '✏️' : '👤'}
          title={editTarget ? 'Edit Customer' : 'Add New Customer'}
          subtitle={editTarget ? 'Update customer information' : 'Add a new member to your gym'}
          onClose={() => setShowModal(false)}
        />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <ModalSection label="Personal Info">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label>Full Name <span className="text-rose-400">*</span></label>
                  <input name="name" value={form.name} onChange={handleChange} placeholder="John Doe" required />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+92 300 0000000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="customer@email.com" />
                </div>
                <div className="form-group">
                  <label>Admission Date</label>
                  <input name="admissionDate" type="date" value={form.admissionDate} onChange={handleChange} />
                </div>
              </div>
            </ModalSection>

            <ModalSection label="Membership & Payment">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label>Membership Type</label>
                  <select name="membershipType" value={form.membershipType} onChange={handleChange}>
                    {MEMBERSHIP_TYPES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fee Amount (PKR)</label>
                  <input name="amount" type="number" min="0" value={form.amount} onChange={handleChange} placeholder="e.g. 3000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="form-group">
                  <label>Payment Status</label>
                  <select name="status" value={form.status} onChange={handleChange}>
                    <option value="paid">✅ Paid</option>
                    <option value="unpaid">⚠️ Unpaid</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Admission Fee (PKR) <span className="text-slate-300 font-normal">(optional)</span></label>
                  <input name="admissionFee" type="number" min="0" value={form.admissionFee} onChange={handleChange} placeholder="One-time joining fee" />
                </div>
              </div>
            </ModalSection>

            <ModalSection label="Membership Period">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label>Start Date</label>
                  <input name="startDate" type="date" value={form.startDate} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input name="endDate" type="date" value={form.endDate} onChange={handleChange} />
                </div>
              </div>
            </ModalSection>

            <div className="form-group">
              <label>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
              <input name="notes" value={form.notes} onChange={handleChange} placeholder="Any additional notes..." />
            </div>
          </ModalBody>

          <ModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : editTarget ? 'Update Customer' : 'Add Customer'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal show={!!deleteTarget} onClose={() => setDeleteTarget(null)} size="sm">
        <ModalHeader
          icon="🗑️"
          title="Delete Customer"
          subtitle="This cannot be undone"
          onClose={() => setDeleteTarget(null)}
        />
        <ModalBody>
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteTarget?.name}</span>?
            All their membership data will be permanently removed.
          </p>
        </ModalBody>
        <ModalFooter>
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete Customer</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
