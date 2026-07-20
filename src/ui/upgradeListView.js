import { COLORS, FONT_FAMILIES } from '../config/theme.js';

export function buildUpgradeListView({ scene, container, upgrades, layout, onPointerDown, onPointerUp }) {
  const { rowHeight, rowGap, compactRows, listTop } = layout;
  const step = rowHeight + rowGap;
  const startY = listTop + rowHeight / 2;
  const labelFontSize = compactRows ? '20px' : '24px';
  const infoFontSize = compactRows ? '16px' : '20px';
  const buyButtonWidth = compactRows ? 130 : 146;
  const buyButtonHeight = compactRows ? 48 : 56;
  const buyButtonX = scene.scale.width - buyButtonWidth / 2 - 34;
  const buyFontSize = compactRows ? '18px' : '20px';

  return upgrades.map((upgrade, index) => {
    const y = startY + index * step;
    const rowBg = scene.add.rectangle(scene.scale.width / 2, y, scene.scale.width - 58, rowHeight, 0x133046, 0.95).setStrokeStyle(2, 0x3f7ca4);
    const label = scene.add
      .text(38, y - rowHeight * 0.22, '', {
        fontFamily: FONT_FAMILIES.body,
        fontSize: labelFontSize,
        color: '#f4f7fa',
        fontStyle: '700',
      })
      .setOrigin(0, 0.5);
    const info = scene.add
      .text(38, y + rowHeight * 0.22, '', {
        fontFamily: FONT_FAMILIES.body,
        fontSize: infoFontSize,
        color: '#9dd7ff',
      })
      .setOrigin(0, 0.5);
    const stars = (upgrade.milestones ?? []).map(() =>
      scene.add
        .text(0, y - rowHeight * 0.22, '★', {
          fontFamily: FONT_FAMILIES.body,
          fontSize: '15px',
          color: '#ffd43b',
        })
        .setOrigin(0, 0.5)
        .setVisible(false),
    );
    const buyButton = scene.add
      .rectangle(buyButtonX, y, buyButtonWidth, buyButtonHeight, COLORS.primary)
      .setStrokeStyle(2, COLORS.primaryBorder)
      .setInteractive({ useHandCursor: true });
    const buyText = scene.add
      .text(buyButtonX, y, 'BUY', {
        fontFamily: FONT_FAMILIES.display,
        fontSize: buyFontSize,
        color: COLORS.primaryText,
      })
      .setOrigin(0.5);

    buyButton.on('pointerdown', (pointer) => {
      buyButton.pointerDownAt = { x: pointer.x, y: pointer.y };
      onPointerDown(upgrade, pointer);
    });
    buyButton.on('pointerup', (pointer) => {
      const start = buyButton.pointerDownAt;
      const moved = start && Math.hypot(pointer.x - start.x, pointer.y - start.y) > 14;
      buyButton.pointerDownAt = null;
      onPointerUp(upgrade, pointer, moved);
    });

    const item = { id: upgrade.id, baseY: y, rowBg, label, info, stars, buyButton, buyText };
    container.add([rowBg, label, info, ...stars, buyButton, buyText]);
    return item;
  });
}