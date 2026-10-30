/**
 * Module xử lý và phân tách chương hàng loạt (Batch Chapter Splitter)
 * Tối ưu hóa hiệu năng cao cho truyện lớn lên đến 2000+ chương
 */


export interface RawChapterItem {
  id: string;
  chapterNum: number;
  sourceChapterNum?: number;
  rawTitle: string;
  content: string;
  charCount: number;
}

export interface BatchTranslationItem extends RawChapterItem {
  translatedTitle: string;
  translatedContent: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMessage?: string;
}

/**
 * Chuyển đổi số Hán tự sang số nguyên (vd: 一千八百一十 -> 1810)
 */
export function chineseNumberToInt(cnNum: string): number | null {
  if (!cnNum) return null;
  const digits: Record<string, number> = {
    '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  };
  const units: Record<string, number> = {
    '十': 10, '百': 100, '千': 1000, '万': 10000,
  };

  let total = 0;
  let current = 0;
  let hasUnit = false;

  for (let i = 0; i < cnNum.length; i++) {
    const char = cnNum[i];
    if (digits[char] !== undefined) {
      current = digits[char];
    } else if (units[char] !== undefined) {
      hasUnit = true;
      const unitVal = units[char];
      if (unitVal === 10 && current === 0 && i === 0) {
        current = 1;
      }
      total += current * unitVal;
      current = 0;
    } else {
      return null;
    }
  }
  total += current;
  return total > 0 || hasUnit ? total : null;
}

/**
 * Trích xuất chính xác số thứ tự chương từ chuỗi tiêu đề
 * Hỗ trợ cả số Ả Rập (1810) lẫn số Hán tự (第一千八百一十章)
 */
export function extractChapterNumber(title: string, fallbackNumber: number): number {
  if (!title) return fallbackNumber;
  const clean = title.trim();

  // 1. Nhận diện mẫu số Ả Rập trong cụm "第 1810 章" hoặc "Chương 1810" hoặc "1810."
  const arabicMatch = clean.match(/(?:第|Chương|Hồi|Tiết|Phần|chap|chapter)?\s*(\d+)\s*(?:章|回|节|卷|部|[\.:：\-\s]|$)/i);
  if (arabicMatch && arabicMatch[1]) {
    const num = parseInt(arabicMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // 2. Nhận diện số Hán tự trong cụm "第...章"
  const cnMatch = clean.match(/第\s*([零〇一二两三四五六七八九十百千万]+)\s*[章回节卷部]/);
  if (cnMatch && cnMatch[1]) {
    const parsed = chineseNumberToInt(cnMatch[1]);
    if (parsed !== null && parsed > 0) return parsed;
  }

  // 3. Nhận diện số đứng đầu dòng (ví dụ "1810 Khởi đầu...")
  const leadingNumMatch = clean.match(/^(\d+)[\s\.:：\-_]/);
  if (leadingNumMatch && leadingNumMatch[1]) {
    const num = parseInt(leadingNumMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return fallbackNumber;
}

/**
 * Tự động phân tách một văn bản lớn thành danh sách các chương
 * Sử dụng Regex phát hiện tiêu đề chương không đệ quy, tối ưu cho 2000+ chương
 */
export function splitLargeTextIntoChapters(
  rawText: string,
  startChapterNumber?: number
): RawChapterItem[] {
  if (!rawText || !rawText.trim()) return [];

  // Regex chuẩn nhận diện tiêu đề chương tiếng Trung & tiếng Việt
  const chapterRegex = /(?:^|\r?\n)(?=第\s*[0-9零〇一二两三四五六七八九十百千万]+\s*[章回节卷部]|(?:Chương|Hồi|Tiết|Phần)\s*\d+|(?:Chap|Chapter)\s*\d+)/gmi;

  const parts = rawText.split(chapterRegex);
  const chapters: RawChapterItem[] = [];
  let currentSeq = startChapterNumber !== undefined ? startChapterNumber : 1;

  for (let i = 0; i < parts.length; i++) {
    const section = parts[i].trim();
    if (!section) continue;

    // Lấy dòng đầu tiên làm tiêu đề
    const lineEndIdx = section.indexOf('\n');
    let title = '';
    let body = '';

    if (lineEndIdx !== -1) {
      title = section.substring(0, lineEndIdx).trim();
      body = section.substring(lineEndIdx + 1).trim();
    } else {
      title = section;
      body = '';
    }

    // Nếu phần đầu tiên không có từ khóa chương và ngắn, có thể là lời mở đầu
    const isHeading = /(?:第\s*[0-9零〇一二两三四五六七八九十百千万]+\s*[章回节卷部]|(?:Chương|Hồi|Tiết|Phần|Chap)\s*\d+)/i.test(title);
    if (i === 0 && !isHeading && parts.length > 1) {
      // Bỏ qua hoặc gán chương 0/Giới thiệu nếu có
      if (body.length > 50) {
        chapters.push({
          id: `chap-${Date.now()}-${i}`,
          chapterNum: currentSeq,
          rawTitle: title.slice(0, 80) || `Chương ${currentSeq}`,
          content: section,
          charCount: section.length,
        });
        currentSeq++;
      }
      continue;
    }

    const detectedNum = extractChapterNumber(title, currentSeq);
    const finalNum = detectedNum > 0 ? detectedNum : currentSeq;

    chapters.push({
      id: `chap-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
      chapterNum: finalNum,
      rawTitle: title || `Chương ${finalNum}`,
      content: body || section,
      charCount: section.length,
    });

    currentSeq = finalNum + 1;
  }

  // Nếu không nhận diện được dấu phân cách chương nào, coi toàn bộ là 1 chương
  if (chapters.length === 0 && rawText.trim().length > 0) {
    const firstLineEnd = rawText.indexOf('\n');
    const firstLine = firstLineEnd !== -1 ? rawText.substring(0, firstLineEnd).trim() : 'Chương 1';
    const num = extractChapterNumber(firstLine, startChapterNumber || 1);
    chapters.push({
      id: `chap-${Date.now()}-0`,
      chapterNum: num,
      rawTitle: firstLine.slice(0, 100),
      content: rawText.trim(),
      charCount: rawText.length,
    });
  }

  return chapters;
}

/**
 * Đọc nội dung file đơn lẻ (hỗ trợ .txt và .docx qua mammoth)
 */
export async function readFileContent(file: File): Promise<{ title: string; content: string }> {
  const fileName = file.name;
  const isDocx = fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc');

  if (isDocx) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || '';
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const title = lines[0] || fileName.replace(/\.[^/.]+$/, '');
      return { title, content: text };
    } catch (err) {
      console.error('Error reading docx file', fileName, err);
      throw new Error(`Không thể đọc file DOCX "${fileName}"`);
    }
  }

  // Tệp TXT
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const title = lines[0] || fileName.replace(/\.[^/.]+$/, '');
    return { title, content: text };
  } catch (err) {
    console.error('Error reading text file', fileName, err);
    throw new Error(`Không thể đọc file "${fileName}"`);
  }
}

/**
 * Xử lý nạp danh sách nhiều tệp cùng lúc
 */
export async function parseMultipleFiles(
  files: File[],
  startSeq: number = 1
): Promise<RawChapterItem[]> {
  const fileArray = Array.from(files);
  const results: Array<{ file: File; chapterNum: number; content: string; title: string }> = [];
  const epubChapters: RawChapterItem[] = [];

  for (let i = 0; i < fileArray.length; i++) {
    const f = fileArray[i];
    if (/\.epub$/i.test(f.name)) {
      const { importEpub } = await import('./epubImport');
      epubChapters.push(...await importEpub(f, startSeq + results.length + epubChapters.length));
      continue;
    }
    if (!/\.(txt|docx)$/i.test(f.name)) throw new Error(`Định dạng không được hỗ trợ: ${f.name}. Chọn TXT, DOCX hoặc EPUB.`);
    const { title, content } = await readFileContent(f);
    const numFromTitle = extractChapterNumber(title, extractChapterNumber(f.name, startSeq + i));
    results.push({
      file: f,
      chapterNum: numFromTitle,
      title: title || f.name.replace(/\.[^/.]+$/, ''),
      content,
    });
  }

  // Sắp xếp các chương theo số thứ tự tăng dần
  results.sort((a, b) => a.chapterNum - b.chapterNum);

  const textChapters = results.map((r, idx) => ({
    id: `file-chap-${Date.now()}-${idx}`,
    chapterNum: r.chapterNum,
    rawTitle: r.title,
    content: r.content,
    charCount: r.content.length,
  }));
  // Preserve EPUB spine order; numeric titles can reset between volumes.
  return [...textChapters, ...epubChapters];
}
