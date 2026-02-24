// ============================================================
// CMS v1.2.0 - WYSIWYG Editor (Tiptap)
// Mode 1: タグなし編集 - 非エンジニア向けリッチテキスト編集
// ============================================================
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { useDocumentStore, useEditorStore } from '@/stores';

const css: Record<string, React.CSSProperties> = {
  root: { height: '100%', display: 'flex', flexDirection: 'column' },
  toolbar: {
    display: 'flex', gap: 4, padding: '8px 12px',
    borderBottom: '1px solid #eee', background: '#fafafa', flexShrink: 0, flexWrap: 'wrap',
  },
  btn: {
    padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4,
    background: '#fff', cursor: 'pointer', fontSize: 13, minWidth: 32,
  },
  btnActive: { background: '#2e75b6', color: '#fff', borderColor: '#2e75b6' },
  editor: { flex: 1, overflow: 'auto', padding: '16px 24px' },
};

interface WysiwygEditorHandle {
  getHTML: () => string;
}

export const WysiwygEditor = forwardRef<WysiwygEditorHandle>((_props, ref) => {
  const canonicalHtml = useDocumentStore((s) => s.canonicalHtmlString);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Image.configure({ allowBase64: true }),
      Link.configure({ openOnClick: false }),
    ],
    content: '',
    onUpdate: ({ editor: e }) => {
      // Debounced undo stack push (500ms)
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        pushUndo({
          html: e.getHTML(),
          timestamp: Date.now(),
          description: 'WYSIWYG edit',
        });
      }, 500);
    },
  });

  // canonicalHtml が変わったら（モード切替時など）エディタを再初期化
  useEffect(() => {
    if (editor && canonicalHtml) {
      // body 内のコンテンツのみ抽出して Tiptap にセット
      const parser = new DOMParser();
      const doc = parser.parseFromString(canonicalHtml, 'text/html');
      const editableAreas = doc.querySelectorAll('[data-editable]');
      if (editableAreas.length > 0) {
        // data-editable 領域のみ
        const fragments = Array.from(editableAreas).map((el) => el.innerHTML).join('');
        editor.commands.setContent(fragments, false);
      } else {
        editor.commands.setContent(doc.body.innerHTML, false);
      }
    }
  }, [editor, canonicalHtml]);

  // 親コンポーネントから getHTML() を呼べるようにする
  useImperativeHandle(ref, () => ({
    getHTML: () => editor?.getHTML() || '',
  }));

  if (!editor) return null;

  const ToolBtn: React.FC<{
    action: () => void; active?: boolean; label: string; title?: string;
  }> = ({ action, active, label, title }) => (
    <button
      style={{ ...css.btn, ...(active ? css.btnActive : {}) }}
      onClick={action}
      title={title || label}
    >
      {label}
    </button>
  );

  return (
    <div style={css.root}>
      <div style={css.toolbar}>
        <ToolBtn label="B" title="太字" active={editor.isActive('bold')}
          action={() => editor.chain().focus().toggleBold().run()} />
        <ToolBtn label="I" title="斜体" active={editor.isActive('italic')}
          action={() => editor.chain().focus().toggleItalic().run()} />
        <ToolBtn label="S" title="取り消し線" active={editor.isActive('strike')}
          action={() => editor.chain().focus().toggleStrike().run()} />
        <span style={{ borderLeft: '1px solid #ddd', margin: '0 4px' }} />
        <ToolBtn label="H1" active={editor.isActive('heading', { level: 1 })}
          action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolBtn label="H2" active={editor.isActive('heading', { level: 2 })}
          action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolBtn label="H3" active={editor.isActive('heading', { level: 3 })}
          action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span style={{ borderLeft: '1px solid #ddd', margin: '0 4px' }} />
        <ToolBtn label="●" title="箇条書き" active={editor.isActive('bulletList')}
          action={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolBtn label="1." title="番号付き" active={editor.isActive('orderedList')}
          action={() => editor.chain().focus().toggleOrderedList().run()} />
        <span style={{ borderLeft: '1px solid #ddd', margin: '0 4px' }} />
        <ToolBtn label="🔗" title="リンク"
          action={() => {
            const url = prompt('リンクURLを入力:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }} />
        <ToolBtn label="🖼" title="画像URL"
          action={() => {
            const url = prompt('画像URLを入力:');
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }} />
        <ToolBtn label="↩" title="Undo" action={() => editor.chain().focus().undo().run()} />
        <ToolBtn label="↪" title="Redo" action={() => editor.chain().focus().redo().run()} />
      </div>

      <div
        style={css.editor}
        className="tiptap-editor"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
          files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (editor && typeof reader.result === 'string') {
                editor.chain().focus().setImage({ src: reader.result }).run();
              }
            };
            reader.readAsDataURL(file);
          });
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

WysiwygEditor.displayName = 'WysiwygEditor';

export default WysiwygEditor;
