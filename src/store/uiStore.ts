import { create } from 'zustand';
import toast from 'react-hot-toast';
import React from 'react';
import { playToastSound } from '../utils/soundHelper';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string | React.ReactElement;
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
  optionalPromptInput?: boolean;
  promptPlaceholder?: string;
  onConfirm: (promptValue?: string) => void | Promise<void>;
  onCancel?: () => void;
  onExtra?: () => void;
}

export interface LoadingModalState {
  isOpen: boolean;
  text?: string;
  subText?: string;
}

interface UIStore {
  toasts: Toast[];
  addToast: (message: string | React.ReactElement, type?: ToastType, action?: Toast['action'], playSound?: boolean) => void;
  removeToast: (id: string) => void;
  showPOS: boolean | { id: number; [key: string]: any }; // POS can be open for a specific contact
  setShowPOS: (show: boolean | { id: number; [key: string]: any }) => void;
  confirmModal: ConfirmModalState;
  showConfirm: (titleOrOptions: string | Partial<ConfirmModalState>, message?: string, onConfirm?: () => void) => void;
  closeConfirm: () => void;
  loadingModal: LoadingModalState;
  showLoading: (text?: string, subText?: string) => void;
  hideLoading: () => void;
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
  
  loadingModal: {
    isOpen: false,
    text: 'Đang xử lý dữ liệu...',
    subText: 'Hệ thống đang đồng bộ và tính toán, vui lòng chờ trong giây lát'
  },
  showLoading: (text = 'Đang xử lý dữ liệu...', subText = 'Hệ thống đang đồng bộ và tính toán, vui lòng chờ trong giây lát') => 
    set({ loadingModal: { isOpen: true, text, subText } }),
  hideLoading: () => 
    set((state) => ({ loadingModal: { ...state.loadingModal, isOpen: false } })),

  callModal: { isOpen: false, phone: '' },
  showCall: (phone: string) => set({ callModal: { isOpen: true, phone } }),
  closeCall: () => set((state) => ({ callModal: { ...state.callModal, isOpen: false } })),

  addToast: (message, type = 'info', action, playSound = true) => {
    // Trigger synthesized audio sound effect
    if (playSound) {
      playToastSound(type);
    }

    if (action) {
      toast((t) => (
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          React.createElement('span', null, message),
          React.createElement('button', {
            onClick: () => {
              action.onClick();
              toast.dismiss(t.id);
            },
            style: {
              padding: '3px 10px',
              backgroundColor: '#BD1D2D',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              boxShadow: '0 2px 6px rgba(189, 29, 45, 0.4)'
            }
          }, action.label)
        )
      ), { id: Math.random().toString(), duration: 4000 });
    } else {
      if (type === 'success') {
        toast.success(message as any);
      } else if (type === 'error') {
        toast.error(message as any);
      } else if (type === 'warning') {
        toast(message as any, { icon: '⚠️', duration: 3500 });
      } else {
        toast(message as any, { duration: 3000 });
      }
    }
  },
  removeToast: () => {}
}));
