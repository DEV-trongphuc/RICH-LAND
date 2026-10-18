import { clearApiGetCache } from '../api/axios';

export type CrmSyncEventName =
  | 'contact-updated'
  | 'lead-added'
  | 'deposit-updated'
  | 'coop-updated'
  | 'refresh-pending-counts'
  | 'task-updated'
  | 'refresh-page';

const lastEmittedMap = new Map<string, number>();
const THROTTLE_MS = 100;

/**
 * Throttled Cross-Tab & In-App CRM Event Bus.
 * Dispatches CustomEvents across mounted <AppTabs> and immediately clears
 * the Axios GET response cache so subsequent fetches read fresh MySQL data.
 */
export function emitCrmSync(
  events: CrmSyncEventName[] = [
    'contact-updated',
    'deposit-updated',
    'coop-updated',
    'refresh-pending-counts',
  ],
  detail?: Record<string, any>
): void {
  if (typeof window === 'undefined') return;

  // Immediately invalidate in-memory GET cache on any CRM state mutation
  clearApiGetCache();

  const now = Date.now();
  const uniqueEvents = Array.from(new Set(events));

  for (const eventName of uniqueEvents) {
    const lastTime = lastEmittedMap.get(eventName) || 0;
    if (now - lastTime < THROTTLE_MS) {
      continue;
    }
    lastEmittedMap.set(eventName, now);
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

export const emitCrmMutation = emitCrmSync;
