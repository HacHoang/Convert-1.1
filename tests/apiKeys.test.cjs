const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');

globalThis.__apiKeyTestStorage = new Map();

let apiKeys;
const storage = globalThis.__apiKeyTestStorage;
const reset = () => storage.clear();

before(async () => {
  const built = await build({
    entryPoints: [path.join(__dirname, '../src/utils/apiKeys.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    plugins: [{
      name: 'mock-indexeddb-storage',
      setup(buildContext) {
        buildContext.onResolve({ filter: /^\.\/indexedDbStorage$/ }, args => ({ path: args.path, namespace: 'mock-storage' }));
        buildContext.onLoad({ filter: /.*/, namespace: 'mock-storage' }, () => ({
          contents: `
            const storage = globalThis.__apiKeyTestStorage;
            exports.readAppValue = async key => storage.get(key);
            exports.writeAppValue = async (key, value) => { storage.set(key, value); };
          `,
          loader: 'js',
        }));
      },
    }],
  });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
  apiKeys = loaded.exports;
});

test('migrates existing Gemini keys and clears the legacy stored copy', async () => {
  reset();
  storage.set('geminiApiKeySettings', {
    entries: [{ id: 'legacy-1', name: 'Old key', key: 'secret-key', createdAt: 123 }],
    activeId: 'legacy-1',
  });

  const settings = await apiKeys.listApiKeys();

  assert.deepEqual(settings.entries.map(({ id, providerId }) => ({ id, providerId })), [
    { id: 'legacy-1', providerId: 'gemini' },
  ]);
  assert.equal(settings.activeIds.gemini, 'legacy-1');
  assert.deepEqual(storage.get('geminiApiKeySettings'), { entries: [], activeId: null });
  assert.equal((await apiKeys.getActiveGeminiApiKey()), 'secret-key');
});

test('keeps keys and defaults isolated by provider', async () => {
  reset();
  const openAiOne = await apiKeys.addApiKey('OpenAI one', 'same-secret', 'openai');
  const openAiTwo = await apiKeys.addApiKey('OpenAI two', 'another-secret', 'openai');
  const claude = await apiKeys.addApiKey('Claude', 'same-secret', 'claude');
  await apiKeys.setActiveApiKey(openAiTwo.entries[1].id);

  assert.equal((await apiKeys.listApiKeys()).activeIds.openai, openAiTwo.entries[1].id);
  assert.equal((await apiKeys.listApiKeys()).activeIds.claude, claude.entries[2].id);
  await assert.rejects(apiKeys.getActiveGeminiApiKey(), /Chưa có API key Google \/ Gemini/);
});

test('supports user-defined providers and scopes duplicate keys by provider name', async () => {
  reset();
  await apiKeys.addApiKey('DeepSeek key', 'shared-secret', 'custom', 'DeepSeek');
  await apiKeys.addApiKey('Mistral key', 'shared-secret', 'custom', 'Mistral');
  await assert.rejects(
    apiKeys.addApiKey('Duplicate', 'shared-secret', 'custom', 'deepseek'),
    /đã có ở nhà cung cấp đã chọn/,
  );
  await assert.rejects(apiKeys.addApiKey('No provider', 'key', 'custom', ' '), /Nhập tên nhà cung cấp/);
});

test('deleting a selected key chooses another key from the same provider only', async () => {
  reset();
  const settings = await apiKeys.addApiKey('First', 'first-secret', 'openai');
  const firstId = settings.entries[0].id;
  const withSecond = await apiKeys.addApiKey('Second', 'second-secret', 'openai');
  const secondId = withSecond.entries[1].id;
  await apiKeys.addApiKey('Claude', 'claude-secret', 'claude');
  await apiKeys.setActiveApiKey(secondId);

  const afterDelete = await apiKeys.deleteApiKey(secondId);

  assert.equal(afterDelete.activeIds.openai, firstId);
  assert.equal(afterDelete.activeIds.claude, afterDelete.entries.find(entry => entry.providerId === 'claude').id);
});

test('masks API keys to their final five characters', () => {
  assert.equal(apiKeys.maskApiKey('abcdefghijklmnop'), '...lmnop');
  assert.equal(apiKeys.maskApiKey('12345'), '...12345');
});

test('normalizes invalid stored entries and defaults', () => {
  const settings = apiKeys.normalizeApiKeySettings({
    entries: [
      { id: 'valid', name: 'Valid', key: 'secret', providerId: 'openai', createdAt: 1 },
      { id: 'invalid-provider', name: 'Bad', key: 'secret', providerId: 'other', createdAt: 1 },
      { id: 'invalid-custom', name: 'Bad custom', key: 'secret', providerId: 'custom', createdAt: 1 },
    ],
    activeIds: { openai: 'valid', claude: 'valid' },
  });

  assert.deepEqual(settings.entries.map(entry => entry.id), ['valid']);
  assert.deepEqual(settings.activeIds, { openai: 'valid' });
});
