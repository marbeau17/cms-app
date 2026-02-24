// ============================================================
// CMS v1.2.0 - Non-blocking Confirm Dialog
// Replaces window.confirm() for better UX
// ============================================================
import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const css: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 999998,
  },
  dialog: {
    background: '#fff', borderRadius: 12, padding: '24px 28px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxWidth: 420, width: '90%',
  },
  title: {
    fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#1a3a5c',
  },
  message: {
    fontSize: 13, color: '#555', lineHeight: 1.6, margin: '0 0 20px',
  },
  actions: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
  },
  btn: {
    padding: '8px 20px', border: 'none', borderRadius: 6,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnConfirm: {
    background: '#2e75b6', color: '#fff',
  },
  btnCancel: {
    background: '#f0f0f0', color: '#333',
  },
};

export function ConfirmDialog({
  open, title, message, confirmLabel = 'OK', cancelLabel = 'キャンセル',
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div style={css.overlay} onClick={onCancel}>
      <div style={css.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 style={css.title}>{title}</h3>
        <p style={css.message}>{message}</p>
        <div style={css.actions}>
          <button style={{ ...css.btn, ...css.btnCancel }} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} style={{ ...css.btn, ...css.btnConfirm }} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
