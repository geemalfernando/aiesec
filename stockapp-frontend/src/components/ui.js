// src/components/ui.js
import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
};
const BUTTON_SIZES = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-base' };

export const buttonClass = (variant = 'primary', size = 'md') =>
  `inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}`;

export const Button = ({ variant, size, className = '', busy, children, type = 'button', disabled, ...props }) => (
  <button type={type} disabled={disabled || busy} className={`${buttonClass(variant, size)} ${className}`} {...props}>
    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
    {children}
  </button>
);

export const inputClass = 'block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 disabled:bg-slate-100 disabled:text-slate-400';

export const Field = ({ label, hint, children, className = '' }) => {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {React.cloneElement(children, { id })}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
};

export const Input = ({ className = '', ...props }) => <input className={`${inputClass} ${className}`} {...props} />;
export const Select = ({ className = '', children, ...props }) => <select className={`${inputClass} ${className}`} {...props}>{children}</select>;

export const Card = ({ title, action, children, className = '', flush }) => (
  <section className={`min-w-0 rounded-xl border border-slate-200 bg-white ${className}`}>
    {title && (
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
    )}
    <div className={flush ? '' : 'p-5'}>{children}</div>
  </section>
);

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const STAT_TONES = { default: 'text-slate-900', danger: 'text-red-700', warning: 'text-amber-700', good: 'text-brand-700' };

export const Stat = ({ label, value, note, tone = 'default' }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-sm text-slate-500">{label}</p>
    <p className={`tabular mt-1 text-xl font-semibold ${STAT_TONES[tone]}`}>{value}</p>
    {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
  </div>
);

const BADGE_TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  good: 'bg-brand-100 text-brand-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-sky-100 text-sky-800',
};
export const Badge = ({ tone = 'neutral', children }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>{children}</span>
);

export const Table = ({ children }) => <div className="relative overflow-x-auto"><table className="w-full text-left text-sm">{children}</table></div>;
export const Th = ({ align = 'left', children }) => (
  <th scope="col" className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500 ${align === 'right' ? 'text-right' : ''}`}>{children}</th>
);
export const Td = ({ align = 'left', className = '', children, ...props }) => (
  <td className={`border-b border-slate-100 px-4 py-3 ${align === 'right' ? 'tabular text-right' : ''} ${className}`} {...props}>{children}</td>
);

export const EmptyState = ({ icon: Icon, title, children }) => (
  <div className="px-6 py-12 text-center">
    {Icon && <Icon className="mx-auto mb-3 h-8 w-8 text-slate-300" aria-hidden="true" />}
    <p className="font-medium text-slate-700">{title}</p>
    {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
  </div>
);

export const Alert = ({ tone = 'danger', children, className = '' }) => {
  const styles = tone === 'danger' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <div role="alert" className={`flex gap-2 rounded-lg border px-3 py-2.5 text-sm ${styles} ${className}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
};

export const PageLoading = ({ label = 'Loading...' }) => (
  <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500" role="status">
    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {label}
  </div>
);

export const Modal = ({ title, onClose, children, footer, wide }) => {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    panel.current?.querySelector('[data-modal-body] input, [data-modal-body] select, [data-modal-body] textarea, [data-modal-body] button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div ref={panel} className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5" data-modal-body>{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
};

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message) => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[60] flex w-max max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-100" aria-hidden="true" /> {toast}
        </div>
      )}
    </ToastContext.Provider>
  );
};
