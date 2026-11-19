import { useState, useMemo } from 'react';

function ChevronUpDown() {
  return (
    <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
    </svg>
  );
}
function ChevronUp() {
  return (
    <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
    </svg>
  );
}

export default function Table({ columns, data, pageOptions = [10, 25, 50], defaultPageSize = 10, onClick }) {
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(defaultPageSize);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        if (col.orderable === false) return false;
        const val = col.data ? row[col.data] : '';
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * perPage;
  const paginated  = sorted.slice(start, start + perPage);

  const handleSort = (col) => {
    if (col.orderable === false || !col.data) return;
    if (sortKey === col.data) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col.data); setSortDir('asc'); }
    setPage(1);
  };

  const pageNums = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const arr = [1];
    if (safePage > 3) arr.push('…');
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) arr.push(i);
    if (safePage < totalPages - 2) arr.push('…');
    arr.push(totalPages);
    return arr;
  };

  const getCellValue = (col, row) => {
    const raw = col.data ? row[col.data] : null;
    if (col.render) return col.render(raw, null, row);
    return raw ?? col.defaultContent ?? '—';
  };

  return (
    <div className="flex flex-col" onClick={onClick}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4">
        {/* Entries selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Show</span>
          <select
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all cursor-pointer appearance-none pr-6"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
          >
            {pageOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-xs font-medium text-slate-400">entries</span>
        </div>

        {/* Search */}
        <div className="relative">
          <SearchIcon />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 w-48 focus:w-64 font-normal"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(col)}
                  className={`px-5 py-3.5 text-left bg-slate-50 border-y border-slate-100 whitespace-nowrap select-none ${col.orderable !== false && col.data ? 'cursor-pointer group' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">
                      {col.title}
                    </span>
                    {col.orderable !== false && col.data && (
                      <span>
                        {sortKey === col.data
                          ? sortDir === 'asc' ? <ChevronUp /> : <ChevronDown />
                          : <ChevronUpDown />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center">
                  <p className="text-slate-400 text-sm font-medium">
                    {search ? `No results for "${search}"` : 'No data available'}
                  </p>
                </td>
              </tr>
            ) : (
              paginated.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  {columns.map((col, ci) => {
                    const val = getCellValue(col, row);
                    const isHtml = typeof val === 'string' && val.includes('<');
                    return (
                      <td key={ci} className="px-5 py-3.5 text-slate-700 whitespace-nowrap align-middle">
                        {isHtml
                          ? <span dangerouslySetInnerHTML={{ __html: val }} />
                          : <span>{val}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50">
        <p className="text-xs text-slate-400 font-medium">
          {sorted.length === 0
            ? 'No entries found'
            : `Showing ${start + 1}–${Math.min(start + perPage, sorted.length)} of ${sorted.length} entries`}
          {search && data.length !== sorted.length && (
            <span className="text-slate-300"> (filtered from {data.length})</span>
          )}
        </p>

        {/* Pagination */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all text-xs font-bold"
          >«</button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all text-sm font-semibold"
          >‹</button>

          {pageNums().map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-slate-300 text-xs">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all duration-150 ${
                  safePage === p
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >{p}</button>
            )
          )}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all text-sm font-semibold"
          >›</button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all text-xs font-bold"
          >»</button>
        </div>
      </div>
    </div>
  );
}
