const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/translatorEngine.ts')], platform: 'node', format: 'cjs', bundle: true, write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { convertText, parseVietphraseMeanings } = loaded.exports;

test('uses imported main Names, secondary overrides and phonetics throughout conversion', () => {
  const source = '罗彬缓缓睁眼。';
  const primary = { '罗彬': 'la bân' };
  const secondary = [{ chinese: '罗彬', vietnamese: 'la bình', category: 'Nhân vật' }];
  const options = { namesMainMap: primary, customPhienAm: { 罗: 'la', 彬: 'bân', 缓: 'hoãn', 睁: 'tranh', 眼: 'nhãn' }, customLuatNhan: {}, customPronouns: {}, customIgnored: [] };
  const phrases = { '缓缓': 'chậm rãi', '睁眼': 'mở mắt/trợn mắt' };
  assert.equal(convertText(source, [], phrases, options).fullText, 'La Bân chậm rãi mở mắt.');
  assert.equal(convertText(source, secondary, phrases, options).fullText, 'La Bình chậm rãi mở mắt.');
  assert.match(convertText(source, [], phrases, options).hanvietText, /La bân hoãn hoãn tranh nhãn/i);
  assert.equal(loaded.exports.inspectChinesePhrase('罗彬', [], phrases, options).existingName, 'la bân');
});

test('preserves paragraphs, punctuation-bearing long keys and quote spacing', () => {
  const result = convertText('“你好。”他说。\n很长的句子。另一句话！', [], { '你好': 'xin chào', '他说': 'hắn nói', '很长的句子。另一句话！': 'cụm dài chứa dấu câu' }, { namesMainMap: {}, customIgnored: [], customLuatNhan: {} });
  assert.equal(result.paragraphs.length, 2);
  assert.equal(result.paragraphs[0].vietphrase, '"Xin chào." Hắn nói.');
  assert.equal(result.paragraphs[1].tokens.length, 1);
  for (const token of result.tokens) assert.equal(result.originalText.slice(token.charStart, token.charEnd), token.original);
  assert.equal(loaded.exports.formatTranslatedTokens(result.paragraphs[0].tokens), result.paragraphs[0].vietphrase);
});

test('Name priority setting works and exact phrases outrank equal-length multiplication rules', () => {
  const names = [{ chinese: '张三', vietnamese: 'trương tam', category: 'Nhân vật' }];
  const phrases = { '张三来了': 'một cụm dài', '在他眼里': 'nghĩa riêng' };
  const options = { namesMainMap: {}, customLuatNhan: { '在{0}眼里': 'trong mắt {0}' }, customPronouns: { 他: 'hắn' } };
  assert.equal(convertText('张三来了', names, phrases, { ...options, prioritizeNames: false }).fullText, 'Một cụm dài');
  assert.match(convertText('张三来了', names, phrases, { ...options, prioritizeNames: true }).fullText, /^Trương Tam/);
  assert.equal(convertText('在他眼里', [], phrases, options).fullText, 'Nghĩa riêng');
  assert.ok(!convertText('在他眼里', [], {}, { ...options, customLuatNhan: {} }).tokens.some(token => token.original === '在他眼里'));
});

test('honors disabled capitalization and empty meanings from imported dictionaries', () => {
  const result = convertText('你好。广告再见！', [], { 你好: 'xin chào', 广告: '', 再见: 'tạm biệt' }, { capitalizeSentences: false, customIgnored: [], namesMainMap: {}, customLuatNhan: {} });
  assert.equal(result.fullText, 'xin chào. tạm biệt!');
  assert.equal(result.tokens.find(token => token.original === '广告').translated, '');
});

test('whole VIP website notice is omitted, preserving individual words and source offsets', () => {
  const notice = '溫馨提示: 優化了VIP會員的閱讀體驗, 點按屏幕中間即可呼喚出菜單, 可以很方便的「設定」、「上一頁」、「下一頁」、「回到頂部」';
  const story = '他說VIP會員可以設定菜單，翻到上一頁或下一頁，再回到頂部。';
  const source = `你好\n${notice}\n${story}`;
  const actual = convertText(source, [], {}, { customIgnored: [] });
  assert.equal(actual.fullText.replace(/\s/g, ''), convertText(`你好\n${story}`, [], {}, { customIgnored: [] }).fullText.replace(/\s/g, ''));
  assert.equal(actual.originalText, source);
  for (const token of actual.tokens) assert.equal(source.slice(token.charStart, token.charEnd), token.original);
  assert.match(actual.fullText, /VIP/);
});

test('hides copied home breadcrumbs before chapter headings and preserves source offsets', () => {
  for (const prefix of ['首页 / ', '首頁\r\n/\r\n']) {
    const chapter = '第1864章 祭宗現身';
    const source = prefix + chapter;
    const result = convertText(source);
    assert.equal(result.fullText, convertText(chapter).fullText);
    assert.equal(result.hanvietText, convertText(chapter).hanvietText);
    assert.equal(result.originalText, source);
    for (const token of result.tokens) {
      assert.equal(source.slice(token.charStart, token.charEnd), token.original);
    }
  }
});

test('keeps home words and slashes in story content or without a chapter heading', () => {
  for (const source of ['首页 / 你好', '第1864章\n首页 / 第1865章', '他打开首页。']) {
    const result = convertText(source, [], { '首页': 'trang đầu' });
    assert.match(result.fullText.toLowerCase(), /trang đầu/);
  }
});

test('preserves Vietnamese, Latin words and chapter numbers without letter spacing', () => {
  const result = convertText('Chương 1862: Google AI Studio');
  assert.match(result.fullText, /Chương 1862/);
  assert.match(result.fullText, /Google AI Studio/);
});

test('ignored advertising is omitted while source offsets remain exact', () => {
  const source = '你好广告再见';
  const result = convertText(source, [], { '你好': 'xin chào', '再见': 'tạm biệt' }, { customIgnored: ['广告'] });
  assert.ok(!result.fullText.includes('广告'));
  const omitted = result.tokens.find(token => token.original === '广告');
  assert.equal(omitted.translated, '');
  for (const token of result.tokens) assert.equal(source.slice(token.charStart, token.charEnd), token.original);
});

test('replacement dictionary and name overrides take effect after cached conversions', () => {
  const first = { '测试': 'kiểm tra' };
  assert.match(convertText('测试', [], first).fullText.toLowerCase(), /kiểm tra/);
  assert.match(convertText('测试', [], { ...first, '测试': 'thử nghiệm' }).fullText.toLowerCase(), /thử nghiệm/);
  assert.match(convertText('测试', [{ chinese: '测试', vietnamese: 'tên riêng', category: 'Nhân vật' }], first).fullText, /Tên Riêng/);
});

test('QuickTranslator empty primary meaning and multiplication templates work', () => {
  assert.equal(parseVietphraseMeanings('/rồi').primary, '');
  const result = convertText('在他眼里', [], {}, { customLuatNhan: { '在{0}眼里': 'trong mắt {0}' }, customPronouns: { '他': 'hắn' } });
  assert.match(result.fullText.toLowerCase(), /trong mắt hắn/);
});

test('matches phrases longer than the previous 12-character limit', () => {
  const phrase = '这是一个超过十二个汉字的完整词组';
  const result = convertText(phrase, [], { [phrase]: 'cụm từ dài' });
  assert.equal(result.tokens.length, 1);
  assert.match(result.fullText.toLowerCase(), /cụm từ dài/);
});

test('genre styles change pronouns and politeness while preserving names and Han Viet', () => {
  const names = [{ chinese: '张三', vietnamese: 'trương tam', category: 'Nhân vật' }];
  const classic = convertText('我，你，谢谢，张三', names, {}, { style: 'classical' });
  const modern = convertText('我，你，谢谢，张三', names, {}, { style: 'modern' });
  assert.match(classic.fullText.toLowerCase(), /ta, ngươi, đa tạ/);
  assert.match(modern.fullText.toLowerCase(), /tôi, bạn, cảm ơn/);
  assert.match(modern.fullText, /Trương Tam/);
  assert.equal(classic.hanvietText, modern.hanvietText);
});

test('multiplication rules use the selected style pronouns', () => {
  const options = { customLuatNhan: { '在{0}眼里': 'trong mắt {0}' }, customPronouns: { '他': 'hắn' } };
  assert.match(convertText('在他眼里', [], {}, { ...options, style: 'modern' }).fullText.toLowerCase(), /trong mắt anh ấy/);
  assert.match(convertText('在他眼里', [], {}, { ...options, style: 'classical' }).fullText.toLowerCase(), /trong mắt hắn/);
});

test('Western, Korean and Japanese terminology uses separate phrase layers', () => {
  assert.match(convertText('魔法师，城堡', [], {}, { style: 'western' }).fullText.toLowerCase(), /pháp sư, lâu đài/);
  assert.match(convertText('欧巴，首尔，韩元', [], {}, { style: 'korean' }).fullText.toLowerCase(), /oppa, seoul, won/);
  assert.match(convertText('前辈，东京，日元', [], {}, { style: 'japanese' }).fullText.toLowerCase(), /senpai, tokyo, yên/);
});

test('style terminology preserves original VietPhrase alternatives', () => {
  const result = convertText('先生', [], { '先生': 'tiên sinh/thầy' }, { style: 'modern' });
  assert.equal(result.tokens[0].alternatives[0], 'ông');
  assert.ok(result.tokens[0].alternatives.includes('tiên sinh'));
  assert.ok(result.tokens[0].alternatives.includes('thầy'));
});

test('Western names follow style without changing Han Viet or explicit custom names', () => {
  const names = [];
  const phrases = {};
  const neutral = convertText('约翰，威廉', names, phrases, { style: 'neutral' });
  const western = convertText('约翰，威廉', names, phrases, { style: 'western' });
  assert.match(western.fullText, /John, William/);
  assert.equal(western.hanvietText.toLowerCase(), neutral.hanvietText.toLowerCase());
  assert.equal(convertText('约翰，威廉', names, phrases, { style: 'neutral' }).fullText, neutral.fullText);
  const custom = [{ chinese: '约翰', vietnamese: 'Tên Riêng', category: 'Nhân vật' }];
  assert.match(convertText('约翰', custom, phrases, { style: 'western' }).fullText, /Tên Riêng/);
  assert.equal(western.tokens.find(token => token.original === '约翰').isName, true);
});

test('an explicit dictionary remains authoritative after clearing or deleting defaults', () => {
  const { inspectChinesePhrase } = loaded.exports;
  const { buildSync } = require('esbuild');
  const builtDefaults = buildSync({ entryPoints: [path.join(__dirname, '../src/data/vietphraseData.ts')], platform: 'node', format: 'cjs', bundle: true, write: false });
  const defaults = { exports: {} };
  new Function('require', 'module', 'exports', builtDefaults.outputFiles[0].text)(require, defaults, defaults.exports);
  const phrase = Object.keys(defaults.exports.DEFAULT_VIETPHRASE)[0];
  assert.ok(inspectChinesePhrase(phrase).existingVp);
  assert.equal(inspectChinesePhrase(phrase, [], {}).existingVp, null);
  const empty = convertText(phrase, [], {});
  assert.ok(!empty.tokens.some(token => token.original === phrase && token.rawVietphrase));
  assert.equal(inspectChinesePhrase(phrase, [], { [phrase]: 'nghĩa mới' }).existingVp, 'nghĩa mới');
});
