import { serverApiUrl } from './serverApi';

export type WebChapter = { id: string; url: string; title: string; selected: boolean; status: 'pending' | 'loading' | 'ready' | 'error'; content?: string; error?: string };
export type ExtractionOptions = { links: string; content: string; remove: string };
export const DEFAULT_EXTRACTION: ExtractionOptions = { links: '', content: '', remove: 'nav, header, footer, script, style, noscript, iframe, form, button, .ads, .advertisement, .navigation, .chapter-nav' };
export class WebImportError extends Error {
  constructor(message: string, public code?: string, public sourceUrl?: string) { super(message); }
}

export async function loadWebPage(url: string, signal?: AbortSignal): Promise<{ url: string; html: string }> {
  const response = await fetch(serverApiUrl('/api/web-import/resource'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('API tải web chưa hoạt động. Hãy khởi động lại máy chủ app.');
  const result = await response.json();
  if (!response.ok) throw new WebImportError(result.error || 'Không tải được trang.', result.code, result.sourceUrl);
  return result;
}
function documentFrom(html: string) { return new DOMParser().parseFromString(html, 'text/html'); }
export async function readHtmlFile(file: File) {
  const data = await file.arrayBuffer();
  const head = new TextDecoder('windows-1252').decode(data.slice(0, 4096));
  const charset = head.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || 'utf-8';
  try { return new TextDecoder(charset).decode(data); } catch { return new TextDecoder().decode(data); }
}
function absoluteUrl(value: string, base: string) {
  if (!value.trim()) return null;
  try { const url = new URL(value, base); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null; url.hash = ''; return url.href; } catch { return null; }
}
export function analyzeWebPage(html: string, url: string, options: ExtractionOptions) {
  const doc = documentFrom(html);
  const meta = (name: string) => doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content')?.trim() || '';
  const candidates = options.links ? doc.querySelectorAll(options.links) : doc.querySelectorAll('a[href]');
  const chapters: WebChapter[] = [];
  const seen = new Set<string>();
  for (const element of candidates) {
    const anchor = element.matches('a[href]') ? element : element.querySelector('a[href]');
    if (!anchor) continue;
    const title = anchor.textContent?.replace(/\s+/g, ' ').trim() || '';
    const href = absoluteUrl(anchor.getAttribute('href') || '', url);
    if (!href || !title || seen.has(href) || /^(?:javascript|#)/i.test(anchor.getAttribute('href') || '')) continue;
    if (new URL(href).origin !== new URL(url).origin) continue;
    if (!options.links && !/(?:第\s*[\d零〇一二两兩三四五六七八九十百千万萬]+\s*[章回节節卷]|\b(?:chương|chapter|chap|hồi)\s*\d+)/iu.test(title)) continue;
    seen.add(href);
    chapters.push({ id: crypto.randomUUID(), url: href, title, selected: true, status: 'pending' });
    if (chapters.length >= 5000) break;
  }
  return {
    title: meta('og:novel:book_name') || meta('og:title') || doc.querySelector('h1')?.textContent?.trim() || doc.title,
    author: meta('og:novel:author') || meta('author'),
    description: meta('og:description') || meta('description'),
    language: doc.documentElement.lang || 'zh',
    cover: absoluteUrl(meta('og:image'), url) || '',
    chapters,
  };
}
export function extractWebChapter(html: string, options: ExtractionOptions) {
  const doc = documentFrom(html);
  if (/just a moment|attention required|访问验证|安全验证|人机验证/i.test(doc.title) || doc.querySelector('#challenge-form, #cf-challenge-running')) throw new Error('Trang yêu cầu xác minh trình duyệt. Hãy nhập HTML đã lưu hoặc dán nội dung chương.');
  // Never render the downloaded HTML; it is only used as an inert parsing document.
  doc.querySelectorAll(options.remove || DEFAULT_EXTRACTION.remove).forEach(element => element.remove());
  let root = options.content ? doc.querySelector(options.content) : null;
  if (options.content && !root) throw new Error('Không tìm thấy vùng nội dung theo selector đã chọn.');
  if (!root) {
    const candidates = [...doc.querySelectorAll('#chaptercontent, #chapter-content, #content, .chapter-content, .reading-content, .entry-content, article, main')];
    root = candidates.sort((a, b) => (b.textContent?.length || 0) - (a.textContent?.length || 0))[0] || null;
  }
  if (!root) throw new Error('Chưa nhận diện được nội dung. Mở Tùy chỉnh lấy nội dung và nhập selector phù hợp.');
  root.querySelectorAll('br').forEach(element => element.replaceWith('\n'));
  root.querySelectorAll('p, div, h1, h2, h3, li, section').forEach(element => element.append('\n'));
  const text = (root.textContent || '').replace(/\u00a0/g, ' ').split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n\n');
  if (text.length < 40) throw new Error('Nội dung quá ngắn. Trang có thể cần JavaScript hoặc selector khác.');
  return text;
}

async function draftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('convert-web-import', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('draft');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readWebDraft<T>(): Promise<T | undefined> {
  const db = await draftDatabase();
  try { return await new Promise<T | undefined>((resolve, reject) => { const request = db.transaction('draft').objectStore('draft').get('current'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  finally { db.close(); }
}
export async function saveWebDraft(value: unknown) {
  const db = await draftDatabase();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('draft', 'readwrite'); tx.objectStore('draft').put(value, 'current'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
  finally { db.close(); }
}
