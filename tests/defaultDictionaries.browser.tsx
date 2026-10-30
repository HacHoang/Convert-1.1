// Use a dedicated empty origin, e.g. http://127.0.0.1:3013/tests/defaultDictionaries.browser.html.
// This test intentionally resets dictionary data on that TEST origin.
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, useApp } from '../src/context/AppContext';
import { initializeDefaultDictionaries } from '../src/utils/defaultDictionaries';
import { DICTIONARY_STORES, STORE_APP, openDB, readAppValue, writeAppValue, readStore,
  saveVietphraseItem, deleteVietphraseItem, deleteIgnoredPhrases, clearPronounsStore } from '../src/utils/indexedDbStorage';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const output = document.getElementById('results')!;
const lines: string[] = [];
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
async function counts() {
  return Promise.all(DICTIONARY_STORES.map(async name => (await readStore(name)).length));
}
async function removeMarker() {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_APP, 'readwrite'); tx.objectStore(STORE_APP).delete('dictionariesInitialized');
    tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
  }); db.close();
}
let api: ReturnType<typeof useApp>;
function Probe() { const value = useApp(); useEffect(() => { api = value; }); return null; }
const root = createRoot(document.getElementById('test-root')!);
async function run() {
  assert(location.port === '3013', 'Use dedicated test port 3013; do not run on your normal app origin.');
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('ConvertAppDB');
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other tabs on the test origin first.'));
  });
  assert((await counts()).every(count => count === 0), 'Test requires an empty dictionary database.');
  const fetcher = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Simulated offline'); };
  try { await initializeDefaultDictionaries(); throw new Error('Offline initialization succeeded'); }
  catch (error) { assert(String(error).includes('Simulated offline'), String(error)); }
  finally { globalThis.fetch = fetcher; }
  assert(!await readAppValue('dictionariesInitialized'), 'Failed initialization set the marker');
  assert((await counts()).every(count => count === 0), 'Failed initialization left partial data');
  lines.push('PASS failed first load leaves no partial data or completion marker');
  const manifest = await fetch('/assets/default-dictionaries/manifest.json').then(response => response.json());
  const expected = DICTIONARY_STORES.map(name => manifest.stores.find((entry: any) => entry.store === name).count);
  await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
  for (let i = 0; i < 4800 && !api; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
    if (i % 40 === 0) output.textContent = [...lines, document.getElementById('test-root')?.textContent || 'Initializing…'].join('\n');
  }
  assert(api, 'Fresh install timed out');
  assert(JSON.stringify(await counts()) === JSON.stringify(expected), 'Fresh install counts do not match the captured snapshot');
  assert(api.namesList.length === expected[0] && Object.keys(api.vietphraseMap).length === expected[2], 'Provider did not load the default snapshot');
  lines.push('PASS fresh AppProvider installs all seven captured dictionaries');
  const editedPhrase = Object.keys(api.vietphraseMap)[0];
  await saveVietphraseItem(editedPhrase, 'user-edit');
  assert((await readStore<any>('vietphrase_store')).find(row => row.chinese === editedPhrase)?.vietnamese === 'user-edit', 'Edit failed to override bundled data');
  await deleteVietphraseItem(editedPhrase);
  assert(!(await readStore<any>('vietphrase_store')).some(row => row.chinese === editedPhrase), 'Deleted default phrase returned');
  await saveVietphraseItem(editedPhrase, 're-added');
  assert((await readStore<any>('vietphrase_store')).find(row => row.chinese === editedPhrase)?.vietnamese === 're-added', 'Could not re-add a deleted default phrase');
  const ignored = api.ignoredPhrasesList[0];
  await deleteIgnoredPhrases([ignored]);
  assert(!(await readStore<any>('ignored_phrases_store')).some(row => row.phrase === ignored), 'Deleted default ignored phrase returned');
  await clearPronounsStore();
  assert((await readStore('pronouns_store')).length === 0, 'Cleared table retained bundled entries');
  lines.push('PASS edit, delete, re-add and clear persist over bundled snapshots');
  await saveVietphraseItem('default-regression-custom', 'keep user changes');
  await removeMarker();
  await initializeDefaultDictionaries();
  const preserved = await counts();
  assert(preserved[2] === expected[2] + 1, 'Initialization overwrote existing dictionary edits');
  lines.push('PASS existing dictionary edits survive initialization without a marker');
  const library = await readAppValue('library');
  const settings = await readAppValue('settings');
  await writeAppValue('regression-sentinel', 'keep');
  await act(async () => { await api.resetDictionaries(); });
  assert(JSON.stringify(await counts()) === JSON.stringify(expected), 'Reset did not restore the bundled snapshot');
  assert(!Object.hasOwn(api.vietphraseMap, 'default-regression-custom'), 'Reset kept a custom phrase');
  assert(JSON.stringify(await readAppValue('library')) === JSON.stringify(library), 'Reset changed library');
  assert(JSON.stringify(await readAppValue('settings')) === JSON.stringify(settings), 'Reset changed settings');
  assert(await readAppValue('regression-sentinel') === 'keep', 'Reset cleared unrelated app values');
  lines.push('PASS reset restores captured dictionaries and preserves library/settings');
  await act(async () => { root.unmount(); });
}
run().then(() => { output.textContent = lines.join('\n') + '\nALL PASSED'; })
  .catch(error => { output.textContent = lines.join('\n') + '\nFAIL: ' + error.stack; });
