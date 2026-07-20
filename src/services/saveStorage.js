import { SAVE_KEY } from '../config/gameConfig.js';

const SAVE_VERSION = 2;

function computeChecksum(value) {
  let hash = 5381;

  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }

  return (hash >>> 0).toString(16);
}

function packSavePayload(state) {
  const payload = JSON.stringify(state);

  return JSON.stringify({
    version: SAVE_VERSION,
    payload,
    checksum: computeChecksum(`${payload}:${SAVE_KEY}:${SAVE_VERSION}`),
  });
}

function unpackSavePayload(raw) {
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  if (typeof parsed.payload === 'string' && typeof parsed.checksum === 'string') {
    const expected = computeChecksum(`${parsed.payload}:${SAVE_KEY}:${parsed.version ?? SAVE_VERSION}`);

    if (expected !== parsed.checksum) {
      return null;
    }

    return JSON.parse(parsed.payload);
  }

  // Backward compatibility with legacy plain JSON saves.
  return parsed;
}

function shouldResetSaveByQueryParam() {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('resetSave') === '1';
}

function purgeOriginStorage() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.clear();
  } catch (error) {
    // Ignore storage purge failures and continue with fresh state fallback.
  }

  try {
    sessionStorage.clear();
  } catch (error) {
    // Ignore storage purge failures and continue with fresh state fallback.
  }

  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
  }

  if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
    indexedDB
      .databases()
      .then((databases) => {
        databases.forEach((database) => {
          if (database.name) {
            indexedDB.deleteDatabase(database.name);
          }
        });
      })
      .catch(() => {});
  }
}

function removeResetParamFromUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  params.delete('resetSave');
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
}

export function loadGameState() {
  try {
    if (shouldResetSaveByQueryParam()) {
      purgeOriginStorage();
      removeResetParamFromUrl();
      return null;
    }

    const raw = localStorage.getItem(SAVE_KEY);

    if (!raw) {
      return null;
    }

    return unpackSavePayload(raw);
  } catch (error) {
    return null;
  }
}

export function saveGameState(state) {
  localStorage.setItem(SAVE_KEY, packSavePayload(state));
}
