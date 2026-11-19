import { createPortal } from 'react-dom';
import { useEffect } from 'react';

export default function Modal({ show, onClose, children, size = 'md' }) {
  useEffect(() => {
    if (!show) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [show]);

  if (!show) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full ${widths[size]} rounded-2xl overflow-hidden shadow-2xl`}
        style={{
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'modalPop 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalHeader({ icon, title, subtitle, onClose }) {
  return (
    <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
      {icon && (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-slate-50">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0 border-0 bg-transparent cursor-pointer text-lg"
      >✕</button>
    </div>
  );
}

export function ModalBody({ children }) {
  return <div className="px-6 py-5 space-y-5">{children}</div>;
}

export function ModalFooter({ children }) {
  return (
    <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
      {children}
    </div>
  );
}

export function ModalSection({ label, optional, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
        {label}{optional && <span className="ml-1 text-slate-300 font-normal normal-case tracking-normal">(optional)</span>}
      </p>
      {children}
    </div>
  );
}
