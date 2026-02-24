// ============================================================
// CMS v1.2.0 - Service Worker Bridge
// React から SW へのメッセージ送受信ユーティリティ
// ============================================================

/** SW にキャッシュクリアを指示 */
export async function clearSwCache(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage({ type: 'clear-cache' });
}
