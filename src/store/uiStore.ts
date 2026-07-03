import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  extraText?: string;
  isDanger?: boolean;
  impactInfo?: string; // e.g. "Ảnh hưởng đến 45 khách hàng"
  requireWordMatch?: string; // e.g. "DELETE"
  onConfirm: () => void;
  onCancel?: () => void;
  onExtra?: () => void;
}

interface UIStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, action?: Toast['action']) => void;
  removeToast: (id: string) => void;
  showPOS: boolean | { id: number; [key: string]: any }; // POS can be open for a specific contact
  setShowPOS: (show: boolean | { id: number; [key: string]: any }) => void;
  confirmModal: ConfirmModalState;
  showConfirm: (titleOrOptions: string | Partial<ConfirmModalState>, message?: string, onConfirm?: () => void) => void;
  closeConfirm: () => void;
  callModal: { isOpen: boolean; phone: string };
  showCall: (phone: string) => void;
  closeCall: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  toasts: [],
  showPOS: false,
  setShowPOS: (show) => set({ showPOS: show }),
  confirmModal: {
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  },
  showConfirm: (titleOrOptions: any, message?: string, onConfirm?: () => void) => {
    if (typeof titleOrOptions === 'object') {
      set({ confirmModal: { ...titleOrOptions, isOpen: true } });
    } else {
      set({ 
        confirmModal: { 
          title: titleOrOptions, 
          message: message || '', 
          onConfirm: onConfirm || (() => {}), 
          isOpen: true 
        } 
      });
    }
  },
  closeConfirm: () => set((state) => ({ confirmModal: { ...state.confirmModal, isOpen: false } })),
  callModal: { isOpen: false, phone: '' },
  showCall: (phone: string) => set({ callModal: { isOpen: true, phone } }),
  closeCall: () => set((state) => ({ callModal: { ...state.callModal, isOpen: false } })),
  addToast: (message, type = 'info', action) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, type, message, action }] }));
    
    // Auto remove after 3s
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) => 
    set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
}));
