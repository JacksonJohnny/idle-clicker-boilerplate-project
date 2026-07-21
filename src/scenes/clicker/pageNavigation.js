import { COLORS } from '../../config/theme.js';

export function setupPageSwipe(scene) {
  scene.input.on('pointerdown', (pointer) => {
    beginPageSwipe(scene, pointer);
  });

  scene.input.on('pointerup', (pointer) => {
    if (!scene.pageSwipeStart) {
      scene.pageSwipeStart = null;
      return;
    }

    const deltaX = pointer.x - scene.pageSwipeStart.x;
    const deltaY = pointer.y - scene.pageSwipeStart.y;
    scene.pageSwipeStart = null;

    const scroll =
      scene.activePage === 0 ? scene.upgradeScroll : scene.activePage === 2 ? scene.boostScroll : null;
    if (scroll?.lastGestureAxis === 'vertical') {
      return;
    }

    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    const direction = deltaX < 0 ? 1 : -1;
    const next = Math.min(2, Math.max(0, scene.activePage + direction));
    setActivePage(scene, next);
  });
}

export function beginPageSwipe(scene, pointer) {
  if (!scene.gameStarted || scene.activePage === 3 || scene.offlineReturn || pointer.y >= scene.navTop) {
    return;
  }

  scene.pageSwipeStart = { x: pointer.x, y: pointer.y };
}

export function setActivePage(scene, index) {
  scene.holdBuy.stopUpgradeHold();
  scene.activePage = Math.min(3, Math.max(0, index));
  const showStore = scene.activePage === 0;
  const showGame = scene.activePage === 1;
  const showBoosts = scene.activePage === 2;
  const showSettings = scene.activePage === 3;

  scene.gamePage.setVisible(showGame);
  scene.storeTitle.setVisible(showStore);
  scene.upgradePanelBg.setVisible(showStore);
  scene.upgradeCamera.setVisible(scene.gameStarted && showStore);
  scene.upgradeScroll.setVisible(showStore);
  scene.boostsTitle.setVisible(showBoosts);
  scene.boostPanelBg.setVisible(showBoosts);
  scene.boostCamera.setVisible(scene.gameStarted && showBoosts);
  scene.boostScroll.setVisible(showBoosts);
  scene.settingsPage.setVisible(showSettings);
  if (showBoosts) {
    scene.updateBoostListLayout();
  } else {
    scene.boostEmptyText.setVisible(false);
  }
  scene.settingsButtonBackground.setFillStyle(0x000000, 0);
  scene.settingsButtonBackground.setStrokeStyle(
    1.5,
    showSettings ? COLORS.accentActive : COLORS.accent,
    showSettings ? 1 : 0.9,
  );
  scene.settingsButtonIcon.setColor(showSettings ? COLORS.accentActiveText : COLORS.accentText);

  scene.navTabs.forEach((tab, tabIndex) => {
    const active = tabIndex === scene.activePage;
    tab.indicator.setVisible(active);
    tab.text.setColor(active ? COLORS.activeText : COLORS.inactiveText);
  });
}
