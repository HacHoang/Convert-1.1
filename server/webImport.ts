import express from 'express';
import { lookup } from 'node:dns/promises';
import { isIP, BlockList } from 'node:net';
import http from 'node:http';
import https from 'node:https';

const blocked = new BlockList();
for (const [ip, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['192.0.0.0', 24], ['192.0.2.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked.addSubnet(ip, bits, 'ipv4');
// Only global unicast IPv6 is eligible; IPv4-mapped addresses are excluded as well.
export function isPublicAddress(address: string) {
  if (isIP(address) === 4) return !blocked.check(address, 'ipv4');
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:0:|db8:|10:|20:)/i.test(address) && !/^2002:/i.test(address);
}
export function validateWebUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Chỉ hỗ trợ URL HTTP/HTTPS công khai, cổng 80 hoặc 443.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.local') || (isIP(hostname) && !isPublicAddress(hostname))) throw new Error('Không hỗ trợ địa chỉ nội bộ.');
  return url;
}

export class WebSourceError extends Error {
  constructor(message: string, public status: number, public code: string, public sourceUrl: string) { super(message); }
}

export async function fetchWebResource(input: string, signal: AbortSignal, redirects = 0): Promise<{ url: string; data: Buffer; type: string }> {
  const url = validateWebUrl(input);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('Địa chỉ máy chủ không được hỗ trợ.');
  signal.throwIfAborted();
  const pinned = addresses[0];
  const result = await new Promise<{ status: number; location?: string; data: Buffer; type: string; challenge: boolean }>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      signal, headers: { 'User-Agent': 'Convert/1.1 WebImport', Accept: 'text/html,application/xhtml+xml,image/*', 'Accept-Encoding': 'identity' },
      lookup: ((_host: string, options: { all?: boolean }, callback: Function) => options.all ? callback(null, [pinned]) : callback(null, pinned.address, pinned.family)) as any,
    }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) { response.destroy(new Error('Tệp vượt giới hạn 8 MB.')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode || 500, location: response.headers.location, data: Buffer.concat(chunks), type: response.headers['content-type'] || '', challenge: response.headers['cf-mitigated'] === 'challenge' }));
    });
    request.setTimeout(20000, () => request.destroy(new Error('Máy chủ phản hồi quá chậm, hãy thử lại.')));
    request.on('error', reject);
  });
  if ([301, 302, 303, 307, 308].includes(result.status) && result.location) {
    if (redirects >= 4) throw new Error('Trang chuyển hướng quá nhiều lần.');
    return fetchWebResource(new URL(result.location, url).href, signal, redirects + 1);
  }
  const responseHead = result.data.subarray(0, 65536).toString('utf8');
  if (result.challenge || /<title[^>]*>\s*Just a moment/i.test(responseHead) || /(?:cf-chl-|challenge-platform)/i.test(responseHead) && /cloudflare/i.test(responseHead)) {
    throw new WebSourceError('Trang nguồn yêu cầu xác minh Cloudflare. Máy chủ app chưa nhận được mục lục hoặc nội dung truyện. Mở trang gốc trong trình duyệt; khi truy cập được, lưu HTML rồi nhập vào app.', 403, 'SOURCE_VERIFICATION_REQUIRED', url.href);
  }
  if (result.status < 200 || result.status >= 300) throw new WebSourceError(`Trang nguồn trả về HTTP ${result.status}. Trang có thể yêu cầu đăng nhập hoặc từ chối tải tự động.`, result.status === 403 ? 403 : 422, 'SOURCE_HTTP_ERROR', url.href);
  return { url: url.href, data: result.data, type: result.type };
}

export function createWebImportRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));
  let active = 0;
  router.post('/resource', async (req, res) => {
    const origin = req.get('origin');
    if (origin) {
      try { if (new URL(origin).host !== req.get('host')) throw new Error('origin'); }
      catch { res.status(403).json({ error: 'Yêu cầu khác nguồn bị từ chối.' }); return; }
    }
    if (typeof req.body?.url !== 'string') { res.status(400).json({ error: 'Vui lòng nhập URL.' }); return; }
    if (active >= 4) { res.status(429).json({ error: 'Đang có nhiều yêu cầu, hãy thử lại sau.' }); return; }
    active++;
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const result = await fetchWebResource(req.body.url, controller.signal);
      if (req.body.image) {
        const type = result.type.split(';')[0].trim();
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Ảnh bìa phải là JPEG, PNG hoặc WebP.');
        res.json({ image: `data:${type};base64,${result.data.toString('base64')}` });
      } else {
        if (!/text\/html|application\/xhtml\+xml/i.test(result.type)) throw new Error('Đường dẫn không trả về trang HTML.');
        const head = result.data.subarray(0, 4096).toString('ascii');
        const charset = result.type.match(/charset=["']?([\w-]+)/i)?.[1] || head.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || 'utf-8';
        let decoder: TextDecoder;
        try { decoder = new TextDecoder(charset); } catch { decoder = new TextDecoder('utf-8'); }
        res.json({ url: result.url, html: decoder.decode(result.data) });
      }
    } catch (error) {
      if (!res.destroyed) res.status(error instanceof WebSourceError ? error.status : 422).json({ error: error instanceof Error ? error.message : 'Không tải được trang.', ...(error instanceof WebSourceError ? { code: error.code, sourceUrl: error.sourceUrl } : {}) });
    } finally { clearTimeout(timer); res.off('close', cancel); active--; }
  });
  return router;
}
