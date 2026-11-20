// Local-time date helpers. Dates are stored as 'YYYY-MM-DD' strings.

const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// Adds months while clamping to the last day of the target month (Jan 31 + 1m → Feb 28/29).
export function addMonths(iso, n) {
  const d = parseISO(iso);
  if (!d) return '';
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

// Inclusive difference in whole days (b - a).
export function diffDays(aIso, bIso) {
  const a = parseISO(aIso), b = parseISO(bIso);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

export function fmtDate(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function monthKey(iso) {
  return iso ? String(iso).slice(0, 7) : '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

// Last n month keys ending with the current month, oldest first.
export function lastMonths(n) {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return out;
}

// Named ranges used by report filters. Returns { from, to } ISO (inclusive) or nulls for all-time.
export function rangeFor(preset) {
  const now = new Date();
  const today = toISO(now);
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'week': {
      const d = new Date(now);
      const dow = (d.getDay() + 6) % 7; // Monday start
      d.setDate(d.getDate() - dow);
      return { from: toISO(d), to: today };
    }
    case 'month': return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'lastMonth': return {
      from: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toISO(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: today };
    default: return { from: null, to: null };
  }
}

export function inRange(iso, from, to) {
  if (!iso) return !from && !to;
  const d = String(iso).slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
