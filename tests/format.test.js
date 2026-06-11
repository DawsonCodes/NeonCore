import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clampNumber, escapeHTML, fmt, fmtTime } from '../src/utils/format.js';

test('fmt keeps small numbers plain', () => {
  assert.equal(fmt(0), '0');
  assert.equal(fmt(7.9), '7');
  assert.equal(fmt(999), '999');
});

test('fmt abbreviates large numbers with the right precision', () => {
  assert.equal(fmt(1000), '1.00K');
  assert.equal(fmt(1500), '1.50K');
  assert.equal(fmt(15000), '15.0K');
  assert.equal(fmt(150000), '150K');
  assert.equal(fmt(1e6), '1.00M');
  assert.equal(fmt(1e9), '1.00B');
  assert.equal(fmt(1e12), '1.00T');
  assert.equal(fmt(1e15), '1.00Qa');
});

test('fmt handles invalid and negative input safely', () => {
  assert.equal(fmt(NaN), '0');
  assert.equal(fmt(Infinity), '0');
  assert.equal(fmt(-500), '0');
});

test('fmtTime formats seconds, minutes, and hours', () => {
  assert.equal(fmtTime(45), '45s');
  assert.equal(fmtTime(90), '1m 30s');
  assert.equal(fmtTime(3600), '1h 0m');
  assert.equal(fmtTime(7322), '2h 2m');
});

test('clampNumber sanitizes unsafe values', () => {
  assert.equal(clampNumber(50, 0), 50);
  assert.equal(clampNumber(-3, 0), 0);
  assert.equal(clampNumber('abc', 0), 0);
  assert.equal(clampNumber(Infinity, 0), 0);
  assert.equal(clampNumber(150, 0, 100), 100);
});

test('escapeHTML neutralizes markup', () => {
  assert.equal(escapeHTML('<b>"hi" & \'bye\'</b>'), '&lt;b&gt;&quot;hi&quot; &amp; &#039;bye&#039;&lt;/b&gt;');
});
