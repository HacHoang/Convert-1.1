const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { buildSync } = require('esbuild');

const built = buildSync({ entryPoints: ['src/utils/quickTranslatorPort.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const moduleShim = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, moduleShim, moduleShim.exports);
const { quickTranslateOneMeaningForBatch } = moduleShim.exports;

test('dictionary lookups ignore inherited properties and retain explicit special keys', () => {
  const dictionary = { ['长'.repeat(24)]: 'long' };
  assert.equal(quickTranslateOneMeaningForBatch('constructor', [], dictionary), 'Constructor');
  assert.equal(quickTranslateOneMeaningForBatch('toString', [], dictionary), 'ToString');
  assert.equal(quickTranslateOneMeaningForBatch('constructor', [], { constructor: 'explicit' }).trim(), 'Explicit');
  assert.equal(quickTranslateOneMeaningForBatch('测试', [], Object.create({ '测试': 'inherited' })), '测试');
});
const rows = name => JSON.parse(zlib.gunzipSync(fs.readFileSync(`public/assets/default-dictionaries/${name}.json.gz`)));
const map = (name, key = 'chinese', value = 'vietnamese') => Object.fromEntries(rows(name).map(row => [row[key], row[value]]));
const names = rows('names_store');
const vietphrase = map('vietphrase_store');
const options = {
  namesMainMap: map('names_main_store'), phienAmMap: map('phien_am_store'),
  luatNhanMap: map('luat_nhan_store', 'pattern', 'translation'), pronounsMap: map('pronouns_store'),
  ignoredPhrases: rows('ignored_phrases_store').map(row => row.phrase),
  prioritizedName: true, wrapType: 0,
};

test('ignored phrase previews translate meanings while normal translation still omits them', () => {
  const source = '本章完';
  const dictionary = { [source]: 'hết chương' };
  const previewOptions = { ignoredPhrases: [source], applyIgnoredPhrases: false };
  assert.equal(quickTranslateOneMeaningForBatch(source, [], dictionary, { ignoredPhrases: [source] }).trim(), '');
  assert.equal(quickTranslateOneMeaningForBatch(source, [], dictionary, previewOptions).trim(), 'Hết chương');
  assert.deepEqual(quickTranslateOneMeaningForBatch(`${source}\n${source}`, [], dictionary, previewOptions).split('\n').map(value => value.trim()), ['Hết chương', 'Hết chương']);
});

const oracle = [
  ['罗彬缓缓睁眼。', ' La Bân chậm rãi mở mắt.'],
  ['在他眼里', ' Trong mắt hắn'],
  ['他说：“你好！”', ' Hắn nói:"ngươi tốt!"'],
  ['第一章 开始', ' Chương thứ nhất: Bắt đầu'],
];

test('ported one-meaning batch algorithm matches TranslatorEngine 1.4 oracle', () => {
  for (const algorithm of [0, 1, 2]) {
    for (const [source, expected] of oracle) {
      assert.equal(quickTranslateOneMeaningForBatch(source, names, vietphrase, { ...options, translationAlgorithm: algorithm }), expected, `${source}, algorithm ${algorithm}`);
    }
  }
});

test('uses Vietnamese punctuation in batch output', () => {
  const source = '你好，世界。你好！';
  const result = quickTranslateOneMeaningForBatch(source, [], { 你好: 'xin chào', 世界: 'thế giới' });
  assert.equal(result, ' Xin chào, thế giới. xin chào!');
  assert.doesNotMatch(result, /[，。！？；：、]/);
});

test('line-start capitalization can be disabled with the existing typography setting', () => {
  assert.equal(quickTranslateOneMeaningForBatch('你好\n再见', [], { 你好: 'xin chào', 再见: 'tạm biệt' }, { capitalizeLines: false }).trim(), 'xin chào\ntạm biệt');
});

test('uses newly imported dictionaries and matches names and VietPhrase keys longer than 20 characters', () => {
  const longPhrase = '\u6b64\u5904\u662f\u4e00\u4e2a\u957f\u5ea6\u8d85\u8fc7\u4e8c\u5341\u4e2a\u6c49\u5b57\u800c\u4e14\u5fc5\u987b\u5b8c\u6574\u5339\u914d\u7684\u8bcd\u7ec4\u5185\u5bb9';
  const longName = '\u8fd9\u662f\u4e00\u4e2a\u957f\u5ea6\u8d85\u8fc7\u4e8c\u5341\u4e2a\u6c49\u5b57\u7684\u5b8c\u6574\u4eba\u7269\u540d\u79f0\u6d4b\u8bd5\u6570\u636e';
  const importedVietphrase = { [longPhrase]: 'cum tu dai moi nhap' };
  const importedNames = [{ id: 'long-name', chinese: longName, vietnamese: 'ten dai moi nhap', category: 'Nh\u00e2n v\u1eadt' }];
  assert.match(quickTranslateOneMeaningForBatch(longPhrase, [], importedVietphrase, {}), /cum tu dai moi nhap/i);
  assert.match(quickTranslateOneMeaningForBatch(longName, importedNames, {}, {}), /ten dai moi nhap/i);
  assert.match(quickTranslateOneMeaningForBatch('\u6d4b\u8bd5', [], { '\u6d4b\u8bd5': 'du lieu cu' }, {}), /du lieu cu/i);
  assert.match(quickTranslateOneMeaningForBatch('\u6d4b\u8bd5', [], { '\u6d4b\u8bd5': 'du lieu moi' }, {}), /du lieu moi/i);
});

test('matches simplified dictionary entries when the source text is traditional Chinese', () => {
  const importedNames = [
    { id: 'mountain', chinese: '\u56db\u89c4\u5c71', vietnamese: 'T\u1ee9 Quy S\u01a1n', category: 'Nh\u00e2n v\u1eadt' },
    { id: 'person', chinese: '\u7f57\u663e\u795e', vietnamese: 'La Hi\u1ec3n Th\u1ea7n', category: 'Nh\u00e2n v\u1eadt' },
  ];
  const importedVietphrase = { '\u85cf\u7740\u6396\u7740': 'che gi\u1ea5u' };
  const traditionalSource = '\u56db\u898f\u5c71 \u7f85\u986f\u795e \u85cf\u8457\u6396\u8457';
  assert.match(quickTranslateOneMeaningForBatch(traditionalSource, importedNames, importedVietphrase, {}), /T\u1ee9 Quy S\u01a1n La Hi\u1ec3n Th\u1ea7n che gi\u1ea5u/i);
});

test('traditional text matches Quick Translator simplified output and applies ignored phrases', () => {
  const cases = [
    ['四十至五十區間', 'Bốn mươi đến năm mươi khu ở giữa'],
    ['頗有幾分道骨仙風的感覺', 'Rất có vài phần đạo cốt tiên phong cảm giác'],
    ['徐彔卻覺得一陣陣眼熟', 'Từ Lục lại cảm thấy từng đợt nhìn quen mắt'],
  ];
  for (const [source, expected] of cases) {
    assert.equal(quickTranslateOneMeaningForBatch(source, names, vietphrase, { ...options, translationAlgorithm: 1 }).trim(), expected);
  }
});
