/**
 * Sync key-value storage via localStorage.
 * Native Capacitor Preferences can be wired later behind a build-time flag;
 * dynamic imports of @capacitor/preferences break Vite web/dev resolution.
 */
import { SAVE_KEY, LEGACY_SAVE_KEYS } from '../config/gameConfig.js';

const SETTINGS_SUFFIX = '-settings';

export function storageGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

export function storageSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_error) {
    // Ignore quota / private mode failures.
  }
}

export function storageRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (_error) {
    // Ignore.
  }
}

/** Clears only this game's keys (save + settings + legacy), not the whole origin. */
export function purgeGameStorageKeys() {
  const keys = [SAVE_KEY, `${SAVE_KEY}${SETTINGS_SUFFIX}`, ...LEGACY_SAVE_KEYS];
  keys.forEach((key) => storageRemoveItem(key));
}

/** No-op on web; kept so boot stays awaitable. */
export async function hydrateNativePreferences() {
  // Intentionally empty — web uses localStorage only.
}
