import { chapterFileNames, type ChapterExportFormat } from './chapterFileNames';
import { downloadFile } from './downloadFile';
import { createNovelEpub } from './epubExport';
/**
 * Module xuất tệp hàng loạt (Batch Export Utility)
 * Hỗ trợ lưu trực tiếp vào Thư mục qua File System Access API
 * Quy tắc đặt tên file: CHỈ GỒM SỐ THỨ TỰ CHƯƠNG (ví dụ: 1810.txt, 1810.docx)
 */

import JSZip from 'jszip';
import { BatchTranslationItem } from './chapterSplitter';
import { normalizeVietnameseTypography } from './vietnameseTypography';

declare global {
  interface Window {
    hermesFileSystem?: {
      chooseDirectory(): Promise<{ name: string } | null>;
      writeFile(name: string, bytes: ArrayBuffer): Promise<{ size: number }>;
      finish(): Promise<void>;
    };
  }
}

/** Each selected chapter uses the same Blob download path as library EPUB. */
export async function downloadChapterFiles(chapters: BatchTranslationItem[], format: ChapterExportFormat, onProgress?: (count: number, total: number, filename: string) => void): Promise<{ count: number }> {
  const names = chapterFileNames(chapters, format);
  let count = 0;
  for (const chapter of chapters) {
    const filename = names.get(chapter.id)!;
    try {
      const blob = await createChapterBlob(chapter, format);
      downloadFile(blob, filename);
    } catch (error) {
      throw new Error(`Không tạo được ${filename}. Đã gửi ${count}/${chapters.length} file tới trình tải xuống. ${error instanceof Error ? error.message : String(error)}`);
    }
    count++;
    onProgress?.(count, chapters.length, filename);
    // Yield between downloads so the browser can process each file request.
    if (count < chapters.length) await new Promise(resolve => setTimeout(resolve, 100));
  }
  return { count };
}

/** Browsers without folder access download one TXT/DOCX, never an implicit ZIP. */
export async function downloadCombinedChapters(chapters: BatchTranslationItem[], format: 'txt' | 'docx', title: string): Promise<void> {
  const content = chapters.map(chapter => `${normalizeVietnameseTypography(chapter.translatedTitle || chapter.rawTitle, true)}\n\n${normalizeVietnameseTypography(chapter.translatedContent || chapter.content, true)}`).join('\n\n');
  const blob = format === 'docx' ? await createDocxBlob(title, content) : new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${(title || 'Ban_dich').replace(/[\\/:*?"<>|]/g, '_')}.${format}`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Thoát các ký tự đặc biệt cho XML chuẩn UTF-8
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Tạo Blob file Word .docx chuẩn OpenXML bằng JSZip
 */
export async function createDocxBlob(
  title: string,
  content: string
): Promise<Blob> {
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  // _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // word/styles.xml
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Times New Roman"/>
        <w:sz w:val="26"/>
        <w:szCs w:val="26"/>
        <w:lang w:val="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`
  );

  // Chuẩn bị các đoạn văn cho word/document.xml
  const paragraphs = content.split(/\r?\n/).filter(p => p.trim() !== '');
  let documentBodyXml = '';

  // Tiêu đề chương in đậm
  if (title) {
    documentBodyXml += `
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="240" w:after="240" w:line="360" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="32"/>
          <w:szCs w:val="32"/>
          <w:color w:val="0D6EFD"/>
        </w:rPr>
        <w:t>${escapeXml(title)}</w:t>
      </w:r>
    </w:p>`;
  }

  // Nội dung các đoạn
  for (const para of paragraphs) {
    documentBodyXml += `
    <w:p>
      <w:pPr>
        <w:spacing w:after="160" w:line="360" w:lineRule="auto"/>
        <w:ind w:firstLine="400"/>
      </w:pPr>
      <w:r>
        <w:t xml:space="preserve">${escapeXml(para)}</w:t>
      </w:r>
    </w:p>`;
  }

  // word/document.xml
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${documentBodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`
  );

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Kiểm tra xem trình duyệt có hỗ trợ File System Access API không
 */
export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && (!!window.hermesFileSystem || typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function');
}

/**
 * Lưu danh sách chương vào Thư mục do người dùng chọn trên máy
 * Tên file: CHỈ GỒM STT CHƯƠNG (ví dụ: 1810.txt hoặc 1810.docx)
 */
export async function saveChaptersToUserFolder(
  chapters: BatchTranslationItem[],
  format: ChapterExportFormat,
  onProgress?: (savedCount: number, total: number, currentName: string) => void,
  onStage?: (message: string) => void,
): Promise<{ success: boolean; count: number; folderName: string }> {
  if (!isDirectoryPickerSupported()) {
    throw new Error('Trình duyệt hiện tại không hỗ trợ chọn thư mục trực tiếp. Hãy mở ứng dụng trong trình duyệt hỗ trợ lưu thư mục.');
  }

  const desktop = window.hermesFileSystem;
  if (desktop) {
    const selection = await desktop.chooseDirectory();
    if (!selection) throw new DOMException('Cancelled', 'AbortError');
    const names = chapterFileNames(chapters, format);
    let saved = 0;
    try {
      for (const chapter of chapters) {
        const fileName = names.get(chapter.id)!;
        onStage?.(`Đang ghi ${fileName} vào "${selection.name}" (${saved}/${chapters.length})…`);
        try {
          const blob = await createChapterBlob(chapter, format);
          const result = await desktop.writeFile(fileName, await blob.arrayBuffer());
          if (!result.size) throw new Error('File được tạo nhưng chưa có nội dung.');
        } catch (error) {
          throw new Error(`Không lưu được ${fileName}. Đã lưu ${saved}/${chapters.length} chương. ${error instanceof Error ? error.message : String(error)}`);
        }
        saved++;
        onProgress?.(saved, chapters.length, fileName);
      }
      return { success: true, count: saved, folderName: selection.name };
    } finally {
      await desktop.finish().catch(() => {});
    }
  }

  // Directory pickers cannot supply writable handles when a browser host
  // intercepts file choosers. Chromium reports that as AbortError too, but it
  // is an environment failure, not the user cancelling the folder selection.
  let dirHandle: FileSystemDirectoryHandle;
  try {
    // @ts-ignore
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'downloads' });
  } catch (error) {
    if (/intercepted.*(?:filechooser|file chooser)|setInterceptFileChooserDialog/i.test(String((error as Error)?.message || error))) {
      throw new Error('Trình duyệt tích hợp đang chặn hộp chọn thư mục, nên chưa có file nào được lưu. Hãy mở ứng dụng trong trình duyệt ngoài (Chrome/Edge) để lưu vào thư mục trên máy.');
    }
    throw error;
  }
  onStage?.(`Đã chọn thư mục "${dirHandle.name}". Đang kiểm tra quyền ghi…`);
  const permissionHandle = dirHandle as FileSystemDirectoryHandle & {
    queryPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  };
  if (permissionHandle.queryPermission) {
    let permission = await permissionHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted' && permissionHandle.requestPermission) permission = await permissionHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error(`Chưa có quyền ghi vào thư mục "${dirHandle.name}". Hãy cho phép trình duyệt chỉnh sửa file trong thư mục rồi lưu lại.`);
  }

  const total = chapters.length;
  let saved = 0;

  const names = chapterFileNames(chapters, format);
  for (const chap of chapters) {
    // Quy tắc: CHỈ GỒM STT CHƯƠNG
    const fileName = names.get(chap.id)!;

    let writable: FileSystemWritableFileStream | undefined;
    try {
      onStage?.(`Đang ghi ${fileName} vào "${dirHandle.name}" (${saved}/${total})…`);
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      writable = await fileHandle.createWritable();
      await writable.write(await createChapterBlob(chap, format));
      await writable.close();
      writable = undefined;
      if (fileHandle.getFile && (await fileHandle.getFile()).size === 0) throw new Error('File được tạo nhưng chưa có nội dung.');
    } catch (error) {
      if (writable) await writable.abort().catch(() => {});
      throw new Error(`Không lưu được ${fileName}. Đã lưu ${saved}/${total} chương. ${error instanceof Error ? error.message : String(error)}`);
    }
    saved++;
    onProgress?.(saved, total, fileName);
  }

  return {
    success: true,
    count: saved,
    folderName: dirHandle.name,
  };
}

/**
 * Tạo file ZIP chứa toàn bộ các chương đã dịch
 * Tên file bên trong ZIP: CHỈ GỒM STT CHƯƠNG (1810.txt, 1811.txt,...)
 */
export async function downloadChaptersAsZip(
  chapters: BatchTranslationItem[],
  format: ChapterExportFormat,
  zipFileName: string = 'Ban_Dich_Hang_Loat',
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();

  const names = chapterFileNames(chapters, format);
  for (let i = 0; i < chapters.length; i++) {
    const chap = chapters[i];
    const fileName = names.get(chap.id)!;
    zip.file(fileName, await createChapterBlob(chap, format));

    if (onProgress) {
      onProgress(Math.round(((i + 1) / chapters.length) * 80));
    }
  }

  const zipBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => {
      if (onProgress) {
        onProgress(80 + Math.round(metadata.percent * 0.2));
      }
    }
  );

  const cleanZipName = (zipFileName || 'Ban_Dich_Hang_Loat')
    .replace(/[^\w\s\u00C0-\u1EF9]/gi, '_')
    .replace(/\s+/g, '_');

  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${cleanZipName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function createChapterBlob(chapter: BatchTranslationItem, format: ChapterExportFormat): Promise<Blob> {
  const title = normalizeVietnameseTypography(chapter.translatedTitle || chapter.rawTitle, true);
  const content = normalizeVietnameseTypography(chapter.translatedContent || chapter.content, true);
  if (format === 'txt') return new Blob([`${title}\n\n${content}`], { type: 'text/plain;charset=utf-8' });
  if (format === 'docx') return createDocxBlob(title, content);
  if (format === 'epub') {
    return createNovelEpub(
      { title },
      [{ id: chapter.id, title, originalText: chapter.content, vietphraseText: content, savedAt: Date.now() }],
      { preserveOrder: true },
    );
  }
  return createChapterPdfBlob(title, content);
}

/**
 * Renders Vietnamese/Chinese text through the browser's font engine, then
 * wraps the rendered pages in a PDF. This avoids relying on a limited built-in
 * PDF font and keeps both Vietnamese accents and CJK characters intact.
 */
async function createChapterPdfBlob(title: string, content: string): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('PDF chỉ có thể được tạo trong trình duyệt.');
  const width = 1240;
  const height = 1754;
  const margin = 96;
  const lineHeight = 38;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không hỗ trợ tạo PDF.');

  const wrap = (text: string, maxWidth: number) => {
    const result: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      if (!paragraph.trim()) { result.push(''); continue; }
      const tokens = paragraph.includes(' ') ? paragraph.split(/(\s+)/) : Array.from(paragraph);
      let line = '';
      for (const token of tokens) {
        if (context.measureText(line + token).width <= maxWidth || !line) { line += token; continue; }
        result.push(line.trimEnd());
        line = token.trimStart();
      }
      if (line) result.push(line.trimEnd());
    }
    return result;
  };

  context.font = '28px system-ui, sans-serif';
  const lines = wrap(content, width - margin * 2);
  const imageBytes: Uint8Array[] = [];
  let index = 0;
  let firstPage = true;
  while (index < lines.length || firstPage) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#16181d';
    let y = margin;
    if (firstPage) {
      context.font = 'bold 34px system-ui, sans-serif';
      for (const heading of wrap(title, width - margin * 2)) {
        context.fillText(heading, margin, y);
        y += 48;
      }
      y += 26;
      context.font = '28px system-ui, sans-serif';
      firstPage = false;
    }
    while (index < lines.length && y <= height - margin) {
      if (lines[index]) context.fillText(lines[index], margin, y);
      y += lineHeight;
      index++;
    }
    const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể tạo ảnh PDF.')), 'image/jpeg', 0.9));
    imageBytes.push(new Uint8Array(await image.arrayBuffer()));
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let offset = 0;
  const push = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const object = (number: number, body: string | Uint8Array, stream = false) => {
    offsets[number] = offset;
    push(`${number} 0 obj\n`);
    if (stream) { push(body); push('\nendstream\nendobj\n'); }
    else { push(body); push('\nendobj\n'); }
  };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const pageObjects = imageBytes.map((_, page) => 3 + page * 3);
  object(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  object(2, `<< /Type /Pages /Kids [${pageObjects.map(page => `${page} 0 R`).join(' ')}] /Count ${pageObjects.length} >>`);
  imageBytes.forEach((bytes, page) => {
    const pageObject = pageObjects[page];
    const contentObject = pageObject + 1;
    const imageObject = pageObject + 2;
    const drawing = `q\n595 0 0 842 0 0 cm\n/Im${page} Do\nQ\n`;
    object(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${page} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    object(contentObject, `<< /Length ${encoder.encode(drawing).length} >>\nstream\n${drawing}`, true);
    offsets[imageObject] = offset;
    push(`${imageObject} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
    push(bytes);
    push('\nendstream\nendobj\n');
  });
  const xrefOffset = offset;
  const objectCount = 2 + imageBytes.length * 3;
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let number = 1; number <= objectCount; number++) push(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
}
