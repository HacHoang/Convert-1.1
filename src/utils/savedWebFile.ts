export const SAVED_WEB_ACCEPT = '.html,.htm,.mhtml,.mht,text/html,multipart/related';
export const MAX_SAVED_WEB_BYTES = 16 * 1024 * 1024;
const headerValue = (headers: string, name: string) => headers.replace(/\r?\n[ \t]+/g, ' ').match(new RegExp(`^${name}:\\s*(.+)$`, 'im'))?.[1].trim() || '';

function decode(bytes: Uint8Array, hint = '') {
  let charset = hint || 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) charset = 'utf-16le';
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) charset = 'utf-16be';
  else if (!hint) {
    const head = new TextDecoder('windows-1252').decode(bytes.subarray(0, 8192));
    charset = head.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || 'utf-8';
  }
  try { return new TextDecoder(charset, { fatal: true }).decode(bytes); }
  catch { throw new Error(`Không đọc được mã hóa ${charset}. Hãy lưu lại trang thành HTML UTF-8.`); }
}

export async function readSavedWebFile(file: File): Promise<{ html: string; sourceUrl?: string }> {
  if (file.size > MAX_SAVED_WEB_BYTES) throw new Error('Chọn tệp HTML hoặc MHTML không quá 16 MB.');
  if (!file.size) throw new Error('Tệp đã chọn trống.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder('windows-1252').decode(bytes.subarray(0, 8192));
  if (/^content-type:\s*multipart\//im.test(head)) {
    // MHTML is a MIME archive. Decode only its HTML part, never its scripts or attachments.
    const pieces: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 16384) pieces.push(String.fromCharCode(...bytes.subarray(offset, offset + 16384)));
    const mime = pieces.join('');
    const rootEnd = mime.search(/\r?\n\r?\n/);
    if (rootEnd < 0) throw new Error('Tệp MHTML thiếu phần đầu MIME.');
    const rootHeaders = mime.slice(0, rootEnd);
    const boundary = headerValue(rootHeaders, 'Content-Type').match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
    if (!boundary) throw new Error('Không tìm thấy ranh giới nội dung trong MHTML.');
    for (const part of mime.split(`--${boundary[1] || boundary[2]}`).slice(1)) {
      const end = part.search(/\r?\n\r?\n/);
      if (end < 0) continue;
      const headers = part.slice(0, end).trim();
      const contentType = headerValue(headers, 'Content-Type');
      if (!/^text\/html(?:;|$)/i.test(contentType)) continue;
      const separator = part.slice(end).match(/^\r?\n\r?\n/)![0];
      let body = part.slice(end + separator.length).replace(/\r?\n$/, '');
      const transfer = headerValue(headers, 'Content-Transfer-Encoding').toLowerCase();
      if (transfer === 'base64') {
        try { body = atob(body.replace(/\s/g, '')); } catch { throw new Error('Nội dung base64 trong MHTML bị lỗi.'); }
      } else if (transfer === 'quoted-printable') {
        body = body.replace(/=\r?\n/g, '').replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      } else if (transfer && !['7bit', '8bit', 'binary'].includes(transfer)) throw new Error('Kiểu mã hóa MHTML chưa được hỗ trợ. Hãy lưu trang thành HTML.');
      const charset = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
      return { html: decode(Uint8Array.from(body, character => character.charCodeAt(0)), charset), sourceUrl: headerValue(headers, 'Content-Location') || headerValue(rootHeaders, 'Snapshot-Content-Location') };
    }
    throw new Error('MHTML không chứa trang HTML có thể đọc. Hãy lưu lại trang thành HTML.');
  }
  const html = decode(bytes);
  if (!/<(?:!doctype\s+html|html|head|body|a\b|div\b|main\b|section\b)/i.test(html)) throw new Error('Tệp không chứa trang HTML. Hãy chọn .html, .htm hoặc .mhtml đã lưu từ trình duyệt.');
  return { html };
}
