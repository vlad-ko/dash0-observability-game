// ?mode=reset: the owner's way to demo from scratch. Pure: main.mjs calls takeReset(window) once at
// startup, before any progress is read. Only the exact value "reset" counts. It removes the game's own
// localStorage keys (an explicit list, never clear()), then strips the parameter from the URL so a reload
// or a shared link does not reset again. Nothing here may stop the game booting.
import { CORRUPT_KEY, CORRUPT_LATEST_KEY, STORAGE_KEY } from './storage.mjs';
import { HELP_KEY } from './help-prefs.mjs';

export const RESET_KEYS = Object.freeze([STORAGE_KEY, CORRUPT_KEY, CORRUPT_LATEST_KEY, HELP_KEY]);

export function isResetMode(search) {
  if (typeof search !== 'string') return false;
  return new URLSearchParams(search).get('mode') === 'reset';
}

export function takeReset(win) {
  let url;
  try {
    url = new URL(win.location.href);
  } catch {
    return false;
  }
  if (!isResetMode(url.search)) return false;
  // One key failing must not leave the others behind.
  for (const key of RESET_KEYS) {
    try {
      win.localStorage.removeItem(key);
    } catch {
      // storage blocked or full; the game still loads
    }
  }
  url.searchParams.delete('mode');
  try {
    win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    // the URL keeps its query; a reload would reset again, nothing worse
  }
  return true;
}
