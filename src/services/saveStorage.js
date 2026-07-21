import { LEGACY_SAVE_KEYS, SAVE_KEY, SAVE_VERSION } from '../config/gameConfig.js';
import { migrateSaveState, normalizeSaveState } from './saveMigrations.js';
import { purgeGameStorageKeys, storageGetItem, storageRemoveItem, storageSetItem } from './storageAdapter.js';

export function computeChecksum(value) {
  let hash = 5381;

  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }

  return (hash >>> 0).toString(16);
}

export function packSavePayload(state) {
  const payload = JSON.stringify(state);

  return JSON.stringify({
    version: SAVE_VERSION,
    payload,
    checksum: computeChecksum(`${payload}:${SAVE_KEY}:${SAVE_VERSION}`),
  });
}

function isLikelySaveState(value) {
  return Boolean(value && typeof value === 'object' && (value.coins !== undefined || Array.isArray(value.upgrades)));
}

function verifyChecksum(payload, checksum, version, storageKey) {
  if (typeof payload !== 'string' || typeof checksum !== 'string') {
    return false;
  }

  const expected = computeChecksum(`${payload}:${storageKey}:${version}`);
  return expected === checksum;
}

export function unpackEnvelope(parsed, storageKey = SAVE_KEY) {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  if (typeof parsed.payload === 'string') {
    const version = Number.isFinite(Number(parsed.version)) ? Number(parsed.version) : 1;
    const checksumOk = verifyChecksum(parsed.payload, parsed.checksum, version, storageKey);

    try {
      const state = JSON.parse(parsed.payload);
      if (!isLikelySaveState(state)) {
        return null;
      }

      return {
        state,
        version,
        verified: checksumOk,
      };
    } catch (error) {
      return null;
    }
  }

  if (isLikelySaveState(parsed)) {
    return {
      state: parsed,
      version: 1,
      verified: true,
    };
  }

  return null;
}

function readRawFromKeys() {
  const keys = [SAVE_KEY, ...LEGACY_SAVE_KEYS];

  for (const key of keys) {
    const raw = storageGetItem(key);
    if (!raw) {
      continue;
    }

    try {
      const unpacked = unpackEnvelope(JSON.parse(raw), key);
      if (unpacked) {
        return { ...unpacked, sourceKey: key };
      }
    } catch (error) {
      // Try next key.
    }
  }

  return null;
}

function shouldResetSaveByQueryParam() {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('resetSave') === '1';
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
      purgeGameStorageKeys();
      removeResetParamFromUrl();
      return null;
    }

    const loaded = readRawFromKeys();

    if (!loaded) {
      return null;
    }

    const migrated = migrateSaveState(loaded.state, loaded.version);

    if (loaded.sourceKey !== SAVE_KEY || loaded.version !== SAVE_VERSION || !loaded.verified) {
      saveGameState(migrated.state);
      if (loaded.sourceKey !== SAVE_KEY) {
        storageRemoveItem(loaded.sourceKey);
      }
    }

    return migrated.state;
  } catch (error) {
    return null;
  }
}

export function saveGameState(state) {
  const normalized = normalizeSaveState(state);
  storageSetItem(SAVE_KEY, packSavePayload(normalized));
}
