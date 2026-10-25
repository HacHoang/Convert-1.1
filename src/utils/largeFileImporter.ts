/**
 * Large File Streaming / Chunked Importer
 * Hỗ trợ nạp tệp từ điển QuickTranslator nặng ~40MB (500.000 - 1.500.000 dòng)
 * Không gây tràn heap, không gây đơ (freeze) trình duyệt.
 */

export interface ParsedDictEntry {
  chinese: string;
  vietnamese: string;
}

/**
 * Đọc và phân tích tệp từ điển lớn theo khối (chunked)
 * Nhường luồng cho UI sau mỗi khối 10.000 dòng
 */
export async function parseDictionaryFileChunked(
  file: File,
  onProgress?: (processedCount: number, percent: number) => void
): Promise<ParsedDictEntry[]> {
  const totalBytes = file.size;
  let offset = 0;
  const CHUNK_SIZE = 1024 * 1024 * 2; // 2MB mỗi khối
  const decoder = new TextDecoder('utf-8');

  let leftover = '';
  const entries: ParsedDictEntry[] = [];
  let lineCount = 0;

  while (offset < totalBytes) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();
    const text = leftover + decoder.decode(buffer, { stream: offset + CHUNK_SIZE < totalBytes });
    
    // Tìm vị trí xuống dòng cuối cùng trong khối để giữ lại phần dở dang (leftover)
    const lastNewlineIdx = text.lastIndexOf('\n');
    let chunkText = text;
    if (lastNewlineIdx !== -1 && offset + CHUNK_SIZE < totalBytes) {
      chunkText = text.slice(0, lastNewlineIdx);
      leftover = text.slice(lastNewlineIdx + 1);
    } else {
      leftover = '';
    }

    const lines = chunkText.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      const equalIdx = line.indexOf('=');
      if (equalIdx > 0) {
        const cn = line.slice(0, equalIdx).trim();
        const vn = line.slice(equalIdx + 1).trim();
        if (cn && vn) {
          entries.push({ chinese: cn, vietnamese: vn });
          lineCount++;
        }
      }
    }

    offset += CHUNK_SIZE;
    const progressPercent = Math.min(99, Math.round((offset / totalBytes) * 100));
    if (onProgress) {
      onProgress(entries.length, progressPercent);
    }

    // Nhường luồng cho browser render UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Xử lý dòng cuối cùng nếu còn sót lại
  if (leftover.trim()) {
    const line = leftover.trim();
    if (!line.startsWith('#') && !line.startsWith('//')) {
      const equalIdx = line.indexOf('=');
      if (equalIdx > 0) {
        const cn = line.slice(0, equalIdx).trim();
        const vn = line.slice(equalIdx + 1).trim();
        if (cn && vn) {
          entries.push({ chinese: cn, vietnamese: vn });
        }
      }
    }
  }

  if (onProgress) {
    onProgress(entries.length, 100);
  }

  return entries;
}
