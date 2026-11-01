const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const built = buildSync({ stdin: { contents: "export * from './src/utils/autoMeaningStyles'; export * from './src/utils/meaningStyles'; export { meaningRows } from './src/components/MeaningStyleEditor';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { autoMeaningStyles, applyMeaningStyles, meaningRows, preferredMeaning, validMeaningStyles } = loaded.exports;

test('automatic tags distinguish meanings and support shared genres', () => {
  const rows = autoMeaningStyles('vietphrase', '异词', 'ma pháp/tỏ tình/máy tính');
  assert.deepEqual(rows[0].styles, ['western']);
  assert.deepEqual(rows[1].styles, ['modern', 'romance']);
  assert.deepEqual(rows[2].styles, ['modern']);
  assert.ok(validMeaningStyles({ vietphrase: { 异词: rows } }));
});
test('classification uses conservative word boundaries and does not infer a culture from names', () => {
  for (const [kind, cn, raw] of [['vietphrase', '基因', 'gen'], ['vietphrase', '任务', 'nhiệm vụ'], ['vietphrase', '鱼', 'cá ma'], ['names', '金明', 'Kim Minh']]) {
    assert.deepEqual(autoMeaningStyles(kind, cn, raw)[0].styles, ['neutral']);
  }
  assert.ok(autoMeaningStyles('names_main', '东京', 'Tokyo')[0].styles.includes('japanese'));
});
test('empty meanings and existing manual choices are retained', () => {
  assert.deepEqual(autoMeaningStyles('vietphrase', '了', '/đã')[0], { meaning: '', styles: ['neutral'], automatic: true });
  const manual = [{ meaning: 'ma pháp', styles: ['gaming'] }];
  assert.deepEqual(autoMeaningStyles('vietphrase', '魔法', 'ma pháp', manual), manual);
});
test('neutral automatic tags do not replace the source default, while manual neutral choices still work', () => {
  try {
    applyMeaningStyles({ vietphrase: { 先生: autoMeaningStyles('vietphrase', '先生', 'tiên sinh/ông/thầy') } }, 'neutral');
    assert.equal(preferredMeaning('vietphrase', '先生', 'neutral'), undefined);
    assert.equal(preferredMeaning('vietphrase', '先生', 'modern'), 'ông');
    applyMeaningStyles({ vietphrase: { 先生: [{ meaning: 'thầy', styles: ['neutral'] }] } }, 'neutral');
    assert.equal(preferredMeaning('vietphrase', '先生', 'neutral'), 'thầy');
  } finally { applyMeaningStyles({}); }
});
test('implicit neutral classification covers every ordinary meaning without per-term records', () => {
  try {
    applyMeaningStyles({}, 'neutral');
    assert.deepEqual(meaningRows('vietphrase', '常词', 'nghĩa một/nghĩa hai').map(row => row.styles), [['neutral'], ['neutral']]);
    applyMeaningStyles({ vietphrase: { 常词: [{ meaning: 'nghĩa một', styles: ['modern'] }, { meaning: 'nghĩa hai', styles: ['modern'] }] } }, 'neutral');
    assert.equal(preferredMeaning('vietphrase', '常词', 'modern'), 'nghĩa một');
  } finally { applyMeaningStyles({}); }
});
