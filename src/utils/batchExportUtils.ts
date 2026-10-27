/**
 * Module xuất tệp hàng loạt (Batch Export Utility)
 * Hỗ trợ lưu trực tiếp vào Thư mục qua File System Access API
 * Quy tắc đặt tên file: CHỈ GỒM SỐ THỨ TỰ CHƯƠNG (ví dụ: 1810.txt, 1810.docx)
 */

import JSZip from 'jszip';
import { BatchTranslationItem } from './chapterSplitter';

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
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Lưu danh sách chương vào Thư mục do người dùng chọn trên máy
 * Tên file: CHỈ GỒM STT CHƯƠNG (ví dụ: 1810.txt hoặc 1810.docx)
 */
export async function saveChaptersToUserFolder(
  chapters: BatchTranslationItem[],
  format: 'txt' | 'docx',
  onProgress?: (savedCount: number, total: number, currentName: string) => void
): Promise<{ success: boolean; count: number; folderName: string }> {
  if (!isDirectoryPickerSupported()) {
    throw new Error('Trình duyệt hiện tại không hỗ trợ chọn thư mục trực tiếp. Vui lòng dùng tùy chọn "Tải file ZIP".');
  }

  // Mở hộp thoại chọn thư mục trên máy tính
  // @ts-ignore
  const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'downloads',
  });

  const total = chapters.length;
  let saved = 0;

  for (const chap of chapters) {
    // Quy tắc: CHỈ GỒM STT CHƯƠNG
    const fileName = `${chap.chapterNum}.${format}`;
    onProgress?.(saved + 1, total, fileName);

    const fullText = chap.translatedTitle
      ? `${chap.translatedTitle}\n\n${chap.translatedContent}`
      : chap.translatedContent;

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    // @ts-ignore
    const writable = await fileHandle.createWritable();

    if (format === 'docx') {
      const docxBlob = await createDocxBlob(chap.translatedTitle, chap.translatedContent);
      await writable.write(docxBlob);
    } else {
      await writable.write(fullText);
    }

    await writable.close();
    saved++;
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
  format: 'txt' | 'docx',
  zipFileName: string = 'Ban_Dich_Hang_Loat',
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();

  for (let i = 0; i < chapters.length; i++) {
    const chap = chapters[i];
    const fileName = `${chap.chapterNum}.${format}`;
    const fullText = chap.translatedTitle
      ? `${chap.translatedTitle}\n\n${chap.translatedContent}`
      : chap.translatedContent;

    if (format === 'docx') {
      const blob = await createDocxBlob(chap.translatedTitle, chap.translatedContent);
      zip.file(fileName, blob);
    } else {
      zip.file(fileName, fullText);
    }

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
