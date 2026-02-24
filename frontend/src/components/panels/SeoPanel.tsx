// ============================================================
// CMS v1.2.0 - SEO・ページ設定パネル (v1.2.0 新規)
// DOMParser で抽出した <title>, <meta>, OGP 等を
// GUI フォームから安全に編集できる専用パネル
// ============================================================
import React from 'react';
import { useSeoStore } from '@/stores';

const css: Record<string, React.CSSProperties> = {
  root: { fontSize: 13 },
  heading: { fontWeight: 600, fontSize: 14, margin: '0 0 12px', color: '#1a3a5c' },
  group: { marginBottom: 16 },
  label: {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#555',
    marginBottom: 4, textTransform: 'uppercase' as const,
  },
  input: {
    width: '100%', boxSizing: 'border-box' as const, padding: '6px 8px',
    border: '1px solid #ddd', borderRadius: 4, fontSize: 13,
  },
  textarea: {
    width: '100%', boxSizing: 'border-box' as const, padding: '6px 8px',
    border: '1px solid #ddd', borderRadius: 4, fontSize: 13,
    resize: 'vertical' as const, minHeight: 60,
  },
  counter: {
    fontSize: 11, color: '#888', marginTop: 2, textAlign: 'right' as const,
  },
  overLimit: { color: '#c0392b', fontWeight: 600 },
  select: {
    width: '100%', boxSizing: 'border-box' as const, padding: '6px 8px',
    border: '1px solid #ddd', borderRadius: 4, fontSize: 13, background: '#fff',
  },
  hint: { fontSize: 11, color: '#999', marginTop: 2 },
  urlError: { fontSize: 11, color: '#c0392b', marginTop: 2 },
  section: {
    borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12,
  },
  tag: {
    fontSize: 10, padding: '2px 6px', background: '#d4edda', color: '#155724',
    borderRadius: 3, display: 'inline-block', marginBottom: 4,
  },
};

function CharCounter({ current, limit }: { current: number; limit: number }) {
  const over = current > limit;
  return (
    <div style={{ ...css.counter, ...(over ? css.overLimit : {}) }}>
      {current} / {limit} 文字{over ? ' (超過)' : ''}
    </div>
  );
}

export function SeoPanel() {
  const seo = useSeoStore();

  /** URL有効性チェック (仕様4.2.3) */
  const isValidUrl = (val: string): boolean => {
    if (!val) return true; // 空は許可
    try { new URL(val); return true; } catch { return false; }
  };

  return (
    <div style={css.root}>
      <h4 style={css.heading}>🔍 SEO・ページ設定</h4>
      <span style={css.tag}>v1.2.0 新規</span>

      {/* ページタイトル */}
      <div style={css.group}>
        <label style={css.label}>ページタイトル &lt;title&gt;</label>
        <input
          style={css.input}
          value={seo.title}
          onChange={(e) => seo.setSeoField('title', e.target.value)}
          placeholder="ページタイトルを入力"
        />
        <CharCounter current={seo.title.length} limit={60} />
      </div>

      {/* メタディスクリプション */}
      <div style={css.group}>
        <label style={css.label}>メタディスクリプション &lt;meta description&gt;</label>
        <textarea
          style={css.textarea}
          value={seo.description}
          onChange={(e) => seo.setSeoField('description', e.target.value)}
          placeholder="ページの説明文を入力"
          rows={3}
        />
        <CharCounter current={seo.description.length} limit={160} />
      </div>

      {/* キーワード */}
      <div style={css.group}>
        <label style={css.label}>キーワード &lt;meta keywords&gt;</label>
        <input
          style={css.input}
          value={seo.keywords}
          onChange={(e) => seo.setSeoField('keywords', e.target.value)}
          placeholder="キーワード1, キーワード2, ..."
        />
        <div style={css.hint}>カンマ区切りで入力</div>
      </div>

      {/* OGP */}
      <div style={css.section}>
        <h4 style={{ ...css.heading, fontSize: 13, margin: '0 0 8px' }}>📱 OGP (SNSシェア設定)</h4>

        <div style={css.group}>
          <label style={css.label}>OGタイトル &lt;og:title&gt;</label>
          <input
            style={css.input}
            value={seo.ogTitle}
            onChange={(e) => seo.setSeoField('ogTitle', e.target.value)}
            placeholder="OGタイトル (空欄でtitleと同期)"
          />
          <div style={css.hint}>空欄の場合、ページタイトルが使用されます</div>
        </div>

        <div style={css.group}>
          <label style={css.label}>OGディスクリプション &lt;og:description&gt;</label>
          <textarea
            style={css.textarea}
            value={seo.ogDescription}
            onChange={(e) => seo.setSeoField('ogDescription', e.target.value)}
            placeholder="OGディスクリプション (空欄でdescriptionと同期)"
            rows={2}
          />
        </div>

        <div style={css.group}>
          <label style={css.label}>OG画像 URL &lt;og:image&gt;</label>
          <input
            style={{
              ...css.input,
              borderColor: seo.ogImage && !isValidUrl(seo.ogImage) ? '#c0392b' : '#ddd',
            }}
            value={seo.ogImage}
            onChange={(e) => seo.setSeoField('ogImage', e.target.value)}
            placeholder="https://example.com/og-image.jpg"
          />
          {seo.ogImage && !isValidUrl(seo.ogImage) && (
            <div style={css.urlError}>⚠ 有効なURLを入力してください</div>
          )}
          {seo.ogImage && (
            <div style={{ marginTop: 4 }}>
              <img
                src={seo.ogImage}
                alt="OG Preview"
                style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 4, border: '1px solid #ddd' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Canonical / Robots */}
      <div style={css.section}>
        <h4 style={{ ...css.heading, fontSize: 13, margin: '0 0 8px' }}>⚙ クロール設定</h4>

        <div style={css.group}>
          <label style={css.label}>Canonical URL &lt;link rel="canonical"&gt;</label>
          <input
            style={{
              ...css.input,
              borderColor: seo.canonical && !isValidUrl(seo.canonical) ? '#c0392b' : '#ddd',
            }}
            value={seo.canonical}
            onChange={(e) => seo.setSeoField('canonical', e.target.value)}
            placeholder="https://example.com/page"
          />
          {seo.canonical && !isValidUrl(seo.canonical) && (
            <div style={css.urlError}>⚠ 有効なURLを入力してください</div>
          )}
        </div>

        <div style={css.group}>
          <label style={css.label}>Robots &lt;meta robots&gt;</label>
          <select
            style={css.select}
            value={seo.robots}
            onChange={(e) => seo.setSeoField('robots', e.target.value)}
          >
            <option value="index, follow">index, follow (推奨)</option>
            <option value="noindex, follow">noindex, follow</option>
            <option value="index, nofollow">index, nofollow</option>
            <option value="noindex, nofollow">noindex, nofollow</option>
          </select>
        </div>
      </div>
    </div>
  );
}
