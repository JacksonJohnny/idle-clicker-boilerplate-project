import { COLORS, FONT_FAMILIES } from '../../config/theme.js';
import { UI_TEXT } from '../../config/uiText.js';
import { formatCoins } from '../../lib/clickerMath.js';
import { setActivePage } from './pageNavigation.js';

function formatOfflineDuration(totalSeconds) {
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

/** List cameras composite over the main camera — hide them while a modal is up. */
function hideListCamerasForModal(scene) {
  scene.upgradeCamera?.setVisible(false);
  scene.metaCamera?.setVisible(false);
  scene.statusCamera?.setVisible(false);
  scene.upgradeScroll?.setVisible(false);
  scene.metaScroll?.setVisible(false);
  scene.statusScroll?.setVisible(false);
}

function restoreUiAfterModal(scene) {
  if (typeof scene.activePage === 'number') {
    setActivePage(scene, scene.activePage);
  }
}

function ignoreModalOnListCameras(scene, modal) {
  scene.upgradeCamera?.ignore(modal);
  scene.metaCamera?.ignore(modal);
  scene.statusCamera?.ignore(modal);
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

  hideListCamerasForModal(scene);
  ignoreModalOnListCameras(scene, scene.offlineReturn);

  continueButton.on('pointerup', () => {
    scene.offlineReturn?.destroy(true);
    scene.offlineReturn = null;
    restoreUiAfterModal(scene);
    scene.renderState?.();
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

/** Generic confirm modal (prestige, destructive actions). */
function showConfirmDialog(
  scene,
  { title, body, confirmLabel, cancelLabel, onConfirm, onCancel, danger = false, confirmDelaySeconds = 0 },
) {
  if (scene.confirmDialog) {
    return;
  }

  const width = scene.scale.width;
  const height = scene.scale.height;
  const cx = width / 2;
  const cy = height / 2;
  const panelWidth = Math.min(width - 48, 460);
  const contentWidth = panelWidth - 56;
  const padY = 40;
  const gapTitleBody = 28;
  const gapBodyButtons = 40;
  const gapButtons = 18;
  const confirmH = 60;
  const cancelH = 52;

  const readyFill = danger ? COLORS.danger : COLORS.primary;
  const readyBorder = danger ? COLORS.dangerBorder : COLORS.primaryBorder;
  const readyTextColor = danger ? COLORS.dangerText : COLORS.primaryText;
  const delaySeconds = Math.max(0, Math.floor(confirmDelaySeconds));

  const titleText = scene.add
    .text(0, 0, title, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '28px',
      color: COLORS.accentText,
      align: 'center',
      wordWrap: { width: contentWidth },
    })
    .setOrigin(0.5);
  const bodyText = scene.add
    .text(0, 0, body, {
      fontFamily: FONT_FAMILIES.body,
      fontSize: '18px',
      color: COLORS.overlayText,
      align: 'center',
      wordWrap: { width: contentWidth },
    })
    .setOrigin(0.5);

  const contentHeight =
    titleText.height + gapTitleBody + bodyText.height + gapBodyButtons + confirmH + gapButtons + cancelH;
  const panelHeight = contentHeight + padY * 2;
  const stackTop = cy - contentHeight / 2;

  const titleY = stackTop + titleText.height / 2;
  const bodyY = titleY + titleText.height / 2 + gapTitleBody + bodyText.height / 2;
  const confirmY = bodyY + bodyText.height / 2 + gapBodyButtons + confirmH / 2;
  const cancelY = confirmY + confirmH / 2 + gapButtons + cancelH / 2;

  titleText.setPosition(cx, titleY);
  bodyText.setPosition(cx, bodyY);

  const overlay = scene.add.rectangle(cx, cy, width, height, COLORS.overlay, 0.78).setInteractive();
  const panel = scene.add
    .rectangle(cx, cy, panelWidth, panelHeight, COLORS.overlayPanel, 1)
    .setStrokeStyle(3, COLORS.overlayBorder);

  const confirmButton = scene.add.rectangle(cx, confirmY, contentWidth, confirmH, readyFill);
  const confirmText = scene.add
    .text(cx, confirmY, confirmLabel, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '20px',
      color: readyTextColor,
    })
    .setOrigin(0.5);

  let confirmReady = delaySeconds <= 0;
  let countdownEvent = null;

  function setConfirmReady() {
    confirmReady = true;
    confirmButton.setFillStyle(readyFill).setStrokeStyle(2, readyBorder);
    confirmText.setText(confirmLabel).setColor(readyTextColor);
    confirmButton.setInteractive({ useHandCursor: true });
  }

  if (confirmReady) {
    confirmButton.setStrokeStyle(2, readyBorder).setInteractive({ useHandCursor: true });
  } else {
    confirmButton.setFillStyle(COLORS.disabled).setStrokeStyle(2, COLORS.disabledBorder);
    confirmText.setText(String(delaySeconds)).setColor(COLORS.disabledText);

    let remaining = delaySeconds;
    countdownEvent = scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        remaining -= 1;
        if (remaining <= 0) {
          countdownEvent?.remove(false);
          countdownEvent = null;
          setConfirmReady();
          return;
        }
        confirmText.setText(String(remaining));
      },
    });
  }

  const cancelButton = scene.add
    .rectangle(cx, cancelY, contentWidth, cancelH, COLORS.primary)
    .setStrokeStyle(2, COLORS.primaryBorder)
    .setInteractive({ useHandCursor: true });
  const cancelText = scene.add
    .text(cx, cancelY, cancelLabel, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '18px',
      color: COLORS.primaryText,
    })
    .setOrigin(0.5);

  const dialog = scene.add
    .container(0, 0, [overlay, panel, titleText, bodyText, confirmButton, confirmText, cancelButton, cancelText])
    .setDepth(3200);

  scene.confirmDialog = dialog;
  hideListCamerasForModal(scene);
  ignoreModalOnListCameras(scene, dialog);

  function close() {
    countdownEvent?.remove(false);
    countdownEvent = null;
    dialog.destroy(true);
    scene.confirmDialog = null;
    restoreUiAfterModal(scene);
  }

  confirmButton.on('pointerup', () => {
    if (!confirmReady) {
      return;
    }
    close();
    onConfirm?.();
  });
  cancelButton.on('pointerup', () => {
    close();
    onCancel?.();
  });
}

export function showPrestigeConfirm(scene, onConfirm) {
  showConfirmDialog(scene, {
    title: UI_TEXT.prestigeConfirmTitle,
    body: UI_TEXT.prestigeConfirmBody,
    confirmLabel: UI_TEXT.prestigeConfirmYes,
    cancelLabel: UI_TEXT.prestigeConfirmNo,
    danger: true,
    confirmDelaySeconds: 5,
    onConfirm,
  });
}
