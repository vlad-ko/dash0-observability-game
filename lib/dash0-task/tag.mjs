// The player tag (#509 P5): the only identifier of a player that ever leaves the server. A pseudonym, not an
// anonymous value: whoever holds DASH0_GAME_PLAYER_SECRET can recompute it from a pid, nobody else can link it back.
// base32lower(HMAC-SHA256(secret, 'player:' + pid)), the first TAG_LENGTH characters (50 bits).
import { createHmac } from 'node:crypto';
import { MIN_SECRET_BYTES } from '../auth/session.mjs';

export const TAG_LENGTH = 10;
export const TAG_PATTERN = /^[a-z2-7]{10}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'; // RFC 4648 base32, lower case, no padding

function base32lower(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return bits > 0 ? out + ALPHABET[(value << (5 - bits)) & 31] : out;
}

/** The tag of `pid` under `secret` (32 bytes or more). Throws without echoing either. */
export function playerTag(pid, secret) {
  if (typeof pid !== 'string' || pid === '') throw new TypeError('playerTag needs a pid');
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < MIN_SECRET_BYTES) throw new TypeError('playerTag needs a secret of at least 32 bytes');
  return base32lower(createHmac('sha256', secret).update(`player:${pid}`).digest()).slice(0, TAG_LENGTH);
}
