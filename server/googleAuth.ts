import express from 'express';
import { randomBytes } from 'node:crypto';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

type Profile = { isLoggedIn: true; id: string; email: string; name: string; avatarUrl?: string };
type Options = { clientId?: string; appUrl?: string; production?: boolean; verifyToken?: (token: string) => Promise<TokenPayload & { nonce?: string }> };
const anonymous = { isLoggedIn: false, email: '', name: '' };
const random = () => randomBytes(32).toString('base64url');

export function createGoogleAuthRouter(options: Options) {
  const router = express.Router();
  const client = new OAuth2Client(options.clientId);
  const sessions = new Map<string, { user: Profile; expires: number }>();
  const challenges = new Map<string, { csrf: string; nonce: string; expires: number }>();
  const secure = options.appUrl?.startsWith('https://') || !!options.production;
  const sessionCookie = secure ? '__Host-convert_session' : 'convert_session';
  const challengeCookie = secure ? '__Host-convert_login' : 'convert_login';
  const cookie = (name: string, value: string, age: number) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const readCookie = (req: express.Request, name: string) => req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);
  const origin = (req: express.Request) => options.appUrl ? new URL(options.appUrl).origin : `http://${req.headers.host}`;

  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    for (const [id, entry] of sessions) if (entry.expires <= Date.now()) sessions.delete(id);
    for (const [id, entry] of challenges) if (entry.expires <= Date.now()) challenges.delete(id);
    if (req.method === 'POST' && (req.headers.origin !== origin(req) || !req.is('application/json'))) {
      res.status(403).json({ error: 'Yêu cầu đăng nhập không hợp lệ. Hãy tải lại trang.' });
      return;
    }
    next();
  });
  router.use(express.json({ limit: '16kb' }));

  router.get('/config', (req, res) => {
    if (!options.clientId || (options.production && !options.appUrl?.startsWith('https://'))) {
      res.json({ configured: false });
      return;
    }
    const previous = readCookie(req, challengeCookie);
    if (previous) challenges.delete(previous);
    // Bound anonymous login attempts in this single-process deployment.
    if (challenges.size >= 2000) { res.status(429).json({ error: 'Vui lòng thử lại sau.' }); return; }
    const id = random();
    const entry = { csrf: random(), nonce: random(), expires: Date.now() + 10 * 60_000 };
    challenges.set(id, entry);
    res.setHeader('Set-Cookie', cookie(challengeCookie, id, 600));
    res.json({ configured: true, clientId: options.clientId, csrf: entry.csrf, nonce: entry.nonce });
  });

  router.get('/session', (req, res) => {
    const id = readCookie(req, sessionCookie);
    res.json(id ? sessions.get(id)?.user || anonymous : anonymous);
  });

  router.post('/google', async (req, res) => {
    if (!options.clientId) { res.status(503).json({ error: 'Đăng nhập Google chưa được cấu hình.' }); return; }
    const challengeId = readCookie(req, challengeCookie);
    const challenge = challengeId ? challenges.get(challengeId) : undefined;
    if (!challenge || challenge.csrf !== req.body?.csrf || typeof req.body?.credential !== 'string' || !req.body.credential) {
      res.status(403).json({ error: 'Phiên đăng nhập đã hết hạn. Đóng và mở lại menu để thử lại.' });
      return;
    }
    challenges.delete(challengeId!);
    try {
      const payload = options.verifyToken
        ? await options.verifyToken(req.body.credential)
        : (await client.verifyIdToken({ idToken: req.body.credential, audience: options.clientId })).getPayload() as TokenPayload & { nonce?: string };
      if (!payload || payload.nonce !== challenge.nonce || !payload.sub || !payload.email || payload.email_verified !== true || payload.aud !== options.clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) || payload.exp * 1000 <= Date.now()) {
        throw new Error('Invalid Google identity');
      }
      const user: Profile = { isLoggedIn: true, id: payload.sub, email: payload.email, name: payload.name || payload.email, avatarUrl: payload.picture?.startsWith('https://') ? payload.picture : undefined };
      const previous = readCookie(req, sessionCookie);
      if (previous) sessions.delete(previous);
      if (sessions.size >= 10000) { res.status(503).json({ error: 'Vui lòng thử lại sau.' }); return; }
      const id = random();
      sessions.set(id, { user, expires: Date.now() + 8 * 60 * 60_000 });
      res.setHeader('Set-Cookie', [cookie(sessionCookie, id, 8 * 3600), cookie(challengeCookie, '', 0)]);
      res.json(user);
    } catch {
      res.status(401).json({ error: 'Không xác minh được tài khoản Google. Đóng và mở lại menu để thử lại.' });
    }
  });

  router.post('/logout', (req, res) => {
    const id = readCookie(req, sessionCookie);
    if (id) sessions.delete(id);
    const challenge = readCookie(req, challengeCookie);
    if (challenge) challenges.delete(challenge);
    res.setHeader('Set-Cookie', [cookie(sessionCookie, '', 0), cookie(challengeCookie, '', 0)]);
    res.json(anonymous);
  });

  return router;
}
