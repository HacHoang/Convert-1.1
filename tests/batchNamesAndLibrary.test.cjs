const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');
function load(file) {
  const result = buildSync({ entryPoints: [path.join(__dirname, '../src/utils', file)], bundle: true, platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
const { BatchNameDetector } = load('batchNameDetection.ts');
const { findLibraryChapter, mergeLibraryChapters, planLibraryDuplicateRepair } = load('libraryChapterMerge.ts');
const tokens = [{ original: '赵晏衡', translated: 'triệu yến hành', isName: false, isPunctuation: false, charStart: 0, charEnd: 3 }];

test('repeated name-like phrases produce suggestions with frequency and translation context', () => {
  const detector = new BatchNameDetector([]);
  detector.addChapter('赵晏衡说道。赵晏衡问道。', tokens);
  detector.addChapter('赵晏衡点头。', tokens);
  const found = detector.suggestions().find(row => row.chinese === '赵晏衡');
  assert.ok(found);
  assert.equal(found.count, 3);
  assert.equal(found.chapterCount, 2);
  assert.ok(found.vietnamese.length > 0);
  assert.ok(found.translationExample.includes('triệu yến hành'));
});

test('known names, ordinary repeated words and single appearances are excluded', () => {
  const detector = new BatchNameDetector(['赵晏衡']);
  detector.addChapter('赵晏衡说道。赵晏衡问道。赵晏衡点头。王国说道。王国说道。王国说道。高兴说道。高兴说道。高兴说道。慕容晏衡说道。', tokens);
  assert.deepEqual(detector.suggestions(), []);
});

test('compound surnames are supported without reporting their shorter prefixes', () => {
  const detector = new BatchNameDetector([]);
  detector.addChapter('慕容晏衡说道。慕容晏衡问道。慕容晏衡点头。', []);
  assert.ok(detector.suggestions().some(row => row.chinese === '慕容晏衡'));
  assert.ok(!detector.suggestions().some(row => row.chinese === '慕容晏'));
});

test('stable short names suppress grammatical extensions but uncertain candidates remain inspectable', () => {
  const detector = new BatchNameDetector([]);
  detector.addChapter('罗斌说道。罗斌问道。罗斌点头。' +
    '罗斌才说道。罗斌才问道。罗斌才点头。' +
    '罗斌能说道。罗斌能问道。罗斌能点头。' +
    '罗斌没说道。罗斌没问道。罗斌没点头。' +
    '罗斌一说道。罗斌一问道。罗斌一点头。', []);
  const visible = detector.suggestions().map(row => row.chinese);
  assert.ok(visible.includes('罗斌'));
  for (const word of ['罗斌才', '罗斌能', '罗斌没', '罗斌一']) assert.ok(!visible.includes(word), word);
  const uncertain = detector.suggestions({ includeUncertain: true }).filter(row => row.possibleContinuationOf === '罗斌');
  assert.equal(uncertain.length, 4);
});

test('known names also protect their boundary without excluding real longer names', () => {
  const detector = new BatchNameDetector(['罗斌']);
  detector.addChapter('罗斌才说道。罗斌才问道。罗斌才点头。', []);
  assert.ok(!detector.suggestions().some(row => row.chinese === '罗斌才'));
  const genuine = new BatchNameDetector(['罗斌']);
  genuine.addChapter('他名叫罗斌才。罗斌才说道。罗斌才问道。罗斌才点头。', []);
  assert.ok(genuine.suggestions().some(row => row.chinese === '罗斌才'));
});

test('no global suffix blacklist removes valid names such as 林一 and 陈才能', () => {
  const detector = new BatchNameDetector(['林']);
  detector.addChapter('林一说道。林一问道。林一点头。陈才能说道。陈才能问道。陈才能点头。', []);
  const names = detector.suggestions().map(row => row.chinese);
  assert.ok(names.includes('林一'));
  assert.ok(names.includes('陈才能'));
});

function chapter(overrides = {}) {
  return { id: 'old', novelId: 'book', novelTitle: 'Truyện', title: 'Chương 10: Cũ', chapterPrefix: 'Chương 10', originalText: '旧原文', vietphraseText: 'Bản cũ', savedAt: 1, ...overrides };
}
test('overwrite updates an existing chapter in place after source or title changes', () => {
  const old = chapter();
  const incoming = chapter({ title: 'Chương 10: Mới', originalText: '新原文', vietphraseText: 'Bản mới' });
  const result = mergeLibraryChapters([old], [incoming], { duplicatePolicy: 'overwrite', overwriteIds: ['old'] });
  assert.equal(result.chapters.length, 1);
  assert.equal(result.overwritten, 1);
  assert.equal(result.count, 0);
  assert.equal(result.chapters[0].id, 'old');
  assert.equal(result.chapters[0].vietphraseText, 'Bản mới');
  assert.equal(old.vietphraseText, 'Bản cũ');
});

test('skip retains the old translation and stale overwrite approvals are rejected', () => {
  const old = chapter();
  assert.equal(mergeLibraryChapters([old], [chapter({ vietphraseText: 'Mới' })]).skipped, 1);
  assert.throws(() => mergeLibraryChapters([old], [chapter()], { duplicatePolicy: 'overwrite', overwriteIds: [] }), /Thư viện đã thay đổi/);
});

test('different novels, chapter numbers and explicit multipart chapters never collide', () => {
  const old = chapter();
  assert.equal(findLibraryChapter([old], chapter({ novelId: 'other' })), undefined);
  assert.equal(findLibraryChapter([old], chapter({ title: 'Chương 11', chapterPrefix: 'Chương 11' })), undefined);
  assert.equal(findLibraryChapter([chapter({ title: 'Chương 10 (1/2)' })], chapter({ title: 'Chương 10 (2/2)' })), undefined);
  assert.equal(findLibraryChapter([chapter({ title: 'Chương 10 (1/2)' })], chapter({ title: 'Chương 10 (1/2)', vietphraseText: 'Mới' })).id, 'old');
});

test('duplicate inputs are skipped without creating repeated copies or overwriting another novel', () => {
  const result = mergeLibraryChapters([chapter({ novelId: 'other' })], [chapter(), chapter()], { duplicatePolicy: 'overwrite', overwriteIds: [] });
  assert.equal(result.count, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.chapters.length, 2);
  assert.equal(result.chapters.find(row => row.novelId === 'other').id, 'old');
});

test('differently titled unlabeled parts retain different source under the same chapter number', () => {
  const result = mergeLibraryChapters([], [chapter({ title: 'Chương 10: đầu', originalText: 'part one' }), chapter({ title: 'Chương 10: cuối', originalText: 'part two' })]);
  assert.equal(result.count, 2);
  assert.equal(result.skipped, 0);
});

test('same chapter revisions with different advertisements or prose never create duplicate rows', () => {
  const first = chapter({ originalText: '正文\n温馨提示: advertisement one' });
  const revised = chapter({ originalText: '正文\n温馨提示: advertisement two' });
  const result = mergeLibraryChapters([], [first, revised, chapter({ originalText: 'Revised story text' })]);
  assert.equal(result.count, 1);
  assert.equal(result.skipped, 2);
  assert.equal(result.chapters.length, 1);
  const again = mergeLibraryChapters(result.chapters, [revised]);
  assert.equal(again.count, 0);
  assert.equal(again.skipped, 1);
});

test('existing duplicate numbers resolve by normalized title instead of adding another copy', () => {
  const rows = [chapter({ id: 'a', originalText: 'a' }), chapter({ id: 'b', originalText: 'b' })];
  const result = mergeLibraryChapters(rows, [chapter({ title: 'Chương 10:  Cũ', originalText: 'c' })]);
  assert.equal(result.count, 0);
  assert.equal(result.skipped, 1);
});

test('repair keeps newest revision under stable ID, preserves explicit parts and other books, and is idempotent', () => {
  const rows = [chapter({ id: 'first', savedAt: 1 }), chapter({ id: 'revision', originalText: 'new prose', savedAt: 2 }),
    chapter({ id: 'part1', title: 'Chương 10 (1/2)' }), chapter({ id: 'part2', title: 'Chương 10 (2/2)' }),
    chapter({ id: 'other', novelId: 'other' })];
  const plan = planLibraryDuplicateRepair(rows, 'book');
  assert.equal(plan.removedCount, 1);
  assert.deepEqual(plan.redirectedIds, { revision: 'first' });
  assert.equal(plan.chapters[0].originalText, 'new prose');
  assert.deepEqual(plan.chapters.map(row => row.id), ['first', 'part1', 'part2', 'other']);
  assert.equal(planLibraryDuplicateRepair(plan.chapters, 'book').removedCount, 0);
  assert.equal(rows[0].originalText, '旧原文');
});
