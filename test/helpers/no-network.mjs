// Import this FIRST in a test that must never reach the network (#509): from here on a call to the global fetch throws.
// The In Dash0 task server's tests pass every fetch in as a dependency; this proves none of them forgets to.
globalThis.fetch = () => {
  throw new Error('the test reached for the real fetch');
};
