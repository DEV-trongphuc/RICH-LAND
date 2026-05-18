import { useEffect, useState } from 'react';
import { AlertCircle, Shield, Users, CheckCircle, Ticket as TicketIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAPI } from '../utils/api';

export const Tickets = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActioning, setIsActioning] = useState<number | null>(null);
  // NEW-06 fix: status filter tabs
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

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

  useEffect(() => {
    fetchReports();
  }, []);

  const handleReportAction = async (reportId: number, action: 'approve' | 'reject') => {
    if (isActioning) return;
    setIsActioning(reportId);
    try {
      const endpoint = action === 'approve' ? 'approve_report' : 'reject_report';
      const res = await fetchAPI(endpoint, {
        method: 'POST',
        body: JSON.stringify({ id: reportId })
      });
      if (res.success) {
        toast.success(action === 'approve' ? 'Đã duyệt đền bù Data!' : 'Đã từ chối báo cáo!');
        fetchReports();
      } else {
        toast.error(res.message || 'Có lỗi xảy ra');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsActioning(null);
  };

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const filteredReports = activeFilter === 'all' ? reports : reports.filter(r => r.status === activeFilter);

  const FILTER_TABS = [
    { key: 'pending', label: 'Chờ duyệt', color: '#b45309', bg: '#fef3c7' },
    { key: 'approved', label: 'Đã duyệt', color: '#065f46', bg: '#d1fae5' },
    { key: 'rejected', label: 'Đã từ chối', color: '#6b7280', bg: '#f3f4f6' },
    { key: 'all', label: 'Tất cả', color: 'var(--color-text)', bg: 'var(--color-bg)' },
  ] as const;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TicketIcon size={28} color="var(--color-primary)" /> Ticket Lỗi Data
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Quản lý và xét duyệt các báo cáo Data lỗi từ Tư vấn viên
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* NEW-06: Filter tabs */}
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveFilter(tab.key as any)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: activeFilter === tab.key ? tab.color : 'var(--color-border)', background: activeFilter === tab.key ? tab.bg : 'transparent', color: activeFilter === tab.key ? tab.color : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
              {tab.label} {tab.key !== 'all' && `(${reports.filter(r => r.status === tab.key).length})`}
            </button>
          ))}
          <div style={{ 
            background: pendingCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
            color: pendingCount > 0 ? 'var(--color-danger)' : '#10b981', 
            padding: '8px 16px', 
            borderRadius: 20, 
            fontSize: '0.875rem', 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 8
          }}>
            {pendingCount > 0 ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            {pendingCount} chờ duyệt
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-muted)' }}>Đang tải dữ liệu...</div>
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle size={40} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Chưa có báo cáo lỗi nào</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto' }}>Hệ thống đang hoạt động trơn tru. Các báo cáo lỗi Data từ Sale sẽ hiển thị tại đây.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Thông tin Lead</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tư vấn viên</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Lý do lỗi</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', background: r.status === 'pending' ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }} className="hover:bg-slate-50">
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{r.lead_name}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Shield size={14} /> {r.lead_phone}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: 4 }}>
                        {new Date(r.created_at).toLocaleString('vi-VN')}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', fontWeight: 500 }}>
                        <Users size={16} color="var(--color-text-muted)" /> {r.consultant_name}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      {/* NEW-07 fix: reason + status badge always visible */}
                      <div style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>{r.reason}</div>
                      <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: r.status === 'pending' ? '#fef3c7' : r.status === 'approved' ? '#d1fae5' : '#f3f4f6',
                        color: r.status === 'pending' ? '#b45309' : r.status === 'approved' ? '#065f46' : '#6b7280'
                      }}>
                        {r.status === 'pending' ? '⏳ Chờ duyệt' : r.status === 'approved' ? '✅ Đã duyệt' : '❌ Từ chối'}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      {r.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleReportAction(r.id, 'reject')} disabled={isActioning === r.id} className="btn ghost sm" style={{ color: 'var(--color-text-muted)' }}>Từ chối</button>
                          <button onClick={() => handleReportAction(r.id, 'approve')} disabled={isActioning === r.id} className="btn primary sm" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                            {isActioning === r.id ? 'Đang xử lý...' : 'Duyệt & Đền Bù'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
    </div>
  );
};
