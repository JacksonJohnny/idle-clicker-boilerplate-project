import { AUTO_TAP_INTERVAL_SECONDS } from '../data/upgrades.js';
import { UI_TEXT } from '../config/uiText.js';
import {
  AUTO_TAP_CURSOR_ARC,
  AUTO_TAP_CURSOR_DISPLAY_H,
  AUTO_TAP_CURSOR_TINTS,
  AUTO_TAP_ORBIT_RADIUS,
  AUTO_TAP_RING_GAP,
  AUTO_TAP_VISUAL_RING_COUNT,
  getAutoTapCursorTint,
  getMaxAutoTapCursorSlots,
} from '../lib/autoTapProgress.js';

const HAND_CURSOR_KEY = 'hand-cursor';
const CURSOR_DISPLAY_W = 40;
const CURSOR_DISPLAY_H = AUTO_TAP_CURSOR_DISPLAY_H;
const ORBIT_RADIUS = AUTO_TAP_ORBIT_RADIUS;
const RING_GAP = AUTO_TAP_RING_GAP;
const VISUAL_RING_COUNT = AUTO_TAP_VISUAL_RING_COUNT;
const CURSOR_ARC = AUTO_TAP_CURSOR_ARC;
const CLICK_PULL = 34;

export { AUTO_TAP_CURSOR_TINTS, getMaxAutoTapCursorSlots };

function ringCapacity(radius) {
  return Math.max(12, Math.floor((Math.PI * 2 * radius) / CURSOR_ARC));
}

export function createAutoTapCursorLayer(scene, centerX, centerY) {
  const layer = scene.add.container(0, 0).setDepth(20);
  const cursors = [];
  const pulls = [];
  const maxSlots = getMaxAutoTapCursorSlots();
  let nextClickIndex = 0;

  function layoutForIndex(index) {
    let remaining = index;
    let ring = 0;

    while (ring < VISUAL_RING_COUNT) {
      const radius = ORBIT_RADIUS + ring * RING_GAP;
      const capacity = ringCapacity(radius);

      if (remaining < capacity) {
        return { ring, slot: remaining, capacity, radius };
      }

      remaining -= capacity;
      ring += 1;
    }

    const radius = ORBIT_RADIUS + (VISUAL_RING_COUNT - 1) * RING_GAP;
    return {
      ring: VISUAL_RING_COUNT - 1,
      slot: remaining,
      capacity: ringCapacity(radius),
      radius,
    };
  }

  function createCursor() {
    const cursor = scene.add
      .image(centerX, centerY, HAND_CURSOR_KEY)
      .setDisplaySize(CURSOR_DISPLAY_W, CURSOR_DISPLAY_H)
      .setOrigin(0.5, 0.08)
      .setDepth(20);
    cursors.push(cursor);
    pulls.push({ amount: 0 });
    layer.add(cursor);
    return cursor;
  }

  function sync(count) {
    while (cursors.length < count) {
      createCursor();
    }

    while (cursors.length > count) {
      const cursor = cursors.pop();
      const pull = pulls.pop();
      scene.tweens.killTweensOf(pull);
      cursor.destroy();
    }

    if (cursors.length > 0) {
      nextClickIndex %= cursors.length;
    } else {
      nextClickIndex = 0;
    }

    cursors.forEach((cursor) => cursor.setVisible(count > 0));
  }

  function updateOrbit(level, timeMs) {
    const safeLevel = Math.max(0, level | 0);
    const count = Math.min(safeLevel, maxSlots);
    sync(count);

    if (count <= 0) {
      return;
    }

    const spin = timeMs / 1000;
    cursors.forEach((cursor, index) => {
      const { slot, capacity, radius: ringRadius } = layoutForIndex(index);
      const angle = spin * 0.7 + (slot / capacity) * Math.PI * 2;
      const radius = ringRadius - (pulls[index]?.amount ?? 0);
      cursor.setVisible(true);
      cursor.setTint(getAutoTapCursorTint(safeLevel, index, maxSlots));
      cursor.x = centerX + Math.cos(angle) * radius;
      cursor.y = centerY + Math.sin(angle) * radius;
      cursor.rotation = angle - Math.PI / 2;
    });
  }

  // Cookie Clicker style: jab toward the button, one cursor at a time, clockwise.
  function playClicks(tapCount = 1, onEachClick) {
    if (cursors.length === 0 || tapCount <= 0) {
      return;
    }

    const total = Math.max(1, tapCount | 0);

    for (let i = 0; i < total; i += 1) {
      const index = (nextClickIndex + i) % cursors.length;
      const pull = pulls[index];
      const delay = i * 110;
      scene.tweens.killTweensOf(pull);
      pull.amount = 0;
      scene.tweens.add({
        targets: pull,
        amount: CLICK_PULL,
        duration: 85,
        yoyo: true,
        ease: 'Quad.Out',
        delay,
        onStart: () => {
          onEachClick?.(index, i);
        },
      });
    }

    nextClickIndex = (nextClickIndex + total) % cursors.length;
  }

  return { layer, updateOrbit, sync, playClicks, maxSlots };
}

export function getAutoTapEffectLabel(upgrade) {
  return UI_TEXT.autoTapEffect
    .replace('{value}', String(upgrade.baseValue))
    .replace('{seconds}', String(AUTO_TAP_INTERVAL_SECONDS));
}
