import Phaser from 'phaser';
import { LOOP_CONFIG, SCENE_KEY } from '../config/gameConfig.js';
import { COLORS, FONT_FAMILIES, UI_LAYOUT } from '../config/theme.js';
import { UI_TEXT } from '../config/uiText.js';
import { UpgradeScrollController } from '../controllers/UpgradeScrollController.js';
import { MILESTONE_BOOSTS } from '../data/boosts.js';
import { CLICKER_GENERATORS } from '../data/generators.js';
import { CLICK_UPGRADES } from '../data/upgrades.js';
import { createClickerController, formatCoins, getReachedMilestones, isUpgradeUnlocked } from '../lib/clickerMath.js';
import { createFeedbackService } from '../services/feedbackService.js';
import { loadGameState, saveGameState } from '../services/saveStorage.js';
import { loadSettings, saveSettings } from '../services/settingsStorage.js';
import { buildBoostsView } from '../ui/boostsView.js';
import { buildBottomNavigation } from '../ui/bottomNavigation.js';
import { buildSettingsButton, buildSettingsView } from '../ui/settingsView.js';
import { buildUpgradeListView } from '../ui/upgradeListView.js';

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

export class ClickerScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEY);
  }

  create() {
    this.engine = createClickerController([...CLICK_UPGRADES, ...CLICKER_GENERATORS], MILESTONE_BOOSTS);
    const loadedState = loadGameState();
    const hasSave = !!loadedState;
    const offline = this.engine.hydrate(loadedState, {
      nowMs: Date.now(),
      maxOfflineSeconds: LOOP_CONFIG.maxOfflineSeconds,
    });
    this.state = this.engine.state;
    this.settings = loadSettings();
    this.feedback = createFeedbackService(this, this.settings);
    this.gameStarted = hasSave;

    const width = this.scale.width;
    const height = this.scale.height;

    this.activePage = 1;
    this.navHeight = UI_LAYOUT.navHeight;
    this.navTop = height - this.navHeight;
    this.tapCenterY = UI_LAYOUT.tapCenterY;
    this.gamePage = this.add.container(0, 0);
    this.boostsPage = this.add.container(0, 0);
    this.settingsPage = this.add.container(0, 0);

    this.add.rectangle(width / 2, height / 2, width, height, COLORS.background, 0.2);

    this.add
      .text(width / 2, 48, UI_TEXT.gameTitle, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '38px',
        color: COLORS.accentText,
        stroke: COLORS.titleStroke,
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    this.coinsText = this.add
      .text(width / 2, 134, '', {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '52px',
        color: COLORS.whiteText,
        fontStyle: '800',
      })
      .setOrigin(0.5);

    this.statsText = this.add
      .text(width / 2, 202, '', {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '24px',
        color: COLORS.statsText,
      })
      .setOrigin(0.5);

    this.coreGlow = this.add.circle(width / 2, this.tapCenterY, 136, COLORS.coreGlow, 0.18);
    const coreRing = this.add.circle(width / 2, this.tapCenterY, 124, COLORS.coreRing, 0.12).setStrokeStyle(3, COLORS.coreRingBorder, 0.5);
    this.coreButton = this.add.circle(width / 2, this.tapCenterY, 116, COLORS.coreButton).setInteractive({ useHandCursor: true });
    const coreInner = this.add.circle(width / 2, this.tapCenterY, 84, COLORS.coreInner);

    this.buttonLabel = this.add
      .text(width / 2, this.tapCenterY, UI_TEXT.tapButton, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '46px',
        color: COLORS.coreLabel,
      })
      .setOrigin(0.5);

    const tapHint = this.add
      .text(width / 2, 650, UI_TEXT.tapHint, {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '22px',
        color: COLORS.hintText,
        fontStyle: '700',
      })
      .setOrigin(0.5);

    this.tapButtonVisuals = [coreRing, this.coreButton, coreInner, this.buttonLabel];
    this.gamePage.add([this.coreGlow, ...this.tapButtonVisuals, tapHint]);

    this.coreButton.on('pointerdown', (pointer) => {
      this.corePointerDown = { x: pointer.x, y: pointer.y };
      this.beginPageSwipe(pointer);
    });

    this.coreButton.on('pointerup', (pointer) => {
      const moved = this.corePointerDown && Phaser.Math.Distance.Between(this.corePointerDown.x, this.corePointerDown.y, pointer.x, pointer.y) > 14;
      this.corePointerDown = null;

      if (!this.gameStarted || moved || this.activePage !== 1) {
        return;
      }

      const gain = this.engine.tap();
      this.tapButtonVisuals.forEach((object) => object.setScale(0.94));
      this.tweens.add({
        targets: this.tapButtonVisuals,
        scale: 1,
        duration: 120,
        ease: 'Back.Out',
      });
      this.feedback.spawnFloatingText(`+${formatCoins(gain)}`, COLORS.whiteText, this.tapCenterY);
      this.renderState();
    });

    const compactRows = this.state.upgrades.length > 4;
    const rowHeight = compactRows ? 72 : 84;
    const rowGap = compactRows ? 12 : 16;
    const panelPadding = 12;
    const panelTop = 294;
    const panelBottomMargin = this.navHeight + 14;
    const maxPanelHeight = height - panelTop - panelBottomMargin;
    const listHeight = this.state.upgrades.length * rowHeight + (this.state.upgrades.length - 1) * rowGap;
    const minPanelHeight = rowHeight + panelPadding * 2;
    const panelHeight = Math.max(minPanelHeight, Math.min(listHeight + panelPadding * 2, maxPanelHeight));
    const panelCenterY = height - panelBottomMargin - panelHeight / 2;
    const panelTopY = panelCenterY - panelHeight / 2;
    const panelBottomY = panelCenterY + panelHeight / 2;
    const listLeft = 24;
    const listWidth = width - 56;
    const listTop = panelTopY + panelPadding;
    const listBottom = panelBottomY - panelPadding;
    const visibleListHeight = listBottom - listTop;

    this.upgradeLayout = {
      rowHeight,
      rowGap,
      panelCenterY,
      compactRows,
      panelTopY,
      panelBottomY,
      listLeft,
      listWidth,
      listTop,
      listBottom,
      visibleListHeight,
      listHeight,
    };

    this.storeTitle = this.add
      .text(28, UI_LAYOUT.sectionTitleY, UI_TEXT.storeTitle, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '24px',
        color: COLORS.accentText,
      })
      .setOrigin(0, 0.5);

    this.upgradePanelBg = this.add.rectangle(width / 2, panelCenterY, width - 34, panelHeight, COLORS.storePanel, 0.86).setStrokeStyle(2, COLORS.storePanelBorder);

    this.upgradeContent = this.add.container(0, 0);

    this.upgradeItems = buildUpgradeListView({
      scene: this,
      container: this.upgradeContent,
      upgrades: this.state.upgrades,
      layout: this.upgradeLayout,
      onPointerDown: (upgrade, pointer) => this.startUpgradePurchase(upgrade, pointer),
      onPointerUp: (upgrade, pointer, moved) => this.finishUpgradePurchase(upgrade, pointer, moved),
    });
    this.boostItems = buildBoostsView({
      scene: this,
      container: this.boostsPage,
      boosts: this.state.boosts,
      onPointerDown: (pointer) => this.beginPageSwipe(pointer),
      onBuy: (boost) => this.buyBoost(boost),
    });
    this.settingItems = buildSettingsView({ scene: this, container: this.settingsPage, onToggle: (settingKey) => this.toggleSetting(settingKey) });
    const settingsButton = buildSettingsButton(this, () => this.toggleSettingsPage());
    this.settingsButtonBackground = settingsButton.background;
    this.settingsButtonIcon = settingsButton.icon;
    this.navTabs = buildBottomNavigation({ scene: this, navTop: this.navTop, navHeight: this.navHeight, onSelect: (index) => this.selectPage(index) });
    this.setupUpgradeViewportCamera();
    this.upgradeScroll = new UpgradeScrollController({
      scene: this,
      layout: this.upgradeLayout,
      items: this.upgradeItems,
      isEnabled: () => this.gameStarted,
      onPointerMove: (pointer) => this.cancelUpgradeHoldOnMove(pointer),
      onPointerUp: (pointer) => this.stopUpgradeHold(pointer.id),
    });
    this.upgradeScroll.setup();
    this.setupPageSwipe();
    this.setActivePage(1);

    this.time.addEvent({
      delay: LOOP_CONFIG.autoIncomeDelayMs,
      loop: true,
      callback: () => {
        if (!this.gameStarted) {
          return;
        }

        const gain = this.engine.tick();
        if (gain.gt(0)) {
          this.feedback.spawnFloatingText(`+${formatCoins(gain)}`, COLORS.positiveText, 300);
          this.renderState();
        }
      },
    });

    this.time.addEvent({
      delay: LOOP_CONFIG.autoSaveDelayMs,
      loop: true,
      callback: () => {
        if (!this.gameStarted) {
          return;
        }

        this.persist();
      },
    });

    this.input.on('gameout', () => {
      this.stopUpgradeHold();
      if (this.gameStarted) {
        this.persist();
      }
    });
    window.addEventListener('beforeunload', () => {
      if (this.gameStarted) {
        this.persist();
      }
    });

    this.renderState();

    if (!this.gameStarted) {
      this.showStartOverlay();
    }

    if (offline.gain.gt(0)) {
      this.persist();
      this.showOfflineReturn(offline);
    }

    this.tweens.add({
      targets: [this.coreGlow],
      alpha: { from: 0.2, to: 0.42 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  startUpgradePurchase(upgrade, pointer) {
    this.startUpgradeHold(upgrade.id, pointer);
    this.beginPageSwipe(pointer);
  }

  finishUpgradePurchase(upgrade, pointer, moved) {
    const boughtWhileHeld = this.stopUpgradeHold(pointer.id);
    if (!this.gameStarted || moved || boughtWhileHeld || this.activePage !== 0) {
      return;
    }
    this.tryBuyUpgrade(upgrade.id);
  }

  buyBoost(boost) {
    if (!this.gameStarted || this.activePage !== 2) {
      return;
    }

    const result = this.engine.tryBuyBoost(boost.id);
    if (!result.ok) {
      this.cameras.main.shake(120, 0.004);
      return;
    }

    this.feedback.playPurchase();
    this.feedback.spawnFloatingText(`PRODUCTION x${boost.multiplier}`, COLORS.positiveText, 520);
    this.renderState();
    this.persist();
  }

  toggleSetting(settingKey) {
    if (!this.gameStarted || this.activePage !== 3) {
      return;
    }

    this.settings[settingKey] = !this.settings[settingKey];
    saveSettings(this.settings);
    this.renderSettings();
  }

  toggleSettingsPage() {
    if (!this.gameStarted) {
      return;
    }

    if (this.activePage === 3) {
      this.setActivePage(this.previousMainPage ?? 1);
      return;
    }

    this.previousMainPage = this.activePage;
    this.setActivePage(3);
  }

  selectPage(index) {
    if (this.gameStarted) {
      this.setActivePage(index);
    }
  }

  setupUpgradeViewportCamera() {
    const { listLeft, listTop, listWidth, visibleListHeight } = this.upgradeLayout;

    this.cameras.main.ignore(this.upgradeContent);

    this.upgradeCamera = this.cameras.add(listLeft, listTop, listWidth, visibleListHeight);
    this.upgradeCamera.setBackgroundColor('rgba(0,0,0,0)');
    this.upgradeCamera.setScroll(listLeft, listTop);

    const mainObjects = this.children.list.filter((obj) => obj !== this.upgradeContent);
    this.upgradeCamera.ignore(mainObjects);
  }

  cancelUpgradeHoldOnMove(pointer) {
    if (this.upgradeHold?.pointerId !== pointer.id || !pointer.isDown) {
      return;
    }

    const moved = Phaser.Math.Distance.Between(this.upgradeHold.startX, this.upgradeHold.startY, pointer.x, pointer.y) > 14;
    if (moved) {
      this.stopUpgradeHold(pointer.id);
    }
  }

  setupPageSwipe() {
    this.input.on('pointerdown', (pointer) => {
      this.beginPageSwipe(pointer);
    });

    this.input.on('pointerup', (pointer) => {
      if (!this.pageSwipeStart) {
        this.pageSwipeStart = null;
        return;
      }

      const deltaX = pointer.x - this.pageSwipeStart.x;
      const deltaY = pointer.y - this.pageSwipeStart.y;
      this.pageSwipeStart = null;

      if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
        return;
      }

      const direction = deltaX < 0 ? 1 : -1;
      this.setActivePage(Phaser.Math.Clamp(this.activePage + direction, 0, 2));
    });
  }

  beginPageSwipe(pointer) {
    if (!this.gameStarted || this.activePage === 3 || this.offlineReturn || pointer.y >= this.navTop) {
      return;
    }

    this.pageSwipeStart = { x: pointer.x, y: pointer.y };
  }

  setActivePage(index) {
    this.stopUpgradeHold();
    this.activePage = Phaser.Math.Clamp(index, 0, 3);
    const showStore = this.activePage === 0;
    const showGame = this.activePage === 1;
    const showBoosts = this.activePage === 2;
    const showSettings = this.activePage === 3;

    this.gamePage.setVisible(showGame);
    this.storeTitle.setVisible(showStore);
    this.upgradePanelBg.setVisible(showStore);
    this.upgradeCamera.setVisible(this.gameStarted && showStore);
    this.upgradeScroll.setVisible(showStore);
    this.boostsPage.setVisible(showBoosts);
    this.settingsPage.setVisible(showSettings);
    this.settingsButtonBackground.setFillStyle(0x000000, 0);
    this.settingsButtonBackground.setStrokeStyle(1.5, showSettings ? COLORS.accentActive : COLORS.accent, showSettings ? 1 : 0.9);
    this.settingsButtonIcon.setColor(showSettings ? COLORS.accentActiveText : COLORS.accentText);

    this.navTabs.forEach((tab, tabIndex) => {
      const active = tabIndex === this.activePage;
      tab.indicator.setVisible(active);
      tab.text.setColor(active ? COLORS.activeText : COLORS.inactiveText);
    });
  }

  renderSettings() {
    this.settingItems.forEach((item) => {
      const enabled = this.settings[item.settingKey];
      item.toggle.setFillStyle(enabled ? COLORS.success : COLORS.toggleOff);
      item.toggle.setStrokeStyle(2, enabled ? COLORS.successBorder : COLORS.toggleOffBorder);
      item.valueText.setText(enabled ? UI_TEXT.on : UI_TEXT.off);
      item.valueText.setColor(enabled ? COLORS.successText : COLORS.toggleOffText);
    });
  }

  showOfflineReturn(offline) {
    if (this.offlineReturn) {
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.overlay, 0.78).setInteractive();
    const panel = this.add.rectangle(width / 2, height / 2, width - 48, 380, COLORS.overlayPanel, 1).setStrokeStyle(3, COLORS.overlayBorder);
    const title = this.add
      .text(width / 2, height / 2 - 128, UI_TEXT.welcomeBack, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '32px',
        color: COLORS.accentText,
      })
      .setOrigin(0.5);
    const awayText = this.add
      .text(width / 2, height / 2 - 68, `Away for ${formatOfflineDuration(offline.elapsedSeconds)}`, {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '23px',
        color: COLORS.overlayText,
      })
      .setOrigin(0.5);
    const earningsLabel = this.add
      .text(width / 2, height / 2 - 12, UI_TEXT.offlineEarnings, {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '18px',
        color: COLORS.overlayMutedText,
        fontStyle: '800',
      })
      .setOrigin(0.5);
    const earnings = this.add
      .text(width / 2, height / 2 + 34, `+${formatCoins(offline.gain)} coins`, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '30px',
        color: COLORS.positiveText,
      })
      .setOrigin(0.5);
    const continueButton = this.add.rectangle(width / 2, height / 2 + 120, width - 104, 66, COLORS.primary).setStrokeStyle(2, COLORS.primaryBorder).setInteractive({ useHandCursor: true });
    const continueText = this.add
      .text(width / 2, height / 2 + 120, UI_TEXT.continue, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '22px',
        color: COLORS.primaryText,
      })
      .setOrigin(0.5);

    this.offlineReturn = this.add.container(0, 0, [overlay, panel, title, awayText, earningsLabel, earnings, continueButton, continueText]).setDepth(3000);
    this.upgradeCamera.ignore(this.offlineReturn);

    continueButton.on('pointerup', () => {
      this.offlineReturn?.destroy(true);
      this.offlineReturn = null;
    });
  }

  startUpgradeHold(upgradeId, pointer) {
    this.stopUpgradeHold();
    this.upgradeHold = {
      upgradeId,
      pointerId: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      startedAt: this.time.now,
      didRepeat: false,
    };
    this.upgradeHoldTimer = this.time.delayedCall(550, () => this.runUpgradeHold());
  }

  runUpgradeHold() {
    if (!this.upgradeHold || this.activePage !== 0 || !this.gameStarted) {
      this.stopUpgradeHold();
      return;
    }

    const bought = this.tryBuyUpgrade(this.upgradeHold.upgradeId, { shakeOnFailure: false });
    if (!bought) {
      this.stopUpgradeHold();
      return;
    }

    this.upgradeHold.didRepeat = true;
    const elapsed = this.time.now - this.upgradeHold.startedAt - 550;
    const nextDelay = Math.max(100, 500 * Math.exp(-elapsed / 1500));
    this.upgradeHoldTimer = this.time.delayedCall(nextDelay, () => this.runUpgradeHold());
  }

  stopUpgradeHold(pointerId = null) {
    if (!this.upgradeHold) {
      if (pointerId !== null && this.completedUpgradeHoldPointerId === pointerId) {
        this.completedUpgradeHoldPointerId = null;
        return true;
      }
      return false;
    }

    if (pointerId !== null && this.upgradeHold.pointerId !== pointerId) {
      return false;
    }

    const didRepeat = this.upgradeHold.didRepeat;
    if (didRepeat) {
      this.completedUpgradeHoldPointerId = this.upgradeHold.pointerId;
    }
    this.upgradeHoldTimer?.remove(false);
    this.upgradeHoldTimer = null;
    this.upgradeHold = null;
    return didRepeat;
  }

  tryBuyUpgrade(upgradeId, options = {}) {
    if (!this.gameStarted) {
      return false;
    }

    const result = this.engine.tryBuyUpgrade(upgradeId);

    if (!result.ok) {
      if (options.shakeOnFailure !== false) {
        this.cameras.main.shake(120, 0.004);
      }
      return false;
    }

    if (result.milestoneReached) {
      this.feedback.spawnFloatingText(UI_TEXT.milestoneReached, COLORS.milestoneText, 300);
    }

    this.feedback.playPurchase(Boolean(result.milestoneReached));
    this.renderState();
    return true;
  }

  renderState() {
    this.coinsText.setText(`${formatCoins(this.state.coins)} coins`);
    this.statsText.setText(`per tap: ${formatCoins(this.state.perClick)} | per second: ${formatCoins(this.state.perSecond)}`);

    this.renderSettings();
    this.updateUpgradeListLayout();

    this.upgradeItems.forEach((item) => {
      const upgrade = this.state.upgrades.find((entry) => entry.id === item.id);
      const cost = this.engine.getUpgradeCost(item.id);
      if (item.isLockedPreview) {
        item.label.setText('???');
        item.info.setText(UI_TEXT.unlockHint);
        item.rowBg.setFillStyle(COLORS.lockedRow, 0.95).setStrokeStyle(2, COLORS.lockedRowBorder);
        item.label.setColor(COLORS.lockedText);
        item.info.setColor(COLORS.lockedInfo);
        item.buyButton.setFillStyle(COLORS.lockedButton).setStrokeStyle(2, COLORS.lockedButtonBorder);
        item.buyText.setText(UI_TEXT.locked).setColor(COLORS.lockedButtonText);
        item.stars.forEach((star) => star.setVisible(false));
        return;
      }

      const canBuy = this.state.coins.gte(cost);
      const effectLabel = upgrade.type === 'click' ? `+${upgrade.baseValue} tap power` : `+${upgrade.baseValue} per second`;

      item.rowBg.setFillStyle(COLORS.upgradeRow, 0.95).setStrokeStyle(2, COLORS.upgradeRowBorder);
      item.label.setColor(COLORS.upgradeText);
      item.info.setColor(COLORS.upgradeInfo);
      item.label.setText(`${upgrade.label} Lv.${upgrade.level}`);
      item.info.setText(`${effectLabel}  |  cost ${formatCoins(cost)}`);
      item.buyText.setText(UI_TEXT.buy);

      const reachedMilestones = getReachedMilestones(upgrade);
      item.stars.forEach((star, index) => {
        star.setVisible(index < reachedMilestones.length && item.rowBg.visible);
        star.x = item.label.x + item.label.width + 8 + index * 17;
      });

      item.buyButton.setFillStyle(canBuy ? COLORS.primary : COLORS.unavailableButton);
      item.buyText.setColor(canBuy ? COLORS.primaryText : COLORS.unavailableText);
    });

    const highestGeneratorLevel = this.state.upgrades
      .filter((upgrade) => upgrade.type === 'auto')
      .reduce((highest, upgrade) => Math.max(highest, upgrade.level), 0);

    this.boostItems.forEach((item) => {
      const boost = this.state.boosts.find((entry) => entry.id === item.id);
      const unlocked = highestGeneratorLevel >= boost.requiredLevel;
      const canBuy = unlocked && !boost.purchased && this.state.coins.gte(boost.cost);

      item.condition.setText(boost.purchased ? `Active · Production x${boost.multiplier}` : `Requires generator Lv.${boost.requiredLevel}`);
      item.condition.setColor(boost.purchased ? COLORS.positiveText : COLORS.mutedText);
      item.buyText.setText(boost.purchased ? UI_TEXT.owned : unlocked ? formatCoins(boost.cost) : UI_TEXT.locked);
      item.buyButton.setFillStyle(boost.purchased ? COLORS.success : canBuy ? COLORS.primary : COLORS.disabled);
      item.buyButton.setStrokeStyle(2, boost.purchased ? COLORS.successBorder : canBuy ? COLORS.primaryBorder : COLORS.disabledBorder);
      item.buyText.setColor(boost.purchased ? COLORS.successText : canBuy ? COLORS.primaryText : COLORS.disabledText);
    });
  }

  updateUpgradeListLayout() {
    const { rowHeight, rowGap, listTop, visibleListHeight } = this.upgradeLayout;
    const step = rowHeight + rowGap;
    const nextLockedUpgrade = this.state.upgrades.find((upgrade) => !isUpgradeUnlocked(upgrade, this.state.upgrades));
    let visibleIndex = 0;

    this.upgradeItems.forEach((item) => {
      const upgrade = this.state.upgrades.find((entry) => entry.id === item.id);
      const unlocked = isUpgradeUnlocked(upgrade, this.state.upgrades);
      item.isLockedPreview = !unlocked && item.id === nextLockedUpgrade?.id;
      const visible = unlocked || item.isLockedPreview;
      const objects = [item.rowBg, item.label, item.info, ...item.stars, item.buyButton, item.buyText];

      objects.forEach((object) => object.setVisible(visible));
      if (item.buyButton.input) {
        item.buyButton.input.enabled = unlocked;
      }

      if (visible) {
        item.baseY = listTop + rowHeight / 2 + visibleIndex * step;
        visibleIndex += 1;
      }
    });

    const listHeight = visibleIndex > 0 ? visibleIndex * rowHeight + (visibleIndex - 1) * rowGap : 0;
    this.upgradeScroll.updateMetrics(listHeight);
  }

  persist() {
    saveGameState(this.engine.snapshot());
  }

  showStartOverlay() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.startOverlayBg = this.add.rectangle(width / 2, height / 2, width, height, COLORS.startOverlay, 0.88).setDepth(2000);
    this.startOverlayText = this.add
      .text(width / 2, height / 2, UI_TEXT.start, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '52px',
        color: COLORS.text,
        stroke: COLORS.startStroke,
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(2001);

    this.startOverlayHitArea = this.add
      .zone(width / 2, height / 2, width, height)
      .setInteractive({ useHandCursor: true })
      .setDepth(2002);

    this.startOverlayHitArea.on('pointerdown', () => this.startGame());
  }

  startGame() {
    if (this.gameStarted) {
      return;
    }

    this.gameStarted = true;

    this.startOverlayBg?.destroy();
    this.startOverlayText?.destroy();
    this.startOverlayHitArea?.destroy();

    this.renderState();
    this.setActivePage(this.activePage);
  }
}
