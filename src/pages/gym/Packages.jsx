import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalSection } from '../../components/Modal';
import { StatTile, EmptyState, Spinner } from '../../components/ui';
import {
  loadGymData, savePackage, deletePackage, durationLabel, memberState, fmtPKR, num, DURATION_UNITS,
} from '../../lib/gym';

const TONES = ['lavender', 'mint', 'peach', 'powder', 'blush', 'butter'];
const TONE_CLASS = {
  lavender: 'from-lavender-50 to-lavender-100 ring-lavender-200 text-lavender-800',
  mint:     'from-mint-50 to-mint-100 ring-mint-200 text-mint-800',
  peach:    'from-peach-50 to-peach-100 ring-peach-200 text-peach-800',
  powder:   'from-powder-50 to-powder-100 ring-powder-200 text-powder-800',
  blush:    'from-blush-50 to-blush-100 ring-blush-200 text-blush-800',
  butter:   'from-butter-50 to-butter-100 ring-butter-200 text-butter-800',
};

const PRESETS = [
  { label: '1 Day',    durationValue: 1,  durationUnit: 'days' },
  { label: '1 Month',  durationValue: 1,  durationUnit: 'months' },
  { label: '3 Months', durationValue: 3,  durationUnit: 'months' },
  { label: '6 Months', durationValue: 6,  durationUnit: 'months' },
  { label: '1 Year',   durationValue: 1,  durationUnit: 'years' },
];

// Ready-made tiers a gym can add in one click (prices are a starting point — editable).
const STARTER_PACKAGES = [
  {
    name: 'Basic', icon: '🌱', price: 3000, durationValue: 1, durationUnit: 'months', admissionFee: 1000,
    description: 'Gym floor access · weights & cardio', tone: 'mint',
  },
  {
    name: 'Standard', icon: '⭐', price: 8000, durationValue: 3, durationUnit: 'months', admissionFee: 1000,
    description: 'Gym + group classes · saves vs. monthly', tone: 'lavender',
  },
  {
    name: 'Premium', icon: '👑', price: 30000, durationValue: 1, durationUnit: 'years', admissionFee: 0,
    description: 'Full year · all facilities · admission fee waived', tone: 'peach',
  },
];

const EMPTY = {
  name: '', price: '', durationValue: 1, durationUnit: 'months',
  admissionFee: '', description: '', tone: 'lavender', active: true,
};

export default function Packages() {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const [data, setData] = useState({ customers: [], packages: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const refresh = () => loadGymData(uid)
    .then(setData)
    .catch((e) => { console.error(e); toast.error('Failed to load packages'); })
    .finally(() => setLoading(false));

  useEffect(() => { if (uid) refresh(); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const map = {};
    data.packages.forEach((p) => { map[p.id] = { members: 0, active: 0, revenue: 0 }; });
    data.customers.forEach((c) => {
      const s = map[c.packageId];
      if (!s) return;
      s.members += 1;
      if (['active', 'expiring'].includes(memberState(c).state)) s.active += 1;
    });
    data.payments.forEach((p) => {
      if (map[p.packageId] && p.type !== 'admission') map[p.packageId].revenue += num(p.amount);
    });
    return map;
  }, [data]);

  const openAdd = () => { setEditId(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (p) => { setEditId(p.id); setForm({ ...EMPTY, ...p }); setShowModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Package name is required'); return; }
    if (num(form.price) <= 0) { toast.error('Enter a package price'); return; }
    if (num(form.durationValue) <= 0) { toast.error('Enter a valid duration'); return; }
    setSaving(true);
    try {
      await savePackage(uid, editId, {
        name: form.name.trim(),
        price: num(form.price),
        durationValue: num(form.durationValue),
        durationUnit: form.durationUnit,
        admissionFee: num(form.admissionFee),
        description: form.description.trim(),
        tone: form.tone,
        active: !!form.active,
      });
      toast.success(editId ? 'Package updated' : 'Package created');
      setShowModal(false);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const existingNames = new Set(data.packages.map((p) => p.name.trim().toLowerCase()));
  const missingStarters = STARTER_PACKAGES.filter((t) => !existingNames.has(t.name.toLowerCase()));

  const starterData = (t) => ({
    name: t.name, price: t.price, durationValue: t.durationValue, durationUnit: t.durationUnit,
    admissionFee: t.admissionFee, description: t.description, tone: t.tone, active: true,
  });

  // Open the form pre-filled so the owner can tweak the price before saving.
  const customizeStarter = (t) => { setEditId(null); setForm({ ...EMPTY, ...starterData(t) }); setShowModal(true); };

  const addStarters = async (list) => {
    setSaving(true);
    try {
      for (const t of list) await savePackage(uid, null, starterData(t));
      toast.success(list.length === 1 ? `${list[0].name} package added` : `${list.length} packages added`);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add packages');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p) => {
    try {
      await savePackage(uid, p.id, { active: !p.active });
      toast.success(p.active === false ? 'Package activated' : 'Package deactivated');
      refresh();
    } catch { toast.error('Failed to update package'); }
  };

  const handleDelete = async () => {
    try {
      await deletePackage(uid, deleteTarget.id);
      toast.success('Package deleted');
      setDeleteTarget(null);
      refresh();
    } catch { toast.error('Failed to delete package'); }
  };

  const activeCount = data.packages.filter((p) => p.active !== false).length;
  const enrolled = Object.values(stats).reduce((s, x) => s + x.active, 0);
  const bestSeller = [...data.packages].sort((a, b) => (stats[b.id]?.members || 0) - (stats[a.id]?.members || 0))[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Packages</h2>
          <p className="page-subtitle">Create custom membership plans — e.g. PKR 5,000 for 3 months, or a yearly plan</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ New Package</button>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatTile label="Active Packages" value={activeCount} sub={`${data.packages.length} total`} icon="🎁" tone="lavender" />
            <StatTile label="Members Enrolled" value={enrolled} sub="on a running package" icon="👥" tone="mint" />
            <StatTile label="Most Popular" value={bestSeller && stats[bestSeller.id]?.members ? bestSeller.name : '—'}
              sub={bestSeller && stats[bestSeller.id]?.members ? `${stats[bestSeller.id].members} members` : 'No sign-ups yet'} icon="⭐" tone="peach" />
          </div>

          {missingStarters.length > 0 && (
            <div className="card mb-6">
              <div className="card-header">
                <div>
                  <p className="card-title">✨ Quick start: Basic · Standard · Premium</p>
                  <p className="text-xs text-slate-400 mt-0.5">Add ready-made tiers in one click, or customise the price first.</p>
                </div>
                {missingStarters.length > 1 && (
                  <button className="btn-primary btn-sm" disabled={saving} onClick={() => addStarters(missingStarters)}>
                    {saving ? 'Adding…' : `+ Add all ${missingStarters.length}`}
                  </button>
                )}
              </div>
              <div className="card-body grid grid-cols-1 sm:grid-cols-3 gap-3">
                {missingStarters.map((t) => (
                  <div key={t.name} className={`rounded-2xl ring-1 bg-gradient-to-br p-4 flex flex-col ${TONE_CLASS[t.tone]}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{t.icon}</span>
                      <p className="font-bold text-base">{t.name}</p>
                      <span className="ml-auto text-xs font-semibold opacity-80">{durationLabel(t.durationValue, t.durationUnit)}</span>
                    </div>
                    <p className="text-2xl font-extrabold mt-3">{fmtPKR(t.price)}</p>
                    <p className="text-xs opacity-80 mt-0.5">{t.admissionFee ? `+ ${fmtPKR(t.admissionFee)} admission fee` : 'No admission fee'}</p>
                    <p className="text-xs text-slate-600 mt-2 flex-1">{t.description}</p>
                    <div className="flex gap-1.5 mt-3">
                      <button className="btn-secondary btn-sm flex-1" onClick={() => customizeStarter(t)}>Customise</button>
                      <button className="btn-primary btn-sm flex-1" disabled={saving} onClick={() => addStarters([t])}>+ Add</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.packages.length === 0 ? (
            <div className="card">
              <EmptyState icon="🎁" title="No packages yet" hint="Add the Basic / Standard / Premium tiers above, or create your own package." />
              <div className="flex justify-center pb-10"><button className="btn-primary" onClick={openAdd}>+ Create Package</button></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.packages.map((p) => {
                const s = stats[p.id] || { members: 0, active: 0, revenue: 0 };
                const tone = TONE_CLASS[p.tone] || TONE_CLASS.lavender;
                const inactive = p.active === false;
                return (
                  <div key={p.id} className={`rounded-2xl ring-1 bg-gradient-to-br p-5 flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover ${tone} ${inactive ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-lg leading-tight truncate">{p.name}</p>
                        <p className="text-xs font-semibold opacity-80 mt-0.5">{durationLabel(p.durationValue, p.durationUnit)}</p>
                      </div>
                      <span className={`badge ${inactive ? 'badge-cancelled' : 'bg-white/70 ring-1 ring-white'}`}>{inactive ? 'Inactive' : 'Active'}</span>
                    </div>

                    <p className="text-3xl font-extrabold mt-4">{fmtPKR(p.price)}</p>
                    <p className="text-xs opacity-80 mt-1">
                      {num(p.admissionFee) > 0 ? `+ ${fmtPKR(p.admissionFee)} admission fee` : 'No admission fee'}
                    </p>
                    {p.description && <p className="text-xs text-slate-600 mt-3 line-clamp-2">{p.description}</p>}

                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div className="bg-white/70 rounded-xl py-2"><p className="text-sm font-bold text-slate-800">{s.active}</p><p className="text-[10px] text-slate-500">Active</p></div>
                      <div className="bg-white/70 rounded-xl py-2"><p className="text-sm font-bold text-slate-800">{s.members}</p><p className="text-[10px] text-slate-500">All-time</p></div>
                      <div className="bg-white/70 rounded-xl py-2"><p className="text-sm font-bold text-slate-800">{s.revenue >= 1000 ? `${Math.round(s.revenue / 1000)}k` : s.revenue}</p><p className="text-[10px] text-slate-500">Revenue</p></div>
                    </div>

                    <div className="flex gap-1.5 mt-4 pt-4 border-t border-white/70">
                      <button className="btn-secondary btn-sm flex-1" onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn-secondary btn-sm flex-1" onClick={() => toggleActive(p)} title={inactive ? 'Make this the default choice again' : 'Move to the inactive group in the member form'}>{inactive ? 'Activate' : 'Deactivate'}</button>
                      <button className="btn-sm btn bg-white text-blush-700 hover:bg-blush-50 border border-blush-100" onClick={() => setDeleteTarget(p)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader icon={editId ? '✏️' : '🎁'} title={editId ? 'Edit Package' : 'New Package'}
          subtitle="Set the price and how long the membership lasts" onClose={() => setShowModal(false)} />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <ModalSection label="Package">
              <div className="form-group">
                <label>Package Name <span className="text-blush-400">*</span></label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Quarterly Saver" required />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="form-group">
                  <label>Price (PKR) <span className="text-blush-400">*</span></label>
                  <input type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="5000" required />
                </div>
                <div className="form-group">
                  <label>Admission Fee (PKR)</label>
                  <input type="number" min="0" value={form.admissionFee} onChange={(e) => set('admissionFee', e.target.value)} placeholder="Optional, one-time" />
                </div>
              </div>
            </ModalSection>

            <ModalSection label="Duration">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PRESETS.map((pr) => {
                  const on = num(form.durationValue) === pr.durationValue && form.durationUnit === pr.durationUnit;
                  return (
                    <button type="button" key={pr.label} className={on ? 'chip-on' : 'chip-off'}
                      onClick={() => setForm((f) => ({ ...f, durationValue: pr.durationValue, durationUnit: pr.durationUnit }))}>
                      {pr.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label>Length</label>
                  <input type="number" min="1" value={form.durationValue} onChange={(e) => set('durationValue', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select value={form.durationUnit} onChange={(e) => set('durationUnit', e.target.value)}>
                    {Object.entries(DURATION_UNITS).map(([k, v]) => <option key={k} value={k}>{v}s</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Members on this package get <span className="font-semibold text-slate-700">{durationLabel(form.durationValue, form.durationUnit)}</span> for <span className="font-semibold text-slate-700">{fmtPKR(form.price)}</span>.
              </p>
            </ModalSection>

            <ModalSection label="Display" optional>
              <div className="form-group">
                <label>Description</label>
                <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Includes cardio + weights, 6am–11pm" />
              </div>
              <div className="flex items-center gap-2 mt-3">
                {TONES.map((t) => (
                  <button type="button" key={t} onClick={() => set('tone', t)}
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ring-2 ${TONE_CLASS[t]} ${form.tone === t ? 'ring-slate-500 scale-110' : 'ring-transparent'} transition-all`}
                    aria-label={t} />
                ))}
                <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)} className="accent-lavender-500 w-4 h-4" />
                  Active
                </label>
              </div>
            </ModalSection>
          </ModalBody>
          <ModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Package' : 'Create Package'}</button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal show={!!deleteTarget} onClose={() => setDeleteTarget(null)} size="sm">
        <ModalHeader icon="🗑️" title="Delete Package" subtitle="Members keep their current plan" onClose={() => setDeleteTarget(null)} />
        <ModalBody>
          <p className="text-sm text-slate-600 leading-relaxed">
            Delete <span className="font-semibold text-slate-900">{deleteTarget?.name}</span>? Existing members and payment history are not affected.
            {stats[deleteTarget?.id]?.active > 0 && <> It is in use by <b>{stats[deleteTarget.id].active}</b> active member(s) — consider <b>Deactivate</b> instead.</>}
          </p>
        </ModalBody>
        <ModalFooter>
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
