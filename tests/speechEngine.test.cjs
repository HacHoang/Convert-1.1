const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const path = require('node:path');

const source = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/speechEngine.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', source.outputFiles[0].text)(require, loaded, loaded.exports);
const { SpeechService, splitSpeechChunks } = loaded.exports;

function setup(voices = [{ lang: 'vi-VN' }]) {
  const spoken = [];
  const listeners = new Map();
  const synth = {
    voices, spoken, listeners, cancelled: 0,
    getVoices() { return this.voices; },
    speak(utterance) { spoken.push(utterance); },
    cancel() { this.cancelled++; },
    pause() {}, resume() {},
    addEventListener(event, callback) { listeners.set(event, callback); },
    removeEventListener(event) { listeners.delete(event); },
  };
  global.window = { speechSynthesis: synth };
  global.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  return { service: new SpeechService(), synth, spoken };
}

test('splits long paragraphs without losing text', () => {
  const text = 'First sentence. Second sentence! '.repeat(50).trim();
  const chunks = splitSpeechChunks(text);
  assert.ok(chunks.every(chunk => chunk.length <= 220));
  assert.equal(chunks.join(' '), text);
  assert.ok(splitSpeechChunks('x'.repeat(1000)).every(chunk => chunk.length <= 220));
});

test('reads in order and preserves original indexes across empty paragraphs', () => {
  const { service, spoken } = setup();
  const indexes = [];
  let ended = 0;
  service.speakParagraphs(['first', '', 'third'], 1, { onParagraphChange: i => indexes.push(i), onEnd: () => ended++ });
  assert.equal(spoken[0].text, 'first');
  spoken[0].onend();
  assert.equal(spoken[1].text, 'third');
  spoken[1].onend();
  assert.deepEqual(indexes, [0, 2]);
  assert.equal(ended, 1);
  assert.equal(service.isSpeaking(), false);
});

test('seek cancels stale events and starts the requested paragraph', () => {
  const { service, spoken } = setup();
  let errors = 0;
  service.speakParagraphs(['first', 'second', 'third'], 1, { onError: () => errors++ });
  const stale = spoken[0];
  service.seekParagraph(2);
  assert.equal(spoken.at(-1).text, 'third');
  stale.onend();
  stale.onerror({ error: 'canceled' });
  assert.equal(spoken.length, 2);
  assert.equal(errors, 0);
  service.seekParagraph(1);
  assert.equal(spoken.at(-1).text, 'second');
  service.stop();
});

test('seeking while paused stays paused until resumed', () => {
  const { service, spoken } = setup();
  service.speakParagraphs(['first', 'second']);
  service.pause();
  service.seekParagraph(1);
  assert.equal(service.isPaused(), true);
  assert.equal(spoken.length, 1);
  service.resume();
  assert.equal(spoken[1].text, 'second');
  assert.equal(service.isPaused(), false);
  service.stop();
});

test('stop and a new session ignore old completion callbacks', () => {
  const { service, spoken } = setup();
  let ended = 0;
  service.speak('old', 1, { onEnd: () => ended++ });
  const stale = spoken[0];
  service.stop();
  service.speak('new');
  stale.onend();
  assert.equal(spoken.at(-1).text, 'new');
  assert.equal(spoken.length, 2);
  assert.equal(ended, 0);
  service.stop();
});

test('waits for Vietnamese voices and releases listeners on stop', () => {
  const { service, synth, spoken } = setup([{ lang: 'en-US' }]);
  service.speak('first');
  assert.equal(spoken.length, 0);
  synth.voices.push({ lang: 'vi-VN' });
  synth.listeners.get('voiceschanged')();
  assert.equal(spoken[0].lang, 'vi-VN');
  assert.equal(synth.listeners.size, 0);
  service.stop();
  synth.voices = [];
  service.speak('second');
  service.stop();
  assert.equal(synth.listeners.size, 0);
});

test('speed is bounded and slow speech uses smaller chunks with fixed pitch', () => {
  const { service, spoken } = setup();
  service.speak('word '.repeat(200), 0.1);
  assert.equal(spoken[0].rate, 0.5);
  assert.equal(spoken[0].pitch, 1);
  assert.ok(spoken[0].text.length <= 90);
  service.stop();
  service.speak('fast', 10);
  assert.equal(spoken.at(-1).rate, 2);
  service.stop();
});

test('errors reset playback and empty input never starts', () => {
  const { service, spoken } = setup();
  let errors = 0;
  service.speak('hello', 1, { onError: () => errors++ });
  spoken[0].onerror({ error: 'synthesis-failed' });
  assert.equal(errors, 1);
  assert.equal(service.isSpeaking(), false);
  service.speak('   ', 1, { onStart: () => assert.fail('empty playback') });
});

test('missing Vietnamese voices reports an error instead of using another language', async () => {
  const { service, spoken, synth } = setup([{ lang: 'en-US' }]);
  await new Promise(resolve => service.speak('hello', 1, { onError: error => {
    assert.ok(String(error).length > 0);
    resolve();
  } }));
  assert.equal(spoken.length, 0);
  assert.equal(service.isSpeaking(), false);
  assert.equal(synth.listeners.size, 0);
});
