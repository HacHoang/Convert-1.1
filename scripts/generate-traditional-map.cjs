const fs = require('node:fs');

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/generate-traditional-map.cjs <cedict_ts.u8> <output.ts>');

const candidates = new Map();
const simplifiedInboundCounts = new Map();
for (const line of fs.readFileSync(input, 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const match = /^(\S+)\s+(\S+)\s+\[/.exec(line);
  if (!match) continue;
  const traditional = [...match[1]];
  const simplified = [...match[2]];
  if (traditional.length !== simplified.length) continue;
  for (let index = 0; index < traditional.length; index++) {
    if (traditional[index] === simplified[index]) continue;
    simplifiedInboundCounts.set(simplified[index], (simplifiedInboundCounts.get(simplified[index]) || 0) + 1);
    const choices = candidates.get(traditional[index]) || new Map();
    choices.set(simplified[index], (choices.get(simplified[index]) || 0) + 1);
    candidates.set(traditional[index], choices);
  }
}

// CC-CEDICT contains a few variant headwords in the reverse direction. Keep a
// mapping only when its evidence is stronger than evidence that the key itself
// is a simplified target (e.g. keep 兒→儿, discard 儿→兒 and 么→幺).
const mapping = Object.fromEntries([...candidates]
  .map(([traditional, choices]) => [traditional, [...choices].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hans'))[0]])
  .filter(([traditional, [, count]]) => count > (simplifiedInboundCounts.get(traditional) || 0))
  .sort(([left], [right]) => left.localeCompare(right, 'zh-Hant'))
  .map(([traditional, [simplified]]) => [traditional, simplified]));
fs.writeFileSync(output, `// Generated from CC-CEDICT. Do not edit by hand.\nexport const TRADITIONAL_TO_SIMPLIFIED: Record<string, string> = ${JSON.stringify(mapping)};\n`);
console.log(`Generated ${Object.keys(mapping).length} traditional-to-simplified character mappings.`);
