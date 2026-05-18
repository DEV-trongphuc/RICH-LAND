import { useEffect, useState, useMemo } from 'react';
import { AlertCircle, Shield, Users, CheckCircle, Ticket as TicketIcon, RefreshCw, Zap, Filter, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAPI } from '../utils/api';
import { TableSkeleton } from '../components/ui/Skeleton';

export const Tickets = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActioning, setIsActioning] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // ── NEW: Sale + Date filters ───────────────────────────────────────────────
  const [saleFilter, setSaleFilter] = useState('');   // consultant_name
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
          <Users size={13} style={{ position: 'absolute', left: 10, color: saleFilter ? '#7c3aed' : '#94a3b8', zIndex: 1, pointerEvents: 'none' }} />
          <select
            value={saleFilter}
            onChange={e => setSaleFilter(e.target.value)}
            style={{
              fontSize: '0.8rem', padding: '7px 32px 7px 30px',
              borderRadius: 10,
              border: '1.5px solid',
              borderColor: saleFilter ? '#7c3aed' : 'rgba(124,58,237,0.2)',
              background: saleFilter ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.7)',
              color: saleFilter ? '#5b21b6' : '#64748b',
              fontWeight: saleFilter ? 700 : 500,
              outline: 'none', cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
              boxShadow: saleFilter ? '0 0 0 3px rgba(124,58,237,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'all 0.2s',
              minWidth: 140,
            }}
          >
            <option value="">Tất cả Sale</option>
            {consultantOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <svg style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: saleFilter ? '#7c3aed' : '#94a3b8' }} width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
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
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', background: r.status === 'pending' ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
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
                      {r.round_name && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
                          <Zap size={12} /> {r.round_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
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
