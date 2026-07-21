const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const AXIS_LOCK_PX = 12;

function defaultSyncItem(item, y, layout) {
  const { rowHeight } = layout;
  item.rowBg.y = y;
  item.label.y = y - rowHeight * 0.22;
  item.info.y = y + rowHeight * 0.22;
  item.buyButton.y = y;
  item.buyText.y = y;
}

export class ListScrollController {
  constructor({ scene, layout, items, isEnabled, onPointerMove, onPointerUp, syncItem }) {
    this.scene = scene;
    this.layout = layout;
    this.items = items;
    this.isEnabled = isEnabled;
    this.onPointerMove = onPointerMove;
    this.onPointerUp = onPointerUp;
    this.syncItem = syncItem ?? defaultSyncItem;
    this.offset = 0;
    this.maxScroll = 0;
    this.thumbHeight = layout.visibleListHeight;
    this.isDragging = false;
    this.activePointerId = null;
    this.lastPointerY = 0;
    this.startX = 0;
    this.startY = 0;
    this.axisLock = null;
    /** Survives until next pointerdown so page-swipe can read it on pointerup. */
    this.lastGestureAxis = null;
  }

  setup() {
    const { scene, layout } = this;
    const trackX = scene.scale.width - 16;

    // Visual-only scrollbar — scroll happens by dragging the list, not the thumb.
    this.track = scene.add
      .rectangle(trackX, (layout.panelTopY + layout.panelBottomY) / 2, 8, layout.visibleListHeight, 0x0b2233, 0.9)
      .setStrokeStyle(1, 0x2f5f7c, 0.9)
      .setDepth(5);
    this.thumb = scene.add
      .rectangle(trackX, layout.listTop + this.thumbHeight / 2, 12, this.thumbHeight, 0x76c5ff, 0.95)
      .setStrokeStyle(1, 0xb5e5ff, 1)
      .setDepth(6);

    scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.isEnabled() || !this.isPointerInside(pointer) || this.maxScroll <= 0) {
        return;
      }
      this.setOffset(this.offset + deltaY * 0.7);
    });

    scene.input.on('pointerdown', (pointer) => {
      if (!this.isEnabled() || !this.isPointerInside(pointer) || this.maxScroll <= 0) {
        return;
      }
      this.isDragging = true;
      this.activePointerId = pointer.id;
      this.startX = pointer.x;
      this.startY = pointer.y;
      this.lastPointerY = pointer.y;
      this.axisLock = null;
      this.lastGestureAxis = null;
    });

    scene.input.on('pointermove', (pointer) => {
      this.onPointerMove?.(pointer);
      if (!this.isDragging || !pointer.isDown || pointer.id !== this.activePointerId) {
        return;
      }

      if (!this.axisLock) {
        const dx = Math.abs(pointer.x - this.startX);
        const dy = Math.abs(pointer.y - this.startY);
        if (dx < AXIS_LOCK_PX && dy < AXIS_LOCK_PX) {
          return;
        }
        // Prefer horizontal when close — lets STORE → TAP swipe win over list scroll.
        this.axisLock = dx >= dy ? 'horizontal' : 'vertical';
        this.lastGestureAxis = this.axisLock;
        this.lastPointerY = pointer.y;
      }

      if (this.axisLock !== 'vertical') {
        return;
      }

      const deltaY = pointer.y - this.lastPointerY;
      this.lastPointerY = pointer.y;
      this.setOffset(this.offset - deltaY);
    });

    const finishPointer = (pointer) => {
      this.onPointerUp?.(pointer);
      if (pointer.id === this.activePointerId) {
        this.isDragging = false;
        this.activePointerId = null;
        this.axisLock = null;
      }
    };
    scene.input.on('pointerup', finishPointer);
    scene.input.on('pointerupoutside', finishPointer);

    this.updateMetrics(layout.listHeight);
  }

  isPointerInside(pointer) {
    const { listLeft, listWidth, panelTopY, panelBottomY } = this.layout;
    return pointer.x >= listLeft && pointer.x <= listLeft + listWidth && pointer.y >= panelTopY && pointer.y <= panelBottomY;
  }

  setOffset(value) {
    this.offset = clamp(value, 0, this.maxScroll);
    this.update();
  }

  updateMetrics(listHeight) {
    const { visibleListHeight } = this.layout;
    this.layout.listHeight = listHeight;
    this.maxScroll = Math.max(0, listHeight - visibleListHeight);
    this.offset = clamp(this.offset, 0, this.maxScroll);
    this.thumbHeight = this.maxScroll > 0 ? Math.max(40, visibleListHeight * (visibleListHeight / Math.max(listHeight, 1))) : visibleListHeight;
    this.thumb.setDisplaySize(12, this.thumbHeight);
    this.update();
  }

  update() {
    const { visibleListHeight, listTop } = this.layout;
    this.offset = clamp(this.offset, 0, this.maxScroll);
    this.items.forEach((item) => {
      if (item.baseY == null) {
        return;
      }
      this.syncItem(item, item.baseY - this.offset, this.layout);
    });

    if (this.maxScroll <= 0) {
      this.track.setAlpha(0);
      this.thumb.setAlpha(0);
      this.thumb.y = listTop + visibleListHeight / 2;
      return;
    }

    this.track.setAlpha(1);
    this.thumb.setAlpha(1);
    const minY = listTop + this.thumbHeight / 2;
    const maxY = listTop + visibleListHeight - this.thumbHeight / 2;
    this.thumb.y = minY + (this.offset / this.maxScroll) * (maxY - minY);
  }

  setVisible(visible) {
    this.track.setVisible(visible);
    this.thumb.setVisible(visible);
  }
}
