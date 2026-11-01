self.onmessage = ({ data }: MessageEvent<{ keys: string[]; rule: string }>) => {
  const { keys, rule } = data;
  const collator = new Intl.Collator(rule.startsWith('meaning') ? 'vi' : 'zh-Hans', { numeric: true, sensitivity: 'base' });
  const indexes = Uint32Array.from({ length: keys.length }, (_, index) => index);
  const lengths = rule.startsWith('length') ? keys.map(key => Array.from(key).length) : null;
  indexes.sort((a, b) => {
    const compared = lengths ? lengths[a] - lengths[b] || collator.compare(keys[a], keys[b]) : collator.compare(keys[a], keys[b]);
    return (rule.endsWith('desc') ? -compared : compared) || a - b;
  });
  self.postMessage(indexes, { transfer: [indexes.buffer] });
};
