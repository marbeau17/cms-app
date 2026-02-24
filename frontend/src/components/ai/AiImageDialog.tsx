// ============================================================
// CMS v1.2.0 - AI Image Dialog (Nano Banana 3 Modes)
// t2i: text-to-image (新規生成)
// i2i: image+text-to-image (編集: 背景変更等)
// m2i: multi-image-to-image (合成・スタイル転写)
// ============================================================
import React, { useState } from 'react';
import { useAiStore, useDocumentStore } from '@/stores';
import { aiGenerateImage, ftpUploadImage } from '@/services/api';
import { showToast } from '../common/Toast';
import type { AiMode } from '@/types';

const css: Record<string, React.CSSProperties> = {
  root: { fontSize: 13 },
  heading: { fontWeight: 600, fontSize: 14, margin: '0 0 12px', color: '#1a3a5c' },
  modeBar: { display: 'flex', gap: 4, marginBottom: 12 },
  modeBtn: {
    flex: 1, padding: '8px 4px', border: '1px solid #ddd', borderRadius: 6,
    background: '#fff', cursor: 'pointer', fontSize: 11, textAlign: 'center' as const,
  },
  modeBtnActive: { background: '#2e75b6', color: '#fff', borderColor: '#2e75b6' },
  group: { marginBottom: 12 },
  label: {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#555',
    marginBottom: 4, textTransform: 'uppercase' as const,
  },
  input: {
    width: '100%', boxSizing: 'border-box' as const, padding: '6px 8px',
    border: '1px solid #ddd', borderRadius: 4, fontSize: 13,
  },
  textarea: {
    width: '100%', boxSizing: 'border-box' as const, padding: '6px 8px',
    border: '1px solid #ddd', borderRadius: 4, fontSize: 13,
    resize: 'vertical' as const, minHeight: 60,
  },
  slider: { width: '100%' },
  generateBtn: {
    width: '100%', padding: '10px', border: 'none', borderRadius: 6,
    background: '#2e75b6', color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  preview: {
    width: '100%', maxHeight: 200, borderRadius: 6, border: '1px solid #ddd',
    objectFit: 'contain' as const, background: '#f8f8f8',
  },
  actions: { display: 'flex', gap: 8, marginTop: 8 },
  actionBtn: {
    flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: 4,
    background: '#fff', cursor: 'pointer', fontSize: 12, textAlign: 'center' as const,
  },
  hint: { fontSize: 11, color: '#999', marginTop: 2 },
  error: { color: '#c0392b', fontSize: 12, padding: 8, background: '#fde8e8', borderRadius: 4 },
  tag: {
    fontSize: 10, padding: '2px 6px', background: '#d4edda', color: '#155724',
    borderRadius: 3, display: 'inline-block', marginBottom: 8,
  },
};

const modes: { key: AiMode; label: string; icon: string; desc: string }[] = [
  { key: 't2i', label: '新規生成', icon: '✨', desc: 'テキストから画像を生成' },
  { key: 'i2i', label: '編集', icon: '🎨', desc: '既存画像の背景変更等' },
  { key: 'm2i', label: '合成', icon: '🔀', desc: '複数画像の合成・スタイル転写' },
];

/** Convert a base64 data URL to a File object for FTP upload */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, b64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export function AiImageDialog() {
  const ai = useAiStore();
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [initImagePreview, setInitImagePreview] = useState<string | null>(null);
  const [multiImagePreviews, setMultiImagePreviews] = useState<string[]>([]);
  const [styleImagePreview, setStyleImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 内部ストレージ (base64データ)
  const initImageRef = React.useRef<string | null>(null);
  const multiImagesRef = React.useRef<string[]>([]);
  const styleImageRef = React.useRef<string | null>(null);

  /** 画像ファイルを base64 に変換 */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /** ベース画像選択 (i2i モード) */
  const handleInitImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setInitImagePreview(URL.createObjectURL(file));
    initImageRef.current = base64;
  };

  /** 複数画像選択 (m2i モード) */
  const handleMultiImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const previews = files.map((f) => URL.createObjectURL(f));
    const base64s = await Promise.all(files.map(fileToBase64));
    setMultiImagePreviews(previews);
    multiImagesRef.current = base64s;
  };

  /** スタイル参照画像選択 (m2i モード) */
  const handleStyleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setStyleImagePreview(URL.createObjectURL(file));
    styleImageRef.current = base64;
  };

  /** AI 画像生成実行 */
  const handleGenerate = async () => {
    if (!ai.prompt.trim()) return;
    ai.setGenerating(true);
    ai.setError(null);
    ai.setGeneratedImage(null);

    try {
      const res = await aiGenerateImage({
        mode: ai.selectedMode,
        prompt: ai.prompt,
        width,
        height,
        init_image: ai.selectedMode === 'i2i' ? (initImageRef.current ?? undefined) : undefined,
        strength: ai.selectedMode === 'i2i' ? ai.strength : undefined,
        images: ai.selectedMode === 'm2i' ? multiImagesRef.current : undefined,
        style_image: ai.selectedMode === 'm2i' ? (styleImageRef.current ?? undefined) : undefined,
      });
      ai.setGeneratedImage(`data:image/png;base64,${res.imageBase64}`);
    } catch (e) {
      ai.setError(String(e));
    } finally {
      ai.setGenerating(false);
    }
  };

  /** 生成結果を承認 → FTPアップロード → DOM に <img> を挿入 */
  const handleApprove = async () => {
    if (!ai.generatedImage) return;

    const docStore = useDocumentStore.getState();
    if (!docStore.currentFilePath) {
      showToast('ファイルを先に開いてください', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      // 1. Generate a unique filename
      const timestamp = Date.now();
      const filename = `ai-${ai.selectedMode}-${timestamp}.png`;

      // 2. Determine the upload directory (same directory as current file)
      const filePath = docStore.currentFilePath;
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
      const imageDirPath = dirPath.endsWith('/') ? `${dirPath}images` : `${dirPath}/images`;

      // 3. Convert data URL to File and upload to FTP
      const file = dataUrlToFile(ai.generatedImage, filename);
      const uploadResult = await ftpUploadImage(imageDirPath, file);

      // 4. Insert <img> tag into document DOM
      const relativePath = `images/${filename}`;
      if (docStore.domTree) {
        const imgEl = docStore.domTree.createElement('img');
        imgEl.setAttribute('src', relativePath);
        imgEl.setAttribute('alt', ai.prompt.slice(0, 100));
        imgEl.setAttribute('width', String(width));
        imgEl.setAttribute('height', String(height));
        imgEl.setAttribute('loading', 'lazy');

        // Insert at end of body
        docStore.domTree.body.appendChild(imgEl);

        // Serialize back to canonical HTML
        const doctype = docStore.domTree.doctype
          ? `<!DOCTYPE ${docStore.domTree.doctype.name}>\n`
          : '<!DOCTYPE html>\n';
        const html = doctype + docStore.domTree.documentElement.outerHTML;
        docStore.updateCanonicalHtml(html);
      }

      showToast(`画像をアップロードしました: ${uploadResult.url}`, 'success');
      ai.setGeneratedImage(null);
      ai.setPrompt('');
    } catch (e) {
      showToast(`アップロードエラー: ${e}`, 'error', 5000);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={css.root}>
      <h4 style={css.heading}>🎨 AI 画像生成</h4>
      <span style={css.tag}>v1.2.0 3モード対応</span>

      {/* モード選択 */}
      <div style={css.modeBar}>
        {modes.map((m) => (
          <button
            key={m.key}
            style={{ ...css.modeBtn, ...(ai.selectedMode === m.key ? css.modeBtnActive : {}) }}
            onClick={() => ai.setMode(m.key)}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>
      <div style={css.hint}>
        {modes.find((m) => m.key === ai.selectedMode)?.desc}
      </div>

      {/* i2i: ベース画像アップロード */}
      {ai.selectedMode === 'i2i' && (
        <div style={{ ...css.group, marginTop: 12 }}>
          <label style={css.label}>ベース画像 (商品画像等)</label>
          <input type="file" accept="image/*" onChange={handleInitImage} style={{ fontSize: 12 }} />
          {initImagePreview && (
            <img src={initImagePreview} alt="Base" style={{ ...css.preview, marginTop: 8 }} />
          )}
          <div style={{ ...css.group, marginTop: 8 }}>
            <label style={css.label}>
              元画像保持度 (strength): {ai.strength.toFixed(2)}
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={ai.strength}
              onChange={(e) => ai.setStrength(parseFloat(e.target.value))}
              style={css.slider}
            />
            <div style={css.hint}>
              0.2-0.4: 背景のみ変更 / 0.5-0.7: 大幅な雰囲気変更 / 0.8-1.0: ほぼ新規生成
            </div>
          </div>
        </div>
      )}

      {/* m2i: 複数画像アップロード + スタイル参照画像 (v1.2.0) */}
      {ai.selectedMode === 'm2i' && (
        <div style={{ ...css.group, marginTop: 12 }}>
          <label style={css.label}>ベース画像 (複数選択可)</label>
          <input
            type="file" accept="image/*" multiple
            onChange={handleMultiImages}
            style={{ fontSize: 12 }}
          />
          {multiImagePreviews.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {multiImagePreviews.map((src, i) => (
                <img key={i} src={src} alt={`img-${i}`}
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }} />
              ))}
            </div>
          )}
          <label style={{ ...css.label, marginTop: 12 }}>スタイル参照画像 (任意)</label>
          <input
            type="file" accept="image/*"
            onChange={handleStyleImage}
            style={{ fontSize: 12 }}
          />
          {styleImagePreview && (
            <img src={styleImagePreview} alt="Style" style={{ ...css.preview, marginTop: 8, maxHeight: 100 }} />
          )}
          <div style={css.hint}>スタイル参照: 配色や雰囲気をベース画像に適用します</div>
        </div>
      )}

      {/* プロンプト */}
      <div style={{ ...css.group, marginTop: 12 }}>
        <label style={css.label}>プロンプト</label>
        <textarea
          style={css.textarea}
          value={ai.prompt}
          onChange={(e) => ai.setPrompt(e.target.value)}
          placeholder={
            ai.selectedMode === 't2i' ? '生成したい画像を説明...' :
            ai.selectedMode === 'i2i' ? '例: 背景を海辺のサンセットに変更' :
            '例: 商品Aの配色を商品Bに適用'
          }
          rows={3}
        />
      </div>

      {/* サイズ */}
      <div style={{ display: 'flex', gap: 8, ...css.group }}>
        <div style={{ flex: 1 }}>
          <label style={css.label}>幅 (px)</label>
          <input
            style={css.input} type="number" value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={css.label}>高さ (px)</label>
          <input
            style={css.input} type="number" value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
          />
        </div>
      </div>

      {/* 生成ボタン */}
      <button
        style={{ ...css.generateBtn, opacity: ai.isGenerating ? 0.5 : 1 }}
        onClick={handleGenerate}
        disabled={ai.isGenerating || !ai.prompt.trim()}
      >
        {ai.isGenerating ? '⏳ 生成中...' : '🚀 画像を生成'}
      </button>

      {/* エラー */}
      {ai.error && <div style={{ ...css.error, marginTop: 8 }}>⚠ {ai.error}</div>}

      {/* 生成結果プレビュー */}
      {ai.generatedImage && (
        <div style={{ marginTop: 12 }}>
          <label style={css.label}>生成結果</label>
          <img src={ai.generatedImage} alt="Generated" style={css.preview} />
          <div style={css.actions}>
            <button
              style={{ ...css.actionBtn, background: '#27ae60', color: '#fff', opacity: isUploading ? 0.5 : 1 }}
              onClick={handleApprove}
              disabled={isUploading}
            >
              {isUploading ? '⏳ アップロード中...' : '✅ 承認・挿入'}
            </button>
            <button style={css.actionBtn} onClick={handleGenerate} disabled={isUploading}>
              🔄 再生成
            </button>
            <button style={css.actionBtn} onClick={() => ai.setGeneratedImage(null)} disabled={isUploading}>
              ❌ キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
