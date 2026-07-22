import Phaser from 'phaser';
import { LOOP_CONFIG, SCENE_KEY } from '../config/gameConfig.js';
import { COLORS, FONT_FAMILIES, UI_LAYOUT } from '../config/theme.js';
import { UI_TEXT } from '../config/uiText.js';
import { META_UPGRADES } from '../data/metaUpgrades.js';
import { CLICKER_GENERATORS } from '../data/generators.js';
import { CLICK_UPGRADES } from '../data/upgrades.js';
import { createClickerController, formatCoins, getAutoTapCursorCount } from '../lib/clickerMath.js';
import { createFeedbackService } from '../services/feedbackService.js';
import { loadGameState, saveGameState } from '../services/saveStorage.js';
import { loadSettings, saveSettings } from '../services/settingsStorage.js';
import { getNavHeight } from '../ui/bottomNavigation.js';
import { createAutoTapCursorLayer } from '../ui/autoTapCursors.js';
import { getMetaUpgradeEffectText } from '../ui/metaUpgradeCopy.js';
import handCursorUrl from '../assets/hand-cursor.png';
import {
  destroyStartOverlay,
  showOfflineReturn as showOfflineReturnOverlay,
  showPrestigeConfirm,
  showStartOverlay as showStartOverlayUI,
} from './clicker/overlays.js';
import {
  applyWallClockProgress as applyWallClockProgressHelper,
  bindLifecyclePersistence,
  flushProgressAndSave as flushProgressAndSaveHelper,
} from './clicker/wallClock.js';
import {
  renderStoreRows,
  updateMetaListLayout as refreshMetaListLayout,
  updateStoreListLayout,
} from './clicker/listRender.js';
import {
  beginPageSwipe as beginPageSwipeHelper,
  setActivePage as setActivePageHelper,
  setupPageSwipe,
  PAGE,
  SETTINGS_PAGE,
} from './clicker/pageNavigation.js';
import { normalizeBuyAmount } from '../config/buyAmounts.js';
import {
  createMetaUpgradePage,
  createPrestigePage,
  createSettingsChrome,
  createStatusPage,
  createStorePage,
  setupListInteraction,
} from './clicker/createPages.js';

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
      maxOfflineSeconds: LOOP_CONFIG.maxOfflineSeconds ?? Number.POSITIVE_INFINITY,
    });
    this.state = this.engine.state;
    this.settings = loadSettings();
    this.feedback = createFeedbackService(this, this.settings);
    this.gameStarted = hasSave;

    const width = this.scale.width;
    const height = this.scale.height;

    this.activePage = PAGE.TAP;
    this.navHeight = getNavHeight();
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

      if (!this.gameStarted || moved || this.activePage !== PAGE.TAP) {
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

    createStorePage(this);
    createMetaUpgradePage(this);
    createStatusPage(this);
    createPrestigePage(this);
    createSettingsChrome(this);
    setupListInteraction(this);
    setupPageSwipe(this);
    this.setActivePage(PAGE.TAP);
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

  setBuyAmount(amount) {
    this.settings.buyAmount = normalizeBuyAmount(amount);
    saveSettings(this.settings);
    this.buyAmountBar?.refresh(this.settings.buyAmount);
    this.renderState();
  }

  buyStoreUpgrade(upgrade) {
    if (!this.gameStarted || this.activePage !== PAGE.STORE) {
      return;
    }
    this.tryBuyUpgrade(upgrade.id, this.settings.buyAmount);
  }

  buyMetaUpgrade(meta) {
    if (!this.gameStarted || this.activePage !== PAGE.UPGRADE) {
      return;
    }

    const result = this.engine.tryBuyMetaUpgrade(meta.id);
    if (!result.ok) {
      this.cameras.main.shake(120, 0.004);
      return;
    }

    this.feedback.playPurchase();
    this.feedback.spawnFloatingText(getMetaUpgradeEffectText(meta), COLORS.positiveText, 520);
    this.renderState();
    this.persist();
  }

  requestPrestige() {
    if (!this.gameStarted || this.activePage !== PAGE.PRESTIGE || this.confirmDialog) {
      return;
    }
    const preview = this.engine.getPrestigePreview();
    if (preview.ascensionTokensGain <= 0) {
      this.cameras.main.shake(120, 0.004);
      return;
    }
    showPrestigeConfirm(this, () => this.doPrestige());
  }

  doPrestige() {
    if (!this.gameStarted || this.activePage !== PAGE.PRESTIGE) {
      return;
    }
    const result = this.engine.tryPrestige();
    if (!result.ok) {
      this.cameras.main.shake(120, 0.004);
      return;
    }
    this.feedback.playPurchase();
    this.feedback.spawnFloatingText(
      `+${result.tokensGained} ${UI_TEXT.ascensionTokens}`,
      COLORS.accentText,
      520,
    );
    this.renderState();
    this.persist();
  }

  tryBuyUpgrade(upgradeId, buyAmount = 1, options = {}) {
    if (!this.gameStarted) {
      return false;
    }

    const result = this.engine.tryBuyUpgrade(upgradeId, buyAmount);

    if (!result.ok) {
      if (options.shakeOnFailure !== false) {
        this.cameras.main.shake(120, 0.004);
      }
      return false;
    }

    this.feedback.playPurchase();
    this.renderState();
    this.persist();
    return true;
  }

  toggleSetting(settingKey) {
    if (!this.gameStarted || this.activePage !== SETTINGS_PAGE) {
      return;
    }

    this.settings[settingKey] = !this.settings[settingKey];
    saveSettings(this.settings);
    this.renderSettings();
  }

  toggleSettingsPage() {
    if (!this.gameStarted || this.offlineReturn || this.confirmDialog) {
      return;
    }

    if (this.activePage === SETTINGS_PAGE) {
      this.setActivePage(this.previousMainPage ?? PAGE.TAP);
      return;
    }

    this.previousMainPage = this.activePage;
    this.setActivePage(SETTINGS_PAGE);
  }

  selectPage(index) {
    if (this.offlineReturn || this.confirmDialog) {
      return;
    }
    if (this.activePage === SETTINGS_PAGE && index !== SETTINGS_PAGE) {
      this.previousMainPage = index;
    }
    if (this.gameStarted) {
      this.setActivePage(index);
    }
  }

  refreshStatusList() {
    if (!this.statusView || !this.statusScroll) {
      return;
    }
    const listHeight = this.statusView.refresh(this.state, this.engine.getMultiplierBreakdown());
    this.statusScroll.items = this.statusView.items;
    this.statusScroll.updateMetrics(listHeight);
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
    this.statsText.setText(
      `per tap: ${formatCoins(this.state.perClick)} | coins / sec: ${formatCoins(this.state.perSecond)}`,
    );
    this.fitHudText(this.coinsText);
    this.fitHudText(this.statsText);
    this.renderSettings();
    updateStoreListLayout(this);
    renderStoreRows(this);
    refreshMetaListLayout(this);
    if (this.activePage === PAGE.STATUS) {
      this.refreshStatusList();
    }
    if (this.activePage === PAGE.PRESTIGE) {
      this.prestigeView?.refresh(this.state, this.engine.getPrestigePreview());
    }
  }

  updateMetaListLayout() {
    refreshMetaListLayout(this);
  }

  update() {
    this.applyWallClockProgress();

    const onTapPage = this.gameStarted && this.activePage === PAGE.TAP;
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
