import { COLORS, FONT_FAMILIES, UI_LAYOUT } from '../config/theme.js';
import { UI_TEXT } from '../config/uiText.js';

export function buildBoostsView({ scene, container, boosts, onPointerDown, onBuy }) {
  const width = scene.scale.width;
  const title = scene.add
    .text(28, UI_LAYOUT.sectionTitleY, UI_TEXT.boostsTitle, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '24px',
      color: COLORS.accentText,
    })
    .setOrigin(0, 0.5);
  const objects = [title];
  const items = boosts.map((boost, index) => {
    const y = 348 + index * 122;
    const background = scene.add.rectangle(width / 2, y, width - 48, 98, COLORS.panel, 0.96).setStrokeStyle(2, COLORS.panelBorder);
    const name = scene.add
      .text(44, y - 19, boost.name, { fontFamily: FONT_FAMILIES.display, fontSize: '21px', color: COLORS.text })
      .setOrigin(0, 0.5);
    const condition = scene.add
      .text(44, y + 21, '', { fontFamily: FONT_FAMILIES.body, fontSize: '18px', color: COLORS.mutedText })
      .setOrigin(0, 0.5);
    const buyButton = scene.add
      .rectangle(width - 104, y, 148, 58, COLORS.primary)
      .setStrokeStyle(2, COLORS.primaryBorder)
      .setInteractive({ useHandCursor: true });
    const buyText = scene.add
      .text(width - 104, y, '', { fontFamily: FONT_FAMILIES.display, fontSize: '17px', color: COLORS.primaryText })
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

    objects.push(background, name, condition, buyButton, buyText);
    return { id: boost.id, background, name, condition, buyButton, buyText };
  });

  container.add(objects);
  return items;
}