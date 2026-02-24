// ============================================================
// CMS v1.2.0 - Right Panel (3 tabs: Properties / AI / SEO)
// ============================================================
import React, { useState, useMemo } from 'react';
import { useDocumentStore, useEditorStore } from '@/stores';
import { SeoPanel } from '../panels/SeoPanel';
import { AiImageDialog } from '../ai/AiImageDialog';

type Tab = 'properties' | 'ai' | 'seo';

const tabDef: { key: Tab; label: string; icon: string }[] = [
  { key: 'properties', label: 'プロパティ', icon: '⚙' },
  { key: 'ai', label: 'AI画像', icon: '🎨' },
  { key: 'seo', label: 'SEO', icon: '🔍' },
];

const css: Record<string, React.CSSProperties> = {
  tabs: {
    display: 'flex', borderBottom: '1px solid #ddd', background: '#fafafa',
  },
  tab: {
    flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 12,
    cursor: 'pointer', border: 'none', background: 'transparent',
    borderBottom: '2px solid transparent',
  },
  active: {
    borderBottomColor: '#2e75b6', color: '#2e75b6', fontWeight: 600,
  },
  content: { padding: 12, fontSize: 13 },
};

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('properties');

  return (
    <div>
      <div style={css.tabs}>
        {tabDef.map((t) => (
          <button
            key={t.key}
            style={{ ...css.tab, ...(tab === t.key ? css.active : {}) }}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div style={css.content}>
        {tab === 'properties' && <PropertiesPanel />}
        {tab === 'ai' && <AiImageDialog />}
        {tab === 'seo' && <SeoPanel />}
      </div>
    </div>
  );
}

const propCss: Record<string, React.CSSProperties> = {
  section: { marginBottom: 16 },
  heading: { fontWeight: 600, fontSize: 13, margin: '0 0 8px', color: '#1a3a5c' },
  row: {
    display: 'flex', justifyContent: 'space-between', padding: '4px 0',
    borderBottom: '1px solid #f0f0f0', fontSize: 12,
  },
  label: { color: '#666', fontWeight: 500 },
  value: { color: '#1a1a1a', fontWeight: 600, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' },
  empty: { fontSize: 12, color: '#aaa', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' },
  tagList: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: {
    fontSize: 10, padding: '2px 6px', background: '#e8f0fe', color: '#1a3a5c',
    borderRadius: 3, fontFamily: 'monospace',
  },
};

function PropertiesPanel() {
  const { currentFilePath, detectedEncoding, canonicalHtmlString, domTree, isDirty } = useDocumentStore();
  const { mode } = useEditorStore();

  const stats = useMemo(() => {
    if (!domTree || !canonicalHtmlString) return null;

    const images = domTree.querySelectorAll('img');
    const links = domTree.querySelectorAll('a[href]');
    const headings = domTree.querySelectorAll('h1,h2,h3,h4,h5,h6');
    const scripts = domTree.querySelectorAll('script');
    const stylesheets = domTree.querySelectorAll('link[rel="stylesheet"]');
    const inlineStyles = domTree.querySelectorAll('style');

    // Count unique tag names in body
    const tagCounts: Record<string, number> = {};
    domTree.body.querySelectorAll('*').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      charCount: canonicalHtmlString.length,
      byteSize: new Blob([canonicalHtmlString]).size,
      imageCount: images.length,
      linkCount: links.length,
      headingCount: headings.length,
      scriptCount: scripts.length,
      stylesheetCount: stylesheets.length + inlineStyles.length,
      topTags,
    };
  }, [domTree, canonicalHtmlString]);

  if (!currentFilePath) {
    return <div style={propCss.empty}>ファイルを開くと情報が表示されます</div>;
  }

  const fileName = currentFilePath.split('/').pop() || currentFilePath;

  return (
    <div>
      <h4 style={propCss.heading}>⚙ ドキュメント情報</h4>

      {/* File Info */}
      <div style={propCss.section}>
        <div style={propCss.row}>
          <span style={propCss.label}>ファイル</span>
          <span style={propCss.value} title={currentFilePath}>{fileName}</span>
        </div>
        <div style={propCss.row}>
          <span style={propCss.label}>パス</span>
          <span style={propCss.value} title={currentFilePath}>{currentFilePath}</span>
        </div>
        <div style={propCss.row}>
          <span style={propCss.label}>文字コード</span>
          <span style={propCss.value}>{detectedEncoding}</span>
        </div>
        <div style={propCss.row}>
          <span style={propCss.label}>編集モード</span>
          <span style={propCss.value}>
            {mode === 'wysiwyg' ? 'タグなし' : mode === 'code' ? 'タグ付き' : 'プレビュー'}
          </span>
        </div>
        <div style={propCss.row}>
          <span style={propCss.label}>状態</span>
          <span style={{ ...propCss.value, color: isDirty ? '#c0392b' : '#27ae60' }}>
            {isDirty ? '未保存' : '保存済み'}
          </span>
        </div>
      </div>

      {/* Document Stats */}
      {stats && (
        <>
          <h4 style={propCss.heading}>📊 ドキュメント統計</h4>
          <div style={propCss.section}>
            <div style={propCss.row}>
              <span style={propCss.label}>文字数</span>
              <span style={propCss.value}>{stats.charCount.toLocaleString()}</span>
            </div>
            <div style={propCss.row}>
              <span style={propCss.label}>サイズ</span>
              <span style={propCss.value}>{(stats.byteSize / 1024).toFixed(1)} KB</span>
            </div>
            <div style={propCss.row}>
              <span style={propCss.label}>画像</span>
              <span style={propCss.value}>{stats.imageCount}</span>
            </div>
            <div style={propCss.row}>
              <span style={propCss.label}>リンク</span>
              <span style={propCss.value}>{stats.linkCount}</span>
            </div>
            <div style={propCss.row}>
              <span style={propCss.label}>見出し</span>
              <span style={propCss.value}>{stats.headingCount}</span>
            </div>
            <div style={propCss.row}>
              <span style={propCss.label}>スクリプト</span>
              <span style={propCss.value}>{stats.scriptCount}</span>
            </div>
            <div style={propCss.row}>
              <span style={propCss.label}>スタイルシート</span>
              <span style={propCss.value}>{stats.stylesheetCount}</span>
            </div>
          </div>

          {/* Top Tags */}
          <h4 style={propCss.heading}>🏷 主要要素</h4>
          <div style={propCss.tagList}>
            {stats.topTags.map(([tag, count]) => (
              <span key={tag} style={propCss.tag}>&lt;{tag}&gt; {count}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
