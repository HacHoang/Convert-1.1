const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.resolve('src');
const tsxFiles = [];
const visit = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.name.endsWith('.tsx')) tsxFiles.push(target);
  }
};
visit(sourceRoot);

test('conditional feedback never inserts a new inline row into the layout', () => {
  const violations = [];
  for (const file of tsxFiles) {
    const source = fs.readFileSync(file, 'utf8');
    if (source.includes('Đã tick {selectedRowIds.size}')) violations.push(`${file}: batch selection row`);

    for (const match of source.matchAll(/\{[^{}\n]+&&\s*<p\b[^>]*role=["'](?:status|alert)["'][^>]*>/g)) {
      violations.push(`${file}: conditional inline feedback ${match[0]}`);
    }
    for (const match of source.matchAll(/\{[^{}\n]+&&\s*<div\b[^>]*role=["'](?:status|alert)["'][^>]*>/g)) {
      if (!/\b(?:fixed|absolute)\b/.test(match[0])) violations.push(`${file}: non-overlay conditional feedback ${match[0]}`);
    }
  }
  assert.deepEqual(violations, [], violations.join('\n'));
});

test('notification stack stays below the mobile header without affecting layout', () => {
  const source = fs.readFileSync(path.join(sourceRoot, 'context', 'BackgroundTasks.tsx'), 'utf8');
  const stack = source.match(/<div data-app-notice-stack className="([^"]+)"/);
  assert.ok(stack, 'Global notification stack is missing');
  assert.match(stack[1], /\babsolute\b/, 'Notification stack must remain an overlay');
  assert.match(stack[1], /top-\[calc\(4\.5rem\+env\(safe-area-inset-top\)\)\]/, 'Mobile notification stack must clear the complete header and safe area');
  assert.match(stack[1], /@min-\[768px\]\/app:top-16/, 'Desktop notification position changed unexpectedly');
});
