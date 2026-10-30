const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/theme.ts')], platform: 'node', format: 'cjs', bundle: true, packages: 'external', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { resolveTheme } = loaded.exports;
const css = fs.readFileSync(path.join(__dirname, '../src/index.css'), 'utf8');

function luminance(hex) {
  const rgb = hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + 0.05) / (values[1] + 0.05); }

test('system mode follows the OS preference while explicit choices stay unchanged', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  for (const theme of ['light', 'dark', 'sepia']) {
    assert.equal(resolveTheme(theme, true), theme);
    assert.equal(resolveTheme(theme, false), theme);
  }
});

for (const theme of ['light', 'dark', 'sepia']) test(`${theme} has readable body, secondary text and primary buttons`, () => {
  const block = css.match(new RegExp('\\[data-theme="' + theme + '"\\]\\s*\\{([^}]+)'))[1];
  const colors = Object.fromEntries([...block.matchAll(/--ui-([\w-]+):\s*(#[a-f0-9]{6})/gi)].map(match => [match[1], match[2]]));
  for (const surface of ['canvas', 'surface', 'raised']) {
    assert.ok(contrast(colors.text, colors[surface]) >= 4.5, `${theme}: main text on ${surface}`);
    assert.ok(contrast(colors.muted, colors[surface]) >= 4.5, `${theme}: secondary text on ${surface}`);
  }
  assert.ok(contrast(colors.accent, colors['on-accent']) >= 4.5, `${theme}: primary button`);
});
