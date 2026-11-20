import { useState } from 'react';
import { toast } from 'sonner';
import { Spinner } from '../../components/ui';
import { fmtPKR } from '../../lib/gym';
import { ALL_SLOTS, saveSettings, isActive } from '../../lib/bookings';
import useBookingData from './useBookingData';

const hourLabel = (h) => `${String(h % 24).padStart(2, '0')}:00`;

export default function BookingSettings({ sport }) {
  const { settings, bookings, loading, refresh, uid, cfg } = useBookingData(sport);
  if (loading || !settings) return <div className="page"><Spinner /></div>;
  return <SettingsForm key={settings.updatedAt || 'default'} settings={settings} bookings={bookings} refresh={refresh} uid={uid} cfg={cfg} />;
}

function SettingsForm({ settings, bookings, refresh, uid, cfg }) {
  const [form, setForm] = useState(() => ({ ...settings, courts: [...settings.courts] }));
  const [newCourt, setNewCourt] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inUse = (c) => bookings.some((b) => isActive(b) && b.court === c);

  const addCourt = () => {
    const name = newCourt.trim() || `${cfg.unit} ${form.courts.length + 1}`;
    if (form.courts.includes(name)) { toast.error('That name already exists'); return; }
    set('courts', [...form.courts, name]);
    setNewCourt('');
  };

  const removeCourt = (c) => {
    if (form.courts.length === 1) { toast.error(`Keep at least one ${cfg.unit.toLowerCase()}`); return; }
    if (inUse(c)) { toast.error(`${c} has bookings — cancel or move them first`); return; }
    set('courts', form.courts.filter((x) => x !== c));
  };

  const save = async () => {
    if (Number(form.closeHour) <= Number(form.openHour)) { toast.error('Closing time must be after opening time'); return; }
    if (Number(form.peakEnd) <= Number(form.peakStart)) { toast.error('Peak end must be after peak start'); return; }
    setSaving(true);
    try {
      await saveSettings(uid, {
        courts: form.courts,
        openHour: Number(form.openHour), closeHour: Number(form.closeHour),
        offPeakRate: Number(form.offPeakRate) || 0, peakRate: Number(form.peakRate) || 0,
        peakStart: Number(form.peakStart), peakEnd: Number(form.peakEnd),
        weekendPeak: !!form.weekendPeak,
      });
      toast.success('Settings saved');
      refresh();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save settings');
    } finally { setSaving(false); }
  };

  const hours = Array.from({ length: 25 }, (_, h) => h);

  return (
    <div className="page max-w-4xl">
      <div className="page-header">
        <div>
          <h2 className="page-title">{cfg.label} Settings</h2>
          <p className="page-subtitle">{cfg.unit}s, opening hours and hourly rates — prices on new bookings fill in automatically</p>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header"><p className="card-title">{cfg.icon} {cfg.unit}s</p><span className="text-xs text-slate-400">{form.courts.length} total</span></div>
          <div className="card-body space-y-2">
            {form.courts.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input" value={c} onChange={(e) => {
                  const v = e.target.value;
                  if (inUse(c)) { toast.error(`${c} has bookings — renaming would detach them`); return; }
                  setForm((f) => ({ ...f, courts: f.courts.map((x, j) => (j === i ? v : x)) }));
                }} />
                <button className="btn-sm btn bg-blush-50 text-blush-700 hover:bg-blush-100" onClick={() => removeCourt(c)} aria-label={`Remove ${c}`}>✕</button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <input className="input" placeholder={`${cfg.unit} ${form.courts.length + 1}`} value={newCourt} onChange={(e) => setNewCourt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCourt(); } }} />
              <button className="btn-soft btn-sm whitespace-nowrap" onClick={addCourt}>+ Add</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><p className="card-title">🕒 Opening hours</p></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group"><label>Opens</label>
                <select value={form.openHour} onChange={(e) => set('openHour', Number(e.target.value))}>{hours.slice(0, 24).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
              </div>
              <div className="form-group"><label>Closes</label>
                <select value={form.closeHour} onChange={(e) => set('closeHour', Number(e.target.value))}>{hours.slice(1).map((h) => <option key={h} value={h}>{h === 24 ? '24:00 (midnight)' : hourLabel(h)}</option>)}</select>
              </div>
            </div>
            <p className="text-xs text-slate-500">{ALL_SLOTS.filter((_, h) => h >= form.openHour && h < form.closeHour).length} one-hour slots per {cfg.unit.toLowerCase()} each day.</p>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="card-header"><p className="card-title">💰 Hourly rates (PKR)</p></div>
          <div className="card-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="form-group"><label>Off-peak rate / hour</label><input type="number" min="0" value={form.offPeakRate} onChange={(e) => set('offPeakRate', e.target.value)} placeholder="e.g. 3000" /></div>
              <div className="form-group"><label>Peak rate / hour</label><input type="number" min="0" value={form.peakRate} onChange={(e) => set('peakRate', e.target.value)} placeholder="e.g. 4500" /></div>
              <div className="form-group"><label>Peak starts</label>
                <select value={form.peakStart} onChange={(e) => set('peakStart', Number(e.target.value))}>{hours.slice(0, 24).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
              </div>
              <div className="form-group"><label>Peak ends</label>
                <select value={form.peakEnd} onChange={(e) => set('peakEnd', Number(e.target.value))}>{hours.slice(1).map((h) => <option key={h} value={h}>{h === 24 ? '24:00' : hourLabel(h)}</option>)}</select>
              </div>
            </div>
            <label className="flex items-center gap-2 mt-4 text-sm text-slate-600 cursor-pointer w-fit">
              <input type="checkbox" checked={!!form.weekendPeak} onChange={(e) => set('weekendPeak', e.target.checked)} className="accent-lavender-500 w-4 h-4" />
              Charge the peak rate all day on Saturday & Sunday
            </label>
            <div className="mt-4 rounded-xl bg-lavender-50 px-4 py-3 text-sm text-slate-600">
              Weekdays: <b>{fmtPKR(form.offPeakRate)}</b>/hr off-peak, <b>{fmtPKR(form.peakRate)}</b>/hr from {hourLabel(form.peakStart)} to {hourLabel(form.peakEnd)}.
              {form.weekendPeak && <> Weekends: <b>{fmtPKR(form.peakRate)}</b>/hr all day.</>}
              <span className="block text-xs text-slate-400 mt-1">You can still change the price on any individual booking.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
