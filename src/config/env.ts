/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    DEV / PROD SWITCH                        ║
 * ║  Đặt DEV_MODE = true  → bỏ qua API, dùng MOCK data         ║
 * ║  Đặt DEV_MODE = false → gọi API thật, MOCK chỉ là fallback  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export const DEV_MODE = true;

/** Base URL của backend — đổi khi deploy production */
export const API_BASE = import.meta.env.VITE_API_URL ?? '/backend';
