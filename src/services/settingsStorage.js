import { SAVE_KEY } from '../config/gameConfig.js';

const SETTINGS_KEY = `${SAVE_KEY}-settings`;
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  vibrationEnabled: true,
};

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));

    return {
      soundEnabled: saved?.soundEnabled !== false,
      vibrationEnabled: saved?.vibrationEnabled !== false,
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}