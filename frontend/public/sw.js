// ============================================================
// CMS v1.2.0 - Service Worker (On-demand Dynamic Proxy)
// v1.1.0: Pre-fetch廃止 → オンデマンド取得
// /preview/* へのリクエストをインターセプトし、
// IndexedDBキャッシュ or BFF経由でFTPから取得
// ============================================================

const CACHE_DB_NAME = 'cms-asset-cache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = 'assets';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30分
const CACHE_MAX_ENTRIES = 500; // LRU上限

// ── IndexedDB Helpers ────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'ftpPath' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getFromCache(ftpPath) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
    const store = tx.objectStore(CACHE_STORE_NAME);
    const req = store.get(ftpPath);
    req.onsuccess = () => {
      const entry = req.result;
      if (!entry) return resolve(null);
      // TTL check
      if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
        resolve(null); // expired
      } else {
        resolve(entry);
      }
    };
    req.onerror = () => resolve(null);
  });
}

async function putToCache(ftpPath, blob, mimeType) {
  const db = await openDB();
  // LRU eviction: エントリ数が上限を超えたら最古エントリを削除
  await evictLRU(db);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CACHE_STORE_NAME);
    store.put({ ftpPath, blob, mimeType, cachedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function evictLRU(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CACHE_STORE_NAME);
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result < CACHE_MAX_ENTRIES) return resolve();
      // 全エントリ取得して cachedAt でソート、古い順に削除
      const all = store.getAll();
      all.onsuccess = () => {
        const entries = all.result.sort((a, b) => a.cachedAt - b.cachedAt);
        const toDelete = entries.length - CACHE_MAX_ENTRIES + 10; // 10件余裕を持って削除
        for (let i = 0; i < Math.max(0, toDelete); i++) {
          store.delete(entries[i].ftpPath);
        }
        resolve();
      };
      all.onerror = () => resolve();
    };
    countReq.onerror = () => resolve();
  });
}

async function clearAllCache() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
    tx.objectStore(CACHE_STORE_NAME).clear();
    tx.oncomplete = () => resolve();
  });
}

// ── base64 → Blob ────────────────────────────────────────

function base64ToBlob(base64, mimeType) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// ── Fetch Event Handler ──────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // /preview/* リクエストのみインターセプト
  if (!url.pathname.startsWith('/preview/')) return;

  // FTPパスを算出: /preview/css/style.css → /css/style.css
  const ftpPath = url.pathname.replace('/preview', '') || '/';

  // 外部CDNリクエスト (// で始まる) はインターセプトしない
  // (ブラウザが解決した後は通常のURLになるため、ここには来ない)

  event.respondWith(
    (async () => {
      // 1. キャッシュチェック
      const cached = await getFromCache(ftpPath);
      if (cached) {
        return new Response(cached.blob, {
          headers: { 'Content-Type': cached.mimeType },
        });
      }

      // 2. BFF経由でFTPから取得
      try {
        const apiUrl = `/api/ftp/read?path=${encodeURIComponent(ftpPath)}`;
        const res = await fetch(apiUrl);
        if (!res.ok) {
          return new Response('Not Found', { status: 404 });
        }

        const data = await res.json();
        let blob;

        if (data.detectedEncoding === 'binary') {
          // バイナリ: base64 → Blob
          blob = base64ToBlob(data.content, data.mimeType);
        } else {
          // テキスト: UTF-8文字列 → Blob
          blob = new Blob([data.content], { type: data.mimeType });
        }

        // 3. キャッシュに保存
        await putToCache(ftpPath, blob, data.mimeType);

        return new Response(blob, {
          headers: { 'Content-Type': data.mimeType },
        });
      } catch (err) {
        return new Response('Service Worker fetch error', { status: 502 });
      }
    })()
  );
});

// ── Message Handler ──────────────────────────────────────

self.addEventListener('message', async (event) => {
  const { type } = event.data;

  if (type === 'clear-cache') {
    await clearAllCache();
  }
});

// ── Install / Activate ───────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
