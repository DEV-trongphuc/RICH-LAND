/**
 * Global Toast Audio & Interaction Enhancer
 * Intercepts react-hot-toast invocations to synchronously provide native Web Audio feedback
 * with audio throttling to guarantee a premium, silky-smooth acoustic experience.
 */
import toast from 'react-hot-toast';
import { playSuccessSound, playErrorSound, playWarningSound, playNotificationChime } from './soundHelper';

let lastSoundTimestamp = 0;
const THROTTLE_MS = 120;

const throttlePlay = (fn: () => void) => {
  const now = Date.now();
  if (now - lastSoundTimestamp > THROTTLE_MS) {
    lastSoundTimestamp = now;
    fn();
  }
};

// Check if enhancer was already initialized
let isInitialized = false;

export const initToastEnhancer = () => {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const originalSuccess = toast.success.bind(toast);
  const originalError = toast.error.bind(toast);
  const originalCustom = toast.custom.bind(toast);

  toast.success = ((message, opts) => {
    throttlePlay(playSuccessSound);
    return originalSuccess(message, opts);
  }) as typeof toast.success;

  toast.error = ((message, opts) => {
    throttlePlay(playErrorSound);
    return originalError(message, opts);
  }) as typeof toast.error;
};

// Auto-run on import
initToastEnhancer();
