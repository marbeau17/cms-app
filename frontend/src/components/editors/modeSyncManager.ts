// ============================================================
// CMS v1.2.0 - Mode Sync Manager
// Single Source of Truth: DocumentStore.canonicalHtmlString
//
// [A] WYSIWYG → Code: Tiptap → DOM → canonicalHtml → Monaco
// [B] Code → WYSIWYG: Monaco → DOMParser validate → canonicalHtml → Tiptap
// [C] Any → Preview: commit current editor → SEO apply → srcdoc
// [D] Preview → Any: read-only, no commit needed
// ============================================================
import { useDocumentStore, useEditorStore, useSeoStore } from '@/stores';
import type { EditorMode } from '@/types';

export interface ModeSyncResult {
  success: boolean;
  error?: string;
}

/**
 * DOM → HTML文字列のシリアライズユーティリティ
 * 仕様3.2.2:
 *   Step1: doctype + documentElement.outerHTML
 *   Step2: XHTML自己閉じタグをHTML5形式に変換
 *   Step4: <meta charset>宣言を維持
 */
function serializeDom(doc: Document): string {
  const doctype = doc.doctype
    ? `<!DOCTYPE ${doc.doctype.name}>\n`
    : '<!DOCTYPE html>\n';
  let html = doctype + doc.documentElement.outerHTML;

  // Step2: XHTML自己閉じタグ → HTML5形式
  // <br/> → <br>, <hr/> → <hr>, <img .../> → <img ...> etc.
  const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  voidElements.forEach((tag) => {
    const regex = new RegExp(`<(${tag})(\\s[^>]*)\\s*/>`, 'gi');
    html = html.replace(regex, '<$1$2>');
  });

  return html;
}

/**
 * Tiptap (WYSIWYG) の内容を canonicalHtmlString にコミット
 */
export function commitFromWysiwyg(tiptapHtml: string): ModeSyncResult {
  const docStore = useDocumentStore.getState();
  if (!docStore.domTree) return { success: false, error: 'No document loaded' };

  try {
    // Tiptap は <body> 内の編集可能領域のみを返すので、
    // DOM ツリーの該当箇所を更新
    const editableAreas = docStore.domTree.querySelectorAll('[data-editable]');
    if (editableAreas.length > 0) {
      // data-editable 領域がある場合、Tiptap出力で更新
      const tempDoc = new DOMParser().parseFromString(tiptapHtml, 'text/html');
      editableAreas.forEach((area, i) => {
        const replacement = tempDoc.body.children[i];
        if (replacement) {
          area.innerHTML = replacement.innerHTML;
        }
      });
    } else {
      // data-editable が無い場合、body 全体を Tiptap 出力で更新
      docStore.domTree.body.innerHTML = tiptapHtml;
    }

    // シリアライズ (XHTML→HTML5変換 + meta charset維持)
    const html = serializeDom(docStore.domTree);

    docStore.updateCanonicalHtml(html);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Monaco (Code Editor) の内容を canonicalHtmlString にコミット
 * DOMParser でバリデーションを行い、パースエラーがあれば切替を中断
 */
export function commitFromCode(codeHtml: string): ModeSyncResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(codeHtml, 'text/html');

    // text/html パーサーは parsererror を生成しないため、
    // 構造的バリデーションで不正HTMLを検出する
    const body = doc.body;
    if (!body || (!body.innerHTML.trim() && codeHtml.trim().length > 0)) {
      return {
        success: false,
        error: 'HTML パースエラー: body が空です。HTMLの構造を確認してください。',
      };
    }
    // <html>/<head>/<body> が最低限存在するか
    if (!doc.documentElement || !doc.head) {
      return {
        success: false,
        error: 'HTML パースエラー: <html> または <head> が見つかりません。',
      };
    }

    // DOM ツリーとcanonicalHtmlを更新
    useDocumentStore.getState().updateDomTree(doc);
    useDocumentStore.getState().updateCanonicalHtml(codeHtml);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * プレビュー用 HTML を生成
 * SEO メタデータを DOM に書き戻した上で返す
 */
export function getPreviewHtml(): string {
  const docStore = useDocumentStore.getState();
  const seoStore = useSeoStore.getState();

  if (!docStore.domTree) return docStore.canonicalHtmlString;

  // v1.2.0: SEOメタデータをDOMに反映
  seoStore.applyToDocument(docStore.domTree);

  return serializeDom(docStore.domTree);
}

/**
 * メインのモード切替ハンドラ
 * v1.2.0: 厳密に定義されたライフサイクルに従う
 */
export function onModeSwitch(
  from: EditorMode,
  to: EditorMode,
  getCurrentEditorContent: () => string
): ModeSyncResult {
  // [D] プレビューからの切替: read-only なので commit 不要、setMode のみ
  if (from === 'preview') {
    useEditorStore.getState().setMode(to);
    return { success: true };
  }

  // [A] WYSIWYG → 他
  if (from === 'wysiwyg') {
    const content = getCurrentEditorContent();
    const result = commitFromWysiwyg(content);
    if (!result.success) return result;
  }

  // [B] Code → 他
  if (from === 'code') {
    const content = getCurrentEditorContent();
    const result = commitFromCode(content);
    if (!result.success) return result;
  }

  // [C] → Preview の場合、SEOメタデータを反映
  if (to === 'preview') {
    // getPreviewHtml() が SEO 反映を行う
  }

  // モードを切替
  useEditorStore.getState().setMode(to);
  return { success: true };
}
