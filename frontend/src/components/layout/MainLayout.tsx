// ============================================================
// CMS v1.2.0 - MainLayout (3-column layout)
// Left: FileTree (240px) | Center: Editor (flex) | Right: Panel (320px)
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { EditorTabs } from '../editors/EditorTabs';
import { useDocumentStore, useEditorStore } from '@/stores';
import { ftpRead, ftpWrite } from '@/services/api';
import { useFileTreeStore } from '@/stores';
import { useSeoStore } from '@/stores';
import { showToast } from '../common/Toast';
import { ConfirmDialog } from '../common/ConfirmDialog';

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14, color: '#1a1a1a', background: '#f5f5f5',
  },
  header: {
    height: 44, background: '#1a3a5c', color: '#fff',
    display: 'flex', alignItems: 'center', padding: '0 16px',
    fontSize: 14, fontWeight: 600, flexShrink: 0,
  },
  body: {
    display: 'flex', flex: 1, overflow: 'hidden',
  },
  left: {
    width: 240, flexShrink: 0, borderRight: '1px solid #ddd',
    background: '#fff', overflow: 'auto',
  },
  center: {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  right: {
    width: 320, flexShrink: 0, borderLeft: '1px solid #ddd',
    background: '#fff', overflow: 'auto',
  },
  statusBar: {
    height: 28, background: '#2e75b6', color: '#fff',
    display: 'flex', alignItems: 'center', padding: '0 12px',
    fontSize: 12, flexShrink: 0, gap: 16,
  },
};

export function MainLayout() {
  const { currentFilePath, detectedEncoding, isDirty, canonicalHtmlString } = useDocumentStore();
  const { mode, isSaving, setSaving } = useEditorStore();
  const { selectedPath } = useFileTreeStore();
  const { applyToDocument } = useSeoStore();

  // ── Auto-save restore dialog state ──
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{
    autoSaved: string; ftpContent: string; encoding: string; path: string;
  } | null>(null);

  /** Load document into stores (shared between normal load and restore) */
  const applyDocument = useCallback((html: string, encoding: string, path: string) => {
    useDocumentStore.getState().setDocument(html, encoding, path);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    useSeoStore.getState().loadFromDocument(doc);

    // SEO localStorage restore
    const savedSeo = localStorage.getItem(`cms-seo:${path}`);
    if (savedSeo) {
      try {
        const seoData = JSON.parse(savedSeo);
        Object.keys(seoData).forEach((k) => {
          useSeoStore.getState().setSeoField(k as any, seoData[k]);
        });
      } catch { /* ignore corrupt data */ }
    }
  }, []);

  // ── ファイル選択時の読み込み ──
  const loadFile = useCallback(async (path: string) => {
    try {
      const res = await ftpRead(path);
      if (res.mimeType.includes('html') || path.endsWith('.html') || path.endsWith('.htm')) {
        const autoSaved = localStorage.getItem(`cms-autosave:${path}`);
        if (autoSaved && autoSaved !== res.content) {
          // Show non-blocking confirm dialog
          setPendingRestore({
            autoSaved, ftpContent: res.content,
            encoding: res.detectedEncoding, path,
          });
          setConfirmOpen(true);
        } else {
          applyDocument(res.content, res.detectedEncoding, path);
        }
      }
    } catch (e) {
      showToast(`ファイル読み込みエラー: ${e}`, 'error', 5000);
    }
  }, [applyDocument]);

  const handleRestoreConfirm = useCallback(() => {
    if (pendingRestore) {
      applyDocument(pendingRestore.autoSaved, pendingRestore.encoding, pendingRestore.path);
    }
    setConfirmOpen(false);
    setPendingRestore(null);
  }, [pendingRestore, applyDocument]);

  const handleRestoreCancel = useCallback(() => {
    if (pendingRestore) {
      localStorage.removeItem(`cms-autosave:${pendingRestore.path}`);
      applyDocument(pendingRestore.ftpContent, pendingRestore.encoding, pendingRestore.path);
    }
    setConfirmOpen(false);
    setPendingRestore(null);
  }, [pendingRestore, applyDocument]);

  useEffect(() => {
    if (selectedPath) loadFile(selectedPath);
  }, [selectedPath, loadFile]);

  // ── Prettier Worker (保存時HTML整形) ──
  const prettierWorkerRef = React.useRef<Worker | null>(null);
  React.useEffect(() => {
    try {
      prettierWorkerRef.current = new Worker(
        new URL('../../workers/prettierWorker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch { /* Worker 未対応環境は無視 */ }
    return () => prettierWorkerRef.current?.terminate();
  }, []);

  /** Prettier で HTML を整形 (Web Worker バックグラウンド実行) */
  const formatWithPrettier = useCallback((html: string): Promise<string> => {
    return new Promise((resolve) => {
      if (!prettierWorkerRef.current) {
        resolve(html); // Worker 非対応時はスキップ
        return;
      }
      const timeout = setTimeout(() => resolve(html), 5000); // 5秒タイムアウト
      prettierWorkerRef.current.onmessage = (e: MessageEvent) => {
        clearTimeout(timeout);
        resolve(e.data.html);
      };
      prettierWorkerRef.current.postMessage({ type: 'format', html });
    });
  }, []);

  // ── 保存 (Ctrl+S) ──
  const handleSave = useCallback(async () => {
    const state = useDocumentStore.getState();
    if (!state.currentFilePath || !state.isDirty) return;
    setSaving(true);
    try {
      // v1.2.0: SEOメタデータをDOMに書き戻し
      if (state.domTree) {
        applyToDocument(state.domTree);
      }
      // v1.1.0: Prettier で保存時HTML整形 (Web Worker)
      const formatted = await formatWithPrettier(state.canonicalHtmlString);
      await ftpWrite({
        path: state.currentFilePath,
        content: formatted,
        encoding: state.detectedEncoding,
      });
      // 整形結果を canonicalHtml にも反映
      useDocumentStore.getState().updateCanonicalHtml(formatted);
      useDocumentStore.getState().setDirty(false);
      showToast('保存しました', 'success');
    } catch (e) {
      showToast(`保存エラー: ${e}`, 'error', 5000);
    } finally {
      setSaving(false);
    }
  }, [setSaving, applyToDocument, formatWithPrettier]);

  // ── キーボードショートカット ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        useEditorStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  // ── オートセーブ (30秒) ──
  useEffect(() => {
    const id = setInterval(() => {
      const { canonicalHtmlString, currentFilePath, isDirty } = useDocumentStore.getState();
      if (currentFilePath && isDirty && canonicalHtmlString) {
        try {
          localStorage.setItem(`cms-autosave:${currentFilePath}`, canonicalHtmlString);
          // SeoStore も永続化
          const seo = useSeoStore.getState();
          const seoData = {
            title: seo.title, description: seo.description, keywords: seo.keywords,
            ogTitle: seo.ogTitle, ogDescription: seo.ogDescription, ogImage: seo.ogImage,
            canonical: seo.canonical, robots: seo.robots,
          };
          localStorage.setItem(`cms-seo:${currentFilePath}`, JSON.stringify(seoData));
        } catch { /* quota exceeded - ignore */ }
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={styles.root}>
      {/* Auto-save restore dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="自動バックアップの復元"
        message="未保存の自動バックアップがあります。復元しますか？&#10;「キャンセル」を選ぶとサーバー版を読み込みます。"
        confirmLabel="復元する"
        cancelLabel="サーバー版を使用"
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
      />

      {/* ヘッダー */}
      <div style={styles.header}>
        <span>📝 CMS Editor v1.2.0</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.8 }}>
          {currentFilePath || 'ファイル未選択'}
          {isDirty && ' (未保存)'}
        </span>
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          style={{
            marginLeft: 12, padding: '4px 12px', border: 'none', borderRadius: 4,
            background: isDirty ? '#27ae60' : '#555', color: '#fff', cursor: 'pointer',
            opacity: isSaving ? 0.5 : 1,
          }}
        >
          {isSaving ? '保存中...' : '💾 保存'}
        </button>
      </div>

      {/* ボディ: 3カラム */}
      <div style={styles.body}>
        <div style={styles.left}><Sidebar /></div>
        <div style={styles.center}><EditorTabs /></div>
        <div style={styles.right}><RightPanel /></div>
      </div>

      {/* ステータスバー */}
      <div style={styles.statusBar}>
        <span>モード: {mode === 'wysiwyg' ? 'タグなし' : mode === 'code' ? 'タグ付き' : 'プレビュー'}</span>
        <span>文字コード: {detectedEncoding || '—'}</span>
        <span>{canonicalHtmlString.length.toLocaleString()} 文字</span>
      </div>
    </div>
  );
}
