import { downloadFile } from './downloadFile';
import type { NovelBook, SavedChapter } from '../context/AppContext';

function escapeXml(text: string) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}

export interface EpubOptions {
  preserveOrder?: boolean;
  language?: string;
  font?: 'serif' | 'sans-serif';
  fontSize?: number;
  lineHeight?: number;
  cover?: string;
}
export async function createNovelEpub(novel: Pick<NovelBook, 'title' | 'author' | 'description'>, chapters: SavedChapter[], options: EpubOptions = {}): Promise<Blob> {
  if (!chapters.length) throw new Error('Truyện chưa có chương để xuất.');
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const esc = escapeXml;
  const title = esc(novel.title || 'Truyện');
  const uid = `urn:uuid:${crypto.randomUUID()}`;
  const ordered = options.preserveOrder ? [...chapters] : [...chapters].sort((a, b) => a.title.localeCompare(b.title, 'vi', { numeric: true }) || a.savedAt - b.savedAt);
  const language = esc(options.language || 'vi');
  const font = options.font === 'sans-serif' ? 'sans-serif' : 'serif';
  const fontSize = Math.max(12, Math.min(28, options.fontSize || 18));
  const lineHeight = Math.max(1.2, Math.min(2.4, options.lineHeight || 1.6));
  const xhtml = (name: string, body: string) => `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${language}" xml:lang="${language}"><head><title>${name}</title><meta charset="UTF-8"/><style>body{font-family:${font};font-size:${fontSize}px;line-height:${lineHeight};margin:5%;}h1{font-size:1.4em;}p{margin:0 0 .8em;}img{max-width:100%;height:auto;}</style></head><body>${body}</body></html>`;
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const nav: string[] = [];
  const manifest: string[] = [];
  const spine: string[] = [];
  const cover = options.cover?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (cover) {
    const extension = cover[1] === 'image/jpeg' ? 'jpg' : cover[1].slice(6);
    zip.file(`EPUB/cover.${extension}`, cover[2], { base64: true });
    zip.file('EPUB/cover.xhtml', xhtml(title, `<img src="cover.${extension}" alt="${title}"/>`));
    manifest.push(`<item id="cover-image" href="cover.${extension}" media-type="${cover[1]}" properties="cover-image"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push('<itemref idref="cover"/>');
  }
  ordered.forEach((chapter, index) => {
    const heading = esc(chapter.title || `Chương ${index + 1}`);
    const paragraphs = (chapter.vietphraseText.trim() || chapter.originalText).split(/\r?\n/).filter(line => line.trim()).map(line => `<p>${esc(line)}</p>`).join('\n');
    zip.file(`EPUB/chapter-${index + 1}.xhtml`, xhtml(heading, `<h1>${heading}</h1>${paragraphs}`));
    nav.push(`<li><a href="chapter-${index + 1}.xhtml">${heading}</a></li>`);
    manifest.push(`<item id="ch${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="ch${index + 1}"/>`);
  });
  zip.file('EPUB/nav.xhtml', xhtml(title, `<nav epub:type="toc" id="toc"><h1>${title}</h1><ol>${nav.join('')}</ol></nav>`));
  zip.file('EPUB/book.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${uid}</dc:identifier><dc:title>${title}</dc:title><dc:language>${language}</dc:language><dc:creator>${esc(novel.author || 'Khuyết danh')}</dc:creator><dc:description>${esc(novel.description || '')}</dc:description><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest.join('')}</manifest><spine>${spine.join('')}</spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}

export async function downloadNovelEpub(novel: NovelBook, chapters: SavedChapter[]) {
  const blob = await createNovelEpub(novel, chapters);
  downloadFile(blob, `${novel.title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'truyen'}.epub`);
}
