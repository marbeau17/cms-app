// ============================================================
// CMS v1.2.0 - BFF API Client
// ============================================================
import type {
  FtpEntry, FtpReadResponse, FtpWriteRequest, FtpWriteResponse,
  AiGenerateRequest, AiGenerateResponse,
} from '@/types';

const BASE = '/api';

// ── CSRF Token Management (仕様6.1) ────────────────────
let _csrfToken: string | null = null;

async function ensureCsrfToken(): Promise<string> {
  if (_csrfToken) return _csrfToken;
  const res = await fetch(`${BASE}/csrf-token`);
  const data = await res.json();
  _csrfToken = data.csrfToken;
  return _csrfToken!;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    // CSRF失効時はリトライ
    if (res.status === 403) {
      _csrfToken = null;
      const token = await ensureCsrfToken();
      const retryHeaders = new Headers(options?.headers);
      retryHeaders.set('X-CSRF-Token', token);
      const retry = await fetch(url, { ...options, headers: retryHeaders });
      if (!retry.ok) throw new Error(`API Error ${retry.status}: ${await retry.text().catch(() => '')}`);
      return retry.json();
    }
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json();
}

/** POST用ヘッダー (CSRFトークン付き) */
async function postHeaders(contentType?: string): Promise<Record<string, string>> {
  const token = await ensureCsrfToken();
  const h: Record<string, string> = { 'X-CSRF-Token': token };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

/** FTP ファイル一覧取得 */
export async function ftpList(path: string): Promise<FtpEntry[]> {
  return request<FtpEntry[]>(`${BASE}/ftp/list?path=${encodeURIComponent(path)}`);
}

/** FTP ファイル読み取り (文字コード自動判定 → UTF-8変換済み) */
export async function ftpRead(path: string): Promise<FtpReadResponse> {
  return request<FtpReadResponse>(`${BASE}/ftp/read?path=${encodeURIComponent(path)}`);
}

/** FTP ファイル書き込み (BFF側で元の文字コードにエンコードして保存) */
export async function ftpWrite(req: FtpWriteRequest): Promise<FtpWriteResponse> {
  const headers = await postHeaders('application/json');
  return request<FtpWriteResponse>(`${BASE}/ftp/write`, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });
}

/** FTP 画像アップロード */
export async function ftpUploadImage(path: string, file: File): Promise<{ url: string }> {
  const token = await ensureCsrfToken();
  const form = new FormData();
  form.append('path', path);
  form.append('file', file);
  return request<{ url: string }>(`${BASE}/ftp/upload-image`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': token },
    body: form,
  });
}

/** AI 画像生成 (Nano Banana - 3モード対応 v1.2.0) */
export async function aiGenerateImage(req: AiGenerateRequest): Promise<AiGenerateResponse> {
  const headers = await postHeaders('application/json');
  return request<AiGenerateResponse>(`${BASE}/ai/generate-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });
}
