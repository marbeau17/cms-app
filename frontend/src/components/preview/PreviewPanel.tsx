// ============================================================
// CMS v1.2.0 - Preview Panel
// iframe[srcdoc] + Service Worker on-demand proxy
// v1.2.0: <base> タグ注入によるアンカーリンク破損のフェイルセーフ
// ============================================================
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDocumentStore } from '@/stores';
import { getPreviewHtml } from '../editors/modeSyncManager';

const css: Record<string, React.CSSProperties> = {
  root: { height: '100%', display: 'flex', flexDirection: 'column' },
  toolbar: {
    display: 'flex', gap: 8, padding: '8px 12px',
    borderBottom: '1px solid #eee', background: '#fafafa',
    alignItems: 'center', flexShrink: 0, fontSize: 12,
  },
  btn: {
    padding: '4px 10px', border: '1px solid #ddd', borderRadius: 4,
    background: '#fff', cursor: 'pointer', fontSize: 12,
  },
  btnActive: { background: '#2e75b6', color: '#fff', borderColor: '#2e75b6' },
  iframe: {
    flex: 1, border: 'none', width: '100%', background: '#fff',
  },
  skeleton: {
    flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
    color: '#888', fontSize: 14,
  },
};

// ── v1.2.0: アンカーリンクフェイルセーフ注入スクリプト ──
// <base href="/preview/"> の副作用で #hash リンクが /preview/#hash に
// 遷移する問題を回避する
const ANCHOR_FAILSAFE_SCRIPT = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var anchor = e.target.closest('a[href]');
    if (!anchor) return;
    var href = anchor.getAttribute('href');

    // ページ内アンカーリンク (#section, #top 等)
    if (href && href.charAt(0) === '#') {
      e.preventDefault();
      if (href === '#') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        var target = document.getElementById(href.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
      return;
    }

    // 外部リンクはプレビュー内で無効化し、親にpostMessage
    if (href && (href.indexOf('http://') === 0 || href.indexOf('https://') === 0)) {
      e.preventDefault();
      parent.postMessage({ type: 'external-link', url: href }, location.origin);
      return;
    }
  });
})();
</script>
`;

type DeviceMode = 'pc' | 'tablet' | 'mobile';
const deviceWidths: Record<DeviceMode, string> = {
  pc: '100%',
  tablet: '768px',
  mobile: '375px',
};

export default function PreviewPanel() {
  const canonicalHtml = useDocumentStore((s) => s.canonicalHtmlString);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DeviceMode>('pc');
  const [loading, setLoading] = useState(true);

  /**
   * プレビュー用 HTML を構築:
   * 1. <head> に <base href="/preview/"> を注入 (SW ルーティング用)
   * 2. <body> 末尾にアンカーリンクフェイルセーフスクリプトを注入 (v1.2.0)
   */
  const buildPreviewHtml = useCallback((html: string): string => {
    if (!html) return '';

    let result = html;

    // <base> タグ注入 (既存の <base> があれば置換)
    const baseTag = '<base href="/preview/">';
    if (result.includes('<base ')) {
      result = result.replace(/<base[^>]*>/, baseTag);
    } else if (result.includes('<head>')) {
      result = result.replace('<head>', `<head>\n  ${baseTag}`);
    } else if (result.includes('<head ')) {
      result = result.replace(/<head[^>]*>/, (match) => `${match}\n  ${baseTag}`);
    }

    // v1.2.0: アンカーリンクフェイルセーフスクリプト注入
    if (result.includes('</body>')) {
      result = result.replace('</body>', `${ANCHOR_FAILSAFE_SCRIPT}\n</body>`);
    } else {
      result += ANCHOR_FAILSAFE_SCRIPT;
    }

    return result;
  }, []);

  // プレビュー更新 (デバウンス 300ms)
  useEffect(() => {
    if (!canonicalHtml) return;
    setLoading(true);

    const timer = setTimeout(() => {
      const previewHtml = buildPreviewHtml(getPreviewHtml());
      if (iframeRef.current) {
        iframeRef.current.srcdoc = previewHtml;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [canonicalHtml, buildPreviewHtml]);

  // iframe load 完了
  const handleLoad = () => setLoading(false);

  // 外部リンク通知を受信
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'external-link') {
        const msg = `外部リンク: ${e.data.url}\nプレビュー内では遷移できません。新しいタブで開きますか？`;
        if (confirm(msg)) {
          window.open(e.data.url, '_blank');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={css.root}>
      {/* デバイス切替ツールバー */}
      <div style={css.toolbar}>
        <span style={{ fontWeight: 600 }}>👁 プレビュー</span>
        <span style={{ borderLeft: '1px solid #ddd', margin: '0 4px', height: 20 }} />
        {(['pc', 'tablet', 'mobile'] as DeviceMode[]).map((d) => (
          <button
            key={d}
            style={{ ...css.btn, ...(device === d ? css.btnActive : {}) }}
            onClick={() => setDevice(d)}
          >
            {d === 'pc' ? '💻' : d === 'tablet' ? '📱' : '📲'} {d.toUpperCase()}
          </button>
        ))}
        <button
          style={{ ...css.btn, marginLeft: 'auto' }}
          onClick={() => {
            if (iframeRef.current) {
              const html = buildPreviewHtml(getPreviewHtml());
              iframeRef.current.srcdoc = html;
            }
          }}
        >
          🔄 リロード
        </button>
      </div>

      {/* iframe */}
      <div style={{
        flex: 1, display: 'flex', justifyContent: 'center',
        background: '#e8e8e8', overflow: 'auto', padding: device === 'pc' ? 0 : 16,
      }}>
        {loading && <div style={css.skeleton}>⏳ プレビュー読み込み中...</div>}
        <iframe
          ref={iframeRef}
          style={{
            ...css.iframe,
            width: deviceWidths[device],
            maxWidth: deviceWidths[device],
            display: loading ? 'none' : 'block',
            boxShadow: device !== 'pc' ? '0 2px 12px rgba(0,0,0,0.15)' : 'none',
          }}
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleLoad}
          title="Preview"
        />
      </div>
    </div>
  );
}
