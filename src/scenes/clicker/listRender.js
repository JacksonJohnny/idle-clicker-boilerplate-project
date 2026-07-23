import { COLORS } from '../../config/theme.js';
import { UI_TEXT } from '../../config/uiText.js';
import {
  formatCoins,
  formatIdleSharePercent,
  getGeneratorEfficiencyStarCount,
  getGeneratorIdleShare,
  isMetaUpgradeUnlocked,
  isUpgradeUnlocked,
} from '../../lib/clickerMath.js';
import { getMetaUpgradeConditionText, getMetaUpgradeEffectText } from '../../ui/metaUpgradeCopy.js';
import { getAutoTapEffectLabel } from '../../ui/autoTapCursors.js';
import Decimal from 'decimal.js';

import { PAGE } from './pageNavigation.js';

function compareByCostAsc(a, b) {
  if (a.cost.lt(b.cost)) {
    return -1;
  }
  if (a.cost.gt(b.cost)) {
    return 1;
  }
  return a.index - b.index;
}

export function updateStoreListLayout(scene) {
  const { rowHeight, rowGap, listTop } = scene.upgradeLayout;
  const step = rowHeight + rowGap;
  const nextLockedUpgrade = scene.state.upgrades.find((upgrade) => !isUpgradeUnlocked(upgrade, scene.state.upgrades));
  let visibleIndex = 0;

  scene.upgradeItems.forEach((item) => {
    const upgrade = scene.state.upgrades.find((entry) => entry.id === item.id);
    const unlocked = isUpgradeUnlocked(upgrade, scene.state.upgrades);
    item.isLockedPreview = !unlocked && item.id === nextLockedUpgrade?.id;
    const visible = unlocked || item.isLockedPreview;
    const objects = [
      item.rowBg,
      item.label,
      item.level,
      item.info,
      ...(item.stars ?? []),
      item.buyButton,
      item.buyText,
    ];

    objects.forEach((object) => object?.setVisible(visible));
    if (item.buyButton.input) {
      item.buyButton.input.enabled = unlocked;
    }

    if (!visible) {
      item.baseY = null;
      return;
    }

    item.baseY = listTop + rowHeight / 2 + visibleIndex * step;
    visibleIndex += 1;
  });

  const listHeight = visibleIndex > 0 ? visibleIndex * rowHeight + (visibleIndex - 1) * rowGap : 0;
  scene.upgradeScroll.updateMetrics(listHeight);
}

export function updateMetaListLayout(scene) {
  const { rowHeight, rowGap, listTop } = scene.metaLayout;
  const step = rowHeight + rowGap;
  const visibleMeta = scene.state.boosts.filter((meta) => isMetaUpgradeUnlocked(scene.state, meta));
  scene.metaEmptyText.setVisible(scene.activePage === PAGE.UPGRADE && visibleMeta.length === 0);

  const availableRows = [];

  scene.metaItems.forEach((item, index) => {
    const meta = scene.state.boosts.find((entry) => entry.id === item.id);
    const available = isMetaUpgradeUnlocked(scene.state, meta);
    const objects = [item.background, item.name, item.condition, item.effect, item.buyButton, item.buyText];
    objects.forEach((object) => object.setVisible(available));

    if (item.buyButton.input) {
      item.buyButton.input.enabled = available;
    }

    if (!available) {
      item.baseY = null;
      return;
    }

    const cost = new Decimal(meta.cost).floor();
    const canBuy = scene.state.coins.gte(cost);
    item.condition.setText(getMetaUpgradeConditionText(meta));
    item.condition.setColor(COLORS.mutedText);
    item.effect.setText(getMetaUpgradeEffectText(meta));
    item.buyText.setText(formatCoins(cost));
    item.buyButton.setFillStyle(canBuy ? COLORS.primary : COLORS.disabled);
    item.buyButton.setStrokeStyle(2, canBuy ? COLORS.primaryBorder : COLORS.disabledBorder);
    item.buyText.setColor(canBuy ? COLORS.primaryText : COLORS.disabledText);
    availableRows.push({ item, cost, index });
  });

  availableRows.sort(compareByCostAsc);
  availableRows.forEach((row, visibleIndex) => {
    row.item.baseY = listTop + rowHeight / 2 + visibleIndex * step;
  });

  const visibleCount = availableRows.length;
  const listHeight = visibleCount > 0 ? visibleCount * rowHeight + (visibleCount - 1) * rowGap : 0;
  scene.metaScroll.updateMetrics(listHeight);
}

export function renderStoreRows(scene) {
  const buyAmount = scene.settings?.buyAmount ?? 1;
  scene.upgradeItems.forEach((item) => {
    const upgrade = scene.state.upgrades.find((entry) => entry.id === item.id);
    const preview = scene.engine.getUpgradeBuyPreview(item.id, buyAmount);
    const cost = preview?.cost ?? scene.engine.getUpgradeCost(item.id, buyAmount);
    if (item.isLockedPreview) {
      item.label.setText('???');
      item.level?.setText('').setVisible(false);
      item.info.setText(UI_TEXT.unlockHint);
      item.rowBg.setFillStyle(COLORS.lockedRow, 0.95).setStrokeStyle(2, COLORS.lockedRowBorder);
      item.label.setColor(COLORS.lockedText);
      item.info.setColor(COLORS.lockedInfo);
      item.buyButton.setFillStyle(COLORS.lockedButton).setStrokeStyle(2, COLORS.lockedButtonBorder);
      item.buyText.setText(UI_TEXT.locked).setColor(COLORS.lockedButtonText);
      item.stars?.forEach((star) => star.setVisible(false));
      return;
    }

    const amount = preview?.amount ?? 1;
    const canBuy = preview?.canBuy === true;
    let effectLabel =
      upgrade.type === 'click'
        ? UI_TEXT.tapPowerEffect.replace('{value}', String(upgrade.baseValue))
        : upgrade.type === 'auto_tap'
          ? getAutoTapEffectLabel(upgrade)
          : UI_TEXT.generatorEffect.replace('{value}', String(upgrade.baseValue));

    if (upgrade.type === 'auto') {
      const shareLabel = formatIdleSharePercent(getGeneratorIdleShare(scene.state, upgrade.id));
      if (shareLabel) {
        effectLabel += UI_TEXT.generatorIdleShare.replace('{pct}', shareLabel);
      }
    }

    item.rowBg.setFillStyle(COLORS.upgradeRow, 0.95).setStrokeStyle(2, COLORS.upgradeRowBorder);
    item.label.setColor(COLORS.upgradeText);
    item.level?.setColor(COLORS.upgradeText);
    item.info.setColor(COLORS.upgradeInfo);
    item.label.setText(upgrade.label);
    item.level?.setText(`Lv.${upgrade.level}`).setVisible(item.rowBg.visible);
    item.info.setText(`${effectLabel}  |  cost ${formatCoins(cost)}`);
    item.buyText.setText(amount > 1 ? `BUY ${amount}` : UI_TEXT.buy);

    const starCount = getGeneratorEfficiencyStarCount(scene.state, upgrade.id);
    const starStartX = item.label.x + item.label.width + 10;
    item.stars?.forEach((star, index) => {
      const show = index < starCount && item.rowBg.visible;
      star.setVisible(show);
      if (show) {
        star.x = starStartX + index * 17;
        if (item.level && star.x + 14 > item.level.x - item.level.width - 8) {
          star.x = Math.max(starStartX, item.level.x - item.level.width - 8 - (starCount - 1 - index) * 17);
        }
      }
    });

    item.buyButton.setFillStyle(canBuy ? COLORS.primary : COLORS.unavailableButton);
    item.buyButton.setStrokeStyle(2, canBuy ? COLORS.primaryBorder : COLORS.disabledBorder);
    item.buyText.setColor(canBuy ? COLORS.primaryText : COLORS.unavailableText);
  });
}
