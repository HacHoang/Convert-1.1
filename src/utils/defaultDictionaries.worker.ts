import { loadDefaultDictionaries, defaultDictionaryValues } from './defaultDictionaries';
import { replaceStores } from './indexedDbStorage';

self.onmessage = async () => {
  try {
    const bundle = await loadDefaultDictionaries((detail, percent) => self.postMessage({ type: 'progress', detail, percent }));
    await replaceStores(bundle.stores, defaultDictionaryValues(bundle));
    self.postMessage({ type: 'done', version: bundle.version });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
