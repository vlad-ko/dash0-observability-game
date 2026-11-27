// Epic #509: concept steps (the game's own widgets) do not imitate a Dash0 screen or present a game screen as one.
import test from 'node:test';
import assert from 'node:assert/strict';
import spanKinds from '../content/core/levels/span-kinds.mjs';
import theBill from '../content/core/levels/the-bill.mjs';

const SCREEN_NAME = /(simulated|practice|mock)\s+dash0|dash0\s+(view|screen|ui)|metric explorer,?\s+tree map|tree map sized by/i;

test('span kinds: the service view panel is a concept panel, not named as a Dash0 screen', () => {
  const { viewChip, viewNote } = spanKinds.run;
  assert.equal(viewChip, 'Service view');
  assert.doesNotMatch(`${viewChip} ${viewNote}`, /dash0/i);
  assert.doesNotMatch(JSON.stringify(spanKinds.run), SCREEN_NAME);
});

test('the bill: the clues are plain series tables, not the Metric Explorer tree map', () => {
  const views = theBill.play.steps[0].incident.views;
  assert.ok(views.length > 0);
  for (const v of views) assert.doesNotMatch(v.html, SCREEN_NAME, v.id);
  const volume = views.find((v) => v.id === 'volume-by-metric').html;
  assert.match(volume, /Active series for each metric/);
  assert.match(volume, /\{\{series-before\}\}/, 'the figures the answers rest on stay');
  assert.match(volume, /\{\{series-after\}\}/);
});
