import { COLORS, FONT_FAMILIES } from '../config/theme.js';
import { UI_TEXT } from '../config/uiText.js';

export function buildBottomNavigation({ scene, navTop, navHeight, onSelect }) {
  const width = scene.scale.width;
  const tabWidth = width / UI_TEXT.tabs.length;
  const container = scene.add.container(0, 0).setDepth(1000);
  const background = scene.add.rectangle(width / 2, navTop + navHeight / 2, width, navHeight, COLORS.nav, 0.98).setStrokeStyle(2, COLORS.navBorder);
  container.add(background);

  return UI_TEXT.tabs.map((label, index) => {
    const x = tabWidth * index + tabWidth / 2;
    const indicator = scene.add.rectangle(x, navTop + 6, tabWidth - 24, 4, 0xffc857).setOrigin(0.5, 0);
    const hitArea = scene.add.zone(x, navTop + navHeight / 2, tabWidth, navHeight).setInteractive({ useHandCursor: true });
    const text = scene.add
      .text(x, navTop + 47, label, { fontFamily: FONT_FAMILIES.body, fontSize: '18px', color: COLORS.inactiveText, fontStyle: '800' })
      .setOrigin(0.5);
    hitArea.on('pointerup', () => onSelect(index));
    container.add([indicator, hitArea, text]);
    return { indicator, text };
  });
}