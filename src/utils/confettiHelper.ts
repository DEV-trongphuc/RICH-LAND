import { playSuccessSound } from './soundHelper';

export { playSuccessSound };

// Cache dynamic canvas-confetti import
let confettiModulePromise: Promise<any> | null = null;
const getConfetti = async () => {
  if (!confettiModulePromise) {
    confettiModulePromise = import('canvas-confetti').then(m => m.default || m);
  }
  return confettiModulePromise;
};

/**
 * Triggers a multi-burst 3D confetti animation shooting from the center, left, and right corners.
 * Plays the success chime sound synchronously.
 */
export const triggerFullConfetti = async () => {
  // Play chime sound
  playSuccessSound();

  const confetti = await getConfetti();
  if (!confetti) return;

  // Burst 1: Center
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 }
  });

  // Burst 2: Left corner shooting diagonally up-right
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.8 }
    });
  }, 200);

  // Burst 3: Right corner shooting diagonally up-left
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.8 }
    });
  }, 400);
};

/**
 * Triggers an exquisite, subtle localized burst of micro-confetti right at the element or mouse position.
 */
export const triggerLocalConfetti = async (clientX?: number, clientY?: number) => {
  playSuccessSound();

  const x = (typeof window !== 'undefined' && clientX !== undefined && clientX > 0)
    ? Math.min(Math.max(clientX / window.innerWidth, 0.05), 0.95)
    : 0.5;
  const y = (typeof window !== 'undefined' && clientY !== undefined && clientY > 0)
    ? Math.min(Math.max(clientY / window.innerHeight, 0.05), 0.95)
    : 0.5;

  const confetti = await getConfetti();
  if (!confetti) return;

  confetti({
    particleCount: 45,
    spread: 60,
    startVelocity: 22,
    ticks: 100,
    gravity: 1.1,
    origin: { x, y },
    colors: ['#10B981', '#34D399', '#3B82F6', '#F59E0B', '#BD1D2D'],
    scalar: 0.8,
    disableForReducedMotion: true
  });
};

