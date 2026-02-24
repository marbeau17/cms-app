// ============================================================
// CMS v1.2.0 - Sidebar (FTP File Tree)
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useFileTreeStore } from '@/stores';
import { ftpList } from '@/services/api';
import type { FtpEntry } from '@/types';

const css: Record<string, React.CSSProperties> = {
  root: { padding: 8, fontSize: 13 },
  header: {
    fontWeight: 600, fontSize: 13, padding: '8px 4px',
    borderBottom: '1px solid #eee', marginBottom: 8,
  },
  search: {
    width: '100%', boxSizing: 'border-box', padding: '6px 8px',
    border: '1px solid #ddd', borderRadius: 4, marginBottom: 8, fontSize: 12,
  },
  item: {
    padding: '4px 8px', cursor: 'pointer', borderRadius: 4,
    display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' as const,
  },
  selected: { background: '#e3f2fd' },
  dirIcon: { fontSize: 14 },
  error: { color: '#c0392b', fontSize: 12, padding: 8 },
};

export function Sidebar() {
  const {
    entries, selectedPath, expandedDirs, loading, error,
    setEntries, selectFile, toggleDir, setLoading, setError,
  } = useFileTreeStore();
  const [filter, setFilter] = useState('');
  const initialLoadDone = useRef(false);

  // Read latest entries from store inside callback to avoid stale closure
  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await ftpList(path);
      // Get fresh entries from store (avoids stale closure)
      const currentEntries = useFileTreeStore.getState().entries;
      // Deduplicate: remove existing entries under this directory, then add fresh ones
      const existingPaths = new Set(list.map((e) => e.path));
      const filtered = currentEntries.filter((e) => {
        // Keep entries not under this path
        const dir = e.path.substring(0, e.path.lastIndexOf('/')) || '/';
        if (dir === path) return !existingPaths.has(e.path); // dedup
        return true;
      });
      setEntries([...filtered, ...list]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [setEntries, setLoading, setError]);

  // Initial load (run only once)
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadDir('/');
    }
  }, [loadDir]);

  const handleClick = (entry: FtpEntry) => {
    if (entry.type === 'directory') {
      toggleDir(entry.path);
      if (!expandedDirs.has(entry.path)) {
        loadDir(entry.path);
      }
    } else {
      selectFile(entry.path);
    }
  };

  // ツリー構築
  const buildTree = (parentPath: string, depth: number): React.ReactNode[] => {
    const children = entries.filter((e) => {
      const dir = e.path.substring(0, e.path.lastIndexOf('/')) || '/';
      return dir === parentPath;
    });
    const filtered = filter
      ? children.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
      : children;

    // ディレクトリ先、ファイル後
    filtered.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return filtered.map((entry) => {
      const isOpen = expandedDirs.has(entry.path);
      const isSelected = selectedPath === entry.path;
      const isHtml = /\.(html?|htm)$/i.test(entry.name);
      const indent = depth * 16;

      return (
        <React.Fragment key={entry.path}>
          <div
            style={{
              ...css.item,
              ...(isSelected ? css.selected : {}),
              paddingLeft: indent + 8,
              fontWeight: isHtml ? 600 : 400,
            }}
            onClick={() => handleClick(entry)}
            title={entry.path}
          >
            <span style={css.dirIcon}>
              {entry.type === 'directory'
                ? (isOpen ? '📂' : '📁')
                : (isHtml ? '🌐' : '📄')}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
          </div>
          {entry.type === 'directory' && isOpen && buildTree(entry.path, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <div style={css.root}>
      <div style={css.header}>📁 ファイルツリー</div>
      <input
        style={css.search}
        type="text"
        placeholder="🔍 ファイル検索..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {loading && <div style={{ fontSize: 12, padding: 4 }}>読み込み中...</div>}
      {error && <div style={css.error}>⚠ {error}</div>}
      {buildTree('/', 0)}
    </div>
  );
}
