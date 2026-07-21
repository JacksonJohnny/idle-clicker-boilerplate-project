export function createHoldBuyController(scene) {
  function stopUpgradeHold(pointerId = null) {
    if (!scene.upgradeHold) {
      if (pointerId !== null && scene.completedUpgradeHoldPointerId === pointerId) {
        scene.completedUpgradeHoldPointerId = null;
        return true;
      }
      return false;
    }

    if (pointerId !== null && scene.upgradeHold.pointerId !== pointerId) {
      return false;
    }

    const didRepeat = scene.upgradeHold.didRepeat;
    if (didRepeat) {
      scene.completedUpgradeHoldPointerId = scene.upgradeHold.pointerId;
    }
    scene.upgradeHoldTimer?.remove(false);
    scene.upgradeHoldTimer = null;
    scene.upgradeHold = null;
    return didRepeat;
  }

  function runUpgradeHold() {
    if (!scene.upgradeHold || scene.activePage !== 0 || !scene.gameStarted) {
      stopUpgradeHold();
      return;
    }

    const bought = scene.tryBuyUpgrade(scene.upgradeHold.upgradeId, { shakeOnFailure: false });
    if (!bought) {
      stopUpgradeHold();
      return;
    }

    scene.upgradeHold.didRepeat = true;
    const elapsed = scene.time.now - scene.upgradeHold.startedAt - 550;
    const nextDelay = Math.max(100, 500 * Math.exp(-elapsed / 1500));
    scene.upgradeHoldTimer = scene.time.delayedCall(nextDelay, () => runUpgradeHold());
  }

  function startUpgradeHold(upgradeId, pointer) {
    stopUpgradeHold();
    scene.upgradeHold = {
      upgradeId,
      pointerId: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      startedAt: scene.time.now,
      didRepeat: false,
    };
    scene.upgradeHoldTimer = scene.time.delayedCall(550, () => runUpgradeHold());
  }

  function cancelUpgradeHoldOnMove(pointer) {
    if (scene.upgradeHold?.pointerId !== pointer.id || !pointer.isDown) {
      return;
    }

    const moved = Math.hypot(pointer.x - scene.upgradeHold.startX, pointer.y - scene.upgradeHold.startY) > 14;
    if (moved) {
      stopUpgradeHold(pointer.id);
    }
  }

  return { startUpgradeHold, stopUpgradeHold, cancelUpgradeHoldOnMove, runUpgradeHold };
}
