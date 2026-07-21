import { SAVE_KEY } from '../config/gameConfig.js';
import { storageGetItem, storageSetItem } from './storageAdapter.js';

const SETTINGS_KEY = `${SAVE_KEY}-settings`;
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  vibrationEnabled: true,
};

export function loadSettings() {
  try {
    const raw = storageGetItem(SETTINGS_KEY);
    const saved = raw ? JSON.parse(raw) : null;

    return {
      soundEnabled: saved?.soundEnabled !== false,
      vibrationEnabled: saved?.vibrationEnabled !== false,
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  storageSetItem(SETTINGS_KEY, JSON.stringify(settings));
}
