export function createFeedbackService(scene, settings) {
  let audioContext = null;

  function playPurchase() {
    if (settings.soundEnabled) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioContext ??= new AudioContextClass();
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(480, now);
        oscillator.frequency.exponentialRampToValueAtTime(720, now + 0.09);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.11, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.12);
      }
    }

    if (settings.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(12);
    }
  }

  function spawnFloatingText(text, color = '#ffffff', y = 355, xOffset = 0) {
    const floatText = scene.add
      .text(scene.scale.width / 2 + xOffset, y, text, {
        fontFamily: 'Nunito, sans-serif',
        fontSize: '34px',
        color,
        fontStyle: '800',
      })
      .setOrigin(0.5);

    scene.upgradeCamera?.ignore(floatText);
    scene.boostCamera?.ignore(floatText);
    scene.tweens.add({
      targets: floatText,
      y: y - 70,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.Out',
      onComplete: () => floatText.destroy(),
    });
  }

  return { playPurchase, spawnFloatingText };
}