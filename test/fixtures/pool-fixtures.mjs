// Answer pool fixtures (#390, lib/pool.mjs): a pooled choice and a pooled sort as bare specs, and a play level
// that holds pooled steps. Nothing here is live content. Specs are deep-frozen, so a function that edits its input throws.
// The level is built fresh per call (a test may edit it) and is not registered in levels/index.mjs.

export const IDENT = (list) => [...list];
export const REV = (list) => [...list].reverse();

/** `v` and everything under it frozen; returns `v`. */
export function deepFreeze(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
}

/** The same-length colour words the labels use, so no pool has a length tell. */
const WORDS = ['amber', 'azure', 'beige', 'black', 'coral', 'cream', 'ivory', 'khaki', 'lemon', 'mauve', 'olive', 'peach'];

/** A choice entry: `Answer <word>` (all 12 characters), a why of its own. */
export const pick = (key, word, right = false, extra = {}) => ({
  key,
  label: `Answer ${word}`,
  why: `Because ${key} is ${right ? 'the one that holds' : 'not the one'}.`,
  ...(right ? { right: true } : {}),
  ...extra,
});

/** Three rights and six wrongs in a mixed order; shows three. */
export const cp = () => ({
  id: 'cp',
  draw: 3,
  choices: [
    pick('w1', WORDS[0]),
    pick('r1', WORDS[1], true),
    pick('w2', WORDS[2]),
    pick('w3', WORDS[3]),
    pick('r2', WORDS[4], true),
    pick('w4', WORDS[5]),
    pick('w5', WORDS[6]),
    pick('r3', WORDS[7], true),
    pick('w6', WORDS[8]),
  ],
});
export const CP = deepFreeze(cp());

/** A pool for the 50/50: shows four, three rights, eight wrongs, one near-miss that the 50/50 keeps. */
export const fiftyPool = () => ({
  id: 'cf',
  draw: 4,
  choices: [
    pick('r1', WORDS[0], true),
    pick('w1', WORDS[1]),
    pick('w2', WORDS[2], false, { keep: true }),
    pick('w3', WORDS[3]),
    pick('r2', WORDS[4], true),
    pick('w4', WORDS[5]),
    pick('w5', WORDS[6]),
    pick('w6', WORDS[7]),
    pick('r3', WORDS[8], true),
    pick('w7', WORDS[9]),
    pick('w8', WORDS[10]),
  ],
});

const item = (id, bucket) => ({ id, label: `Item ${id}`, bucket, why: `${id} belongs in ${bucket}.` });

/** Two buckets, nine items (five in a, four in b); shows two from a and three from b. */
export const sp = () => ({
  id: 'sp',
  draw: { a: 2, b: 3 },
  buckets: [{ id: 'a', label: 'Bucket A' }, { id: 'b', label: 'Bucket B' }],
  items: [item('a1', 'a'), item('b1', 'b'), item('a2', 'a'), item('b2', 'b'), item('a3', 'a'), item('b3', 'b'), item('a4', 'a'), item('b4', 'b'), item('a5', 'a')],
});
export const SP = deepFreeze(sp());

/** A pooled play level: a 3-shown choice, a pooled sort and a 4-shown choice with a 50/50. */
export function poolFixture({ choice = cp(), sort = sp(), fifty = fiftyPool() } = {}) {
  return {
    id: 'pool-fixture',
    no: '0.2',
    name: 'Pool fixture',
    icon: '*',
    rewardTitle: 'Pool fixture finisher',
    cards: ['fixture-card'],
    play: {
      prefix: 'pf',
      steps: [
        { intro: 'Pick the answer that holds.', question: 'Which one?', choice },
        { intro: 'Sort the items.', question: 'Pick an item, then a bucket.', sort },
        { intro: 'Pick the answer that holds, with a 50/50.', question: 'Which one now?', choice: fifty },
      ],
      finish: 'You played every pooled step.',
    },
  };
}
