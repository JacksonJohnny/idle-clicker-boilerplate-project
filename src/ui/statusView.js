import { COLORS, FONT_FAMILIES, UI_LAYOUT } from '../config/theme.js';
import { UI_TEXT } from '../config/uiText.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { formatCoins } from '../lib/clickerMath.js';
import { createAscensionTokenBadge } from './ascensionTokenBadge.js';

const LINE_HEIGHT = 28;

function fill(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

export function buildStatusView({ scene, content, listTop }) {
  const title = scene.add
    .text(28, UI_LAYOUT.sectionTitleY, UI_TEXT.statusTitle, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '24px',
      color: COLORS.accentText,
    })
    .setOrigin(0, 0.5);

  const items = [];

  function clearItems() {
    items.forEach((item) => {
      (item.nodes ?? [item.node]).forEach((node) => node.destroy());
    });
    items.length = 0;
  }

  function pushLine(text, style = {}) {
    const index = items.length;
    const y = listTop + index * LINE_HEIGHT;
    const node = scene.add
      .text(28, y, text, {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '16px',
        color: COLORS.overlayText,
        ...style,
      })
      .setOrigin(0, 0);
    content.add(node);
    items.push({ baseY: y, offsetY: 0, node, nodes: [node] });
  }

  function pushTokenMultLine(mult, count) {
    const index = items.length;
    const baseY = listTop + index * LINE_HEIGHT;
    const midY = baseY + 8;
    const badge = createAscensionTokenBadge(scene, 28, midY, {
      size: 12,
      showLabel: false,
    });
    const node = scene.add
      .text(badge.endX + 8, midY, fill(UI_TEXT.statusTokenMult, { mult: mult.toFixed(2), count }), {
        fontFamily: FONT_FAMILIES.body,
        fontSize: '16px',
        color: COLORS.overlayText,
      })
      .setOrigin(0, 0.5);
    content.add([...badge.nodes, node]);
    items.push({ baseY, offsetY: 8, node, nodes: [...badge.nodes, node] });
  }

  return {
    title,
    items,
    lineHeight: LINE_HEIGHT,
    refresh(state, breakdown) {
      clearItems();

      const owned = state.upgrades.filter((u) => u.type === 'auto').reduce((n, u) => n + u.level, 0);
      const unlocked = new Set(state.unlockedAchievements ?? []);
      const metaMult = breakdown?.metaMultiplier ?? 1;
      const achievementMult = breakdown?.achievementMultiplier ?? 1;
      const tokenMult = breakdown?.ascensionTokensMultiplier ?? 1;
      const combined = breakdown?.productionMultiplier ?? 1;
      const tokenCount = breakdown?.ascensionTokens ?? state.ascensionTokens ?? 0;

      pushLine(UI_TEXT.statusGeneral, { fontFamily: FONT_FAMILIES.display, fontSize: '18px', color: COLORS.accentText });
      pushLine(fill(UI_TEXT.statusCoinsBank, { coins: formatCoins(state.coins) }));
      pushLine(fill(UI_TEXT.statusCoinsPrestige, { coins: formatCoins(state.coinsThisAscension) }));
      pushLine(fill(UI_TEXT.statusCoinsAllTime, { coins: formatCoins(state.totalCoinsEarned) }));
      pushLine(fill(UI_TEXT.statusGeneratorsOwned, { count: owned }));
      pushLine(fill(UI_TEXT.statusIdleRate, { rate: formatCoins(state.perSecond) }));
      pushLine(fill(UI_TEXT.statusPerTap, { rate: formatCoins(state.perClick) }));
      pushLine(fill(UI_TEXT.statusTotalTaps, { count: formatCoins(state.totalClicks) }));
      pushLine('');

      pushLine(UI_TEXT.statusMultipliers, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '18px',
        color: COLORS.accentText,
      });
      pushLine(fill(UI_TEXT.statusMetaMult, { mult: Number(metaMult).toFixed(2) }));
      pushLine(fill(UI_TEXT.statusAchievementMult, { mult: Number(achievementMult).toFixed(2) }));
      pushTokenMultLine(Number(tokenMult), tokenCount);
      pushLine(fill(UI_TEXT.statusCombinedMult, { mult: Number(combined).toFixed(2) }));
      pushLine('');

      pushLine(`${UI_TEXT.statusAchievements} ${unlocked.size}/${ACHIEVEMENTS.length}`, {
        fontFamily: FONT_FAMILIES.display,
        fontSize: '18px',
        color: COLORS.accentText,
      });

      ACHIEVEMENTS.forEach((achievement) => {
        const done = unlocked.has(achievement.id);
        if (done) {
          pushLine(`✓ ${achievement.name}  (+${Math.round(achievement.idleBonus * 100)}% idle)`, {
            color: COLORS.positiveText,
          });
          pushLine(`   ${achievement.description}`, {
            fontSize: '14px',
            color: COLORS.mutedText,
          });
          return;
        }

        pushLine('○ ???', { color: COLORS.mutedText });
      });

      return items.length * LINE_HEIGHT;
    },
  };
}
