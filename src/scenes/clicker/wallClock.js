import { LOOP_CONFIG } from '../../config/gameConfig.js';
import { COLORS } from '../../config/theme.js';
import { formatCoins, getAutoTapCursorCount } from '../../lib/clickerMath.js';
import { getAutoTapCursorMultiplier } from '../../lib/autoTapProgress.js';
import { showOfflineReturn } from './overlays.js';

export function applyWallClockProgress(scene, options = {}) {
  const nowMs = Date.now();

  if (!scene.gameStarted) {
    scene.lastProgressAtMs = nowMs;
    return;
  }

  const elapsedMs = nowMs - scene.lastProgressAtMs;
  if (elapsedMs <= 0) {
    return;
  }

  const cappedSeconds = Math.min(elapsedMs / 1000, LOOP_CONFIG.maxOfflineSeconds);
  scene.lastProgressAtMs = nowMs;

  const gain = scene.engine.tick(cappedSeconds);
  const autoTaps = scene.state.lastAutoTaps ?? 0;

  if (autoTaps > 0 && scene.activePage === 1) {
    const autoTapLevel = getAutoTapCursorCount(scene.state);
    scene.autoTapCursors.playClicks(autoTaps, (cursorIndex, tapIndex) => {
      scene.tapButtonVisuals.forEach((object) => object.setScale(0.94));
      scene.tweens.add({
        targets: scene.tapButtonVisuals,
        scale: 1,
        duration: 120,
        ease: 'Back.Out',
      });
      const multiplier = getAutoTapCursorMultiplier(autoTapLevel, cursorIndex);
      const tapGain = scene.state.perClick.times(multiplier);
      const xOffset = ((tapIndex % 5) - 2) * 18;
      scene.feedback.spawnFloatingText(`+${formatCoins(tapGain)}`, COLORS.whiteText, scene.tapCenterY, xOffset);
    });
  }

  if (gain.lte(0)) {
    return;
  }

  if (options.showOfflineReturn && cappedSeconds >= 60) {
    showOfflineReturn(scene, { gain, elapsedSeconds: Math.floor(cappedSeconds) });
  }

  scene.renderState();
}

export function flushProgressAndSave(scene) {
  applyWallClockProgress(scene);
  if (scene.gameStarted) {
    scene.persist();
  }
}

export function bindLifecyclePersistence(scene) {
  scene.onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushProgressAndSave(scene);
      return;
    }

    applyWallClockProgress(scene, { showOfflineReturn: true });
  };
  scene.onPageHide = () => flushProgressAndSave(scene);
  scene.onBeforeUnload = () => flushProgressAndSave(scene);

  document.addEventListener('visibilitychange', scene.onVisibilityChange);
  window.addEventListener('pagehide', scene.onPageHide);
  window.addEventListener('beforeunload', scene.onBeforeUnload);
  scene.events.once('shutdown', () => {
    document.removeEventListener('visibilitychange', scene.onVisibilityChange);
    window.removeEventListener('pagehide', scene.onPageHide);
    window.removeEventListener('beforeunload', scene.onBeforeUnload);
  });
}
