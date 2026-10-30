import type { RawChapterItem } from './chapterSplitter';
import { extractChapterNumber, splitLargeTextIntoChapters } from './chapterSplitter';

const MAX_EXPANDED = 80 * 1024 * 1024;

const chapterHeading = /^(?:第\s*[0-9零〇一二两三四五六七八九十百千万]+\s*[章回节節]|(?:Chương|Hồi|Tiết|Chapter|Chap)\s*\d+(?=$|[\s:：.\-–—]))/i;

/** XHTML can repeat its heading, or contain prose without any chapter heading. */
export function splitEpubDocument(text: string, startSeq: number, documentTitle = ''): RawChapterItem[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  if (!lines.some(line => chapterHeading.test(line))) {
    return [{ id: crypto.randomUUID(), chapterNum: extractChapterNumber(documentTitle, startSeq),
      rawTitle: documentTitle || `Chương ${startSeq}`, content: text.trim(), charCount: text.trim().length }];
  }
  const parts = splitLargeTextIntoChapters(lines.join('\n'), startSeq);
  // A heading alone is not a readable chapter (old-style TOCs commonly look like this).
  return parts.filter(part => !(chapterHeading.test(part.rawTitle) && part.content === part.rawTitle));
}

function xml(text: string) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('EPUB có cấu trúc XML không hợp lệ.');
  return doc;
}

function resolvePath(base: string, href: string) {
  if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(href)) throw new Error('EPUB chứa đường dẫn bên ngoài không được hỗ trợ.');
  const parts = base.split('/').slice(0, -1);
  for (const part of decodeURIComponent(href.split('#')[0].split('?')[0]).split('/')) {
    if (part === '..') { if (!parts.length) throw new Error('Đường dẫn EPUB không hợp lệ.'); parts.pop(); }
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

/** Read spine order, extract inert text only; no EPUB markup is mounted in the app. */
export async function importEpub(file: File, startSeq = 1): Promise<RawChapterItem[]> {
  if (file.size > 50 * 1024 * 1024) throw new Error('EPUB vượt giới hạn 50 MB.');
  const { default: JSZip } = await import('jszip');
  let archive;
  try { archive = await JSZip.loadAsync(await file.arrayBuffer()); }
  catch { throw new Error('Không thể mở EPUB. Tệp có thể bị hỏng hoặc được mã hóa.'); }
  // Bound archive expansion before inflating entries (JSZip exposes ZIP metadata internally).
  const entries = Object.values(archive.files);
  const expanded = entries.reduce((sum, entry) => sum + ((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0), 0);
  if (entries.length > 10000 || expanded > MAX_EXPANDED) throw new Error('EPUB quá lớn sau giải nén (tối đa 80 MB hoặc 10.000 tệp).');
  const read = async (path: string) => {
    const entry = archive.file(path);
    if (!entry) throw new Error(`EPUB thiếu tệp: ${path}`);
    return entry.async('string');
  };
  const container = xml(await read('META-INF/container.xml'));
  const packagePath = Array.from(container.getElementsByTagNameNS('*', 'rootfile')).find(el => el.getAttribute('media-type') === 'application/oebps-package+xml')?.getAttribute('full-path')
    || container.getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path');
  if (!packagePath) throw new Error('Không tìm thấy mục lục nội dung EPUB.');
  const opf = xml(await read(packagePath));
  const manifest = new Map(Array.from(opf.getElementsByTagNameNS('*', 'item')).map(el => [el.getAttribute('id'), el]));
  const chapters: RawChapterItem[] = [];
  const visited = new Set<string>();
  const documents = new Set<string>();
  const chapterContents = new Set<string>();
  for (const ref of Array.from(opf.getElementsByTagNameNS('*', 'itemref'))) {
    if (ref.getAttribute('linear') === 'no') continue;
    const item = manifest.get(ref.getAttribute('idref'));
    if (!item) throw new Error('EPUB tham chiếu chương không tồn tại.');
    if (!['application/xhtml+xml', 'text/html'].includes(item.getAttribute('media-type') || '')) continue;
    if ((item.getAttribute('properties') || '').split(/\s+/).includes('nav')) continue;
    const path = resolvePath(packagePath, item.getAttribute('href') || '');
    if (visited.has(path)) continue;
    visited.add(path);
    const doc = new DOMParser().parseFromString(await read(path), 'text/html');
    const documentTitle = doc.querySelector('h1,h2,h3')?.textContent?.trim() || doc.title.trim();
    // EPUB 2 guide references and EPUB 3 semantic landmarks identify non-story pages.
    const guideType = Array.from(opf.getElementsByTagNameNS('*', 'reference')).filter(el => {
      const href = el.getAttribute('href');
      return href && resolvePath(packagePath, href) === path;
    }).map(el => el.getAttribute('type') || '').join(' ');
    const semantics = `${guideType} ${doc.body.getAttribute('epub:type') || ''} ${doc.body.getAttribute('role') || ''}`;
    if (/(?:^|\s)(?:toc|cover|title-page|titlepage|copyright-page|copyright|doc-toc|doc-cover)(?:\s|$)/.test(semantics)) continue;
    // Some EPUB 2 files have no guide/nav metadata: a page made only of links is a TOC.
    const linked = Array.from(doc.body.querySelectorAll('a[href]')).map(el => el.textContent || '').join('').replace(/\s/g, '').length;
    const total = (doc.body.textContent || '').replace(/\s/g, '').length;
    if (doc.body.querySelectorAll('a[href]').length >= 2 && linked >= total * 0.8) continue;
    doc.querySelectorAll('script,style,noscript,nav,iframe,object,svg,head,[hidden]').forEach(el => el.remove());
    doc.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
    doc.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,section,article,blockquote,tr').forEach(el => el.append('\n'));
    const text = (doc.body.textContent || '').replace(/\u00a0/g, ' ').split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n');
    if (!text) continue;
    if (documents.has(text)) continue;
    documents.add(text);
    const parts = splitEpubDocument(text, chapters.length ? chapters[chapters.length - 1].chapterNum + 1 : startSeq, documentTitle);
    for (const part of parts) {
      const key = JSON.stringify([part.rawTitle.normalize('NFC'), part.content.normalize('NFC')]);
      if (chapterContents.has(key)) continue;
      chapterContents.add(key);
      chapters.push({ ...part, id: `epub-${crypto.randomUUID()}` });
    }
    // Let the browser paint progress between documents in large books.
    if (chapters.length % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (!chapters.length) throw new Error('EPUB không có chương văn bản có thể đọc. Tệp chỉ chứa ảnh hoặc có DRM không được hỗ trợ.');
  return chapters;
}
