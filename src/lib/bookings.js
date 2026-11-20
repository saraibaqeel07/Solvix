// Shared booking data layer for Padel and Indoor Cricket.
//
// Firestore (under tenants/{uid}):
//   bookings/{id}        – one slot on one court/pitch
//   settings/booking     – courts, opening hours and hourly rates
//
// Older bookings have no court / price fields; they are treated as being on the
// first court with no price set, so nothing breaks.

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { parseISO, todayISO } from './dates';

export const SPORTS = {
  padel: {
    key: 'padel', label: 'Padel', unit: 'Court', icon: '🎾', base: '/padel',
    accent: '#f5bf5c', accentSoft: '#fff1cc', tone: 'butter',
    header: 'from-butter-100 via-peach-50 to-lavender-50',
  },
  cricket: {
    key: 'cricket', label: 'Indoor Cricket', unit: 'Pitch', icon: '🏏', base: '/cricket',
    accent: '#f28aa2', accentSoft: '#ffe4ea', tone: 'blush',
    header: 'from-blush-100 via-peach-50 to-lavender-50',
  },
};

export const ALL_SLOTS = Array.from({ length: 24 }, (_, h) =>
  `${String(h).padStart(2, '0')}:00 - ${String((h + 1) % 24).padStart(2, '0')}:00`);

export const slotHour = (slot) => Number(String(slot || '').slice(0, 2)) || 0;

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card', 'JazzCash', 'EasyPaisa'];

export function defaultSettings(sport) {
  const unit = SPORTS[sport]?.unit || 'Court';
  return {
    courts: [`${unit} 1`],
    openHour: 6,
    closeHour: 23,          // last slot starts at closeHour - 1
    offPeakRate: 0,
    peakRate: 0,
    peakStart: 17,
    peakEnd: 23,
    weekendPeak: true,
  };
}

export async function loadBookingData(uid, sport) {
  const [bSnap, sSnap] = await Promise.all([
    getDocs(collection(db, 'tenants', uid, 'bookings')),
    getDoc(doc(db, 'tenants', uid, 'settings', 'booking')),
  ]);
  const settings = { ...defaultSettings(sport), ...(sSnap.exists() ? sSnap.data() : {}) };
  if (!settings.courts?.length) settings.courts = defaultSettings(sport).courts;
  const firstCourt = settings.courts[0];
  const bookings = bSnap.docs.map((d) => normalize({ id: d.id, ...d.data() }, firstCourt));
  bookings.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.timeSlot || '').localeCompare(b.timeSlot || ''));
  return { bookings, settings };
}

function normalize(b, firstCourt) {
  return {
    ...b,
    court: b.court || firstCourt,
    amount: Number(b.amount) || 0,
    paidAmount: Number(b.paidAmount) || 0,
    status: b.status || 'confirmed',
    hours: Math.max(1, Number(b.hours) || 1),
  };
}

export const saveSettings = (uid, settings) =>
  setDoc(doc(db, 'tenants', uid, 'settings', 'booking'), { ...settings, updatedAt: Date.now() });

export const openSlots = (settings) =>
  ALL_SLOTS.filter((s) => { const h = slotHour(s); return h >= settings.openHour && h < settings.closeHour; });

export function isPeak(settings, date, slot) {
  const h = slotHour(slot);
  const d = parseISO(date);
  const weekend = d && (d.getDay() === 0 || d.getDay() === 6);
  if (settings.weekendPeak && weekend) return true;
  return h >= settings.peakStart && h < settings.peakEnd;
}

export function rateFor(settings, date, slot) {
  return isPeak(settings, date, slot) ? Number(settings.peakRate) || 0 : Number(settings.offPeakRate) || 0;
}

export const balance = (b) => Math.max(0, (Number(b.amount) || 0) - (Number(b.paidAmount) || 0));

// paid | partial | unpaid | none (no price set) | cancelled
export function payState(b) {
  if (b.status === 'cancelled') return 'cancelled';
  if (!b.amount) return 'none';
  if (b.paidAmount >= b.amount) return 'paid';
  if (b.paidAmount > 0) return 'partial';
  return 'unpaid';
}

export const PAY_META = {
  paid:      { label: 'Paid',      badge: 'badge-paid' },
  partial:   { label: 'Advance',   badge: 'badge-expiring' },
  unpaid:    { label: 'Unpaid',    badge: 'badge-unpaid' },
  none:      { label: 'No price',  badge: 'badge-cancelled' },
  cancelled: { label: 'Cancelled', badge: 'badge-cancelled' },
};

export const isActive = (b) => b.status !== 'cancelled';

// Slots a booking occupies (multi-hour bookings span consecutive slots).
export function occupiedSlots(b) {
  const start = slotHour(b.timeSlot);
  return Array.from({ length: Math.max(1, Number(b.hours) || 1) }, (_, i) => ALL_SLOTS[(start + i) % 24]);
}

export function timeRange(b) {
  const start = slotHour(b.timeSlot);
  const end = (start + (Number(b.hours) || 1)) % 24;
  return `${String(start).padStart(2, '0')}:00 - ${String(end).padStart(2, '0')}:00`;
}

// True when any hour of the requested booking overlaps an existing active booking on the same court.
export function slotTaken(bookings, req, excludeId) {
  const want = new Set(occupiedSlots(req));
  return bookings.some((b) => isActive(b) && b.id !== excludeId && b.date === req.date && b.court === req.court
    && occupiedSlots(b).some((s) => want.has(s)));
}

export function priceFor(settings, date, timeSlot, hours = 1) {
  return occupiedSlots({ timeSlot, hours }).reduce((s, slot) => s + rateFor(settings, date, slot), 0);
}

export const isUpcoming = (b, today = todayISO()) => isActive(b) && b.date >= today;

// ── Writes ────────────────────────────────────────────────────────────────────

const bookingsCol = (uid) => collection(db, 'tenants', uid, 'bookings');

export function cleanBooking(form) {
  const amount = Number(form.amount) || 0;
  return {
    customerName: (form.customerName || '').trim(),
    phone: form.phone || '',
    date: form.date,
    timeSlot: form.timeSlot,
    court: form.court,
    hours: Math.max(1, Number(form.hours) || 1),
    notes: form.notes || '',
    amount,
    paidAmount: Math.min(Number(form.paidAmount) || 0, amount || Infinity),
    method: form.method || 'Cash',
    status: 'confirmed',
    updatedAt: Date.now(),
  };
}

export const createBooking = (uid, data) => addDoc(bookingsCol(uid), { ...data, createdAt: Date.now() });
export const updateBooking = (uid, id, data) => updateDoc(doc(db, 'tenants', uid, 'bookings', id), { ...data, updatedAt: Date.now() });
export const cancelBooking = (uid, id) => updateBooking(uid, id, { status: 'cancelled', cancelledAt: todayISO() });
export const collectBalance = (uid, b, method) =>
  updateBooking(uid, b.id, { paidAmount: Number(b.amount) || 0, method: method || b.method || 'Cash', paidAt: todayISO() });
