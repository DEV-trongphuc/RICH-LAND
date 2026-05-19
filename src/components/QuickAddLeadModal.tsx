import React, { useState, useEffect, useRef } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { CustomModal } from './ui/CustomModal';
import { CustomSelect } from './ui/CustomSelect';
import { Avatar } from './ui/Avatar';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';

export const QuickAddLeadModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [consultants, setConsultants] = useState<{ id: number; name: string; status: string }[]>([]);
  const [manualData, setManualData] = useState({ name: '', phone: '', email: '', source: '', type: '', note: '' });
  const [previewCons, setPreviewCons] = useState<any>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [overrideConsId, setOverrideConsId] = useState<string>('');
  const [compensateSkipped, setCompensateSkipped] = useState(true);
  
  const previewTimerRef = useRef<any>(null);

  // Load consultants list
  const fetchConsultants = async () => {
    try {
      const json = await fetchAPI('get_consultants');
      if (json.success) {
        setConsultants(json.data.filter((c: any) => c.status === 'active'));
      }
    } catch (e: any) {
      console.error(e.message);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConsultants();
    }
  }, [isOpen]);

  // Listen to open event
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-quick-add-lead', handleOpen);
    return () => window.removeEventListener('open-quick-add-lead', handleOpen);
  }, []);

  // Debounce routing preview
  useEffect(() => {
    if (!isOpen) return;
    
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    
    if (manualData.phone.length < 8 && !manualData.email) {
      setPreviewCons(null);
      setOverrideConsId('');
      return;
    }
    
    previewTimerRef.current = setTimeout(async () => {
      setIsPreviewing(true);
      try {
        const json = await fetchAPI('preview_routing', {
          method: 'POST',
          body: JSON.stringify({ data: manualData })
        });
        if (json.success) {
          setPreviewCons(json);
        }
      } catch (e: any) {
        // ignore preview network error
      }
      setIsPreviewing(false);
    }, 500);
    
  }, [manualData, isOpen]);

  const handleManualSubmit = async () => {
    if (!manualData.phone && !manualData.email) {
      toast.error('Vui lòng nhập SĐT hoặc Email');
      return;
    }
    setIsSubmittingManual(true);
    try {
      const payload = {
        data: manualData,
        override_round_id: previewCons?.round_id,
        override_consultant_id: overrideConsId ? Number(overrideConsId) : null,
        compensate_skipped: compensateSkipped,
        skipped_consultant_id: previewCons?.consultant?.consultant_id
      };
      
      const json = await fetchAPI('manual_insert_lead', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (json.success) {
        toast.success(json.message || 'Thêm thành công!');
        setIsOpen(false);
        // Reset form
        setManualData({ name: '', phone: '', email: '', source: '', type: '', note: '' });
        setPreviewCons(null);
        setOverrideConsId('');
        setCompensateSkipped(true);
        // Trigger table refresh
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error(json.message || 'Thêm thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSubmittingManual(false);
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Thêm Data Thủ Công"
      width="650px"
    >
      <div style={{ padding: '0 0 1.25rem 0', background: 'white' }}>
        <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Họ tên</label>
            <input className="form-input" placeholder="VD: Nguyễn Văn A" value={manualData.name} onChange={e => setManualData({...manualData, name: e.target.value})} />
          </div>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Số điện thoại (*)</label>
            <input className="form-input" placeholder="VD: 0912345678" value={manualData.phone} onChange={e => setManualData({...manualData, phone: e.target.value})} />
          </div>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Email</label>
            <input className="form-input" placeholder="VD: email@gmail.com" value={manualData.email} onChange={e => setManualData({...manualData, email: e.target.value})} />
          </div>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Nguồn (Source)</label>
            <input className="form-input" placeholder="VD: FB_Ads" value={manualData.source} onChange={e => setManualData({...manualData, source: e.target.value})} />
          </div>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Loại (Type)</label>
            <input className="form-input" placeholder="VD: Mua nhà" value={manualData.type} onChange={e => setManualData({...manualData, type: e.target.value})} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Ghi chú</label>
            <textarea className="form-input" rows={3} style={{ resize: 'vertical', minHeight: '80px', lineHeight: 1.5, padding: '10px 12px' }} placeholder="Ghi chú thêm (Hỗ trợ nhiều dòng)..." value={manualData.note} onChange={e => setManualData({...manualData, note: e.target.value})} />
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0', marginTop: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <RefreshCw size={16} className={isPreviewing ? "spin" : ""} color="var(--color-primary)" /> Live Preview (Tự động dự báo)
          </h4>
          
          {isPreviewing ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>Đang kiểm tra...</div>
          ) : !previewCons ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>Nhập SĐT hoặc Email để xem trước vòng chia.</div>
          ) : previewCons.round_id === null ? (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.8125rem', fontWeight: 600 }}>Không khớp với luật chia nào. (Data sẽ lưu trạng thái Chưa phân bổ)</div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  Sẽ rơi vào Vòng: <strong style={{ color: 'var(--color-primary)', marginLeft: 4 }}>{previewCons.consultant?.round_name || 'Vòng ' + previewCons.round_id}</strong>
                  {previewCons.is_fallback && (
                    <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                      Vòng mặc định (Fallback)
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{ background: 'white', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Dòng 1: Sale dự kiến nhận */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={previewCons.consultant?.name || '?'} size={32} />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Sale dự kiến nhận</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{previewCons.consultant?.name || 'Không có TVV hoạt động'}</div>
                  </div>
                </div>

                <hr style={{ border: 0, borderTop: '1px dashed #e2e8f0', margin: 0 }} />

                {/* Dòng 2: Chỉ định Sale nhận (Override) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {(() => {
                    const selectedForceCons = consultants.find(c => String(c.id) === overrideConsId);
                    return (
                      <>
                        <Avatar name={selectedForceCons?.name || '?'} size={32} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Chỉ định Sale nhận (Ép lượt)</div>
                          <div style={{ maxWidth: 240 }}>
                            <CustomSelect 
                              options={[
                                { value: '', label: '-- Chọn để ép (Override) --' },
                                ...consultants.map(c => ({
                                  value: c.id.toString(),
                                  label: c.name
                                }))
                              ]}
                              value={overrideConsId}
                              onChange={val => setOverrideConsId(val.toString())}
                              width="100%"
                              direction="up"
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>
                * Nếu bạn chọn ép (Override), người được chọn sẽ nhận Data này bất kể tỷ lệ vòng xoay.
              </div>
              
              {overrideConsId && overrideConsId !== String(previewCons.consultant?.consultant_id) && previewCons.consultant && (
                <div style={{ marginTop: 12, padding: '12px 16px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.8125rem', color: '#854d0e', fontWeight: 600 }}>
                      Trả lại data cho <strong style={{ color: '#713f12' }}>{previewCons.consultant?.name}</strong> ở lượt tiếp theo
                    </div>
                    <div 
                      className={`custom-toggle ${compensateSkipped ? 'active' : ''}`}
                      onClick={() => setCompensateSkipped(!compensateSkipped)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', position: 'sticky', bottom: '-1.5rem', margin: '0 -1.5rem -1.5rem -1.5rem', zIndex: 10 }}>
        <button className="btn outline" onClick={() => setIsOpen(false)}>Hủy</button>
        <button className="btn primary" onClick={handleManualSubmit} disabled={isSubmittingManual || (!manualData.phone && !manualData.email)} style={{ background: 'var(--color-primary)' }}>
          {isSubmittingManual ? 'Đang lưu...' : 'Lưu & Giao Data'}
        </button>
      </div>
    </CustomModal>
  );
};
