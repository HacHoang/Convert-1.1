const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const built = buildSync({ stdin: { contents: "export * from './src/utils/meaningStyles'; export * from './src/utils/translatorEngine'; export { parseBackup } from './src/utils/appBackup';", resolveDir: process.cwd() }, platform: 'node', format: 'cjs', bundle: true, write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { applyMeaningStyles, validMeaningStyles, preferredMeaning, convertText, parseBackup } = loaded.exports;

test('meaning tags support shared styles and multiple meanings in one style', () => {
  const data = { vietphrase: { '先生': [{ meaning: 'thầy', styles: ['modern', 'romance'] }, { meaning: 'tiên sinh', styles: ['classical'] }] } };
  assert.equal(validMeaningStyles(data), true);
  applyMeaningStyles(data);
  assert.equal(preferredMeaning('vietphrase', '先生', 'romance'), 'thầy');
  assert.equal(preferredMeaning('vietphrase', '先生', 'classical'), 'tiên sinh');
  assert.equal(validMeaningStyles({ names: { x: [{ meaning: 'a', styles: ['modern'] }, { meaning: 'b', styles: ['modern'] }] } }), true);
  assert.equal(validMeaningStyles({ names: { x: [{ meaning: 'a', styles: ['auto'] }] } }), false);
  assert.equal(validMeaningStyles({ names: { x: [null] } }), false);
  const backup = parseBackup(JSON.stringify({ app: 'Hermes', version: '2.6-offline', vietphraseMap: {}, meaningStyles: data }));
  assert.deepEqual(backup.meaningStyles, data);
  applyMeaningStyles({});
});

test('tag changes update cached translations and never restore removed meanings', () => {
  const phrases = { '先生': 'tiên sinh/thầy' };
  const options = { namesMainMap: {}, style: 'modern', customIgnored: [], customLuatNhan: {} };
  try {
    applyMeaningStyles({ vietphrase: { '先生': [{ meaning: 'thầy', styles: ['modern', 'romance'] }] } });
    assert.equal(convertText('先生', [], phrases, options).fullText, 'Thầy');
    applyMeaningStyles({ vietphrase: { '先生': [{ meaning: 'tiên sinh', styles: ['modern'] }] } });
    assert.equal(convertText('先生', [], phrases, options).fullText, 'Tiên sinh');
    assert.equal(convertText('先生', [], { '先生': 'giáo viên' }, options).fullText, 'Giáo viên');
    applyMeaningStyles({ vietphrase: { '先生': [{ meaning: 'thầy', styles: [] }] } });
    assert.equal(convertText('先生', [], phrases, options).fullText, 'Tiên sinh');
  } finally { applyMeaningStyles({}); }
});

test('main and secondary Name meanings keep separate style attributes', () => {
  const options = { style: 'western', namesMainMap: { '约翰': 'ước hàn/John' }, customIgnored: [], customLuatNhan: {} };
  try {
    applyMeaningStyles({ names_main: { '约翰': [{ meaning: 'John', styles: ['western'] }] }, names: { '约翰': [{ meaning: 'Johnny', styles: ['western'] }] } });
    assert.equal(convertText('约翰', [], {}, options).fullText, 'John');
    assert.equal(convertText('约翰', [{ chinese: '约翰', vietnamese: 'tên riêng/Johnny', category: 'Nhân vật' }], {}, options).fullText, 'Johnny');
    assert.equal(convertText('约翰', [{ chinese: '约翰', vietnamese: 'tên khác', category: 'Nhân vật' }], {}, options).fullText, 'Tên Khác');
  } finally { applyMeaningStyles({}); }
});
