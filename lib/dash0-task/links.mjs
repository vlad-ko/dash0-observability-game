// The deep link into the Dash0 app (#509 P5), pure. Format (Dash0 deeplink-urls documentation,
// https://www.dash0.com/documentation/dash0/key-concepts/deeplink-urls):
//   <app>/goto/traces/explorer?from=<ISO>&to=<ISO>&dataset=<dataset identifier>&filter=[{"key":"game.attempt.id","operator":"is","value":"<id>"}]
// with `/goto/logs` and `/goto/metrics/explorer` for the other signals. The filter is JSON, URL-encoded; times are
// absolute ISO 8601. The same documentation states absolute ISO 8601 `from` and `to` and the global `dataset` parameter,
// whose value is the dataset identifier (the `Dash0-Dataset` header value).
import { ATTR, ATTEMPT_ID } from './stamp.mjs';

export const LINK_PATHS = Object.freeze({
  traces: '/goto/traces/explorer',
  logs: '/goto/logs',
  metrics: '/goto/metrics/explorer',
});

const time = (ms) => {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new RangeError('bad link time');
  return new Date(ms).toISOString();
};

/** The link that lists the records of one attempt, within [fromMs, toMs]. Throws on a bad input. */
export function deepLink({ appOrigin, target, dataset, attemptId, fromMs, toMs }) {
  if (typeof appOrigin !== 'string' || !/^https:\/\/[^/\s?#]+$/.test(appOrigin)) throw new TypeError('bad app origin');
  if (!Object.hasOwn(LINK_PATHS, target)) throw new RangeError(`unknown link target: ${String(target)}`);
  if (typeof dataset !== 'string' || dataset === '') throw new TypeError('a dataset is required');
  if (typeof attemptId !== 'string' || !ATTEMPT_ID.test(attemptId)) throw new TypeError('bad attempt id');
  const filter = JSON.stringify([{ key: ATTR.attempt, operator: 'is', value: attemptId }]);
  const query = [
    `from=${encodeURIComponent(time(fromMs))}`,
    `to=${encodeURIComponent(time(toMs))}`,
    `dataset=${encodeURIComponent(dataset)}`,
    `filter=${encodeURIComponent(filter)}`,
  ].join('&');
  return `${appOrigin}${LINK_PATHS[target]}?${query}`;
}
