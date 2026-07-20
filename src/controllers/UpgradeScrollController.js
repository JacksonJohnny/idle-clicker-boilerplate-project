const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class UpgradeScrollController {
  constructor({ scene, layout, items, isEnabled, onPointerMove, onPointerUp }) {
    this.scene = scene;
    this.layout = layout;
    this.items = items;
    this.isEnabled = isEnabled;
    this.onPointerMove = onPointerMove;
    this.onPointerUp = onPointerUp;
    this.offset = 0;
    this.maxScroll = 0;
    this.thumbHeight = layout.visibleListHeight;
    this.isDragging = false;
    this.activePointerId = null;
    this.lastPointerY = 0;
  }

  setup() {
    const { scene, layout } = this;
    const trackX = scene.scale.width - 16;
    this.track = scene.add
      .rectangle(trackX, (layout.panelTopY + layout.panelBottomY) / 2, 8, layout.visibleListHeight, 0x0b2233, 0.9)
      .setStrokeStyle(1, 0x2f5f7c, 0.9);
    this.thumb = scene.add
      .rectangle(trackX, layout.listTop + this.thumbHeight / 2, 12, this.thumbHeight, 0x76c5ff, 0.95)
      .setStrokeStyle(1, 0xb5e5ff, 1)
      .setInteractive({ draggable: true, useHandCursor: true });

    scene.input.setDraggable(this.thumb);
    scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      if (gameObject !== this.thumb || this.maxScroll <= 0) {
        return;
      }

      const minY = layout.listTop + this.thumbHeight / 2;
      const maxY = layout.listTop + layout.visibleListHeight - this.thumbHeight / 2;
      const clampedY = clamp(dragY, minY, maxY);
      gameObject.y = clampedY;
      const ratio = (clampedY - minY) / Math.max(1, maxY - minY);
      this.offset = ratio * this.maxScroll;
      this.update();
    });

    scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.isEnabled() || !this.isPointerInside(pointer) || this.maxScroll <= 0) {
        return;
      }
      this.setOffset(this.offset + deltaY * 0.7);
    });

    scene.input.on('pointerdown', (pointer) => {
      if (!this.isEnabled() || !this.isPointerInside(pointer) || this.maxScroll <= 0 || this.thumb.getBounds().contains(pointer.x, pointer.y)) {
        return;
      }
      this.isDragging = true;
      this.activePointerId = pointer.id;
      this.lastPointerY = pointer.y;
    });

    scene.input.on('pointermove', (pointer) => {
      this.onPointerMove(pointer);
      if (!this.isDragging || !pointer.isDown || pointer.id !== this.activePointerId) {
        return;
      }
      const deltaY = pointer.y - this.lastPointerY;
      this.lastPointerY = pointer.y;
      this.setOffset(this.offset - deltaY);
    });

    const finishPointer = (pointer) => {
      this.onPointerUp(pointer);
      if (pointer.id === this.activePointerId) {
        this.isDragging = false;
        this.activePointerId = null;
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
    this.thumbHeight = this.maxScroll > 0 ? Math.max(40, visibleListHeight * (visibleListHeight / listHeight)) : visibleListHeight;
    this.thumb.setDisplaySize(12, this.thumbHeight);
    this.thumb.input.enabled = this.maxScroll > 0;
    this.update();
  }

  update() {
    const { rowHeight, visibleListHeight, listTop } = this.layout;
    this.offset = clamp(this.offset, 0, this.maxScroll);
    this.items.forEach((item) => {
      const y = item.baseY - this.offset;
      item.rowBg.y = y;
      item.label.y = y - rowHeight * 0.22;
      item.info.y = y + rowHeight * 0.22;
      item.stars.forEach((star) => {
        star.y = y - rowHeight * 0.22;
      });
      item.buyButton.y = y;
      item.buyText.y = y;
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