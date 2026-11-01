import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

// Read-only audit: never modifies the source folder or the application's database.
const folder = process.argv[2];
if (!folder) throw new Error('Usage: node scripts/audit-quicktranslator.mjs <QuickTranslator folder>');
const require = createRequire(import.meta.url);
function load(file) {
  const result = buildSync({ entryPoints: [path.resolve(file)], bundle: true, platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
const { parseDictionaryFileChunked } = load('src/utils/largeFileImporter.ts');
const { convertText } = load('src/utils/translatorEngine.ts');
const maps = {}, counts = [];
for (const name of ['Names.txt', 'Names2.txt', 'Vietphrase.txt', 'ChinesePhienAmWords.txt', 'LuatNhan.txt', 'Pronouns.txt']) {
  const bytes = fs.readFileSync(path.join(folder, name));
  const original = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const expected = new Map();
  for (const line of original.split(/\r\n|\r|\n/)) {
    const text = line.trim(), eq = text.indexOf('=');
    if (eq > 0 && !text.startsWith('#') && !text.startsWith('//')) expected.set(text.slice(0, eq).trim(), text.slice(eq + 1).trim());
  }
  const imported = new Map();
  await parseDictionaryFileChunked(new File([bytes], name), undefined, async rows => {
    for (const row of rows) imported.set(row.chinese, row.vietnamese);
  });
  const mismatches = [...expected].filter(([key, value]) => imported.get(key) !== value).length;
  if (mismatches || expected.size !== imported.size) throw new Error(`${name}: import differs from source`);
  counts.push({ file: name, entries: imported.size, emptyMeanings: [...imported.values()].filter(value => value === '').length, longestKey: Math.max(...Array.from({ length: 1 }, () => 0), ...new Set([...imported.keys()].map(key => key.length))), mismatches });
  maps[name] = Object.fromEntries(imported);
}
const names = Object.entries(maps['Names2.txt']).map(([chinese, vietnamese], index) => ({ id: String(index), chinese, vietnamese, category: 'Nhân vật', createdAt: 0 }));
const options = {
  namesMainMap: maps['Names.txt'], customPhienAm: maps['ChinesePhienAmWords.txt'],
  customLuatNhan: maps['LuatNhan.txt'], customPronouns: maps['Pronouns.txt'],
  customIgnored: fs.readFileSync(path.join(folder, 'IgnoredChinesePhrases.txt'), 'utf8').split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean),
  style: 'neutral', prioritizeNames: true,
};
const samples = ['罗彬缓缓睁眼。', '嘴里粘稠苦臭，水泥封鼻似的，难以呼吸。', '羅彬緩緩睜眼。'];
const translations = samples.map(source => ({ source, translation: convertText(source, names, maps['Vietphrase.txt'], options).fullText }));
console.log(JSON.stringify({ counts, translations, sourceVariants: {
  simplified: maps['Vietphrase.txt']['睁眼'], traditional: maps['Vietphrase.txt']['睜眼'],
  nameSimplified: maps['Names2.txt']['罗彬'], nameTraditional: maps['Names2.txt']['羅彬'] ?? null,
} }, null, 2));
