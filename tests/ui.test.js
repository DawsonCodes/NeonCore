import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import {
  categorySummary,
  categoryUnlockedIds,
  resetCategory,
  selectCategory,
  selectedCategory
} from '../src/ui/shop-state.js';
import { createInitialState } from '../src/core/state.js';
import { upgradeCategories } from '../src/config/upgrades.js';

// ---------------------------------------------------------------------------
// Shop category selection
// ---------------------------------------------------------------------------

test('shop defaults to the first category', () => {
  resetCategory();
  assert.equal(selectedCategory(), upgradeCategories[0].id);
});

test('selecting a known category switches; unknown ids are ignored', () => {
  resetCategory();
  assert.equal(selectCategory('passive'), 'passive');
  assert.equal(selectedCategory(), 'passive');
  assert.equal(selectCategory('not-a-category'), 'passive');
  assert.equal(selectedCategory(), 'passive');
  resetCategory();
});

test('category summary counts unlocked, affordable, fresh, and levels', () => {
  const state = createInitialState();
  state.score = 60; // can afford power (10) and auto (50)

  const core = categorySummary(state, 'core');
  assert.equal(core.locked, false);
  assert.equal(core.unlocked, 2, 'power + crit visible at start');
  assert.equal(core.affordable, 1, 'only power affordable at 60');
  assert.equal(core.fresh, 2, 'nothing seen yet');

  state.seenUpgrades.push('power');
  assert.equal(categorySummary(state, 'core').fresh, 1);

  state.upgrades.power.level = 3;
  assert.equal(categorySummary(state, 'core').levels, 3);
});

test('locked categories report locked with zero unlocked upgrades', () => {
  const state = createInitialState();
  assert.equal(categorySummary(state, 'surge').locked, true);
  assert.equal(categorySummary(state, 'singularity').locked, true);
  state.surgesUsed = 1;
  assert.equal(categorySummary(state, 'surge').locked, false);
});

test('categoryUnlockedIds lists exactly the visible upgrades', () => {
  const state = createInitialState();
  assert.deepEqual(categoryUnlockedIds(state, 'core'), ['power', 'crit']);
  assert.deepEqual(categoryUnlockedIds(state, 'singularity'), []);
  state.prestige = 1;
  assert.deepEqual(categoryUnlockedIds(state, 'singularity'), ['tachyon']);
});

// ---------------------------------------------------------------------------
// Static interface guarantees (favicon, volume slider, collapse controls)
// ---------------------------------------------------------------------------

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('favicon asset exists and is a lightweight local SVG', () => {
  const url = new URL('../favicon.svg', import.meta.url);
  assert.ok(existsSync(url), 'favicon.svg exists at the repository root');
  const svg = readFileSync(url, 'utf8');
  assert.ok(svg.includes('<svg'), 'file is an SVG');
  assert.ok(!/(href|src|url)\s*[=(]\s*["']?https?:/.test(svg), 'no external asset loads');
  assert.ok(svg.length < 4096, 'kept lightweight');
});

test('index.html references the favicon with a Pages-safe relative path', () => {
  assert.ok(html.includes('<link rel="icon" href="./favicon.svg" type="image/svg+xml">'));
  assert.ok(html.includes('<meta name="theme-color" content="#050812">'));
});

test('exactly one volume range input exists (grey-thumb regression)', () => {
  const ranges = html.match(/type="range"/g) || [];
  assert.equal(ranges.length, 1, 'a single range input');
  assert.ok(html.includes('id="volumeSlider"'));
  // The slider must not live inside a switch-row, whose checkbox styling
  // once painted a second thumb on top of it.
  assert.ok(!/switch-row[^>]*>[^<]*<[^>]*volumeSlider/.test(html));
  assert.ok(html.includes('class="volume-row"'));
});

test('collapsible sections declare accessible expanded state', () => {
  for (const id of ['achievementToggle', 'statsToggle']) {
    const pattern = new RegExp(`id="${id}"[^>]*aria-expanded=`);
    assert.ok(pattern.test(html), `${id} has aria-expanded`);
  }
  assert.ok(html.includes('aria-controls="achievementBody"'));
  assert.ok(html.includes('aria-controls="statsBody"'));
});

test('shop tablist container is declared accessibly', () => {
  assert.ok(html.includes('id="shopTabs"'));
  assert.ok(/id="shopTabs"[^>]*role="tablist"/.test(html));
});
