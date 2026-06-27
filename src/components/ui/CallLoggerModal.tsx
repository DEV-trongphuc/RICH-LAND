import React, { useState } from 'react';
import { Phone, X, Check, Clock, Mic, User, PhoneOutgoing, PhoneIncoming, CheckCircle, PhoneOff, Voicemail, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/uiStore';
import { CustomSelect } from './CustomSelect';

interface CallLoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: { id: number; full_name: string; phone?: string };
  onSave?: (log: CallLog) => void;
}

export interface CallLog {
  contact_id: number;
  duration_minutes: number;
  outcome: 'reached' | 'no_answer' | 'voicemail' | 'busy' | 'wrong_number';
  direction: 'outbound' | 'inbound';
  note: string;
  next_action: string;
  next_date: string;
}

const OUTCOMES = [
  { value: 'reached',      label: 'Đã kết nối',    color: '#10b981', icon: <CheckCircle size={16} /> },
  { value: 'no_answer',    label: 'Không nghe máy', color: '#f59e0b', icon: <PhoneOff size={16} /> },
  { value: 'voicemail',    label: 'Hộp thư thoại',  color: '#BD1D2D', icon: <Voicemail size={16} /> },
  { value: 'busy',         label: 'Máy bận',         color: '#ef4444', icon: <Clock size={16} /> },
  { value: 'wrong_number', label: 'Sai số',           color: '#6b7280', icon: <XCircle size={16} /> },
];

const NEXT_ACTIONS = [
  'Gọi lại sau 2 giờ', 'Gọi lại ngày mai', 'Gửi email báo giá',
  'Lên lịch demo', 'Gửi tài liệu sản phẩm', 'Chờ khách phản hồi', 'Đánh dấu quan tâm thấp'
];

export const CallLoggerModal: React.FC<CallLoggerModalProps> = ({ isOpen, onClose, contact, onSave }) => {
  const { addToast } = useUIStore();
  const [outcome, setOutcome] = useState<CallLog['outcome']>('reached');
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [duration, setDuration] = useState(5);
  const [note, setNote] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    const log: CallLog = {
      contact_id: contact.id, duration_minutes: duration,
      outcome, direction, note, next_action: nextAction, next_date: nextDate,
    };
    onSave?.(log);
    addToast(`Đã ghi nhận cuộc gọi với ${contact.full_name}`, 'success');
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="overlay-backdrop" style={{ zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: 520, maxWidth: 'calc(100vw - 2rem)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)',
              boxShadow: 'var(--shadow-xl)', border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Phone size={18} color="#10b981" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Ghi nhận cuộc gọi</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 1 }}>
                  {contact.full_name} {contact.phone && `· ${contact.phone}`}
                </p>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, borderRadius: 6 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
              {/* Direction */}
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>Loại cuộc gọi</p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {[{v:'outbound', l:'Gọi đi', i: <PhoneOutgoing size={15}/>},{v:'inbound', l:'Gọi đến', i: <PhoneIncoming size={15}/>}].map(({v,l,i}) => (
                    <button key={v} onClick={() => setDirection(v as any)}
                      style={{ flex: 1, padding: '0.625rem', borderRadius: 'var(--radius-md)', border: `1px solid ${direction === v ? 'var(--color-primary)' : 'var(--color-border)'}`, background: direction === v ? 'var(--color-primary-light)' : 'var(--color-surface)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: direction === v ? 'var(--color-primary)' : 'var(--color-text)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      {i} {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Outcome */}
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>Kết quả cuộc gọi</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {OUTCOMES.map(o => (
                    <button key={o.value} onClick={() => setOutcome(o.value as any)}
                      style={{ padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-md)', border: `1px solid ${outcome === o.value ? o.color : 'var(--color-border)'}`, background: outcome === o.value ? `${o.color}0a` : 'var(--color-surface)', fontWeight: 500, fontSize: '0.8125rem', cursor: 'pointer', color: outcome === o.value ? o.color : 'var(--color-text)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <span style={{ color: outcome === o.value ? o.color : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{o.icon}</span>
                      <span style={{ whiteSpace: 'nowrap' }}>{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', margin: 0 }}>
                    Thời lượng <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{duration} phút</span>
                  </p>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[3, 5, 10, 20].map(m => (
                      <button key={m} onClick={() => setDuration(m)} type="button"
                        style={{ 
                          padding: '2px 8px', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
                          border: duration === m ? '1px solid var(--color-primary)' : '1px solid var(--color-border)', 
                          background: duration === m ? 'var(--color-primary-light)' : 'var(--color-surface)', 
                          color: duration === m ? 'var(--color-primary)' : 'var(--color-text-muted)'
                        }}>
                        {m}p
                      </button>
                    ))}
                  </div>
                </div>
                <input type="range" min={1} max={120} value={duration}
                  onChange={e => setDuration(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  <span>1 phút</span><span>30 phút</span><span>60 phút</span><span>120 phút</span>
                </div>
              </div>

              {/* Note */}
              <div className="form-group">
                <label className="form-label">Ghi chú cuộc gọi</label>
                <textarea className="form-input" rows={3} placeholder="Tóm tắt nội dung trao đổi..." value={note} onChange={e => setNote(e.target.value)}
                  style={{ resize: 'vertical', minHeight: 72 }} />
              </div>

              {/* Next action */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Hành động tiếp theo</label>
                  <CustomSelect
                    options={NEXT_ACTIONS.map(a => ({ value: a, label: a }))}
                    value={nextAction}
                    onChange={v => setNextAction(String(v))}
                    placeholder="-- Chọn --"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ngày nhắc nhở</label>
                  <input className="form-input" type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: 'var(--color-bg)' }}>
              <button className="btn outline" onClick={onClose}>Hủy</button>
              <button className="btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Đang lưu...' : <><Check size={15} /> Lưu ghi nhận</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
