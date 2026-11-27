// The surface vocabulary (#509, docs/DECLARATIVE-LEVELS.md): a step happens in the game or in Dash0, and the game's
// own screens must not pass for Dash0's. Pure data and one pure check; DOM-free.

/** The names of Dash0's own screens. A game screen never titles a heading or panel with one of these. */
export const DASH0_SCREEN_NAMES = Object.freeze([
  'Trace Explorer', 'Trace View', 'Span Sidebar', 'Log Explorer', 'Metric Explorer', 'Dashboards', 'Check Rules', 'Auth Tokens',
]);

/** The phrase that also claims a game screen is Dash0. */
export const SIMULATED_PHRASE = 'simulated Dash0';

/**
 * The Dash0 screen names, or the phrase, in `titles` (the heading, panel-title and role=heading texts of a game screen),
 * as `{name, title}`. Case-sensitive: the names are proper names and the phrase is the lower-case wording the content uses.
 * Prose that only mentions a screen is never passed in.
 */
export function vocabularyHits(titles) {
  const hits = [];
  for (const title of titles) {
    for (const name of DASH0_SCREEN_NAMES) if (title.includes(name)) hits.push({ name, title });
    if (title.includes(SIMULATED_PHRASE)) hits.push({ name: SIMULATED_PHRASE, title });
  }
  return hits;
}
