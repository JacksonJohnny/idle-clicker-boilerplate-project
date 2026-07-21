import { formatCoins } from '../lib/clickerMath.js';
import { UI_TEXT } from '../config/uiText.js';

/** Player-facing copy for meta-upgrades (kept out of the economy module). */
export function getMetaUpgradeConditionText(boost) {
  if (boost.kind === 'generator') {
    return UI_TEXT.metaOwnGenerator
      .replace('{count}', String(boost.requiredOwned))
      .replace('{label}', boost.targetLabel ?? UI_TEXT.metaFallbackUpgrade);
  }

  if (boost.kind === 'global') {
    return UI_TEXT.metaOwnTotal.replace('{count}', String(boost.requiredTotalOwned));
  }

  if (boost.kind === 'click_cps') {
    return UI_TEXT.metaReachTaps.replace('{count}', formatCoins(boost.requiredClicks));
  }

  if (boost.kind === 'synergy') {
    return UI_TEXT.metaOwnPaired
      .replace('{left}', String(boost.requiredOwnedLeft))
      .replace('{right}', String(boost.requiredOwnedRight));
  }

  return '';
}

export function getMetaUpgradeEffectText(boost) {
  if (boost.kind === 'generator') {
    return UI_TEXT.metaEffectGenerator
      .replace('{label}', boost.targetLabel ?? UI_TEXT.metaFallbackUpgrade)
      .replace('{mult}', String(boost.multiplier));
  }

  if (boost.kind === 'global') {
    return UI_TEXT.metaEffectGlobal.replace('{mult}', String(boost.multiplier));
  }

  if (boost.kind === 'click_cps') {
    return UI_TEXT.metaEffectClickCps.replace('{pct}', String(boost.clickCpsShare * 100));
  }

  if (boost.kind === 'synergy') {
    return UI_TEXT.metaEffectSynergy;
  }

  return '';
}
