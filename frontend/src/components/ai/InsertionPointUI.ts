// ============================================================
// CMS v1.2.0 - Dynamic Image Insertion Point UI
// v1.1.0: data-image-container廃止 → 標準ブロック要素でホバーUI
// v1.2.0: 3モード（新規生成/編集/合成）選択に対応
//
// 使い方: PreviewPanel や WYSIWYG の iframe 内で、
// このスクリプトのロジックをインスタンス化して使用する
// ============================================================
import type { InsertPosition, InsertionTarget, AiMode } from '@/types';
import { BLOCK_ELEMENTS } from '@/types';

const AI_MODES: { label: string; mode: AiMode }[] = [
  { label: '✨ 新規生成 (t2i)', mode: 't2i' },
  { label: '🎨 編集 (i2i)', mode: 'i2i' },
  { label: '🔀 合成 (m2i)', mode: 'm2i' },
];

/**
 * iframe 内の DOM にホバー UI を設定する
 * @param iframeDoc iframe の document
 * @param onInsert 挿入位置 + AIモードが選択された時のコールバック
 */
export function setupInsertionPointUI(
  iframeDoc: Document,
  onInsert: (target: InsertionTarget, aiMode: AiMode) => void
) {
  let currentHighlight: HTMLElement | null = null;
  let floatingBtn: HTMLElement | null = null;
  let dropdown: HTMLElement | null = null;

  // ── スタイル注入 ──
  const style = iframeDoc.createElement('style');
  style.textContent = `
    .cms-insertion-highlight {
      outline: 2px dashed #2e75b6 !important;
      outline-offset: 2px;
      position: relative;
    }
    .cms-floating-btn {
      position: absolute;
      bottom: -14px;
      left: 50%;
      transform: translateX(-50%);
      width: 28px; height: 28px;
      border-radius: 50%;
      background: #2e75b6;
      color: #fff;
      border: 2px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      cursor: pointer;
      font-size: 16px;
      line-height: 24px;
      text-align: center;
      z-index: 99999;
      transition: transform 0.15s;
    }
    .cms-floating-btn:hover {
      transform: translateX(-50%) scale(1.15);
    }
    .cms-dropdown {
      position: absolute;
      bottom: -80px;
      left: 50%;
      transform: translateX(-50%);
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 100000;
      overflow: hidden;
      min-width: 180px;
    }
    .cms-dropdown-item {
      padding: 10px 16px;
      cursor: pointer;
      font-size: 13px;
      border-bottom: 1px solid #f0f0f0;
      white-space: nowrap;
    }
    .cms-dropdown-item:last-child { border-bottom: none; }
    .cms-dropdown-item:hover { background: #f0f7ff; }
  `;
  iframeDoc.head.appendChild(style);

  const removeUI = () => {
    if (currentHighlight) {
      currentHighlight.classList.remove('cms-insertion-highlight');
    }
    floatingBtn?.remove();
    dropdown?.remove();
    floatingBtn = null;
    dropdown = null;
    currentHighlight = null;
  };

  const showDropdown = (target: HTMLElement) => {
    if (dropdown) dropdown.remove();

    dropdown = iframeDoc.createElement('div');
    dropdown.className = 'cms-dropdown';

    // 挿入位置選択 (内部/直後)
    const positions: { label: string; position: InsertPosition }[] = [
      { label: '📥 この要素の内部に追加', position: 'inside' },
      { label: '📤 この要素の直後に追加', position: 'after' },
    ];

    const posHeader = iframeDoc.createElement('div');
    posHeader.style.cssText = 'padding:6px 16px;font-size:11px;color:#888;font-weight:600;border-bottom:1px solid #eee;';
    posHeader.textContent = '挿入位置';
    dropdown.appendChild(posHeader);

    positions.forEach(({ label, position }) => {
      const item = iframeDoc.createElement('div');
      item.className = 'cms-dropdown-item';
      item.textContent = label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        showAiModeMenu(target, position);
      });
      dropdown!.appendChild(item);
    });

    target.style.position = target.style.position || 'relative';
    target.appendChild(dropdown);
  };

  /** AIモードサブメニュー (v1.2.0) */
  const showAiModeMenu = (target: HTMLElement, position: InsertPosition) => {
    if (dropdown) dropdown.remove();

    dropdown = iframeDoc.createElement('div');
    dropdown.className = 'cms-dropdown';

    const header = iframeDoc.createElement('div');
    header.style.cssText = 'padding:6px 16px;font-size:11px;color:#888;font-weight:600;border-bottom:1px solid #eee;';
    header.textContent = 'AIモード選択';
    dropdown.appendChild(header);

    AI_MODES.forEach(({ label, mode }) => {
      const item = iframeDoc.createElement('div');
      item.className = 'cms-dropdown-item';
      item.textContent = label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        onInsert(
          { element: target, tagName: target.tagName.toLowerCase(), position },
          mode
        );
        removeUI();
      });
      dropdown!.appendChild(item);
    });

    target.style.position = target.style.position || 'relative';
    target.appendChild(dropdown);
  };

  // ── イベントハンドラ ──
  const handleMouseOver = (e: MouseEvent) => {
    const el = (e.target as Element)?.closest(
      BLOCK_ELEMENTS.join(',')
    ) as HTMLElement | null;

    if (!el || el === currentHighlight) return;

    removeUI();
    currentHighlight = el;
    el.classList.add('cms-insertion-highlight');

    floatingBtn = iframeDoc.createElement('button');
    floatingBtn.className = 'cms-floating-btn';
    floatingBtn.textContent = '+';
    floatingBtn.title = '画像を挿入';
    floatingBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      showDropdown(el);
    });

    el.style.position = el.style.position || 'relative';
    el.appendChild(floatingBtn);
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const related = e.relatedTarget as Element | null;
    if (
      currentHighlight &&
      related &&
      !currentHighlight.contains(related) &&
      related !== floatingBtn &&
      related !== dropdown
    ) {
      if (!dropdown) removeUI();
    }
  };

  const handleClick = (e: MouseEvent) => {
    if (dropdown && !(e.target as Element)?.closest('.cms-dropdown')) {
      removeUI();
    }
  };

  // ── イベント登録 ──
  iframeDoc.body.addEventListener('mouseover', handleMouseOver);
  iframeDoc.body.addEventListener('mouseout', handleMouseLeave);
  iframeDoc.addEventListener('click', handleClick);

  // ── クリーンアップ関数を返す ──
  return () => {
    removeUI();
    iframeDoc.body.removeEventListener('mouseover', handleMouseOver);
    iframeDoc.body.removeEventListener('mouseout', handleMouseLeave);
    iframeDoc.removeEventListener('click', handleClick);
    style.remove();
  };
}
