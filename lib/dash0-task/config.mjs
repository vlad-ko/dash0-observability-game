// The In Dash0 task server's configuration (#509 P5; docs/FOUNDATION.md §2.15): seven environment variables
// -> off, on or invalid. Pure: reads only the `env` it is given. A result never carries an input value, except
// the usable ones in 'on' (the two tokens and the secret go only into an outgoing header or an HMAC).
// The validators are lib/dash0/ingress.mjs (parseEndpoint, checkToken, checkDataset), so the ingress host
// allowlist and the reason names have one authority. All seven absent or empty is off; any one set means all
// must validate, else 'invalid' (a typo shows in the log instead of silently turning the tasks off).
//
// Facts used (Dash0 sources, 2026-11-27, issue #509 P1 research). The API host is
// https://api.<region>.aws.dash0.com, or api.europe-west4.gcp.dash0.com, one per ingress region; derived here from
// INGRESS_HOSTS so the two lists cannot disagree. The app origin is https://app.dash0.com (deep links:
// https://www.dash0.com/documentation/dash0/key-concepts/deeplink-urls). Each API host is the ingress host with
// `ingress.` replaced by `api.`: https://api.<region>.<cloud>.dash0.com/openapi.yaml answers 200 for all four
// regions (checked 2026-11-27). DASH0_GAME_DATASET is the dataset identifier, the value of the `Dash0-Dataset` header.
import { checkDataset, checkToken, INGRESS_HOSTS, parseEndpoint } from '../dash0/ingress.mjs';
import { MIN_SECRET_BYTES } from '../auth/session.mjs';

export const ENV_KEYS = Object.freeze({
  ingestUrl: 'DASH0_GAME_INGEST_URL',
  ingestToken: 'DASH0_GAME_INGEST_TOKEN',
  dataset: 'DASH0_GAME_DATASET',
  apiUrl: 'DASH0_GAME_API_URL',
  apiToken: 'DASH0_GAME_API_TOKEN',
  appUrl: 'DASH0_GAME_APP_URL',
  playerSecret: 'DASH0_GAME_PLAYER_SECRET',
});

export const API_HOSTS = Object.freeze(INGRESS_HOSTS.map((host) => host.replace(/^ingress\./, 'api.')));
export const APP_ORIGIN = 'https://app.dash0.com';

const isSet = (v) => v !== undefined && v !== null && v !== '';

/** `https://host` with nothing else (a trailing slash is tolerated), or `{reason}`. `allowed` is the host test. */
function bareOrigin(raw, allowed) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return { reason: 'empty' };
  let url;
  try {
    url = new URL(text);
  } catch {
    return { reason: 'malformed' };
  }
  if (url.protocol !== 'https:') return { reason: 'not-https' };
  if (url.username !== '' || url.password !== '') return { reason: 'credentials' };
  if (url.search !== '' || url.hash !== '') return { reason: 'query' };
  if (!allowed(url.hostname)) return { reason: 'unknown-host' };
  if (url.port !== '' && url.port !== '443') return { reason: 'unexpected-port' };
  if (url.pathname !== '' && url.pathname !== '/') return { reason: 'unexpected-path' };
  return { origin: `https://${url.hostname}` };
}

/**
 * env -> {state:'off'} | {state:'invalid', field, reason} (field is the variable's name, never a value) |
 * {state:'on', ingestBase, ingestToken, dataset, apiBase, apiToken, appOrigin, playerSecret}.
 * `http://localhost` is accepted for the ingest URL only when `VERCEL` is not `1` (the local dev server).
 */
export function dash0TaskConfig(env) {
  const raw = Object.fromEntries(Object.entries(ENV_KEYS).map(([name, key]) => [name, env?.[key]]));
  if (!Object.values(raw).some(isSet)) return { state: 'off' };
  const invalid = (name, reason) => ({ state: 'invalid', field: ENV_KEYS[name], reason });

  const ingest = parseEndpoint(raw.ingestUrl, { allowLocal: env?.VERCEL !== '1' });
  if (!ingest.ok) return invalid('ingestUrl', ingest.reason);
  const ingestToken = checkToken(raw.ingestToken);
  if (!ingestToken.ok) return invalid('ingestToken', ingestToken.reason);
  // The dataset is required: every deep link names it, so the default dataset is not an option here.
  if (!isSet(raw.dataset)) return invalid('dataset', 'empty');
  const dataset = checkDataset(raw.dataset);
  if (!dataset.ok) return invalid('dataset', dataset.reason);
  const api = bareOrigin(raw.apiUrl, (host) => API_HOSTS.includes(host));
  if (api.reason) return invalid('apiUrl', api.reason);
  const apiToken = checkToken(raw.apiToken);
  if (!apiToken.ok) return invalid('apiToken', apiToken.reason);
  const app = bareOrigin(raw.appUrl, (host) => `https://${host}` === APP_ORIGIN);
  if (app.reason) return invalid('appUrl', app.reason);
  if (typeof raw.playerSecret !== 'string' || raw.playerSecret === '') return invalid('playerSecret', 'empty');
  if (Buffer.byteLength(raw.playerSecret) < MIN_SECRET_BYTES) return invalid('playerSecret', 'short');

  return {
    state: 'on',
    ingestBase: ingest.base,
    ingestToken: raw.ingestToken,
    dataset: dataset.dataset,
    apiBase: api.origin,
    apiToken: raw.apiToken,
    appOrigin: app.origin,
    playerSecret: raw.playerSecret,
  };
}
