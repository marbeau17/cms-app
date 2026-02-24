// ============================================================
// CMS v1.2.0 - Code Editor (Monaco)
// Mode 2: タグ付き編集 - HTML直接編集
// ============================================================
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useDocumentStore, useEditorStore } from '@/stores';

interface CodeEditorHandle {
  getValue: () => string;
}

export const CodeEditor = forwardRef<CodeEditorHandle>((_props, ref) => {
  const canonicalHtml = useDocumentStore((s) => s.canonicalHtmlString);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 親から getValue() を呼べるようにする
  useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.getValue() || '',
  }));

  const handleMount = (ed: editor.IStandaloneCodeEditor, _monaco: Monaco) => {
    editorRef.current = ed;
    ed.setValue(canonicalHtml);
    // Emmet-like features
    ed.updateOptions({
      minimap: { enabled: false },
      wordWrap: 'on',
      fontSize: 13,
      lineNumbers: 'on',
      folding: true,
      formatOnPaste: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
    });
  };

  // canonicalHtml が変わったら Monaco にセット
  useEffect(() => {
    if (editorRef.current && canonicalHtml) {
      const current = editorRef.current.getValue();
      if (current !== canonicalHtml) {
        editorRef.current.setValue(canonicalHtml);
      }
    }
  }, [canonicalHtml]);

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      // Debounced undo stack push (500ms)
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        pushUndo({
          html: value,
          timestamp: Date.now(),
          description: 'Code edit',
        });
      }, 500);
    }
  }, [pushUndo]);

  return (
    <div style={{ height: '100%' }}>
      <Editor
        height="100%"
        defaultLanguage="html"
        theme="vs-light"
        onChange={handleChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          fontSize: 13,
          tabSize: 2,
          automaticLayout: true,
        }}
      />
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
