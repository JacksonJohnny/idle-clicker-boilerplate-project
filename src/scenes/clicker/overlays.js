import { COLORS, FONT_FAMILIES } from '../../config/theme.js';
import { UI_TEXT } from '../../config/uiText.js';
import { formatCoins } from '../../lib/clickerMath.js';

export function formatOfflineDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function showOfflineReturn(scene, offline) {
  if (scene.offlineReturn) {
    return;
  }

  const width = scene.scale.width;
  const height = scene.scale.height;
  const overlay = scene.add.rectangle(width / 2, height / 2, width, height, COLORS.overlay, 0.78).setInteractive();
  const panel = scene.add
    .rectangle(width / 2, height / 2, width - 48, 380, COLORS.overlayPanel, 1)
    .setStrokeStyle(3, COLORS.overlayBorder);
  const title = scene.add
    .text(width / 2, height / 2 - 128, UI_TEXT.welcomeBack, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '32px',
      color: COLORS.accentText,
    })
    .setOrigin(0.5);
  const awayText = scene.add
    .text(width / 2, height / 2 - 68, `Away for ${formatOfflineDuration(offline.elapsedSeconds)}`, {
      fontFamily: FONT_FAMILIES.body,
      fontSize: '23px',
      color: COLORS.overlayText,
    })
    .setOrigin(0.5);
  const earningsLabel = scene.add
    .text(width / 2, height / 2 - 12, UI_TEXT.offlineEarnings, {
      fontFamily: FONT_FAMILIES.body,
      fontSize: '18px',
      color: COLORS.overlayMutedText,
      fontStyle: '800',
    })
    .setOrigin(0.5);
  const earnings = scene.add
    .text(width / 2, height / 2 + 34, `+${formatCoins(offline.gain)} coins`, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '30px',
      color: COLORS.positiveText,
    })
    .setOrigin(0.5);
  const continueButton = scene.add
    .rectangle(width / 2, height / 2 + 120, width - 104, 66, COLORS.primary)
    .setStrokeStyle(2, COLORS.primaryBorder)
    .setInteractive({ useHandCursor: true });
  const continueText = scene.add
    .text(width / 2, height / 2 + 120, UI_TEXT.continue, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '22px',
      color: COLORS.primaryText,
    })
    .setOrigin(0.5);

  scene.offlineReturn = scene.add
    .container(0, 0, [overlay, panel, title, awayText, earningsLabel, earnings, continueButton, continueText])
    .setDepth(3000);
  scene.upgradeCamera?.ignore(scene.offlineReturn);
  scene.boostCamera?.ignore(scene.offlineReturn);

  continueButton.on('pointerup', () => {
    scene.offlineReturn?.destroy(true);
    scene.offlineReturn = null;
  });
}

export function showStartOverlay(scene, onStart) {
  const width = scene.scale.width;
  const height = scene.scale.height;

  scene.startOverlayBg = scene.add
    .rectangle(width / 2, height / 2, width, height, COLORS.startOverlay, 0.88)
    .setDepth(2000);
  scene.startOverlayText = scene.add
    .text(width / 2, height / 2, UI_TEXT.start, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '52px',
      color: COLORS.text,
      stroke: COLORS.startStroke,
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(2001);

  scene.startOverlayHitArea = scene.add
    .zone(width / 2, height / 2, width, height)
    .setInteractive({ useHandCursor: true })
    .setDepth(2002);

  scene.startOverlayHitArea.on('pointerdown', onStart);
}

export function destroyStartOverlay(scene) {
  scene.startOverlayBg?.destroy();
  scene.startOverlayText?.destroy();
  scene.startOverlayHitArea?.destroy();
  scene.startOverlayBg = null;
  scene.startOverlayText = null;
  scene.startOverlayHitArea = null;
}
