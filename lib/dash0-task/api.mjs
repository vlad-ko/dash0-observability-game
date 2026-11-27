// The Dash0 API the task server reads back through (#509 P5): the interface, and the stub that stands in for the real
// adapter until P8. SERVER ONLY. The interface:
//   countAttempt(attemptId, {signal, from, to}) -> Promise<{count}>   records Dash0 shows stamped game.attempt.id = attemptId
//                                                                     between `from` and `to` (epoch ms); rejects on any failure
//   findAssets({signal, originPrefix})          -> Promise<{assets}>  assets whose origin starts with the prefix; rejects on failure
// A caller treats a rejection, a non-integer or negative `count`, or a timeout as "could not answer", never as zero.
// The API token and base stay inside the adapter; nothing else sees them.

export class NotImplementedError extends Error {
  constructor(what) {
    super(`not implemented: ${what}`);
    this.name = 'NotImplementedError';
  }
}

/** The real-mode adapter: every method throws until P8 writes it against the Dash0 API (#509). */
export function createDash0Api() {
  return {
    async countAttempt() {
      throw new NotImplementedError('P8');
    },
    async findAssets() {
      throw new NotImplementedError('P8');
    },
  };
}
