import { COLORS, FONT_FAMILIES, UI_LAYOUT } from '../config/theme.js';
import { UI_TEXT } from '../config/uiText.js';

function createToggle(scene, label, description, settingKey, y, onToggle) {
  const width = scene.scale.width;
  const background = scene.add.rectangle(width / 2, y, width - 48, 78, COLORS.panel, 0.96).setStrokeStyle(2, COLORS.panelBorder);
  const labelText = scene.add
    .text(44, y - 14, label, { fontFamily: FONT_FAMILIES.display, fontSize: '19px', color: COLORS.text })
    .setOrigin(0, 0.5);
  const descriptionText = scene.add
    .text(44, y + 18, description, { fontFamily: FONT_FAMILIES.body, fontSize: '16px', color: COLORS.mutedText })
    .setOrigin(0, 0.5);
  const toggleX = width - 84;
  const toggle = scene.add.rectangle(toggleX, y, 92, 46, COLORS.success).setStrokeStyle(2, COLORS.successBorder);
  const valueText = scene.add
    .text(toggleX, y, '', { fontFamily: FONT_FAMILIES.display, fontSize: '16px', color: COLORS.successText })
    .setOrigin(0.5);
  const hitArea = scene.add.zone(toggleX, y, 112, 66).setInteractive({ useHandCursor: true });
  hitArea.on('pointerup', () => onToggle(settingKey));
  return { settingKey, background, label: labelText, description: descriptionText, toggle, valueText, hitArea };
}

export function buildSettingsView({ scene, container, onToggle }) {
  const title = scene.add
    .text(28, UI_LAYOUT.sectionTitleY, UI_TEXT.settingsTitle, {
      fontFamily: FONT_FAMILIES.display,
      fontSize: '24px',
      color: COLORS.accentText,
    })
    .setOrigin(0, 0.5);
  const items = [
    createToggle(scene, UI_TEXT.sound, UI_TEXT.soundDescription, 'soundEnabled', 340, onToggle),
    createToggle(scene, UI_TEXT.vibration, UI_TEXT.vibrationDescription, 'vibrationEnabled', 438, onToggle),
  ];
  const objects = [title];
  items.forEach((item) => objects.push(item.background, item.label, item.description, item.toggle, item.valueText, item.hitArea));
  container.add(objects);
  return items;
}

export function buildSettingsButton(scene, onToggle) {
  const x = scene.scale.width - 38;
  const y = 48;
  const background = scene.add
    .circle(x, y, 26, 0x000000, 0)
    .setStrokeStyle(1.5, COLORS.accent, 0.9)
    .setInteractive({ useHandCursor: true })
    .setDepth(1100);
  const icon = scene.add
    .text(x, y, '⚙', { fontFamily: FONT_FAMILIES.body, fontSize: '25px', color: COLORS.accentText, fontStyle: '800' })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setDepth(1101);
  background.on('pointerup', onToggle);
  icon.on('pointerup', onToggle);
  return { background, icon };
}