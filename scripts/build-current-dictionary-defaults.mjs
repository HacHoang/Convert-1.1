import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-current-dictionary-defaults.mjs <capture-directory>');
const output = path.resolve('public/assets/default-dictionaries');
const built = buildSync({ stdin: { contents: "export * from './src/utils/autoMeaningStyles'; export { validMeaningStyles } from './src/utils/meaningStyles';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} }; new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
const { autoMeaningStyles, AUTO_STYLE_VERSION, validMeaningStyles } = loaded.exports;
const captured = JSON.parse(await readFile(path.join(source, 'capture.json'), 'utf8'));
const manual = JSON.parse(gunzipSync(await readFile(path.join(source, 'meaning-styles.json.gz')))).entries;
const kinds = { names_store: 'names', names_main_store: 'names_main', vietphrase_store: 'vietphrase' };
const metadata = { version: 1, fallback: 'neutral', entries: {} };
const report = { generatedAt: new Date().toISOString(), capturedAt: captured.capturedAt, rules: AUTO_STYLE_VERSION, stores: {}, byKind: {}, tagMeanings: {}, manualMeaningsPreserved: 0, fallback: 'neutral' };
const manifest = { version: '2026-11-01-style-tags-v1', capturedAt: captured.capturedAt, stores: [] };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// Analyze and validate every staged file before replacing the shipped manifest.
for (const store of captured.stores.filter(store => store !== 'meaning-styles')) {
  const bytes = await readFile(path.join(source, `${store}.json.gz`));
  const rows = JSON.parse(gunzipSync(bytes));
  if (!Array.isArray(rows)) throw new Error(`Invalid store ${store}`);
  const seen = new Set();
  for (const row of rows) {
    const key = store === 'names_store' ? row.id : store === 'luat_nhan_store' ? row.pattern : store === 'ignored_phrases_store' ? row.phrase : row.chinese;
    if (typeof key !== 'string' || seen.has(key)) throw new Error(`Invalid or duplicate key in ${store}`);
    seen.add(key);
  }
  report.stores[store] = rows.length;
  manifest.stores.push({ store, file: `${store}.json.gz`, count: rows.length, bytes: bytes.length, sha256: sha(bytes) });
  const kind = kinds[store];
  if (!kind) continue;
  const entries = Object.create(null);
  let meanings = 0, specific = 0, implicit = 0;
  for (const row of rows) {
    const saved = manual[kind]?.[row.chinese];
    const tagged = autoMeaningStyles(kind, row.chinese, row.vietnamese, saved);
    for (const meaning of tagged) {
      meanings++;
      if (saved?.some(item => item.meaning === meaning.meaning)) report.manualMeaningsPreserved++;
      if (meaning.styles.some(style => style !== 'neutral')) specific++;
      for (const style of meaning.styles) report.tagMeanings[style] = (report.tagMeanings[style] || 0) + 1;
    }
    // All-neutral entries are represented by one shared fallback, not a million duplicate records.
    if (saved || tagged.some(row => row.styles.some(style => style !== 'neutral'))) entries[row.chinese] = tagged;
    else implicit++;
  }
  metadata.entries[kind] = entries;
  report.byKind[kind] = { terms: rows.length, meanings, specificMeanings: specific, sparseTerms: Object.keys(entries).length, implicitNeutralTerms: implicit };
  console.log(JSON.stringify({ kind, ...report.byKind[kind] }));
}
if (!validMeaningStyles(metadata.entries)) throw new Error('Invalid generated meaning styles');
const tagBytes = gzipSync(Buffer.from(JSON.stringify(metadata)), { level: 9 });
manifest.meaningStyles = { file: 'meaning_styles.json.gz', count: Object.values(metadata.entries).reduce((n, rows) => n + Object.keys(rows).length, 0), bytes: tagBytes.length, sha256: sha(tagBytes) };
await mkdir(output, { recursive: true });
for (const entry of manifest.stores) await copyFile(path.join(source, entry.file), path.join(output, entry.file));
await writeFile(path.join(output, manifest.meaningStyles.file), tagBytes);
await writeFile(path.join(output, 'classification-report.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ version: manifest.version, tagBytes: tagBytes.length, report }));
