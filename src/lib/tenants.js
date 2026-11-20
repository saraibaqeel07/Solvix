// Tenant subscription / demo access.
//
// Stored on tenants/{uid}:
//   status:      'demo' | 'active' | 'suspended'   (missing → 'active', for tenants created before this existed)
//   accessUntil: 'YYYY-MM-DD' | ''                  last day the tenant can use the app ('' = no end date)
//
// Once accessUntil has passed, the tenant is locked out and shows as "Dues unpaid" to the CEO.

import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { todayISO, addDays, addMonths, diffDays } from './dates';

// Who tenants contact about demos, payments and suspensions.
export const SUPPORT = {
  phone: '03052674578',
  whatsapp: '923052674578', // international format for wa.me links
  email: 'saraibaqeel07@gmail.com',
};

export const TENANT_STATUSES = {
  demo:      { label: 'Demo',      badge: 'badge-info' },
  active:    { label: 'Paid',      badge: 'badge-paid' },
  suspended: { label: 'Suspended', badge: 'badge-cancelled' },
};

export const DEMO_PRESETS = [
  { label: '3 days',  days: 3 },
  { label: '7 days',  days: 7 },
  { label: '14 days', days: 14 },
  { label: '1 month', months: 1 },
];

export const PAID_PRESETS = [
  { label: '1 month',  months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year',   months: 12 },
];

export const SOON_DAYS = 3;

// Last usable day for a preset counted from today (today counts as day 1).
export function presetUntil(p, from = todayISO()) {
  return p.days ? addDays(from, p.days - 1) : addDays(addMonths(from, p.months), -1);
}

// state: 'demo' | 'active' | 'unpaid' | 'suspended'
//   unpaid  → demo or paid period ended; tenant is locked out
export function tenantAccess(t, today = todayISO()) {
  const status = t?.status || 'active';
  const until = t?.accessUntil || '';
  const daysLeft = until ? diffDays(today, until) + 1 : null; // includes today; ≤ 0 means ended

  if (status === 'suspended') return { state: 'suspended', status, until, daysLeft, locked: true };
  if (until && daysLeft <= 0) return { state: 'unpaid', status, until, daysLeft, locked: true };
  return {
    state: status,
    status,
    until,
    daysLeft,
    locked: false,
    endingSoon: daysLeft !== null && daysLeft <= SOON_DAYS,
  };
}

export const ACCESS_META = {
  demo:      { label: 'Demo',         badge: 'badge-info' },
  active:    { label: 'Paid',         badge: 'badge-paid' },
  unpaid:    { label: 'Dues unpaid',  badge: 'badge-unpaid' },
  suspended: { label: 'Suspended',    badge: 'badge-cancelled' },
};

export function daysLeftText(a) {
  if (a.daysLeft === null) return 'No end date';
  if (a.daysLeft <= 0) return `Ended ${-a.daysLeft + 1} day${-a.daysLeft + 1 === 1 ? '' : 's'} ago`;
  if (a.daysLeft === 1) return 'Last day today';
  return `${a.daysLeft} days left`;
}

// ── Billing (what tenants owe the platform) ─────────────────────────────────
//   tenants/{uid}.monthlyFee  – agreed price per month
//   billing/{id}              – one doc per payment received from a tenant
//       { tenantId, tenantName, amount, months, method, date, note, fromDate, toDate, createdAt }


export const BILLING_METHODS = ['Cash', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Card', 'Cheque'];
export const fmtPKR = (n) => `PKR ${Number(n || 0).toLocaleString()}`;
const num = (v) => Number(v) || 0;

// Amount owed right now. Only tenants whose demo/paid period has ended owe money:
//   ended demo   → first month's fee
//   ended paid   → fee × every month started since the paid period ended
export function tenantDues(t, today = todayISO()) {
  const fee = num(t?.monthlyFee);
  const until = t?.accessUntil;
  if (!until || until >= today) return { months: 0, amount: 0 };
  if ((t.status || 'active') === 'demo') return { months: 1, amount: fee };
  const start = addDays(until, 1);
  let months = 0;
  while (months < 240 && addMonths(start, months) <= today) months++;
  return { months, amount: fee * months };
}

// The period a new payment of `months` covers. Paid tenants continue from where
// they left off (so back-dues get covered first); demo/new tenants start today.
export function nextPeriod(t, months, today = todayISO()) {
  const continuing = (t?.status || 'active') !== 'demo' && t?.accessUntil;
  const from = continuing ? addDays(t.accessUntil, 1) : today;
  return { from, to: addDays(addMonths(from, months), -1) };
}

export async function loadBilling() {
  const snap = await getDocs(collection(db, 'billing'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
}

export async function recordTenantPayment(t, { months, amount, method, date, note }) {
  const { from, to } = nextPeriod(t, months);
  await addDoc(collection(db, 'billing'), {
    tenantId: t.id,
    tenantName: t.name || '',
    tenantRole: t.role || '',
    amount: num(amount),
    months: num(months),
    method: method || 'Cash',
    date: date || todayISO(),
    note: note || '',
    fromDate: from,
    toDate: to,
    createdAt: Date.now(),
  });
  await updateDoc(doc(db, 'tenants', t.id), { status: 'active', accessUntil: to, updatedAt: Date.now() });
  return { from, to };
}
