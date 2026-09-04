/**
 * PDF text extraction in the browser using pdf.js (pdfjs-dist).
 *
 * The worker is loaded from a bundled URL so it works offline and on any host
 * without CORS configuration. We keep the worker disabled (useWorkerFetch:false,
 * disableWorker fallback) if the dynamic import path ever fails.
 */
import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker entry so it ships with the app and avoids CDN CORS.
// Vite resolves this to a hashed asset URL at build time.
const workerUrl = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
} catch {
  // ignore — falls back to running on main thread
}

export interface ExtractedPdf {
  text: string;
  pageCount: number;
  charCount: number;
}

/**
 * Extract plain text from a PDF File.
 * Throws on encrypted/corrupt PDFs so callers can show a friendly error.
 */
export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    parts.push(pageText);
  }

  const text = parts.join('\n\n').trim();
  return {
    text,
    pageCount: pdf.numPages,
    charCount: text.length,
  };
}

/**
 * A lightweight heuristic chunker: split long text into ~3k-char blocks on
 * sentence boundaries. Used when building a summarize prompt that may exceed
 * a model's practical input length.
 */
export function chunkText(text: string, maxChars = 3000): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    // try to break on a sentence end
    let breakAt = end;
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
      if (lastStop > maxChars * 0.5) breakAt = start + lastStop + 1;
    }
    chunks.push(text.slice(start, breakAt).trim());
    start = breakAt;
  }
  return chunks.filter(Boolean);
}
