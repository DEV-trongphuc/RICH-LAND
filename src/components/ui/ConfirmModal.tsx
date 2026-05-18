import React from 'react';
import { CustomModal } from './CustomModal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Xác nhận xóa',
  message = 'Bạn có chắc chắn muốn xóa mục này không? Hành động này không thể hoàn tác.',
  confirmText = 'Xóa',
  cancelText = 'Hủy'
}) => {
  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ 
            width: 40, height: 40, borderRadius: '50%', background: 'var(--color-danger-light)', 
            color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
          }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <p style={{ color: 'var(--color-text)', lineHeight: 1.6, fontSize: '0.9375rem', whiteSpace: 'pre-line' }}>{message}</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
          <button className="btn outline" onClick={onClose}>{cancelText}</button>
          <button className="btn danger" onClick={() => { onConfirm(); onClose(); }}>{confirmText}</button>
        </div>
      </div>
    </CustomModal>
  );
};
