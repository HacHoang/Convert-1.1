// Local, token-protected capture of dictionary tables only; never captures library or keys.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const token = randomBytes(24).toString('hex');
const directory = await mkdtemp(path.join(tmpdir(), 'hermes-default-capture-'));
const allowed = new Set(['names_store', 'names_main_store', 'vietphrase_store', 'luat_nhan_store', 'pronouns_store', 'ignored_phrases_store', 'phien_am_store', 'meaning-styles']);
const received = new Set();
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3000');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Capture-Token');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (req.method !== 'POST' || req.headers['x-capture-token'] !== token) { res.writeHead(403).end(); return; }
  const key = req.url?.slice(1);
  if (key === 'finish') {
    if (received.size !== allowed.size) { res.writeHead(409).end('Incomplete capture'); return; }
    await writeFile(path.join(directory, 'capture.json'), JSON.stringify({ capturedAt: new Date().toISOString(), stores: [...received] }));
    res.end(JSON.stringify({ directory })); server.close(); return;
  }
  if (!allowed.has(key)) { res.writeHead(404).end(); return; }
  try {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 128 * 1024 * 1024) throw new Error('Payload too large'); chunks.push(chunk); }
    await writeFile(path.join(directory, `${key}.json.gz`), Buffer.concat(chunks));
    received.add(key); console.log(JSON.stringify({ saved: key, bytes: size })); res.end('ok');
  } catch (error) { res.writeHead(500).end(String(error)); }
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ url: `http://127.0.0.1:${server.address().port}`, token, directory })));
