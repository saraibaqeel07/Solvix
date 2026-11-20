import { useId } from 'react';

// Slotify mark: a pastel tile holding a 2×2 grid of time slots — three open,
// one booked (solid with a mint check). Reads well from 16px favicons up.
export function LogoMark({ size = 36, className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Slotify">
      <defs>
        <linearGradient id={`sg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b3a4f6" />
          <stop offset="1" stopColor="#f6a3b9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#sg${id})`} />
      <rect x="11" y="11" width="18" height="18" rx="5.5" fill="#fff" fillOpacity=".5" />
      <rect x="35" y="11" width="18" height="18" rx="5.5" fill="#fff" fillOpacity=".5" />
      <rect x="11" y="35" width="18" height="18" rx="5.5" fill="#fff" fillOpacity=".5" />
      <rect x="35" y="35" width="18" height="18" rx="5.5" fill="#fff" />
      <path d="M39.6 44.4l3.2 3.2 6.2-6.6" fill="none" stroke="#52b78b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Horizontal lockup: mark + "Slot" (ink) "ify" (lavender).
export default function Logo({ size = 36, tagline, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <div className="leading-none">
        <p className="font-extrabold tracking-tight text-slate-800" style={{ fontSize: size * 0.5 }}>
          Slot<span className="text-lavender-600">ify</span>
        </p>
        {tagline && <p className="text-slate-400 text-[10px] mt-1">{tagline}</p>}
      </div>
    </div>
  );
}
