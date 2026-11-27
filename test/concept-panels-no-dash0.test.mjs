// Epic #509: concept steps (the game's own widgets) do not imitate a Dash0 screen or present a game screen as one.
import test from 'node:test';
import assert from 'node:assert/strict';
import spanKinds from '../content/core/levels/span-kinds.mjs';

const SCREEN_NAME = /(simulated|practice|mock)\s+dash0|dash0\s+(view|screen|ui)|metric explorer,?\s+tree map|tree map sized by/i;

test('span kinds: the calls panel is a concept panel, not named as a Dash0 screen', () => {
  const { viewChip, viewNote } = spanKinds.run;
  assert.equal(viewChip, 'Calls between services');
  assert.doesNotMatch(`${viewChip} ${viewNote}`, /dash0/i);
  assert.doesNotMatch(JSON.stringify(spanKinds.run), SCREEN_NAME);
});
