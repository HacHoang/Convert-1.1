/** Decode dictionary/source TXT without silently replacing invalid bytes. */
export async function createTextFileDecoder(file: Blob): Promise<TextDecoder> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  let encoding = 'utf-8';
  if (head[0] === 0xff && head[1] === 0xfe) encoding = 'utf-16le';
  else if (head[0] === 0xfe && head[1] === 0xff) encoding = 'utf-16be';
  else if (head.length >= 4) {
    let even = 0, odd = 0;
    for (let i = 0; i < head.length; i++) if (head[i] === 0) i % 2 ? odd++ : even++;
    if (odd > head.length / 8 && even < odd / 4) encoding = 'utf-16le';
    else if (even > head.length / 8 && odd < even / 4) encoding = 'utf-16be';
  }
  return new TextDecoder(encoding, { fatal: true });
}

export async function* textFileChunks(file: Blob, chunkSize = 1024 * 1024): AsyncGenerator<{ text: string; percent: number }> {
  const decoder = await createTextFileDecoder(file);
  try {
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, file.size);
      const text = decoder.decode(await file.slice(offset, end).arrayBuffer(), { stream: end < file.size });
      if (text.includes('\0')) throw new Error('Tệp có ký tự NUL; hãy xuất lại dưới dạng UTF-8 hoặc UTF-16.');
      yield { text, percent: Math.min(99, Math.round(end / file.size * 100)) };
    }
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Không đọc được mã hóa TXT. Hãy lưu tệp thành UTF-8 hoặc UTF-16 rồi nhập lại; dữ liệu lỗi sẽ không được thay bằng ký tự �.');
    throw error;
  }
}

export async function readTextFile(file: Blob): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of textFileChunks(file)) chunks.push(chunk.text);
  return chunks.join('');
}
