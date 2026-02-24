// ============================================================
// CMS v1.2.0 - Toast Notification Component
// 仕様4.3: フィードバック: トースト通知、FTP進捗表示
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

const icons: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

const colors: Record<ToastType, { bg: string; border: string }> = {
  success: { bg: '#d4edda', border: '#28a745' },
  error: { bg: '#f8d7da', border: '#dc3545' },
  info: { bg: '#d1ecf1', border: '#17a2b8' },
  warning: { bg: '#fff3cd', border: '#ffc107' },
};

// ── グローバルトースト制御 ──
type ToastCallback = (msg: string, type?: ToastType, duration?: number) => void;
let _showToast: ToastCallback = () => {};

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  _showToast(message, type, duration);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  useEffect(() => {
    _showToast = addToast;
    return () => { _showToast = () => {}; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 999999,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 13,
          background: colors[t.type].bg,
          borderLeft: `4px solid ${colors[t.type].border}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'slideIn 0.2s ease-out',
          minWidth: 200, maxWidth: 400,
        }}>
          <span>{icons[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
