// ============================================================
// CMS v1.2.0 - Shared Type Definitions
// All agents reference this file as the single source of truth
// ============================================================

// ── FTP / File System ────────────────────────────────────
export interface FtpEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  mimeType?: string;
}

// ── BFF API Response Types ───────────────────────────────
export interface FtpReadResponse {
  content: string;          // UTF-8 text (for text files) or base64 (for binary)
  detectedEncoding: string; // e.g., 'shift_jis', 'euc-jp', 'utf-8'
  mimeType: string;
}

export interface FtpWriteRequest {
  path: string;
  content: string;       // UTF-8 HTML string
  encoding?: string;     // Target encoding (default: original detectedEncoding)
}

export interface FtpWriteResponse {
  status: 'ok' | 'error';
  message?: string;
}

// ── AI Image Generation (Nano Banana 3 Modes) ───────────
export type AiMode = 't2i' | 'i2i' | 'm2i';

export interface AiGenerateRequest {
  mode: AiMode;
  prompt: string;
  width: number;
  height: number;
  init_image?: string;      // base64 (for i2i)
  strength?: number;        // 0.0-1.0 (for i2i)
  images?: string[];        // base64 array (for m2i)
  style_image?: string;     // base64 (for m2i)
}

export interface AiGenerateResponse {
  imageBase64: string;
}

// ── Editor Modes ─────────────────────────────────────────
export type EditorMode = 'wysiwyg' | 'code' | 'preview';

// ── SEO Metadata (v1.2.0) ────────────────────────────────
export interface SeoData {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  canonical: string;
  robots: string;
}

export const DEFAULT_SEO: SeoData = {
  title: '',
  description: '',
  keywords: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  canonical: '',
  robots: 'index, follow',
};

// ── Image Insertion Position (v1.1.0/v1.2.0) ────────────
export type InsertPosition = 'inside' | 'after';

export interface InsertionTarget {
  element: HTMLElement;
  tagName: string;
  position: InsertPosition;
}

// ── Undo/Redo Stack ──────────────────────────────────────
export interface HistoryEntry {
  html: string;
  timestamp: number;
  description: string;
}

// ── Asset Cache ──────────────────────────────────────────
export interface CachedAsset {
  ftpPath: string;
  blob: Blob;
  mimeType: string;
  cachedAt: number;
}

// ── Service Worker Messages ──────────────────────────────
export interface SwUpdateMessage {
  type: 'update-html';
  html: string;
}

export interface SwClearMessage {
  type: 'clear-cache';
}

export type SwMessage = SwUpdateMessage | SwClearMessage;

// ── Block-level elements for insertion UI (v1.1.0) ──────
export const BLOCK_ELEMENTS = [
  'section', 'div', 'article', 'main', 'aside',
  'p', 'figure', 'header', 'footer', 'nav',
] as const;
