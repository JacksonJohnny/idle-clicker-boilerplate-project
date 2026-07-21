import { COLORS, FONT_FAMILIES } from '../config/theme.js';

export function buildBoostsView({ scene, container, boosts, layout, onPointerDown, onBuy }) {
  const width = scene.scale.width;
  const { rowHeight, listTop } = layout;
  const buyButtonWidth = 148;
  const buyButtonHeight = 58;
  const buyButtonX = width - buyButtonWidth / 2 - 34;

  return boosts.map((boost) => {
    const y = listTop + rowHeight / 2;
    const background = scene.add.rectangle(width / 2, y, width - 58, rowHeight, COLORS.panel, 0.96).setStrokeStyle(2, COLORS.panelBorder);
    const name = scene.add
      .text(38, y - 22, boost.name, { fontFamily: FONT_FAMILIES.display, fontSize: '18px', color: COLORS.text })
      .setOrigin(0, 0.5);
    const condition = scene.add
      .text(38, y + 8, '', { fontFamily: FONT_FAMILIES.body, fontSize: '15px', color: COLORS.mutedText })
      .setOrigin(0, 0.5);
    const effect = scene.add
      .text(38, y + 30, '', { fontFamily: FONT_FAMILIES.body, fontSize: '15px', color: COLORS.upgradeInfo })
      .setOrigin(0, 0.5);
    const buyButton = scene.add
      .rectangle(buyButtonX, y, buyButtonWidth, buyButtonHeight, COLORS.primary)
      .setStrokeStyle(2, COLORS.primaryBorder)
      .setInteractive({ useHandCursor: true });
    const buyText = scene.add
      .text(buyButtonX, y, '', { fontFamily: FONT_FAMILIES.display, fontSize: '16px', color: COLORS.primaryText })
      .setOrigin(0.5);

    buyButton.on('pointerdown', (pointer) => {
      buyButton.pointerDownAt = { x: pointer.x, y: pointer.y };
      onPointerDown(pointer);
    });
    buyButton.on('pointerup', (pointer) => {
      const start = buyButton.pointerDownAt;
      const moved = start && Math.hypot(pointer.x - start.x, pointer.y - start.y) > 14;
      buyButton.pointerDownAt = null;
      if (!moved) {
        onBuy(boost);
      }
    });

    const item = { id: boost.id, baseY: y, background, name, condition, effect, buyButton, buyText };
    container.add([background, name, condition, effect, buyButton, buyText]);
    return item;
  });
}
