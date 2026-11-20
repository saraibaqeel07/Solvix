// Gym data layer: members ("customers"), packages and the payments ledger.
//
// Firestore layout (all under tenants/{uid}):
//   customers/{id}  – member profile + current membership period
//   packages/{id}   – custom packages (name, price, duration, admission fee)
//   payments/{id}   – every money movement: admission fee, membership fee, renewal
//
// Revenue is always computed from `payments`, so admission fees are counted and
// collected revenue never disappears when a membership later expires.

import {
  collection, getDocs, addDoc, doc, writeBatch, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { addDays, addMonths, diffDays, todayISO } from './dates';

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card', 'JazzCash', 'EasyPaisa'];
export const PAYMENT_TYPES = {
  admission:  { label: 'Admission Fee',  badge: 'badge-confirmed', color: '#ab9cf3' },
  membership: { label: 'Membership Fee', badge: 'badge-paid',      color: '#6cc9a0' },
  renewal:    { label: 'Renewal',        badge: 'badge-info',      color: '#80b4ef' },
};
// A payment is shown as Package (member on a saved package) or Monthly (custom plan).
// The admission fee is a one-time charge, not a type of its own: it is counted inside that row.
export const PAY_KINDS = {
  package: { label: 'Package', badge: 'badge-confirmed', color: '#ab9cf3' },
  monthly: { label: 'Monthly', badge: 'badge-paid',      color: '#6cc9a0' },
};
export const payKind = (p) => (p.packageId ? 'package' : 'monthly');

// Merges the admission fee and plan fee a member paid on the same day into one row.
export function groupPayments(payments) {
  const map = new Map();
  for (const p of payments) {
    const key = `${p.customerId}|${p.date}`;
    let row = map.get(key);
    if (!row) {
      row = { id: p.id, customerId: p.customerId, date: p.date, customerName: p.customerName, phone: p.phone,
        packageId: p.packageId, packageName: p.packageName, periodStart: p.periodStart, periodEnd: p.periodEnd,
        method: p.method || 'Cash', fee: 0, admission: 0, total: 0 };
      map.set(key, row);
    }
    if (p.type === 'admission') row.admission += num(p.amount);
    else {
      row.fee += num(p.amount);
      // the plan payment decides the type / package shown for the row
      Object.assign(row, { packageId: p.packageId, packageName: p.packageName, periodStart: p.periodStart, periodEnd: p.periodEnd, method: p.method || row.method });
    }
    row.total += num(p.amount);
  }
  return [...map.values()].map((r) => ({ ...r, kind: payKind(r) }));
}
export const EXPIRING_DAYS = 7;

export const fmtPKR = (n) => `PKR ${Number(n || 0).toLocaleString()}`;
export const num = (v) => Number(v) || 0;

const col = (uid, name) => collection(db, 'tenants', uid, name);
const ref = (uid, name, id) => doc(db, 'tenants', uid, name, id);

// ── Packages ──────────────────────────────────────────────────────────────────

export const DURATION_UNITS = { days: 'Day', months: 'Month', years: 'Year' };

export function durationLabel(value, unit) {
  const v = num(value) || 1;
  const word = DURATION_UNITS[unit] || 'Month';
  return `${v} ${word}${v === 1 ? '' : 's'}`;
}

// Membership end date (inclusive): 1 month from 01 Jan → 31 Jan.
export function computeEndDate(startISO, value, unit) {
  if (!startISO) return '';
  const v = num(value) || 1;
  let end;
  if (unit === 'days') end = addDays(startISO, v);
  else if (unit === 'years') end = addMonths(startISO, v * 12);
  else end = addMonths(startISO, v);
  return addDays(end, -1);
}

export const savePackage = (uid, id, data) =>
  id ? updateDoc(ref(uid, 'packages', id), { ...data, updatedAt: Date.now() })
     : addDoc(col(uid, 'packages'), { ...data, createdAt: Date.now(), updatedAt: Date.now() });

export const deletePackage = (uid, id) => deleteDoc(ref(uid, 'packages', id));

// ── Member status ─────────────────────────────────────────────────────────────

// state: active | expiring | expired | none
export function memberState(c, today = todayISO()) {
  if (!c.endDate) return { state: 'none', daysLeft: null };
  const daysLeft = diffDays(today, c.endDate);
  if (daysLeft < 0) return { state: 'expired', daysLeft };
  if (daysLeft <= EXPIRING_DAYS) return { state: 'expiring', daysLeft };
  return { state: 'active', daysLeft };
}

export const STATE_META = {
  active:   { label: 'Active',   badge: 'badge-active' },
  expiring: { label: 'Expiring', badge: 'badge-expiring' },
  expired:  { label: 'Expired',  badge: 'badge-expired' },
  none:     { label: 'No plan',  badge: 'badge-cancelled' },
};

// Money a member still owes right now.
export function memberDues(c) {
  const membership = c.status === 'unpaid' ? num(c.amount) : 0;
  const admission = num(c.admissionFee) > 0 && !c.admissionPaid ? num(c.admissionFee) : 0;
  return { membership, admission, total: membership + admission };
}

// ── Payments ──────────────────────────────────────────────────────────────────

function paymentDoc(member, type, amount, extra = {}) {
  return {
    customerId: member.id,
    customerName: member.name || '',
    phone: member.phone || '',
    type,
    amount: num(amount),
    packageId: member.packageId || '',
    packageName: member.membershipType || '',
    periodStart: member.startDate || '',
    periodEnd: member.endDate || '',
    date: todayISO(),
    method: 'Cash',
    note: '',
    createdAt: Date.now(),
    ...extra,
  };
}

export const addPayment = (uid, member, type, amount, extra) =>
  addDoc(col(uid, 'payments'), paymentDoc(member, type, amount, extra));

export const deletePayment = (uid, id) => deleteDoc(ref(uid, 'payments', id));

// ── Member writes ─────────────────────────────────────────────────────────────

// Creates a member and records whatever was paid at signup.
export async function createMember(uid, data, { method = 'Cash', date } = {}) {
  const payDate = date || data.admissionDate || todayISO();
  const docRef = await addDoc(col(uid, 'customers'), { ...data, ledger: true, createdAt: Date.now(), updatedAt: Date.now() });
  const member = { id: docRef.id, ...data };
  const batch = writeBatch(db);
  if (num(data.admissionFee) > 0 && data.admissionPaid) {
    batch.set(doc(col(uid, 'payments')), paymentDoc(member, 'admission', data.admissionFee, { method, date: payDate }));
  }
  if (num(data.amount) > 0 && data.status === 'paid') {
    batch.set(doc(col(uid, 'payments')), paymentDoc(member, 'membership', data.amount, { method, date: payDate }));
  }
  await batch.commit();
  return docRef.id;
}

// Updates a member; status changes from unpaid → paid are recorded as payments.
export async function updateMember(uid, prev, data, { method = 'Cash' } = {}) {
  const member = { ...prev, ...data };
  const batch = writeBatch(db);
  batch.update(ref(uid, 'customers', prev.id), { ...data, ledger: true, updatedAt: Date.now() });
  if (num(data.admissionFee) > 0 && data.admissionPaid && !prev.admissionPaid) {
    batch.set(doc(col(uid, 'payments')), paymentDoc(member, 'admission', data.admissionFee, { method }));
  }
  if (num(data.amount) > 0 && data.status === 'paid' && prev.status !== 'paid') {
    batch.set(doc(col(uid, 'payments')), paymentDoc(member, 'membership', data.amount, { method }));
  }
  await batch.commit();
}

// Starts a new membership period for an existing member.
export async function renewMember(uid, member, { packageId, packageName, startDate, endDate, amount, paid, method, date }) {
  const data = {
    packageId: packageId || '',
    membershipType: packageName,
    startDate, endDate,
    amount: num(amount),
    status: paid ? 'paid' : 'unpaid',
    renewals: num(member.renewals) + 1,
    lastRenewedAt: todayISO(),
  };
  const batch = writeBatch(db);
  batch.update(ref(uid, 'customers', member.id), { ...data, ledger: true, updatedAt: Date.now() });
  if (paid && num(amount) > 0) {
    batch.set(doc(col(uid, 'payments')), paymentDoc({ ...member, ...data }, 'renewal', amount, { method, date: date || todayISO() }));
  }
  await batch.commit();
}

// Collects outstanding membership and/or admission dues.
export async function collectDues(uid, member, { membership, admission, method, date }) {
  const batch = writeBatch(db);
  const patch = {};
  if (membership && num(member.amount) > 0) {
    patch.status = 'paid';
    batch.set(doc(col(uid, 'payments')), paymentDoc(member, 'membership', member.amount, { method, date }));
  }
  if (admission && num(member.admissionFee) > 0) {
    patch.admissionPaid = true;
    batch.set(doc(col(uid, 'payments')), paymentDoc(member, 'admission', member.admissionFee, { method, date }));
  }
  batch.update(ref(uid, 'customers', member.id), { ...patch, ledger: true, updatedAt: Date.now() });
  await batch.commit();
}

export const deleteMember = (uid, id) => deleteDoc(ref(uid, 'customers', id));

// ── Loading + one-time migration of older records ─────────────────────────────

// Members created before the payments ledger existed stored money only on the
// member doc. Convert them once into payment entries (deterministic ids make
// this safe to run more than once) so reports count their admission fees too.
async function migrateLegacy(uid, customers) {
  const legacy = customers.filter((c) => !c.ledger);
  if (!legacy.length) return false;
  const batch = writeBatch(db);
  for (const c of legacy) {
    const paid = c.status === 'paid';
    const base = { ...c, membershipType: c.membershipType || '' };
    if (paid && num(c.admissionFee) > 0) {
      batch.set(ref(uid, 'payments', `legacy_${c.id}_adm`),
        paymentDoc(base, 'admission', c.admissionFee, { date: c.admissionDate || c.startDate || todayISO(), note: 'Imported' }));
    }
    if (paid && num(c.amount) > 0) {
      batch.set(ref(uid, 'payments', `legacy_${c.id}_mem`),
        paymentDoc(base, 'membership', c.amount, { date: c.startDate || c.admissionDate || todayISO(), note: 'Imported' }));
    }
    batch.update(ref(uid, 'customers', c.id), { ledger: true, admissionPaid: paid && num(c.admissionFee) > 0 });
  }
  await batch.commit();
  return true;
}

export async function loadGymData(uid) {
  const [cSnap, pSnap, paySnap] = await Promise.all([
    getDocs(col(uid, 'customers')),
    getDocs(col(uid, 'packages')),
    getDocs(col(uid, 'payments')),
  ]);
  let customers = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  let payments = paySnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  try {
    if (await migrateLegacy(uid, customers)) {
      const [c2, p2] = await Promise.all([getDocs(col(uid, 'customers')), getDocs(col(uid, 'payments'))]);
      customers = c2.docs.map((d) => ({ id: d.id, ...d.data() }));
      payments = p2.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.error('Legacy migration failed:', err);
  }

  const packages = pSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  payments.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

  return { customers, packages, payments };
}
