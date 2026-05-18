import React, { useState, useMemo, useEffect } from 'react';
import { Database, Search, Filter, ChevronLeft, ChevronRight, Download, RefreshCw, User, Phone, Mail, Clock, Tag, ExternalLink, AlertTriangle } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

type Lead = {
  id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: 'assigned' | 'pending' | 'duplicate' | 'rule_6_month';
  assigned_to_name: string;
  round_name: string;
  created_at: string;
  type?: string;
  note?: string;
  report_status?: string;
};

const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#0ea5e9', 
  '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#14b8a6', '#6366f1'
];

const getColorForName = (name: string) => {
  if (!name || name === '-') return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

import { fetchAPI } from '../utils/api';

export const DataList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const dateFilter = searchParams.get('date') || 'all';
  const consultantFilter = searchParams.get('consultant') || 'all';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const json = await fetchAPI(`get_logs&date=${encodeURIComponent(searchParams.get('date') || 'all')}`);
      if (json.success) {
        // Map the backend structure to the frontend structure
        const mappedLeads = json.data.map((item: any) => ({
          id: item.id,
          name: item.lead_name || 'Khách hàng ẩn danh',
          phone: item.phone || '-',
          email: item.email || '-',
          source: item.source || '-',
          type: item.type || '-',
          note: item.note || '',
          status: item.status,
          assigned_to_name: item.assigned_to_name || '-',
          round_name: item.round_name || '-',
          created_at: item.created_at,
          report_status: item.report_status
        }));
        setLeads(mappedLeads);
        // BUG-04 fix: track truncation
        setTotalCount(json.total_count ?? mappedLeads.length);
        setLimitReached((json.total_count ?? 0) > (json.limit ?? 500));
      }
    } catch (e: any) {
      toast.error('Lỗi tải dữ liệu: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
    fetchConsultants();
  }, [searchParams.get('date')]);

  const updateParams = (key: string, value: string) => {
    setSearchParams(prev => {
      if (value === 'all' || value === '') prev.delete(key);
      else prev.set(key, value);
      return prev;
    }, { replace: true });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [consultants, setConsultants] = useState<{ id: number; name: string; status: string }[]>([]);
  const [reassignConsId, setReassignConsId] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);

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

  const handleReassign = async () => {
    if (!selectedLead || !reassignConsId) return;
    setIsReassigning(true);
    try {
      const res = await fetchAPI('reassign_lead', {
        method: 'POST',
        body: JSON.stringify({
          log_id: selectedLead.id,
          new_consultant_id: Number(reassignConsId)
        })
      });
      if (res.success) {
        toast.success('Giao lại Tư vấn viên thành công!'); // BUG-03 fix: was alert()
        setSelectedLead(null);
        setReassignConsId('');
        fetchLeads();
      } else {
        toast.error('Lỗi: ' + (res.message || 'Không thể giao lại')); // BUG-03 fix
      }
    } catch (err: any) {
      toast.error('Đã xảy ra lỗi: ' + err.message); // BUG-03 fix
    }
    setIsReassigning(false);
  };

  const ITEMS_PER_PAGE = 50;

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLeads().then(() => setIsRefreshing(false));
  };

  // BUG-05 fix: Implement CSV export from current filtered data
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      toast.error('Không có dữ liệu để xuất!');
      return;
    }
    const headers = ['STT', 'Họ và Tên', 'Số Điện Thoại', 'Email', 'Nguồn', 'Loại', 'Trạng thái', 'TVV tiếp nhận', 'Vòng chia', 'Thời gian nhận'];
    const statusMap: Record<string, string> = { assigned: 'Đã chia', pending: 'Chờ chia', duplicate: 'Trùng lặp', unassigned: 'Chưa phân bổ' };
    const rows = filteredLeads.map((l, i) => [
      i + 1,
      l.name,
      l.phone,
      l.email,
      l.source,
      l.type,
      statusMap[l.status] || l.status,
      l.assigned_to_name,
      l.round_name,
      l.created_at
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_export_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${filteredLeads.length} dòng dữ liệu!`);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            lead.phone.includes(searchTerm) || 
                            lead.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesConsultant = consultantFilter === 'all' || lead.assigned_to_name === consultantFilter;
      return matchesSearch && matchesStatus && matchesConsultant;
    });
  }, [searchTerm, statusFilter, dateFilter, consultantFilter, leads]);

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, consultantFilter]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'assigned': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>Đã chia</span>;
      case 'pending': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>Chờ chia</span>;
      case 'duplicate': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>Trùng lặp</span>;
      case 'rule_6_month': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Quy định 6 tháng</span>;
      default: return null;
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 66px)', minHeight: 0 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem', flexShrink: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={24} color="var(--color-primary)" /> Quản lý Data
          </h1>
          <p className="page-subtitle">Xem lịch sử, theo dõi tiến trình và quản lý toàn bộ dữ liệu Khách hàng.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn outline" onClick={handleRefresh} style={{ padding: '0 0.875rem' }}>
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} /> <span className="hidden sm:inline">Làm mới</span>
          </button>
          <button className="btn primary" onClick={handleExportCSV} style={{ padding: '0 1.25rem' }}>
            <Download size={16} /> Xuất CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
          <input 
            className="form-input" 
            placeholder="Tìm theo tên, SĐT, email..." 
            style={{ paddingLeft: 36 }}
            value={searchTerm}
            onChange={e => updateParams('search', e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 4px', height: 44 }}>
          <Clock size={16} style={{ color: 'var(--color-text-muted)', marginLeft: 8 }} />
          <select 
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: 'var(--color-text)', padding: '0 12px', height: '100%', cursor: 'pointer' }}
            value={dateFilter}
            onChange={e => updateParams('date', e.target.value)}
          >
            <option value="all">Tất cả thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="7days">7 ngày qua</option>
            <option value="30days">30 ngày qua</option>
            <option value="this_month">Tháng này</option>
            <option value="last_month">Tháng trước</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 4px', height: 44 }}>
          <Filter size={16} style={{ color: 'var(--color-text-muted)', marginLeft: 8 }} />
          <select 
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: 'var(--color-text)', padding: '0 12px', height: '100%', cursor: 'pointer' }}
            value={statusFilter}
            onChange={e => updateParams('status', e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="assigned">Đã chia</option>
            <option value="pending">Chờ chia</option>
            <option value="duplicate">Trùng lặp</option>
            <option value="rule_6_month">Quy định 6 tháng</option>
            <option value="error">Lỗi / Không xác định</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 4px', height: 44 }}>
          <User size={16} style={{ color: 'var(--color-text-muted)', marginLeft: 8 }} />
          <select 
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: 'var(--color-text)', padding: '0 12px', height: '100%', cursor: 'pointer' }}
            value={consultantFilter}
            onChange={e => updateParams('consultant', e.target.value)}
          >
            <option value="all">Tất cả TVV</option>
            {Array.from(new Set(leads.map(l => l.assigned_to_name).filter(n => n && n !== '-'))).map(name => (
              <option key={name as string} value={name as string}>{name as string}</option>
            ))}
          </select>
        </div>
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          {/* BUG-04 fix: show warning if data is truncated */}
          {limitReached && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600 }}>
              <AlertTriangle size={14} />
              Đang hiển thị 500/{totalCount} bản ghi. Hãy lọc để xem đầy đủ.
            </div>
          )}
          Tổng cộng: <strong style={{ color: 'var(--color-text)', marginLeft: 4 }}>{filteredLeads.length}</strong> data
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto' }} className="table-wrap custom-scrollbar">
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Đang tải dữ liệu...
            </div>
          ) : (
          <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Khách hàng</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Liên hệ</th>
                {/* <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Nguồn</th> */}
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Trạng thái</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Phân bổ cho</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Thời gian nhận</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.length > 0 ? paginatedLeads.map(lead => {
                const getInitials = (name: string) => {
                  if (!name || name === '-') return '?';
                  const parts = name.trim().split(' ');
                  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                  return name.substring(0, 2).toUpperCase();
                };

                return (
                  <tr 
                    key={lead.id} 
                    className="lead-row"
                    onClick={() => setSelectedLead(lead)}
                    style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="avatar-placeholder sm" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))', color: 'white', border: 'none', fontSize: '0.7rem' }}>
                          {getInitials(lead.name)}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{lead.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        {(lead.phone?.length >= 8) ? `${lead.phone.slice(0, lead.phone.length - 6)}***${lead.phone.slice(-3)}` : lead.phone}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{lead.email}</div>
                    </td>
                    {/* <td style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>{lead.source}</td> */}
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        {getStatusBadge(lead.status)}
                        {lead.report_status === 'pending' && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d' }}>⏳ Report Pending</span>}
                        {lead.report_status === 'approved' && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5' }}>🚩 Data Lỗi</span>}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {lead.assigned_to_name !== '-' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="avatar-placeholder sm" style={{ background: getColorForName(lead.assigned_to_name), color: 'white', border: 'none', fontSize: '0.7rem' }}>
                            {getInitials(lead.assigned_to_name)}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{lead.assigned_to_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{lead.round_name}</div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                      )}
                    </td>
                  <td style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>{lead.created_at}</td>
                </tr>
              );
            }) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    Không tìm thấy dữ liệu phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Hiển thị <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, filteredLeads.length)}</span> trên <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{filteredLeads.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: currentPage === 1 ? 'var(--color-bg)' : 'var(--color-surface)', color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={16} />
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Logic to show a window of pages around current
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 2 + i;
                    if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      style={{ 
                        width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                        border: currentPage === pageNum ? 'none' : '1px solid var(--color-border)',
                        background: currentPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: currentPage === pageNum ? 'white' : 'var(--color-text)',
                        cursor: 'pointer'
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: currentPage === totalPages ? 'var(--color-bg)' : 'var(--color-surface)', color: currentPage === totalPages ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <CustomModal
        isOpen={selectedLead !== null}
        onClose={() => {
          setSelectedLead(null);
          setReassignConsId('');
        }}
        title="Chi tiết Khách hàng"
        width="600px"
      >
        {selectedLead && (
          <div style={{ padding: '1.5rem', background: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="avatar-placeholder" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))', color: 'white', border: 'none', width: 48, height: 48, fontSize: '1.25rem' }}>
                {selectedLead.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{selectedLead.name}</h2>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>ID: #{selectedLead.id}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Phone size={14} /> Số điện thoại</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.phone}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Mail size={14} /> Email</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.email}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><ExternalLink size={14} /> Nguồn Data</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.source}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Tag size={14} /> Trạng thái</div>
                <div>{getStatusBadge(selectedLead.status)}</div>
              </div>
            </div>

            <div style={{ background: '#fefce8', borderLeft: '4px solid #eab308', padding: '1rem', borderRadius: '0 12px 12px 0', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginRight: 8 }}>Loại Data:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.type !== '-' ? selectedLead.type : 'Không có'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginRight: 8 }}>Ghi chú / Khác:</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{selectedLead.note ? selectedLead.note : <em style={{color: 'var(--color-text-light)'}}>Không có ghi chú</em>}</span>
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>Thông tin Phân bổ</h3>
            
            {selectedLead.assigned_to_name !== '-' ? (
              <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="avatar-placeholder" style={{ background: getColorForName(selectedLead.assigned_to_name), color: 'white', border: 'none', width: 40, height: 40, fontSize: '1rem' }}>
                    {selectedLead.assigned_to_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Người tiếp nhận</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{selectedLead.assigned_to_name}</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> Vòng chia</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.round_name}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Clock size={12} /> Thời gian nhận</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.created_at}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: 12, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Chưa có thông tin phân bổ cho Khách hàng này.
              </div>
            )}

            {/* Reassignment section */}
            <div style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={16} color="var(--color-primary)" /> Giao lại Tư vấn viên (Không ảnh hưởng vòng xoay)
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
                Hệ thống sẽ cập nhật người tiếp nhận và tự động gửi email thông báo cho TVV mới mà không làm thay đổi hay gián đoạn thứ tự quay vòng chia số của Vòng.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <select 
                    className="form-input" 
                    value={reassignConsId} 
                    onChange={e => setReassignConsId(e.target.value)}
                    style={{ height: 38, fontSize: '0.875rem', border: '1px solid #cbd5e1', background: 'white' }}
                  >
                    <option value="">-- Chọn Tư vấn viên mới --</option>
                    {consultants.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  className="btn primary" 
                  onClick={handleReassign}
                  disabled={isReassigning || !reassignConsId}
                  style={{ height: 38, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, padding: '0 1rem', fontSize: '0.875rem', fontWeight: 700 }}
                >
                  {isReassigning ? <RefreshCw size={14} className="spin" /> : null}
                  Xác nhận giao
                </button>
              </div>
            </div>
            
          </div>
        )}
      </CustomModal>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .lead-row:hover { background: var(--color-bg) !important; }
      `}</style>
    </div>
  );
};
