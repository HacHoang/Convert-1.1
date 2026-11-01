// Dedicated test origin only: this fixture clears dictionary tables on that origin.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from '../src/context/AppContext';
import { WebImportView } from '../src/components/views/WebImportView';
import { analyzeSavedWebPage, DEFAULT_EXTRACTION, saveWebDraft } from '../src/utils/webImport';
import { DICTIONARY_STORES, replaceStores } from '../src/utils/indexedDbStorage';
import { yieldToBrowser } from '../src/utils/yieldToBrowser';
import '../src/index.css';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const output = document.getElementById('results')!;
const area = document.getElementById('test-root')!;
const lines: string[] = [];
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const toc = '<!-- saved from url=(0034)https://example.org/book/toc.html --><html><head><meta charset="utf-8"><base href="https://example.org/book/"><title>测试书</title></head><body><h1>测试书</h1><a href="1.html">第1章 起点</a><a href="2.html">第2章 继续</a><a href="1.html#bottom">第1章 重复</a></body></html>';
const button = (text: string) => [...area.querySelectorAll('button')].find(button => button.textContent?.trim() === text)!;
const until = async (check: () => unknown, label: string) => {
  const deadline = Date.now() + 20000;
  while (!check()) { if (Date.now() > deadline) throw new Error(`Timed out: ${label}`); await act(yieldToBrowser); }
};
const importFile = async (file: File) => {
  await act(async () => {
    const input = area.querySelector<HTMLInputElement>('input[aria-label="HTML mục lục đã lưu"]')!;
    const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await until(() => !area.textContent?.includes('Đang đọc…'), 'file read');
};
async function run() {
  const parsed = analyzeSavedWebPage(toc, '', DEFAULT_EXTRACTION);
  assert(parsed.chapters.length === 2 && parsed.chapters[0].url === 'https://example.org/book/1.html', 'Saved source/base URL resolution failed');
  let challenge = false;
  try { analyzeSavedWebPage('<html><title>Just a moment...</title><form id="challenge-form"></form></html>', 'https://example.org/', DEFAULT_EXTRACTION); } catch (error) { challenge = String(error).includes('xác minh'); }
  assert(challenge, 'A saved verification page was accepted as story content');
  const chapter = analyzeSavedWebPage(`<html><head><link rel="canonical" href="https://example.org/book/1.html"></head><body><article><h1>第1章 开始</h1><p>${'这是章节正文。'.repeat(20)}</p></article></body></html>`, '', DEFAULT_EXTRACTION);
  assert(chapter.chapters[0].status === 'ready' && chapter.chapters[0].content?.includes('这是章节正文'), 'Saved chapter content was not ready offline');
  lines.push('PASS saved URL/base recovery, chapter extraction and verification-page rejection');

  await replaceStores(Object.fromEntries(DICTIONARY_STORES.map(store => [store, []])), { dictionariesInitialized: true, 'dictionaryMeaningStyles:v1': {}, 'dictionaryMeaningStylesFallback:v1': null });
  await saveWebDraft({ url: 'https://example.org/book/', chapters: [] });
  const root = createRoot(area);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => String(input).endsWith('/api/web-import/resource') ? Response.json({ error: 'Cloudflare requires verification', code: 'SOURCE_VERIFICATION_REQUIRED', sourceUrl: 'https://example.org/book/' }, { status: 403 }) : originalFetch(input, init);
  try {
    await act(async () => { root.render(<AppProvider><WebImportView /></AppProvider>); });
    await until(() => button('Phân tích'), 'view hydration');
    await act(async () => button('Phân tích').click());
    await until(() => area.textContent?.includes('Cloudflare requires verification'), 'verification notice');
    const file = new File([toc], 'muc-luc.html', { type: 'text/html' });
    await importFile(file);
    await until(() => area.textContent?.includes('thêm 2 chương'), 'imported chapter count');
    assert(area.querySelector('span[title="muc-luc.html"]'), 'Chosen filename disappeared');
    assert(!area.textContent?.includes('Cloudflare requires verification') && !area.textContent?.includes('Mở trang gốc để xác minh'), 'Stale verification error remained');
    assert(area.querySelector<HTMLInputElement>('input[aria-label="Đến chương"]')?.value === '2', 'Chapter range was not updated');
    assert(area.querySelector<HTMLInputElement>('input[aria-label="HTML mục lục đã lưu"]')?.closest('details')?.open, 'Picker panel closed during import');
    lines.push('PASS choosing HTML shows filename, clears old error, retains open panel and updates range');
    await act(async () => { area.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); });
    await importFile(file);
    await until(() => area.textContent?.includes('thêm 0 chương'), 'same-file reimport');
    assert(area.querySelectorAll('input[aria-label="Tên chương"]').length === 2, 'Same-file append duplicated chapters');
    lines.push('PASS same file can be selected again without duplicate chapters');
    await importFile(new File(['<html><title>Just a moment...</title><form id="challenge-form"></form></html>'], 'challenge.html'));
    await until(() => area.textContent?.includes('Tệp đang chứa trang xác minh'), 'challenge file error');
    assert(area.querySelectorAll('input[aria-label="Tên chương"]').length === 2, 'Invalid file replaced the old list');
    lines.push('PASS invalid saved challenge file gives actionable error and preserves existing chapters');
  } finally { globalThis.fetch = originalFetch; await act(async () => { root.unmount(); }); }
}
run().then(() => { output.textContent = lines.join('\n') + '\nALL PASSED'; }).catch(error => { output.textContent = lines.join('\n') + '\nFAIL: ' + error.stack; });
