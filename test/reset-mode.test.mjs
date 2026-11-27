// ?mode=reset: the owner's fresh-start switch. main.mjs calls takeReset(window) before progress loads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKIPPED_KEY } from '../lib/dash0-task/prefs.mjs';
import { isResetMode, RESET_KEYS, takeReset } from '../lib/reset-mode.mjs';
import { CORRUPT_KEY, CORRUPT_LATEST_KEY, STORAGE_KEY } from '../lib/storage.mjs';
import { HELP_KEY } from '../lib/help-prefs.mjs';
import { PRIMER_KEY } from '../lib/primer-prefs.mjs';

function fakeWin(href, { initial = {}, removeThrows = false, replaceThrows = false } = {}) {
  const data = new Map(Object.entries(initial));
  const replaced = [];
  return {
    data,
    replaced,
    location: { href },
    history: {
      state: null,
      replaceState: (...a) => {
        if (replaceThrows) throw new Error('sandboxed');
        replaced.push(a);
      },
    },
    localStorage: {
      removeItem(k) {
        if (removeThrows) throw new Error('blocked');
        data.delete(k);
      },
    },
  };
}

test('isResetMode is true only for mode=reset exactly', () => {
  assert.equal(isResetMode('?mode=reset'), true);
  assert.equal(isResetMode('?a=1&mode=reset'), true);
  for (const s of ['', '?', '?mode=', '?mode=Reset', '?mode=reset2', '?mode=resetter', '?mode=debug', '?reset', '?reset=1', '?xmode=reset', '?mode=%20reset']) {
    assert.equal(isResetMode(s), false, s);
  }
  assert.equal(isResetMode(undefined), false);
  assert.equal(isResetMode(null), false);
});

test('the key list is exactly the game\'s own storage keys', () => {
  assert.deepEqual([...RESET_KEYS].sort(), [CORRUPT_KEY, CORRUPT_LATEST_KEY, HELP_KEY, PRIMER_KEY, SKIPPED_KEY, STORAGE_KEY].sort());
});

test('reset removes every game key and leaves an unrelated key alone', () => {
  const initial = Object.fromEntries([...RESET_KEYS, 'other.app'].map((k) => [k, 'x']));
  const win = fakeWin('https://x.test/?mode=reset', { initial });
  assert.equal(takeReset(win), true);
  assert.deepEqual([...win.data.keys()], ['other.app']);
});

test('without mode=reset nothing is removed and the URL is untouched', () => {
  const initial = { [STORAGE_KEY]: 'x', [HELP_KEY]: 'y' };
  for (const href of ['https://x.test/', 'https://x.test/?mode=debug', 'https://x.test/?mode=resets']) {
    const win = fakeWin(href, { initial });
    assert.equal(takeReset(win), false, href);
    assert.equal(win.data.size, 2, href);
    assert.equal(win.replaced.length, 0, href);
  }
});

test('the URL keeps other params and the hash and drops mode=reset', () => {
  const win = fakeWin('https://x.test/play?a=1&mode=reset&b=2#top');
  takeReset(win);
  assert.equal(win.replaced.length, 1);
  assert.equal(win.replaced[0][2], '/play?a=1&b=2#top');
  const bare = fakeWin('https://x.test/?mode=reset');
  takeReset(bare);
  assert.equal(bare.replaced[0][2], '/');
});

test('a storage that throws does not throw out of startup, and the URL is still stripped', () => {
  const win = fakeWin('https://x.test/?mode=reset', { removeThrows: true });
  assert.doesNotThrow(() => takeReset(win));
  assert.equal(win.replaced[0][2], '/');
  assert.doesNotThrow(() => takeReset({ location: { href: 'https://x.test/?mode=reset' }, history: { replaceState() {} } }), 'no localStorage at all');
});

test('a failing key does not leave the later keys behind', () => {
  const win = fakeWin('https://x.test/?mode=reset', { initial: Object.fromEntries(RESET_KEYS.map((k) => [k, 'x'])) });
  const real = win.localStorage.removeItem;
  win.localStorage.removeItem = (k) => {
    if (k === RESET_KEYS[0]) throw new Error('blocked');
    real(k);
  };
  takeReset(win);
  assert.deepEqual([...win.data.keys()], [RESET_KEYS[0]]);
});

test('a throwing replaceState does not throw and the keys are still cleared', () => {
  const win = fakeWin('https://x.test/?mode=reset', { initial: { [STORAGE_KEY]: 'x' }, replaceThrows: true });
  assert.doesNotThrow(() => takeReset(win));
  assert.equal(win.data.size, 0);
});

test('a second call on the stripped URL does nothing', () => {
  const win = fakeWin('https://x.test/?mode=reset');
  takeReset(win);
  win.location.href = 'https://x.test' + win.replaced[0][2];
  win.data.set(STORAGE_KEY, 'new progress');
  assert.equal(takeReset(win), false);
  assert.equal(win.data.get(STORAGE_KEY), 'new progress');
});
