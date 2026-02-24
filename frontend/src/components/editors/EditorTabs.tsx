// ============================================================
// CMS v1.2.0 - Editor Tabs (Mode switching orchestration)
// v1.2.0: Strict state sync lifecycle on mode switch
// ============================================================
import React, { useRef, useCallback, useState, lazy, Suspense } from 'react';
import { useEditorStore, useDocumentStore } from '@/stores';
import { onModeSwitch } from './modeSyncManager';
import type { EditorMode } from '@/types';

// Lazy-load heavy editor components (Monaco ~400KB, Tiptap ~100KB)
const WysiwygEditor = lazy(() => import('./WysiwygEditor'));
const CodeEditor = lazy(() => import('./CodeEditor'));
const PreviewPanel = lazy(() => import('../preview/PreviewPanel'));

const tabs: { key: EditorMode; label: string; icon: string }[] = [
  { key: 'wysiwyg', label: 'タグなし編集', icon: '✏️' },
  { key: 'code', label: 'タグ付き編集', icon: '🏷️' },
  { key: 'preview', label: 'プレビュー', icon: '👁️' },
];

const css: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100%' },
  tabBar: {
    display: 'flex', borderBottom: '2px solid #2e75b6',
    background: '#fff', flexShrink: 0,
  },
  tab: {
    padding: '10px 20px', cursor: 'pointer', border: 'none',
    background: 'transparent', fontSize: 13, fontWeight: 500,
    borderBottom: '3px solid transparent', transition: 'all 0.15s',
  },
  activeTab: {
    borderBottomColor: '#2e75b6', color: '#2e75b6', fontWeight: 700,
    background: '#f0f7ff',
  },
  editor: { flex: 1, overflow: 'auto' },
  loading: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    height: '100%', color: '#888', fontSize: 14,
  },
  errorBanner: {
    padding: '8px 12px', background: '#fde8e8', color: '#c0392b',
    fontSize: 12, borderBottom: '1px solid #f5c6cb',
  },
};

export function EditorTabs() {
  const mode = useEditorStore((s) => s.mode);
  const canonicalHtml = useDocumentStore((s) => s.canonicalHtmlString);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 各エディタへの参照（内容取得用）
  const wysiwygRef = useRef<{ getHTML: () => string }>(null);
  const codeRef = useRef<{ getValue: () => string }>(null);

  /** 現在のエディタから内容を取得 */
  const getCurrentContent = useCallback((): string => {
    if (mode === 'wysiwyg' && wysiwygRef.current) {
      return wysiwygRef.current.getHTML();
    }
    if (mode === 'code' && codeRef.current) {
      return codeRef.current.getValue();
    }
    return useDocumentStore.getState().canonicalHtmlString;
  }, [mode]);

  /** モード切替ハンドラ (v1.2.0: 同期ライフサイクル) */
  const handleModeSwitch = useCallback((to: EditorMode) => {
    if (to === mode) return;
    setSyncError(null);

    const result = onModeSwitch(mode, to, getCurrentContent);

    if (!result.success) {
      setSyncError(result.error || 'モード切替に失敗しました');
      return; // 切替中断
    }
  }, [mode, getCurrentContent]);

  if (!canonicalHtml) {
    return (
      <div style={{ ...css.root, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14 }}>左のファイルツリーからHTMLファイルを選択してください</div>
        </div>
      </div>
    );
  }

  return (
    <div style={css.root}>
      {/* タブバー */}
      <div style={css.tabBar}>
        {tabs.map((t) => (
          <button
            key={t.key}
            style={{ ...css.tab, ...(mode === t.key ? css.activeTab : {}) }}
            onClick={() => handleModeSwitch(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* 同期エラーバナー */}
      {syncError && (
        <div style={css.errorBanner}>
          ⚠ {syncError}
          <button
            onClick={() => setSyncError(null)}
            style={{ marginLeft: 12, border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* エディタ本体 */}
      <div style={css.editor}>
        <Suspense fallback={<div style={css.loading}>読み込み中...</div>}>
          {mode === 'wysiwyg' && <WysiwygEditor ref={wysiwygRef} />}
          {mode === 'code' && <CodeEditor ref={codeRef} />}
          {mode === 'preview' && <PreviewPanel />}
        </Suspense>
      </div>
    </div>
  );
}
