/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    DEV / PROD SWITCH                        ║
 * ║  Đặt DEV_MODE = true  → bỏ qua API, dùng MOCK data         ║
 * ║  Đặt DEV_MODE = false → gọi API thật, MOCK chỉ là fallback  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export let DEV_MODE = localStorage.getItem('crm_dev_mode') !== 'false';

export const setDevMode = (val: boolean) => {
  DEV_MODE = val;
  localStorage.setItem('crm_dev_mode', val ? 'true' : 'false');
  window.location.reload();
};

/** Base URL của backend — đổi khi deploy production */
export const API_BASE = import.meta.env.VITE_API_URL ?? '/backend';
