// Report export helpers.
// columns: [{ header: 'Name', value: (row) => any, align?: 'right' }]

function cellText(col, row) {
  const v = col.value(row);
  return v === null || v === undefined ? '' : String(v);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// CSV with a UTF-8 BOM so Excel opens it with the right encoding.
export function exportCSV(name, columns, rows, totals) {
  const esc = (s) => /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [columns.map((c) => esc(c.header)).join(',')];
  rows.forEach((r) => lines.push(columns.map((c) => esc(cellText(c, r))).join(',')));
  if (totals) lines.push(columns.map((c) => esc(totals[c.header] !== undefined ? String(totals[c.header]) : '')).join(','));
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${name}_${stamp()}.csv`);
}

const escHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Opens a print-ready page; the browser's print dialog lets the user "Save as PDF".
export function exportPDF({ title, subtitle, columns, rows, summary = [], totals }) {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to export the PDF.'); return; }

  const head = columns.map((c) => `<th style="text-align:${c.align || 'left'}">${escHtml(c.header)}</th>`).join('');
  const body = rows.map((r) =>
    `<tr>${columns.map((c) => `<td style="text-align:${c.align || 'left'}">${escHtml(cellText(c, r))}</td>`).join('')}</tr>`
  ).join('');
  const foot = totals
    ? `<tfoot><tr>${columns.map((c) => `<td style="text-align:${c.align || 'left'}">${escHtml(totals[c.header] ?? '')}</td>`).join('')}</tr></tfoot>`
    : '';
  const tiles = summary.map((s) =>
    `<div class="tile"><div class="tv">${escHtml(s.value)}</div><div class="tl">${escHtml(s.label)}</div></div>`
  ).join('');

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Inter,system-ui,sans-serif;color:#334155;margin:32px}
  h1{font-size:20px;margin:0;color:#2f2860} .sub{color:#64748b;font-size:12px;margin:4px 0 20px}
  .tiles{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}
  .tile{background:#f6f4ff;border:1px solid #eeeaff;border-radius:10px;padding:10px 14px;min-width:140px}
  .tv{font-size:15px;font-weight:700;color:#2f2860} .tl{font-size:11px;color:#64748b;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f6f4ff;color:#4c3f8c;text-transform:uppercase;letter-spacing:.04em;font-size:10px;padding:8px;border-bottom:1px solid #ddd5fe}
  td{padding:7px 8px;border-bottom:1px solid #f1eefb}
  tfoot td{font-weight:700;background:#fbfaff;border-top:2px solid #ddd5fe}
  .foot{margin-top:16px;font-size:10px;color:#94a3b8}
  @media print{body{margin:12mm} .tile,th,tfoot td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
  <svg width="40" height="40" viewBox="0 0 64 64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b3a4f6"/><stop offset="1" stop-color="#f6a3b9"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#lg)"/><rect x="11" y="11" width="18" height="18" rx="5.5" fill="#fff" fill-opacity=".5"/><rect x="35" y="11" width="18" height="18" rx="5.5" fill="#fff" fill-opacity=".5"/><rect x="11" y="35" width="18" height="18" rx="5.5" fill="#fff" fill-opacity=".5"/><rect x="35" y="35" width="18" height="18" rx="5.5" fill="#fff"/><path d="M39.6 44.4l3.2 3.2 6.2-6.6" fill="none" stroke="#52b78b" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <h1>${escHtml(title)}</h1>
</div>
<div class="sub">${escHtml(subtitle || '')}</div>
${tiles ? `<div class="tiles">${tiles}</div>` : ''}
<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${columns.length}">No records</td></tr>`}</tbody>${foot}</table>
<div class="foot">Generated ${escHtml(new Date().toLocaleString())} · Slotify · ${rows.length} record${rows.length === 1 ? '' : 's'}</div>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
</body></html>`);
  win.document.close();
}
