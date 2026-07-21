// Never rename the default SAVE_KEY — use SAVE_VERSION + migrations instead.
// Optional Vite overrides: VITE_SAVE_KEY, VITE_APP_ID (see .env.example).
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

export const SAVE_KEY = env.VITE_SAVE_KEY || 'clicker-phaser-save-v1';
export const LEGACY_SAVE_KEYS = [];
export const SAVE_VERSION = 5;
export const SCENE_KEY = 'clicker-scene';
export const APP_ID = env.VITE_APP_ID || 'com.clickergame.app';

export const GAME_CONFIG = {
  width: 540,
  height: 960,
  backgroundColor: '#111822',
};

export const LOOP_CONFIG = {
  autoSaveDelayMs: 10000,
  maxOfflineSeconds: 8 * 60 * 60,
};
