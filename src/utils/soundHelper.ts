/**
 * Web Audio API Sound Generator for rich notifications, toasts, and alerts.
 * 100% native synthesized sounds — zero external audio files needed, zero latency,
 * perfectly reliable across all modern browsers.
 */

// Singleton AudioContext getter
let globalAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;
      globalAudioCtx = new AudioCtxClass();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => {});
    }
    return globalAudioCtx;
  } catch {
    return null;
  }
};

/**
 * Ascending 4-note chime (C5, E5, G5, C6) for success / deals / approvals.
 */
export const playSuccessSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const duration = 0.35;
    const startTime = ctx.currentTime;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime + index * 0.07);

      gain.gain.setValueAtTime(0, startTime + index * 0.07);
      gain.gain.linearRampToValueAtTime(0.18, startTime + index * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + index * 0.07 + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + index * 0.07);
      osc.stop(startTime + index * 0.07 + duration + 0.05);
    });
  } catch (err) {
    // Silent fail on browser policy
  }
};

/**
 * Crystal sine wave notification bell chime (880Hz -> 1320Hz) for incoming notifications, messages, leads.
 */
export const playNotificationChime = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  } catch (err) {
    // Silent fail
  }
};

/**
 * Gentle 2-tone alert for warnings / reminders (740Hz -> 587Hz).
 */
export const playWarningSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [739.99, 587.33]; // F#5, D5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.25);
    });
  } catch (err) {
    // Silent fail
  }
};

/**
 * Soft low boop for errors / invalid submissions (350Hz -> 220Hz).
 */
export const playErrorSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch (err) {
    // Silent fail
  }
};

/**
 * Route toast type to the corresponding audio feedback.
 */
export const playToastSound = (type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  switch (type) {
    case 'success':
      playSuccessSound();
      break;
    case 'error':
      playErrorSound();
      break;
    case 'warning':
      playWarningSound();
      break;
    case 'info':
    default:
      playNotificationChime();
      break;
  }
};
