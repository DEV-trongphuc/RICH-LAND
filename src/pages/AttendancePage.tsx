import React, { useEffect, useState } from 'react';
import { withRouterFreezer } from '../components/RouterFreezer';
import { fetchAPI } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import { Avatar } from '../components/ui/Avatar';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Clock, Calendar, Check, X, Trash2, Eye, ShieldAlert, AlertCircle, CheckCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const AttendancePageInner = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);

  // Filter states
  const [filterDate, setFilterDate] = useState<string>(() => {
    return '2026-07-01'; 
  });
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Preview Image Modal state
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Confirm delete states
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action submitting state
  const [actionSubmittingId, setActionSubmittingId] = useState<number | null>(null);

  const fetchConsultantsList = async () => {
    try {
      const res = await fetchAPI('get_consultants');
      if (res.success) {
        setConsultants(res.data || []);
      }
    } catch (e: any) {
      console.error('Error fetching consultants list:', e);
    }
  };

  const fetchCheckInsList = async () => {
    setLoading(true);
    try {
      const query = `check-ins&date=${filterDate}&status=${filterStatus}&user_id=${filterUser}`;
      const res = await fetchAPI(query);
      if (res.success) {
        setCheckIns(res.data || []);
      } else {
        toast.error(res.message || t('Lỗi khi tải danh sách chấm công'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultantsList();
  }, []);

  useEffect(() => {
    fetchCheckInsList();
  }, [filterDate, filterUser, filterStatus]);

  const handleUpdateStatus = async (id: number, status: 'approved' | 'rejected', reason?: string) => {
    setActionSubmittingId(id);
    try {
      const res = await fetchAPI(`check-ins/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, reason })
      });
      if (res.success) {
        toast.success(status === 'approved' ? t('Đã duyệt chấm công thành công') : t('Đã từ chối chấm công'));
        fetchCheckInsList();
      } else {
        toast.error(res.message || t('Cập nhật trạng thái thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi: ') + err.message);
    } finally {
      setActionSubmittingId(null);
    }
  };

  const openDeleteConfirm = (id: number) => {
    setDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteCheckIn = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetchAPI(`check-ins/${deleteId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        toast.success(t('Đã xóa bản ghi chấm công thành công!'));
        setConfirmDeleteOpen(false);
        fetchCheckInsList();
      } else {
        toast.error(res.message || t('Lỗi khi xóa bản ghi'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const totalCount = checkIns.length;
  const approvedCount = checkIns.filter(c => c.status === 'approved').length;
  const pendingCount = checkIns.filter(c => c.status === 'pending_approval').length;
  const rejectedCount = checkIns.filter(c => c.status === 'rejected').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
            {t('Quản lý Chấm công')}
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            {t('Kiểm duyệt ảnh selfie chấm công hàng ngày và phê duyệt đi trễ của tư vấn viên.')}
          </p>
        </div>
      </div>

      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <div className="stat-card hover-lift" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('TỔNG BẢN GHI')}</div>
          <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>{totalCount}</div>
        </div>
        <div className="stat-card hover-lift" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>{t('ĐÃ DUYỆT / HỢP LỆ')}</div>
          <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>{approvedCount}</div>
        </div>
        <div className="stat-card hover-lift" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--color-warning)', fontWeight: 600 }}>{t('ĐANG CHỜ DUYỆT')}</div>
          <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: '4px' }}>{pendingCount}</div>
        </div>
        <div className="stat-card hover-lift" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>{t('BỊ TỪ CHỐI')}</div>
          <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: '4px' }}>{rejectedCount}</div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Ngày chấm công')}</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '10px', color: 'var(--color-text-light)', pointerEvents: 'none' }} />
              <input
                type="date"
                className="form-control"
                style={{ paddingLeft: '32px', height: '38px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Tư vấn viên')}</label>
            <CustomSelect
              options={[
                { value: 'all', label: t('Tất cả nhân viên') },
                ...consultants.map(c => ({ value: String(c.id), label: c.name }))
              ]}
              value={filterUser}
              onChange={(val) => setFilterUser(String(val))}
              width="100%"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Trạng thái duyệt')}</label>
            <CustomSelect
              options={[
                { value: 'all', label: t('Tất cả trạng thái') },
                { value: 'approved', label: t('Đã duyệt / Đúng giờ') },
                { value: 'pending_approval', label: t('Chờ duyệt đi trễ') },
                { value: 'rejected', label: t('Đã từ chối') }
              ]}
              value={filterStatus}
              onChange={(val) => setFilterStatus(String(val))}
              width="100%"
            />
          </div>

          <button
            onClick={() => {
              setFilterDate('2026-07-01');
              setFilterUser('all');
              setFilterStatus('all');
            }}
            className="btn outline sm"
            style={{ marginTop: '20px', height: '38px', borderRadius: '8px' }}
          >
            {t('Đặt lại bộ lọc')}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', background: 'var(--color-bg)' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TƯ VẤN VIÊN')}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('GIỜ QUY ĐỊNH')}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('GIỜ CHECK-IN')}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>{t('ẢNH SELFIE')}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('LÝ DO TRỄ / GHI CHÚ')}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TRẠNG THÁI')}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'right' }}>{t('HÀNH ĐỘNG')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => <TableRowSkeleton key={i} cols={7} />)
              ) : checkIns.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    <Info size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                    {t('Không tìm thấy dữ liệu chấm công cho ngày đã chọn.')}
                  </td>
                </tr>
              ) : (
                checkIns.map((row) => {
                  const isLate = row.check_in_time > (row.work_start_time || '08:00');
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem' }} className="group table-row-hover">
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={row.user_avatar} name={row.user_name} size={32} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.user_name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{row.user_email}</span>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--color-text-light)' }}>
                        {row.work_start_time || '08:00'}
                      </td>

                      <td style={{ padding: '12px 16px', fontWeight: 600, color: isLate ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} />
                          {row.check_in_time}
                          {isLate && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 500, backgroundColor: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>
                              {t('Trễ')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {row.selfie_url ? (
                          <div
                            style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
                            onClick={() => setPreviewImage(row.selfie_url)}
                          >
                            <img
                              src={row.selfie_url}
                              style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-border)' }}
                              alt="Selfie"
                            />
                            <div className="overlay" style={{
                              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                              background: 'rgba(0,0,0,0.4)', borderRadius: '6px', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s'
                            }}>
                              <Eye size={12} style={{ color: '#fff' }} />
                            </div>
                            <style>{`
                              div:hover .overlay { opacity: 1 !important; }
                            `}</style>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>N/A</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--color-text)', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {row.reason ? (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                            <ShieldAlert size={14} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                            <span>{row.reason}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>{t('Không có')}</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          backgroundColor:
                            row.status === 'approved' ? 'var(--color-success-light)' :
                            row.status === 'pending_approval' ? 'var(--color-warning-light)' :
                            'var(--color-danger-light)',
                          color:
                            row.status === 'approved' ? 'var(--color-success)' :
                            row.status === 'pending_approval' ? 'var(--color-warning)' :
                            'var(--color-danger)',
                        }}>
                          {row.status === 'approved' && <CheckCircle size={12} />}
                          {row.status === 'pending_approval' && <AlertCircle size={12} />}
                          {row.status === 'rejected' && <X size={12} />}
                          {row.status === 'approved' ? t('Đã duyệt / Đúng giờ') :
                           row.status === 'pending_approval' ? t('Chờ duyệt đi trễ') :
                           t('Bị từ chối')}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {row.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(row.id, 'approved')}
                                disabled={actionSubmittingId === row.id}
                                className="btn success sm icon-only"
                                title={t('Duyệt nhận lead')}
                                style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(row.id, 'rejected')}
                                disabled={actionSubmittingId === row.id}
                                className="btn danger sm icon-only"
                                title={t('Từ chối nhận lead')}
                                style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openDeleteConfirm(row.id)}
                            className="btn outline sm danger icon-only"
                            title={t('Xóa bản ghi')}
                            style={{ width: 28, height: 28, padding: 0, borderRadius: '6px', border: '1px solid var(--color-border)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewImage && (
        <CustomModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          title={t('Ảnh selfie check-in')}
          width="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <img
              src={previewImage}
              style={{ width: '100%', maxHeight: '450px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#000' }}
              alt="Selfie phóng to"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="btn secondary sm"
              style={{ alignSelf: 'flex-end' }}
            >
              {t('Đóng')}
            </button>
          </div>
        </CustomModal>
      )}

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteCheckIn}
        title={t('Cảnh báo Xóa Bản ghi Chấm công')}
        message={t('Bạn có chắc chắn muốn xóa vĩnh viễn bản ghi chấm công này không? Hành động này không thể hoàn tác.')}
        confirmText={t('Xóa vĩnh viễn')}
      />
    </div>
  );
};

export const AttendancePage = withRouterFreezer(AttendancePageInner, '/attendance');
export default AttendancePage;
