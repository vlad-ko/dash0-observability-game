// test/helpers/snapshot.mjs: the opt-in LEVEL_SNAPSHOT=<dir> recorder used by levels-play (#391).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshotDir, recordFrames, writeFrames } from './helpers/snapshot.mjs';

const FRAMES = [
  { at: 'step', body: '<p>one</p>', actions: '<button>next</button>' },
  { at: 'end', body: '<p>done</p>', actions: '<button data-finish>Finish</button>' },
];

function tmp() {
  return mkdtempSync(join(tmpdir(), 'snap-'));
}

test('writeFrames writes exactly one file holding the frames and the finish text', () => {
  const dir = tmp();
  try {
    writeFrames(dir, 'fx', 'happy', FRAMES, 'Well done.');
    assert.deepEqual(readdirSync(dir), ['fx.happy.json']);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'fx.happy.json'), 'utf8')), { frames: FRAMES, finish: 'Well done.' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeFrames output is byte-stable for equal input', () => {
  const a = tmp();
  const b = tmp();
  try {
    writeFrames(a, 'fx', 'sloppy', FRAMES, 'x');
    writeFrames(b, 'fx', 'sloppy', FRAMES, 'x');
    assert.equal(readFileSync(join(a, 'fx.sloppy.json'), 'utf8'), readFileSync(join(b, 'fx.sloppy.json'), 'utf8'));
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test('the hook is off when LEVEL_SNAPSHOT is unset or empty: nothing is written', () => {
  assert.equal(snapshotDir({}), null);
  assert.equal(snapshotDir({ LEVEL_SNAPSHOT: '' }), null);
  assert.equal(recordFrames({}, 'fx', 'happy', FRAMES, 'x'), false);
});

test('the hook is on when LEVEL_SNAPSHOT names a directory: recordFrames writes there', () => {
  const dir = tmp();
  try {
    assert.equal(snapshotDir({ LEVEL_SNAPSHOT: dir }), dir);
    assert.equal(recordFrames({ LEVEL_SNAPSHOT: dir }, 'fx', 'happy', FRAMES, 'x'), true);
    assert.deepEqual(readdirSync(dir), ['fx.happy.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
