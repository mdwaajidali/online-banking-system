import { useEffect, useId, useRef, useState } from 'react';

export function Field({ label, hint, error, children, id }) {
  const autoId = useId();
  const fieldId = id || autoId;
  const child = typeof children === 'function' ? children(fieldId) : children;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={fieldId}>{label}</label>
      {child}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function PasswordInput({ id, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-with-action">
      <input id={id} type={show ? 'text' : 'password'} {...props} />
      <button type="button" className="input-action" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Button({ loading, children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading" role="status">
      <span className="spinner spinner-dark" aria-hidden="true" />
      {label}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        {onClose ? (
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        ) : null}
      </div>
      {children}
    </dialog>
  );
}

export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="link-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}
