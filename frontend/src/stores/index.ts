// ============================================================
// CMS v1.2.0 - Zustand Stores (All 6 Stores)
// ============================================================
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  FtpEntry, EditorMode, SeoData, AiMode, HistoryEntry,
} from '@/types';

// ── 1. FileTreeStore ─────────────────────────────────────
interface FileTreeState {
  entries: FtpEntry[];
  selectedPath: string | null;
  expandedDirs: Set<string>;
  loading: boolean;
  error: string | null;
  setEntries: (entries: FtpEntry[]) => void;
  selectFile: (path: string) => void;
  toggleDir: (path: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const useFileTreeStore = create<FileTreeState>()(
  immer((set) => ({
    entries: [],
    selectedPath: null,
    expandedDirs: new Set<string>(),
    loading: false,
    error: null,
    setEntries: (entries) => set((s) => { s.entries = entries; }),
    selectFile: (path) => set((s) => { s.selectedPath = path; }),
    toggleDir: (path) => set((s) => {
      if (s.expandedDirs.has(path)) s.expandedDirs.delete(path);
      else s.expandedDirs.add(path);
    }),
    setLoading: (v) => set((s) => { s.loading = v; }),
    setError: (e) => set((s) => { s.error = e; }),
  }))
);

// ── 2. DocumentStore (Single Source of Truth) ────────────
// NOTE: DOM Document objects are not compatible with immer's WritableDraft,
// so this store uses plain zustand (no immer middleware).
interface DocumentState {
  /** Parsed DOM tree for editing */
  domTree: Document | null;
  /** Canonical HTML string - THE single source of truth (v1.2.0) */
  canonicalHtmlString: string;
  /** Original HTML as fetched from FTP (for reset) */
  originalHtml: string;
  /** Detected character encoding (e.g., 'shift_jis') */
  detectedEncoding: string;
  /** Current file path on FTP */
  currentFilePath: string | null;
  /** Dirty flag */
  isDirty: boolean;

  setDocument: (html: string, encoding: string, filePath: string) => void;
  updateCanonicalHtml: (html: string) => void;
  updateDomTree: (doc: Document) => void;
  setDirty: (v: boolean) => void;
  reset: () => void;
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  domTree: null,
  canonicalHtmlString: '',
  originalHtml: '',
  detectedEncoding: 'utf-8',
  currentFilePath: null,
  isDirty: false,

  setDocument: (html, encoding, filePath) => {
    const parser = new DOMParser();
    set({
      originalHtml: html,
      canonicalHtmlString: html,
      detectedEncoding: encoding,
      currentFilePath: filePath,
      isDirty: false,
      domTree: parser.parseFromString(html, 'text/html'),
    });
  },

  updateCanonicalHtml: (html) => set({ canonicalHtmlString: html, isDirty: true }),

  updateDomTree: (doc) => set({ domTree: doc }),

  setDirty: (v) => set({ isDirty: v }),

  reset: () => {
    const { originalHtml } = get();
    const parser = new DOMParser();
    set({
      canonicalHtmlString: originalHtml,
      isDirty: false,
      domTree: originalHtml ? parser.parseFromString(originalHtml, 'text/html') : null,
    });
  },
}));

// ── 3. EditorStore ───────────────────────────────────────
interface EditorState {
  mode: EditorMode;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  isSaving: boolean;

  setMode: (mode: EditorMode) => void;
  pushUndo: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  setSaving: (v: boolean) => void;
}

const MAX_UNDO = 50;

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    mode: 'wysiwyg',
    undoStack: [],
    redoStack: [],
    isSaving: false,

    setMode: (mode) => set((s) => { s.mode = mode; }),

    pushUndo: (entry) => set((s) => {
      s.undoStack.push(entry);
      if (s.undoStack.length > MAX_UNDO) s.undoStack.shift();
      s.redoStack = []; // Clear redo on new action
    }),

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0) return null;
      const entry = state.undoStack[state.undoStack.length - 1];
      set((s) => {
        const popped = s.undoStack.pop();
        if (popped) s.redoStack.push(popped);
      });
      return entry ?? null;
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0) return null;
      const entry = state.redoStack[state.redoStack.length - 1];
      set((s) => {
        const popped = s.redoStack.pop();
        if (popped) s.undoStack.push(popped);
      });
      return entry ?? null;
    },

    setSaving: (v) => set((s) => { s.isSaving = v; }),
  }))
);

// ── 4. SeoStore (v1.2.0 New) ─────────────────────────────
interface SeoState extends SeoData {
  setSeoField: <K extends keyof SeoData>(key: K, value: SeoData[K]) => void;
  loadFromDocument: (doc: Document) => void;
  applyToDocument: (doc: Document) => void;
  resetSeo: () => void;
}

export const useSeoStore = create<SeoState>()(
  immer((set, get) => ({
    title: '',
    description: '',
    keywords: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    canonical: '',
    robots: 'index, follow',

    setSeoField: (key, value) => set((s) => { (s as any)[key] = value; }),

    loadFromDocument: (doc) => set((s) => {
      s.title = doc.querySelector('title')?.textContent || '';
      s.description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      s.keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
      s.ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      s.ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      s.ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      s.canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
      s.robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || 'index, follow';
    }),

    applyToDocument: (doc) => {
      const state = get();

      // v1.2.0 セキュリティ: SEO入力値のサニタイズ (<script>注入防止)
      const sanitize = (val: string): string => {
        return val
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
      };
      // title は textContent で設定するためHTMLエスケープ不要だが、
      // attribute値に設定するメタタグはサニタイズ必須
      const safeDesc = sanitize(state.description);
      const safeKeywords = sanitize(state.keywords);
      const safeOgTitle = sanitize(state.ogTitle);
      const safeOgDesc = sanitize(state.ogDescription);
      const safeOgImage = sanitize(state.ogImage);
      const safeRobots = sanitize(state.robots);
      const safeCanonical = sanitize(state.canonical);

      // title (textContent は安全)
      let titleEl = doc.querySelector('title');
      if (state.title) {
        if (!titleEl) { titleEl = doc.createElement('title'); doc.head.appendChild(titleEl); }
        titleEl.textContent = state.title;
      } else if (titleEl) { titleEl.remove(); }

      // Helper: set or create meta
      const setMeta = (selector: string, attr: string, value: string, createTag: () => HTMLElement) => {
        let el = doc.querySelector(selector);
        if (value) {
          if (!el) { el = createTag(); doc.head.appendChild(el); }
          el.setAttribute(attr, value);
        } else if (el) { el.remove(); }
      };

      setMeta('meta[name="description"]', 'content', safeDesc, () => {
        const m = doc.createElement('meta'); m.setAttribute('name', 'description'); return m;
      });
      setMeta('meta[name="keywords"]', 'content', safeKeywords, () => {
        const m = doc.createElement('meta'); m.setAttribute('name', 'keywords'); return m;
      });
      setMeta('meta[property="og:title"]', 'content', safeOgTitle, () => {
        const m = doc.createElement('meta'); m.setAttribute('property', 'og:title'); return m;
      });
      setMeta('meta[property="og:description"]', 'content', safeOgDesc, () => {
        const m = doc.createElement('meta'); m.setAttribute('property', 'og:description'); return m;
      });
      setMeta('meta[property="og:image"]', 'content', safeOgImage, () => {
        const m = doc.createElement('meta'); m.setAttribute('property', 'og:image'); return m;
      });
      setMeta('meta[name="robots"]', 'content', safeRobots, () => {
        const m = doc.createElement('meta'); m.setAttribute('name', 'robots'); return m;
      });
      // canonical link
      let canonicalEl = doc.querySelector('link[rel="canonical"]');
      if (state.canonical) {
        if (!canonicalEl) {
          canonicalEl = doc.createElement('link');
          canonicalEl.setAttribute('rel', 'canonical');
          doc.head.appendChild(canonicalEl);
        }
        canonicalEl.setAttribute('href', safeCanonical);
      } else if (canonicalEl) { canonicalEl.remove(); }
    },

    resetSeo: () => set((s) => {
      s.title = ''; s.description = ''; s.keywords = '';
      s.ogTitle = ''; s.ogDescription = ''; s.ogImage = '';
      s.canonical = ''; s.robots = 'index, follow';
    }),
  }))
);

// ── 5. AssetCacheStore ───────────────────────────────────
interface AssetCacheState {
  cachedPaths: Set<string>;
  addCachedPath: (path: string) => void;
  clearCache: () => void;
}

export const useAssetCacheStore = create<AssetCacheState>()(
  immer((set) => ({
    cachedPaths: new Set<string>(),
    addCachedPath: (path) => set((s) => { s.cachedPaths.add(path); }),
    clearCache: () => set((s) => { s.cachedPaths.clear(); }),
  }))
);

// ── 6. AIStore (v1.2.0 updated: 3 modes) ────────────────
interface AiState {
  isGenerating: boolean;
  selectedMode: AiMode;
  prompt: string;
  strength: number;         // for i2i mode
  generatedImage: string | null;
  error: string | null;

  setMode: (mode: AiMode) => void;
  setPrompt: (prompt: string) => void;
  setStrength: (v: number) => void;
  setGenerating: (v: boolean) => void;
  setGeneratedImage: (img: string | null) => void;
  setError: (e: string | null) => void;
  resetAi: () => void;
}

export const useAiStore = create<AiState>()(
  immer((set) => ({
    isGenerating: false,
    selectedMode: 't2i',
    prompt: '',
    strength: 0.3,
    generatedImage: null,
    error: null,

    setMode: (mode) => set((s) => { s.selectedMode = mode; }),
    setPrompt: (prompt) => set((s) => { s.prompt = prompt; }),
    setStrength: (v) => set((s) => { s.strength = v; }),
    setGenerating: (v) => set((s) => { s.isGenerating = v; }),
    setGeneratedImage: (img) => set((s) => { s.generatedImage = img; }),
    setError: (e) => set((s) => { s.error = e; }),
    resetAi: () => set((s) => {
      s.isGenerating = false; s.prompt = ''; s.generatedImage = null; s.error = null;
    }),
  }))
);
