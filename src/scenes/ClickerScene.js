import Phaser from 'phaser';
import { LOOP_CONFIG, SCENE_KEY } from '../config/gameConfig.js';
import { COLORS, FONT_FAMILIES, UI_LAYOUT } from '../config/theme.js';
import { UI_TEXT } from '../config/uiText.js';
import { ListScrollController } from '../controllers/ListScrollController.js';
import { META_UPGRADES } from '../data/metaUpgrades.js';
import { CLICKER_GENERATORS } from '../data/generators.js';
import { CLICK_UPGRADES } from '../data/upgrades.js';
import { createClickerController, formatCoins, getAutoTapCursorCount } from '../lib/clickerMath.js';
import { createFeedbackService } from '../services/feedbackService.js';
import { loadGameState, saveGameState } from '../services/saveStorage.js';
import { loadSettings, saveSettings } from '../services/settingsStorage.js';
import { buildBoostsView } from '../ui/boostsView.js';
import { buildBottomNavigation } from '../ui/bottomNavigation.js';
import { buildSettingsButton, buildSettingsView } from '../ui/settingsView.js';
import { buildUpgradeListView } from '../ui/upgradeListView.js';
import { createAutoTapCursorLayer } from '../ui/autoTapCursors.js';
import { getMetaUpgradeEffectText } from '../ui/metaUpgradeCopy.js';
import handCursorUrl from '../assets/hand-cursor.png';
import {
  destroyStartOverlay,
  showOfflineReturn as showOfflineReturnOverlay,
  showStartOverlay as showStartOverlayUI,
} from './clicker/overlays.js';
import { createHoldBuyController } from './clicker/holdBuy.js';
import {
  applyWallClockProgress as applyWallClockProgressHelper,
  bindLifecyclePersistence,
  flushProgressAndSave as flushProgressAndSaveHelper,
} from './clicker/wallClock.js';
import { renderStoreRows, updateMetaListLayout, updateStoreListLayout } from './clicker/listRender.js';
import {
  beginPageSwipe as beginPageSwipeHelper,
  setActivePage as setActivePageHelper,
  setupPageSwipe,
} from './clicker/pageNavigation.js';

export class ClickerScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEY);
  }

  preload() {
    this.load.image('hand-cursor', handCursorUrl);
  }

  create() {
    this.engine = createClickerController([...CLICK_UPGRADES, ...CLICKER_GENERATORS], META_UPGRADES);
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

    this.hudMaxWidth = width - 34;

    this.coinsText = this.add
      .text(width / 2, 134, '', {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '44px',
        color: COLORS.whiteText,
        fontStyle: '800',
      })
      .setOrigin(0.5);

    this.statsText = this.add
      .text(width / 2, 202, '', {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '22px',
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

    this.tapButtonVisuals = [coreRing, this.coreButton, coreInner, this.buttonLabel];
    this.autoTapCursors = createAutoTapCursorLayer(this, width / 2, this.tapCenterY);
    this.gamePage.add([this.coreGlow, ...this.tapButtonVisuals, this.autoTapCursors.layer]);

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

    const boostRowHeight = 98;
    const boostRowGap = 16;
    const boostPanelPadding = 12;
    const boostPanelTop = 294;
    const boostPanelBottomMargin = this.navHeight + 14;
    const boostMaxPanelHeight = height - boostPanelTop - boostPanelBottomMargin;
    const boostPanelHeight = boostMaxPanelHeight;
    const boostPanelCenterY = height - boostPanelBottomMargin - boostPanelHeight / 2;
    const boostPanelTopY = boostPanelCenterY - boostPanelHeight / 2;
    const boostPanelBottomY = boostPanelCenterY + boostPanelHeight / 2;
    const boostListTop = boostPanelTopY + boostPanelPadding;
    const boostListBottom = boostPanelBottomY - boostPanelPadding;

    this.boostLayout = {
      rowHeight: boostRowHeight,
      rowGap: boostRowGap,
      panelCenterY: boostPanelCenterY,
      panelTopY: boostPanelTopY,
      panelBottomY: boostPanelBottomY,
      listLeft: 24,
      listWidth: width - 56,
      listTop: boostListTop,
      listBottom: boostListBottom,
      visibleListHeight: boostListBottom - boostListTop,
      listHeight: 0,
    };

    this.boostsTitle = this.add
      .text(28, UI_LAYOUT.sectionTitleY, UI_TEXT.metaUpgradesTitle || UI_TEXT.boostsTitle, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '24px',
        color: COLORS.accentText,
      })
      .setOrigin(0, 0.5);
    this.boostPanelBg = this.add
      .rectangle(width / 2, boostPanelCenterY, width - 34, boostPanelHeight, COLORS.storePanel, 0.86)
      .setStrokeStyle(2, COLORS.storePanelBorder);
    this.boostEmptyText = this.add
      .text(width / 2, boostPanelCenterY, UI_TEXT.unlockHint, {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '20px',
        color: COLORS.mutedText,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.boostContent = this.add.container(0, 0);
    this.boostItems = buildBoostsView({
      scene: this,
      container: this.boostContent,
      boosts: this.state.boosts,
      layout: this.boostLayout,
      onPointerDown: (pointer) => this.beginPageSwipe(pointer),
      onBuy: (boost) => this.buyBoost(boost),
    });
    this.settingItems = buildSettingsView({ scene: this, container: this.settingsPage, onToggle: (settingKey) => this.toggleSetting(settingKey) });
    const settingsButton = buildSettingsButton(this, () => this.toggleSettingsPage());
    this.settingsButtonBackground = settingsButton.background;
    this.settingsButtonIcon = settingsButton.icon;
    this.navTabs = buildBottomNavigation({ scene: this, navTop: this.navTop, navHeight: this.navHeight, onSelect: (index) => this.selectPage(index) });
    this.setupUpgradeViewportCamera();
    this.setupBoostViewportCamera();

    this.holdBuy = createHoldBuyController(this);
    this.upgradeScroll = new ListScrollController({
      scene: this,
      layout: this.upgradeLayout,
      items: this.upgradeItems,
      isEnabled: () => this.gameStarted && this.activePage === 0,
      onPointerMove: (pointer) => this.holdBuy.cancelUpgradeHoldOnMove(pointer),
      onPointerUp: (pointer) => this.holdBuy.stopUpgradeHold(pointer.id),
    });
    this.upgradeScroll.setup();
    this.boostScroll = new ListScrollController({
      scene: this,
      layout: this.boostLayout,
      items: this.boostItems,
      isEnabled: () => this.gameStarted && this.activePage === 2,
      syncItem: (item, y) => {
        item.background.y = y;
        item.name.y = y - 22;
        item.condition.y = y + 8;
        item.effect.y = y + 30;
        item.buyButton.y = y;
        item.buyText.y = y;
      },
    });
    this.boostScroll.setup();
    setupPageSwipe(this);
    this.setActivePage(1);
    this.lastProgressAtMs = Date.now();

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
      this.holdBuy.stopUpgradeHold();
      this.flushProgressAndSave();
    });

    bindLifecyclePersistence(this);

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
    this.holdBuy.startUpgradeHold(upgrade.id, pointer);
    this.beginPageSwipe(pointer);
  }

  finishUpgradePurchase(upgrade, pointer, moved) {
    const boughtWhileHeld = this.holdBuy.stopUpgradeHold(pointer.id);
    if (!this.gameStarted || moved || boughtWhileHeld || this.activePage !== 0) {
      return;
    }
    this.tryBuyUpgrade(upgrade.id);
  }

  buyBoost(boost) {
    if (!this.gameStarted || this.activePage !== 2) {
      return;
    }

    const buy = this.engine.tryBuyMetaUpgrade ?? this.engine.tryBuyBoost;
    const result = buy.call(this.engine, boost.id);
    if (!result.ok) {
      this.cameras.main.shake(120, 0.004);
      return;
    }

    this.feedback.playPurchase();
    this.feedback.spawnFloatingText(getMetaUpgradeEffectText(boost), COLORS.positiveText, 520);
    this.renderState();
    this.persist();
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

    this.feedback.playPurchase();
    this.renderState();
    return true;
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

  setupBoostViewportCamera() {
    const { listLeft, listTop, listWidth, visibleListHeight } = this.boostLayout;

    this.cameras.main.ignore(this.boostContent);

    this.boostCamera = this.cameras.add(listLeft, listTop, listWidth, visibleListHeight);
    this.boostCamera.setBackgroundColor('rgba(0,0,0,0)');
    this.boostCamera.setScroll(listLeft, listTop);

    const mainObjects = this.children.list.filter((obj) => obj !== this.boostContent);
    this.boostCamera.ignore(mainObjects);
    this.upgradeCamera.ignore(this.boostContent);
    this.boostCamera.ignore(this.upgradeContent);
  }

  setActivePage(index) {
    setActivePageHelper(this, index);
  }

  beginPageSwipe(pointer) {
    beginPageSwipeHelper(this, pointer);
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

  fitHudText(textObject) {
    if (!textObject || !this.hudMaxWidth) {
      return;
    }

    textObject.setScale(1);
    const width = textObject.width;
    if (width > this.hudMaxWidth) {
      textObject.setScale(this.hudMaxWidth / width);
    }
  }

  renderState() {
    this.coinsText.setText(`${formatCoins(this.state.coins, { rate: this.state.perSecond })} coins`);
    this.statsText.setText(`per tap: ${formatCoins(this.state.perClick)} | per second: ${formatCoins(this.state.perSecond)}`);
    this.fitHudText(this.coinsText);
    this.fitHudText(this.statsText);
    this.renderSettings();
    updateStoreListLayout(this);
    renderStoreRows(this);
    updateMetaListLayout(this);
  }

  updateBoostListLayout() {
    updateMetaListLayout(this);
  }

  updateUpgradeListLayout() {
    updateStoreListLayout(this);
  }

  update() {
    this.applyWallClockProgress();

    const onTapPage = this.gameStarted && this.activePage === 1;
    const cursorCount = onTapPage ? getAutoTapCursorCount(this.state) : 0;
    this.autoTapCursors.layer.setVisible(onTapPage);
    this.autoTapCursors.updateOrbit(cursorCount, this.time.now);
  }

  applyWallClockProgress(options = {}) {
    applyWallClockProgressHelper(this, options);
  }

  flushProgressAndSave() {
    flushProgressAndSaveHelper(this);
  }

  persist() {
    saveGameState(this.engine.snapshot());
  }

  showOfflineReturn(offline) {
    showOfflineReturnOverlay(this, offline);
  }

  showStartOverlay() {
    showStartOverlayUI(this, () => this.startGame());
  }

  startGame() {
    if (this.gameStarted) {
      return;
    }

    this.gameStarted = true;
    destroyStartOverlay(this);
    this.renderState();
    this.setActivePage(this.activePage);
  }
}
