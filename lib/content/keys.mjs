// The vocabulary of a content file (#391, docs/CONTENT.md): which keys may appear in content and how each is
// checked. Content carries text and the ids that join it to the level's logic; nothing else. Pure data.

/** Keys that identify an element, so content and logic can be joined on them. */
export const IDENTITY_KEYS = Object.freeze(['id', 'key']);

/** Keys whose value is an object or array holding more content. */
export const CONTAINER_KEYS = Object.freeze([
  'play', 'steps', 'choice', 'sort', 'spot', 'tradeoff', 'incident', 'build', 'query', 'configure',
  'choices', 'buckets', 'items', 'lines', 'knobs', 'options', 'needs', 'views', 'hypotheses', 'alert',
]);

/** Keys of a step that name its widget; a step's identity is its widget key plus the widget's id. */
export const STEP_TYPE_KEYS = Object.freeze(['choice', 'sort', 'spot', 'tradeoff', 'incident', 'build', 'query', 'configure']);

/** Text keys shown as written: no HTML, only the text rules. `code` may also hold newlines. */
export const PLAIN_KEYS = Object.freeze(['code', 'finish', 'name', 'sub', 'rewardTitle', 'unit', 'unitOne', 'text']);
/** Text keys that are trusted HTML (checked by checkHtml). `whyNot` holds a map of them. */
export const HTML_KEYS = Object.freeze(['intro', 'question', 'show', 'label', 'why', 'explain', 'hint', 'html', 'title', 'closing']);
/** The one text key whose value is a map from any key to trusted HTML. */
export const MAP_KEY = 'whyNot';

/** Every text key, the ones a logic file may not hold (outside a fixture). */
export const TEXT_KEYS = Object.freeze([...PLAIN_KEYS, ...HTML_KEYS, MAP_KEY]);

/** Keys of a level's logic that hold data a grader computes over; text-named keys inside them are not content. */
export const FIXTURE_KEYS = Object.freeze([
  'spans', 'logs', 'answer', 'faults', 'given', 'reference', 'dataset', 'withhold', 'uses', 'target', 'extensions', 'forbids', 'helps', 'budget',
]);

/** Every key a content file may use. */
export const CONTENT_KEYS = Object.freeze([...IDENTITY_KEYS, ...CONTAINER_KEYS, ...TEXT_KEYS]);
