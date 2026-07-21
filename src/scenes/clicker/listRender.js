import { COLORS } from '../../config/theme.js';
import { UI_TEXT } from '../../config/uiText.js';
import { formatCoins, isMetaUpgradeUnlocked, isUpgradeUnlocked } from '../../lib/clickerMath.js';
import { getMetaUpgradeConditionText, getMetaUpgradeEffectText } from '../../ui/metaUpgradeCopy.js';
import { getAutoTapEffectLabel } from '../../ui/autoTapCursors.js';

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
    const objects = [item.rowBg, item.label, item.info, item.buyButton, item.buyText];

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
  scene.upgradeScroll.updateMetrics(listHeight);
}

export function updateMetaListLayout(scene) {
  const { rowHeight, rowGap, listTop } = scene.boostLayout;
  const step = rowHeight + rowGap;
  const visibleBoosts = scene.state.boosts.filter((boost) => isMetaUpgradeUnlocked(scene.state, boost));
  scene.boostEmptyText.setVisible(scene.activePage === 2 && visibleBoosts.length === 0);

  let visibleIndex = 0;
  scene.boostItems.forEach((item) => {
    const boost = scene.state.boosts.find((entry) => entry.id === item.id);
    const available = isMetaUpgradeUnlocked(scene.state, boost);
    const objects = [item.background, item.name, item.condition, item.effect, item.buyButton, item.buyText];
    objects.forEach((object) => object.setVisible(available));

    if (item.buyButton.input) {
      item.buyButton.input.enabled = available;
    }

    if (!available) {
      item.baseY = null;
      return;
    }

    item.baseY = listTop + rowHeight / 2 + visibleIndex * step;
    const canBuy = scene.state.coins.gte(boost.cost);
    item.condition.setText(getMetaUpgradeConditionText(boost));
    item.condition.setColor(COLORS.mutedText);
    item.effect.setText(getMetaUpgradeEffectText(boost));
    item.buyText.setText(formatCoins(boost.cost));
    item.buyButton.setFillStyle(canBuy ? COLORS.primary : COLORS.disabled);
    item.buyButton.setStrokeStyle(2, canBuy ? COLORS.primaryBorder : COLORS.disabledBorder);
    item.buyText.setColor(canBuy ? COLORS.primaryText : COLORS.disabledText);
    visibleIndex += 1;
  });

  const listHeight = visibleIndex > 0 ? visibleIndex * rowHeight + (visibleIndex - 1) * rowGap : 0;
  scene.boostScroll.updateMetrics(listHeight);
}

export function renderStoreRows(scene) {
  scene.upgradeItems.forEach((item) => {
    const upgrade = scene.state.upgrades.find((entry) => entry.id === item.id);
    const cost = scene.engine.getUpgradeCost(item.id);
    if (item.isLockedPreview) {
      item.label.setText('???');
      item.info.setText(UI_TEXT.unlockHint);
      item.rowBg.setFillStyle(COLORS.lockedRow, 0.95).setStrokeStyle(2, COLORS.lockedRowBorder);
      item.label.setColor(COLORS.lockedText);
      item.info.setColor(COLORS.lockedInfo);
      item.buyButton.setFillStyle(COLORS.lockedButton).setStrokeStyle(2, COLORS.lockedButtonBorder);
      item.buyText.setText(UI_TEXT.locked).setColor(COLORS.lockedButtonText);
      return;
    }

    const canBuy = scene.state.coins.gte(cost);
    const effectLabel =
      upgrade.type === 'click'
        ? UI_TEXT.tapPowerEffect.replace('{value}', String(upgrade.baseValue))
        : upgrade.type === 'auto_tap'
          ? getAutoTapEffectLabel(upgrade)
          : UI_TEXT.generatorEffect.replace('{value}', String(upgrade.baseValue));

    item.rowBg.setFillStyle(COLORS.upgradeRow, 0.95).setStrokeStyle(2, COLORS.upgradeRowBorder);
    item.label.setColor(COLORS.upgradeText);
    item.info.setColor(COLORS.upgradeInfo);
    item.label.setText(`${upgrade.label} Lv.${upgrade.level}`);
    item.info.setText(`${effectLabel}  |  cost ${formatCoins(cost)}`);
    item.buyText.setText(UI_TEXT.buy);

    item.buyButton.setFillStyle(canBuy ? COLORS.primary : COLORS.unavailableButton);
    item.buyText.setColor(canBuy ? COLORS.primaryText : COLORS.unavailableText);
  });
}
