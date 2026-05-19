import { useEffect, useState, useMemo } from 'react';
import { AlertCircle, Users, CheckCircle, Ticket as TicketIcon, RefreshCw, Zap, Filter, Calendar, Settings2, X, Save, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAPI } from '../utils/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { Avatar } from '../components/ui/Avatar';

export const Tickets = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActioning, setIsActioning] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // ── NEW: Sale + Date filters ───────────────────────────────────────────────
  const [saleFilter, setSaleFilter] = useState('');   // consultant_name
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetchAPI('get_reports');
      if (res.success) setReports(res.data);
    } catch (e: any) {
      toast.error('Lỗi tải ticket: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Quick Message State
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessageTarget, setQuickMessageTarget] = useState<any>(null);
  const [quickMessageText, setQuickMessageText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  const handleReportApprove = async (reportId: number) => {
    if (isActioning) return;
    setIsActioning(reportId);
    try {
      const res = await fetchAPI('approve_report', {
        method: 'POST',
        body: JSON.stringify({ id: reportId })
      });
      if (res.success) {
        toast.success('Đã duyệt đền bù Data!');
        window.dispatchEvent(new Event('ticket-resolved'));
        fetchReports();
      } else {
        toast.error(res.message || 'Có lỗi xảy ra');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsActioning(null);
  };

  const openRejectModal = (id: number) => {
    setRejectingId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const submitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId || !rejectReason.trim()) return;
    
    setIsActioning(rejectingId);
    setRejectModalOpen(false);
    
    try {
      const res = await fetchAPI('reject_report', {
        method: 'POST',
        body: JSON.stringify({ id: rejectingId, reject_reason: rejectReason })
      });
      if (res.success) {
        toast.success('Đã từ chối báo cáo!');
        window.dispatchEvent(new Event('ticket-resolved'));
        fetchReports();
      } else {
        toast.error(res.message || 'Có lỗi xảy ra');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsActioning(null);
  };

  const handleSendQuickMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessageText.trim() || !quickMessageTarget) return;
    setIsSendingMsg(true);
    try {
      const res = await fetchAPI('send_quick_zalo_message', {
        method: 'POST',
        body: JSON.stringify({ consultant_id: quickMessageTarget.consultant_id, message: quickMessageText })
      });
      if (res.success) {
        toast.success('Đã gửi tin nhắn thành công!');
        setQuickMessageOpen(false);
        setQuickMessageText('');
      } else {
        toast.error(res.message || 'Lỗi khi gửi tin');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSendingMsg(false);
  };

  // Unique consultants for the sale filter dropdown
  const consultantOptions = useMemo(() => {
    const names = [...new Set(reports.map(r => r.consultant_name).filter(Boolean))].sort();
    return names;
  }, [reports]);

  // Apply all filters
  const filteredReports = useMemo(() => {
    let list = activeFilter === 'all' ? reports : reports.filter(r => r.status === activeFilter);
    if (saleFilter) list = list.filter(r => r.consultant_name === saleFilter);
    if (dateFrom) list = list.filter(r => r.created_at && r.created_at >= dateFrom);
    if (dateTo) {
      const toEnd = dateTo + ' 23:59:59';
      list = list.filter(r => r.created_at && r.created_at <= toEnd);
    }
    return list;
  }, [reports, activeFilter, saleFilter, dateFrom, dateTo]);

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const hasActiveFilters = saleFilter || dateFrom || dateTo;

  const FILTER_TABS = [
    { key: 'pending', label: 'Chờ duyệt', color: '#b45309', bg: '#fef3c7' },
    { key: 'approved', label: 'Đã duyệt', color: '#065f46', bg: '#d1fae5' },
    { key: 'rejected', label: 'Đã từ chối', color: '#6b7280', bg: '#f3f4f6' },
    { key: 'all', label: 'Tất cả', color: 'var(--color-text)', bg: 'var(--color-bg)' },
  ] as const;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TicketIcon size={28} color="var(--color-primary)" /> Ticket Lỗi Data
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Quản lý và xét duyệt các báo cáo Data lỗi từ Tư vấn viên
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveFilter(tab.key as any)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: activeFilter === tab.key ? tab.color : 'var(--color-border)', background: activeFilter === tab.key ? tab.bg : 'transparent', color: activeFilter === tab.key ? tab.color : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
              {tab.label} {tab.key !== 'all' && `(${reports.filter(r => r.status === tab.key).length})`}
            </button>
          ))}
          <button onClick={fetchReports} disabled={loading} title="Làm mới" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            title="Thiết lập thông báo Ticket"
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-primary)',
              background: 'rgba(124,58,237,0.08)', cursor: 'pointer',
              color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s'
            }}
          >
            <Settings2 size={14} /> Cài đặt thông báo
          </button>
          <div style={{
            background: pendingCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: pendingCount > 0 ? 'var(--color-danger)' : '#10b981',
            padding: '8px 16px', borderRadius: 20, fontSize: '0.875rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4
          }}>
            {pendingCount > 0 ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            {pendingCount} chờ duyệt
          </div>
        </div>
      </div>

      {/* ── Filter bar: Sale + Date ── */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center',
        padding: '14px 18px',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.04) 100%)',
        border: '1px solid rgba(124,58,237,0.15)',
        borderRadius: 16,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 12px rgba(124,58,237,0.06), inset 0 1px 0 rgba(255,255,255,0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7c3aed', fontWeight: 700, fontSize: '0.8rem' }}>
          <Filter size={14} />
          <span>Bộ lọc</span>
        </div>

        <div style={{ width: 1, height: 20, background: 'rgba(124,58,237,0.2)', margin: '0 4px' }} />

        {/* Sale filter */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <CustomSelect 
            options={[
              { value: '', label: 'Tất cả Sale', icon: <Users size={16} /> },
              ...consultantOptions.map(name => ({
                value: name,
                label: name,
                avatar: ''
              }))
            ]}
            value={saleFilter}
            onChange={val => setSaleFilter(val.toString())}
            showAvatars={true}
            searchable={true}
            width={200}
          />
        </div>

        {/* Date from */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Calendar size={13} style={{ position: 'absolute', left: 9, color: dateFrom ? '#7c3aed' : '#94a3b8', zIndex: 1, pointerEvents: 'none' }} />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                fontSize: '0.8rem', padding: '7px 10px 7px 28px',
                borderRadius: 10,
                border: '1.5px solid',
                borderColor: dateFrom ? '#7c3aed' : 'rgba(124,58,237,0.2)',
                background: dateFrom ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.7)',
                color: dateFrom ? '#5b21b6' : '#64748b',
                outline: 'none',
                fontWeight: dateFrom ? 700 : 400,
                boxShadow: dateFrom ? '0 0 0 3px rgba(124,58,237,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            />
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>→</span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Calendar size={13} style={{ position: 'absolute', left: 9, color: dateTo ? '#7c3aed' : '#94a3b8', zIndex: 1, pointerEvents: 'none' }} />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{
                fontSize: '0.8rem', padding: '7px 10px 7px 28px',
                borderRadius: 10,
                border: '1.5px solid',
                borderColor: dateTo ? '#7c3aed' : 'rgba(124,58,237,0.2)',
                background: dateTo ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.7)',
                color: dateTo ? '#5b21b6' : '#64748b',
                outline: 'none',
                fontWeight: dateTo ? 700 : 400,
                boxShadow: dateTo ? '0 0 0 3px rgba(124,58,237,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            />
          </div>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button onClick={() => { setSaleFilter(''); setDateFrom(''); setDateTo(''); }}
            style={{
              fontSize: '0.75rem', padding: '6px 12px', borderRadius: 10,
              border: '1.5px solid #fca5a5', background: 'linear-gradient(135deg,#fff5f5,#fee2e2)',
              color: '#dc2626', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              boxShadow: '0 1px 4px rgba(220,38,38,0.12)',
              transition: 'all 0.15s'
            }}>
            ✕ Xóa lọc
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, background: 'rgba(255,255,255,0.6)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(124,58,237,0.1)' }}>
          {filteredReports.length}/{reports.length} tickets
        </span>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle size={40} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
              {hasActiveFilters ? 'Không có kết quả phù hợp' : 'Chưa có báo cáo lỗi nào'}
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto' }}>
              {hasActiveFilters ? 'Thử thay đổi bộ lọc để tìm kết quả khác.' : 'Hệ thống đang hoạt động trơn tru. Các báo cáo lỗi Data từ Sale sẽ hiển thị tại đây.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Thông tin Lead</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tư vấn viên</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Vòng phân bổ</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Lý do lỗi</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', background: 'transparent' }}>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={r.lead_name} size={36} color="#7c3aed" />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{r.lead_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                            <span>{r.lead_phone}</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                            {new Date(r.created_at).toLocaleString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', fontWeight: 500 }}>
                        <Avatar name={r.consultant_name} size={24} /> {r.consultant_name}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      {r.round_name && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
                          <Zap size={12} /> {r.round_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>{r.reason}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: r.status === 'pending' ? '#fef3c7' : r.status === 'approved' ? '#d1fae5' : '#f3f4f6',
                          color: r.status === 'pending' ? '#b45309' : r.status === 'approved' ? '#065f46' : '#6b7280'
                        }}>
                          {r.status === 'pending' ? 'Chờ duyệt' : r.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                        </div>
                        {r.status === 'rejected' && r.reject_reason && (
                          <div style={{ fontSize: '0.75rem', color: '#dc2626', background: '#fee2e2', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                            Lý do: {r.reject_reason}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      {r.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {r.zalo_chat_id && (
                            <button onClick={() => { setQuickMessageTarget({id: r.consultant_id, name: r.consultant_name}); setQuickMessageOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: '#0068ff' }} title="Nhắn Zalo Bot cho Sale">
                              <Bell size={14} />
                            </button>
                          )}
                          <button onClick={() => openRejectModal(r.id)} disabled={isActioning === r.id} className="btn outline sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', boxShadow: 'none' }}>
                            Từ chối
                          </button>
                          <button onClick={() => handleReportApprove(r.id)} disabled={isActioning === r.id} className="btn primary sm" style={{ background: '#10b981', borderColor: '#10b981', boxShadow: 'none' }}>
                            {isActioning === r.id ? 'Đang xử lý...' : 'Duyệt & Đền Bù'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                          {r.zalo_chat_id && (
                            <button onClick={() => { setQuickMessageTarget({id: r.consultant_id, name: r.consultant_name}); setQuickMessageOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: '#0068ff' }} title="Nhắn Zalo Bot cho Sale">
                              <Bell size={14} />
                            </button>
                          )}
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: r.status === 'approved' ? '#10b981' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, background: r.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg)', padding: '6px 12px', borderRadius: 20 }}>
                            {r.status === 'approved' ? <><CheckCircle size={14} /> Đã Đền Bù</> : 'Đã Từ chối'}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <TicketSettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* Reject Modal */}
      <CustomModal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Từ chối Báo cáo Lỗi">
        <form onSubmit={submitReject}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Vui lòng nhập lý do từ chối để Tư vấn viên biết lý do không được đền bù Data:
            </p>
            <div className="form-group">
              <label className="form-label">Lý do từ chối <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <textarea
                className="form-input"
                placeholder="Ví dụ: Khách bảo có nhu cầu nhưng Sale tư vấn chưa tốt..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
                autoFocus
                style={{ minHeight: 80, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setRejectModalOpen(false)}>Hủy</button>
              <button type="submit" className="btn primary" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} disabled={isActioning !== null}>
                {isActioning ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        </form>
      </CustomModal>

      {/* Quick Message Modal */}
      <CustomModal isOpen={quickMessageOpen} onClose={() => setQuickMessageOpen(false)} title={`Nhắn tin cho ${quickMessageTarget?.name || 'Sale'}`}>
        <form onSubmit={handleSendQuickMessage}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>Tin nhắn sẽ được tự động gửi qua Zalo Bot (nếu có) và Email với tiêu đề [ TIN NHẮN TỪ QUẢN TRỊ VIÊN ]</p>
            <div className="form-group">
              <label className="form-label">Nội dung tin nhắn <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <textarea 
                className="form-input" 
                placeholder="Nhập nội dung cần thông báo cho Sale..." 
                value={quickMessageText}
                onChange={e => setQuickMessageText(e.target.value)}
                required
                autoFocus
                style={{ minHeight: 100, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setQuickMessageOpen(false)}>Hủy</button>
              <button type="submit" className="btn primary" disabled={isSendingMsg} style={{ background: '#0068ff', borderColor: '#0068ff' }}>
                {isSendingMsg ? 'Đang gửi...' : 'Gửi tin nhắn'}
              </button>
            </div>
          </div>
        </form>
      </CustomModal>

    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// TicketSettingsModal — Chọn admin nhận email thông báo Ticket
// ─────────────────────────────────────────────────────────────
const TicketSettingsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      fetchAPI('get_accounts'),
      fetchAPI('get_ticket_settings')
    ]).then(([accRes, settingsRes]) => {
      if (accRes.success) setAccounts(accRes.data);
      if (settingsRes.success) setSelectedIds(settingsRes.data ?? []);
    }).catch((e: any) => toast.error('Lỗi tải cấu hình: ' + e.message))
      .finally(() => setLoadingData(false));
  }, [open]);

  const toggle = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchAPI('save_ticket_settings', {
        method: 'POST',
        body: JSON.stringify({ admin_ids: selectedIds })
      });
      if (res.success) {
        toast.success('Đã lưu cài đặt thông báo Ticket!');
        onClose();
      } else {
        toast.error(res.message || 'Lỗi lưu cài đặt');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <CustomModal isOpen={open} onClose={onClose} title="Cài đặt thông báo Ticket">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loadingData ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Đang tải...</div>
        ) : (
          <>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
              Admin đầu tiên nhận email <strong>To:</strong> — Các admin còn lại nhận <strong>CC:</strong>. Admin phải có email mới có thể được chọn.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
              {accounts.filter((a: any) => a.role === 'admin' || a.role === 'assistant').map((acc: any) => {
                const isSelected = selectedIds.includes(acc.id);
                const noEmail = !acc.email;
                return (
                  <div
                    key={acc.id}
                    onClick={() => !noEmail && toggle(acc.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      borderRadius: 'var(--radius-lg)', border: '1px solid',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      background: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg)',
                      cursor: noEmail ? 'not-allowed' : 'pointer',
                      opacity: noEmail ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9rem' }}>{acc.name}</div>
                      <div style={{ fontSize: '0.8rem', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: 2 }}>
                        {noEmail
                          ? <span style={{ color: 'var(--color-danger)' }}>⚠ Chưa cài email — không nhận được</span>
                          : acc.email
                        }
                      </div>
                    </div>
                    {/* Role badge */}
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--radius-md)', flexShrink: 0,
                      background: acc.role === 'admin' ? 'rgba(124,58,237,0.1)' : 'rgba(16,185,129,0.1)',
                      color: acc.role === 'admin' ? 'var(--color-primary)' : '#10b981'
                    }}>
                      {acc.role === 'admin' ? 'Admin' : 'Assistant'}
                    </span>
                    {/* Toggle switch */}
                    <div style={{
                      width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                      background: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      position: 'relative', transition: 'background 0.2s', marginLeft: 8
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
                        background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        left: isSelected ? 21 : 3, transition: 'left 0.2s'
                      }} />
                    </div>
                  </div>
                );
              })}
              {accounts.filter((a: any) => a.role === 'admin' || a.role === 'assistant').length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Chưa có admin nào trong hệ thống</div>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button onClick={onClose} className="btn ghost" type="button">Hủy</button>
          <button
            onClick={handleSave}
            disabled={saving || loadingData}
            className="btn primary"
            type="button"
          >
            <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </CustomModal>
  );
};
