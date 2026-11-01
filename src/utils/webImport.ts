import { serverApiUrl } from './serverApi';
import { readSavedWebFile } from './savedWebFile';

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
  return (await readSavedWebFile(file)).html;
}
function absoluteUrl(value: string, base: string) {
  if (!value.trim()) return null;
  try { const url = new URL(value, base); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null; url.hash = ''; return url.href; } catch { return null; }
}
export function analyzeWebPage(html: string, url: string, options: ExtractionOptions) {
  const doc = documentFrom(html);
  const linkBase = absoluteUrl(doc.querySelector('base[href]')?.getAttribute('href') || '', url) || url;
  const meta = (name: string) => doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content')?.trim() || '';
  const candidates = options.links ? doc.querySelectorAll(options.links) : doc.querySelectorAll('a[href]');
  const chapters: WebChapter[] = [];
  const seen = new Set<string>();
  for (const element of candidates) {
    const anchor = element.matches('a[href]') ? element : element.querySelector('a[href]');
    if (!anchor) continue;
    const title = anchor.textContent?.replace(/\s+/g, ' ').trim() || '';
    const href = absoluteUrl(anchor.getAttribute('data-original-href') || anchor.getAttribute('data-sf-original-href') || anchor.getAttribute('href') || '', linkBase);
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
export function analyzeSavedWebPage(html: string, suppliedUrl: string, options: ExtractionOptions, archiveUrl?: string) {
  const doc = documentFrom(html);
  const savedUrl = html.match(/<!--\s*saved from url=\(\d+\)(https?:\/\/[^\s<>]+)\s*-->/i)?.[1];
  const detected = [archiveUrl, savedUrl, doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), doc.querySelector('meta[property="og:url"]')?.getAttribute('content'), doc.querySelector('base[href]')?.getAttribute('href')].find(value => value && absoluteUrl(value, value));
  const url = suppliedUrl.trim() ? absoluteUrl(suppliedUrl.trim(), suppliedUrl.trim()) : detected ? absoluteUrl(detected, detected) : null;
  if (!url) throw new Error('Chưa xác định được URL gốc. Điền URL trang truyện hoặc mục lục rồi chọn lại tệp.');
  if (/just a moment|attention required|访问验证|安全验证|人机验证/i.test(doc.title) || doc.querySelector('#challenge-form, #cf-challenge-running')) throw new WebImportError('Tệp đang chứa trang xác minh, chưa có nội dung truyện. Hoàn tất xác minh trên trang gốc rồi lưu lại HTML hoặc MHTML.', 'SOURCE_VERIFICATION_REQUIRED', url);
  const result = analyzeWebPage(html, url, options);
  if (!result.chapters.length) {
    const chapterRoot = doc.querySelector(options.content || '#chaptercontent, #chapter-content, .chapter-content, .reading-content, article');
    const heading = doc.querySelector('h1, h2')?.textContent || doc.title;
    if (chapterRoot || /第\s*[\d零〇一二两兩三四五六七八九十百千万萬]+\s*[章回节節]|\b(?:chương|chapter)\s*\d+/iu.test(heading)) {
      const content = extractWebChapter(html, options);
      result.chapters.push({ id: crypto.randomUUID(), url, title: heading.trim() || result.title || 'Chương 1', selected: true, status: 'ready', content });
    }
  }
  if (!result.chapters.length) throw new Error('Tệp chưa có liên kết hoặc nội dung chương. Hãy lưu trang mục lục đầy đủ sau khi tải xong, hoặc chỉnh selector mục lục.');
  return { ...result, url };
}

export function mergeWebChapters(existing: WebChapter[], incoming: WebChapter[], append: boolean) {
  const chapters = append ? [...existing] : [];
  const positions = new Map(chapters.map((chapter, index) => [chapter.url, index]));
  const originalUrls = new Set(positions.keys());
  const updatedUrls = new Set<string>();
  let added = 0;
  for (const chapter of incoming) {
    const index = positions.get(chapter.url);
    if (index !== undefined) {
      if (chapter.content && (chapters[index].content !== chapter.content || chapters[index].status !== 'ready' || chapters[index].error)) {
        chapters[index] = { ...chapters[index], content: chapter.content, status: 'ready', error: undefined };
        if (originalUrls.has(chapter.url)) updatedUrls.add(chapter.url);
      }
      continue;
    }
    if (chapters.length >= 5000) throw new Error('Danh sách vượt 5.000 chương. Tạo bản nháp khác để nhập thêm.');
    positions.set(chapter.url, chapters.length); chapters.push(chapter); added++;
  }
  return { chapters, added, updated: updatedUrls.size };
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
