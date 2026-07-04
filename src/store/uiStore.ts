import { create } from 'zustand';
import toast from 'react-hot-toast';
import React from 'react';

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
  requirePromptInput?: boolean;
  promptPlaceholder?: string;
  onConfirm: (promptValue?: string) => void;
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
    if (action) {
      toast((t) => (
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement('span', null, message),
          React.createElement('button', {
            onClick: () => {
              action.onClick();
              toast.dismiss(t.id);
            },
            style: {
              padding: '2px 8px',
              backgroundColor: '#a31422',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
            }
          }, action.label)
        )
      ), { id: Math.random().toString(), duration: 4000 });
    } else {
      if (type === 'success') {
        toast.success(message);
      } else if (type === 'error') {
        toast.error(message);
      } else if (type === 'warning') {
        toast(message, { icon: '⚠️', duration: 3000 });
      } else {
        toast(message, { duration: 3000 });
      }
    }
  },
  removeToast: () => {}
}));

