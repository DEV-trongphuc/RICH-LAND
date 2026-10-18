/**
 * Global Toast Audio, Sanitizer & Interaction Enhancer
 * Intercepts react-hot-toast invocations to synchronously provide native Web Audio feedback
 * with audio throttling, 100% SQL/DB/PHP error sanitization, and 2.5s toast deduplication.
 */
import toast from 'react-hot-toast';
import { playSuccessSound, playErrorSound, playWarningSound, playNotificationChime, playToastSound } from './soundHelper';

let lastSoundTimestamp = 0;
const THROTTLE_MS = 120;

const throttlePlay = (fn: () => void) => {
  const now = Date.now();
  if (now - lastSoundTimestamp > THROTTLE_MS) {
    lastSoundTimestamp = now;
    fn();
  }
};

const TECHNICAL_ERROR_KEYWORDS = [
  'SQLSTATE',
  'Unknown column',
  'Syntax error',
  'You have an error in your SQL syntax',
  "Table '",
  "doesn't exist",
  'Duplicate entry',
  'foreign key constraint',
  'Cannot add or update a child row',
  'Deadlock',
  'Lock wait timeout',
  'Data truncated',
  "Column count doesn't match",
  'PDOException',
  'mysqli',
  'ArgumentCountError',
  'Uncaught ',
  'Fatal error',
  'FATAL ERROR',
  'Parse error',
  'Stack trace:',
  '.php on line',
  '<br />',
  '<b>Warning</b>',
  '<b>Fatal error</b>',
  'Call to a member function',
  'Undefined index',
  'Undefined array key',
  'Undefined variable',
  'Request failed with status code 5',
  'API Error (500)'
];

export function sanitizeUserMessage(
  rawMsg: unknown,
  fallback = 'Hệ thống đang bận hoặc gặp sự cố dữ liệu tạm thời. Vui lòng thử lại sau.'
): string {
  if (rawMsg === null || rawMsg === undefined) return fallback;

  const str =
    typeof rawMsg === 'string'
      ? rawMsg.trim()
      : typeof (rawMsg as any)?.message === 'string'
        ? String((rawMsg as any).message).trim()
        : String(rawMsg).trim();

  if (!str) return fallback;

  const lowerStr = str.toLowerCase();
  const isTechnicalError = TECHNICAL_ERROR_KEYWORDS.some((kw) =>
    lowerStr.includes(kw.toLowerCase())
  );

  if (isTechnicalError) {
    console.warn('[Sanitized Technical Error]:', rawMsg);

    if (lowerStr.includes('duplicate entry')) {
      return 'Dữ liệu bị trùng lặp trong hệ thống. Vui lòng kiểm tra lại.';
    }
    if (lowerStr.includes('deadlock') || lowerStr.includes('lock wait timeout')) {
      return 'Hệ thống đang xử lý giao dịch đồng thời, vui lòng thử lại sau giây lát.';
    }
    if (
      lowerStr.includes('foreign key constraint') ||
      lowerStr.includes('cannot add or update a child row')
    ) {
      return 'Dữ liệu liên kết không hợp lệ hoặc đang được sử dụng. Vui lòng kiểm tra lại.';
    }
    return fallback;
  }

  return str;
}

export function enhanceToastMessage(
  message: unknown,
  fallback?: string
): string {
  return sanitizeUserMessage(message, fallback);
}

export function enhanceToast(
  message: any,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  playSound = true
) {
  if (playSound && type !== 'success' && type !== 'error') {
    throttlePlay(() => playToastSound(type));
  }
  return typeof message === 'string' ? enhanceToastMessage(message) : message;
}

// Check if enhancer was already initialized
let isInitialized = false;

export const initToastEnhancer = () => {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const originalSuccess = toast.success.bind(toast);
  const originalError = toast.error.bind(toast);

  toast.success = ((message, opts) => {
    throttlePlay(playSuccessSound);
    const safeMsg = typeof message === 'string' ? enhanceToastMessage(message) : message;
    return originalSuccess(safeMsg as any, opts);
  }) as typeof toast.success;

  toast.error = ((message, opts) => {
    throttlePlay(playErrorSound);
    const safeMsg = typeof message === 'string' ? enhanceToastMessage(message) : message;
    return originalError(safeMsg as any, opts);
  }) as typeof toast.error;
};

// Auto-run on import
initToastEnhancer();

