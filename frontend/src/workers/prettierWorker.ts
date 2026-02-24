// ============================================================
// CMS v1.2.0 - Prettier Web Worker
// 大規模HTMLのPrettier整形をWeb Workerでバックグラウンド実行
// UIブロックを回避
// ============================================================

import prettier from 'prettier/standalone';
import htmlParser from 'prettier/plugins/html';

declare const self: DedicatedWorkerGlobalScope;

interface FormatRequest {
  type: 'format';
  html: string;
  options?: {
    printWidth?: number;
    tabWidth?: number;
  };
}

interface FormatResponse {
  type: 'formatted';
  html: string;
  error?: string;
  duration: number;
}

self.onmessage = async (event: MessageEvent<FormatRequest>) => {
  const { html, options } = event.data;
  const start = performance.now();

  try {
    const formatted = await prettier.format(html, {
      parser: 'html',
      plugins: [htmlParser],
      printWidth: options?.printWidth ?? 120,
      tabWidth: options?.tabWidth ?? 2,
      htmlWhitespaceSensitivity: 'ignore' as const,
    });

    const response: FormatResponse = {
      type: 'formatted',
      html: formatted,
      duration: performance.now() - start,
    };
    self.postMessage(response);
  } catch (e) {
    const response: FormatResponse = {
      type: 'formatted',
      html: html, // 失敗時はオリジナルを返す
      error: String(e),
      duration: performance.now() - start,
    };
    self.postMessage(response);
  }
};
