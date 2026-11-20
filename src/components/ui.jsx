// Small shared pastel UI pieces.

const TONES = {
  lavender: 'bg-lavender-50 ring-lavender-100 [&_.tile-icon]:bg-lavender-100 [&_.tile-icon]:text-lavender-700',
  mint:     'bg-mint-50 ring-mint-100 [&_.tile-icon]:bg-mint-100 [&_.tile-icon]:text-mint-700',
  peach:    'bg-peach-50 ring-peach-100 [&_.tile-icon]:bg-peach-100 [&_.tile-icon]:text-peach-700',
  blush:    'bg-blush-50 ring-blush-100 [&_.tile-icon]:bg-blush-100 [&_.tile-icon]:text-blush-700',
  butter:   'bg-butter-50 ring-butter-100 [&_.tile-icon]:bg-butter-100 [&_.tile-icon]:text-butter-700',
  powder:   'bg-powder-50 ring-powder-100 [&_.tile-icon]:bg-powder-100 [&_.tile-icon]:text-powder-700',
  aqua:     'bg-aqua-50 ring-aqua-100 [&_.tile-icon]:bg-aqua-100 [&_.tile-icon]:text-aqua-700',
};

export function StatTile({ label, value, sub, icon, tone = 'lavender', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`text-left rounded-2xl p-5 ring-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover ${TONES[tone]} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1.5 leading-tight truncate">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {icon && <div className="tile-icon w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0">{icon}</div>}
      </div>
    </Tag>
  );
}

export function ExportButtons({ onCSV, onPDF, disabled }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn-mint btn-sm" onClick={onCSV} disabled={disabled} title="Download as CSV (opens in Excel)">
        ⬇ Excel / CSV
      </button>
      <button type="button" className="btn-soft btn-sm" onClick={onPDF} disabled={disabled} title="Open print view to save as PDF">
        🖨 PDF / Print
      </button>
    </div>
  );
}

export function ChartTooltip({ active, payload, label, money = true }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white text-slate-700 ring-1 ring-lavender-100 px-3 py-2 rounded-xl text-xs shadow-lg space-y-0.5">
      <p className="font-semibold text-slate-800">{label || payload[0].name}</p>
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold">{money ? `PKR ${Number(p.value).toLocaleString()}` : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function EmptyState({ icon = '🌸', title, hint }) {
  return (
    <div className="text-center py-12 px-6">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-slate-600 font-semibold text-sm">{title}</p>
      {hint && <p className="text-slate-400 text-xs mt-1">{hint}</p>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-lavender-100 border-t-lavender-400 rounded-full animate-spin" />
    </div>
  );
}
