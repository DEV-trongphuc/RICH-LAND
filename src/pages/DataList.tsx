import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Database, Search, Filter, ChevronLeft, ChevronRight, Download, RefreshCw, User, Phone, Mail, Clock, Tag, ExternalLink, AlertTriangle, Plus } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Avatar } from '../components/ui/Avatar';
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

  // Manual Add states
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualData, setManualData] = useState({ name: '', phone: '', email: '', source: '', type: '', note: '' });
  const [previewCons, setPreviewCons] = useState<any>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [overrideConsId, setOverrideConsId] = useState<string>('');
  const [compensateSkipped, setCompensateSkipped] = useState(true);
  
  const previewTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!showManualAdd) return;
    
    // Debounce preview
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
          // If we override, we might want to clear override if rules change, but let's leave it manual
        }
      } catch (e: any) {
        // ignore network error on preview
      }
      setIsPreviewing(false);
    }, 500);
    
  }, [manualData, showManualAdd]);

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
        setShowManualAdd(false);
        setManualData({ name: '', phone: '', email: '', source: '', type: '', note: '' });
        setPreviewCons(null);
        setOverrideConsId('');
        setCompensateSkipped(true);
        fetchLeads();
      } else {
        toast.error(json.message || 'Thêm thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSubmittingManual(false);
  };

  const ITEMS_PER_PAGE = 50;

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLeads().then(() => setIsRefreshing(false));
  };

  // BUG-05 fix: Implement CSV export from current filtered data
  // BUG-05 fix: Implement CSV export from current filtered data using Backend Stream to prevent browser/server OOM
  const handleExportCSV = () => {
    toast.loading('Đang chuẩn bị dữ liệu xuất CSV...', { id: 'export' });
    try {
      const date = encodeURIComponent(searchParams.get('date') || 'all');
      const search = encodeURIComponent(searchTerm);
      const status = encodeURIComponent(statusFilter);
      const consultant = encodeURIComponent(consultantFilter);
      
      const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api.php` : 'https://open.domation.net/sale_data/api.php';
      const token = localStorage.getItem('domation_token');
      
      const url = `${BASE_URL}?action=export_csv&date=${date}&search=${search}&status=${status}&consultant=${consultant}&token=${token}`;
      window.location.href = url;
      
      setTimeout(() => {
        toast.success('Đã tải xuống file CSV an toàn!', { id: 'export' });
      }, 1500);
    } catch (err) {
      toast.error('Có lỗi xảy ra khi xuất dữ liệu', { id: 'export' });
    }
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
      case 'compensation': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#e0e7ff', color: '#4f46e5' }}>Data Bù</span>;
      case 'error': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>Bị Lỗi</span>;
      case 'pending': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>Chờ chia</span>;
      case 'reminder': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#fce7f3', color: '#db2777' }}>Nhắc lại</span>;
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
          <button className="btn outline" onClick={() => setShowManualAdd(true)} style={{ padding: '0 1rem', background: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' }}>
            <Plus size={16} /> <span className="hidden sm:inline">Thêm Data</span>
          </button>
          <button className="btn outline" onClick={handleRefresh} style={{ padding: '0 0.875rem' }}>
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} /> <span className="hidden sm:inline">Làm mới</span>
          </button>
          <button className="btn primary" onClick={handleExportCSV} style={{ padding: '0 1.25rem' }}>
            <Download size={16} /> Xuất CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="responsive-filter-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexShrink: 0, flexWrap: 'wrap' }}>
        <div className="responsive-filter-item" style={{ position: 'relative', width: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
          <input 
            className="form-input" 
            placeholder="Tìm theo tên, SĐT, email..." 
            style={{ paddingLeft: 36, width: '100%' }}
            value={searchTerm}
            onChange={e => updateParams('search', e.target.value)}
          />
        </div>
        
        <div className="responsive-filter-item">
          <CustomSelect 
            options={[
              { value: 'all', label: 'Tất cả thời gian', icon: <Clock size={16} /> },
              { value: 'today', label: 'Hôm nay' },
              { value: 'yesterday', label: 'Hôm qua' },
              { value: '7days', label: '7 ngày qua' },
              { value: '30days', label: '30 ngày qua' },
              { value: 'this_month', label: 'Tháng này' },
              { value: 'last_month', label: 'Tháng trước' }
            ]}
            value={dateFilter}
            onChange={val => updateParams('date', val.toString())}
            width={200}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect 
            options={[
              { value: 'all', label: 'Tất cả trạng thái', icon: <Filter size={16} /> },
              { value: 'assigned', label: 'Đã chia' },
              { value: 'compensation', label: 'Data Bù' },
              { value: 'pending', label: 'Chờ chia' },
              { value: 'reminder', label: 'Nhắc lại' },
              { value: 'duplicate', label: 'Trùng lặp' },
              { value: 'rule_6_month', label: 'Quy định 6 tháng' },
              { value: 'error', label: 'Bị Lỗi' }
            ]}
            value={statusFilter}
            onChange={val => updateParams('status', val.toString())}
            width={200}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect 
            options={[
              { value: 'all', label: 'Tất cả TVV', icon: <User size={16} /> },
              ...Array.from(new Set(leads.map(l => l.assigned_to_name).filter(n => n && n !== '-'))).map(name => ({
                value: name as string,
                label: name as string,
                avatar: '' // We use name for Avatar initials
              }))
            ]}
            value={consultantFilter}
            onChange={val => updateParams('consultant', val.toString())}
            showAvatars={true}
            searchable={true}
            width={220}
          />
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
          <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Khách hàng</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Liên hệ</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Trạng thái</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Phân bổ cho</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Thời gian nhận</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(8)].map((_, i) => (
                <tr key={`skel-${i}`}>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-border)', animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                      <div>
                        <div style={{ width: 120, height: 16, background: 'var(--color-border)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                        <div style={{ width: 80, height: 12, background: 'var(--color-border-light)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                     <div style={{ width: 100, height: 16, background: 'var(--color-border)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                     <div style={{ width: 140, height: 12, background: 'var(--color-border-light)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                     <div style={{ width: 80, height: 24, background: 'var(--color-border)', borderRadius: 12, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-border)', animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                       <div style={{ width: 90, height: 14, background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                     </div>
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                     <div style={{ width: 110, height: 14, background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                  </td>
                </tr>
              )) : paginatedLeads.length > 0 ? paginatedLeads.map(lead => {
                return (
                  <tr 
                    key={lead.id} 
                    className="lead-row"
                    onClick={() => setSelectedLead(lead)}
                    style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={lead.name} size={32} />
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
                          <Avatar name={lead.assigned_to_name} size={28} />
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
        width="850px"
      >
        {selectedLead && (
          <div style={{ padding: '1.5rem', background: 'white' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem' }}>
              {/* Cột Trái: Chi Tiết */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <Avatar name={selectedLead.name} size={48} />
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{selectedLead.name}</h2>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>ID: #{selectedLead.id}</div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Phone size={14} /> Số điện thoại</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.phone}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Mail size={14} /> Email</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.email}</div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><ExternalLink size={14} /> Nguồn Data</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.source}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Tag size={14} /> Trạng thái</div>
                    <div>{getStatusBadge(selectedLead.status)}</div>
                  </div>
                </div>

                <div style={{ background: '#fefce8', borderLeft: '4px solid #eab308', padding: '1rem', borderRadius: '0 12px 12px 0' }}>
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
              </div>

              {/* Cột Phải: Phân bổ */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>Thông tin Phân bổ</h3>
                
                {selectedLead.assigned_to_name !== '-' ? (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar name={selectedLead.assigned_to_name} size={24} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Người tiếp nhận</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{selectedLead.assigned_to_name}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                    <User size={16} color="var(--color-primary)" /> Giao lại Tư vấn viên
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
                    Thay đổi người tiếp nhận (Không ảnh hưởng lượt chia).
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <CustomSelect 
                      options={[
                        { value: '', label: '-- Chọn Tư vấn viên --' },
                        ...consultants.map(c => ({
                          value: c.id.toString(),
                          label: c.name,
                          avatar: ''
                        }))
                      ]}
                      value={reassignConsId}
                      onChange={val => setReassignConsId(val.toString())}
                      showAvatars={true}
                      searchable={true}
                      width="100%"
                      direction="up"
                    />
                    <button 
                      className="btn primary" 
                      onClick={handleReassign}
                      disabled={isReassigning || !reassignConsId}
                      style={{ height: 38, background: 'var(--color-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '0 1rem', fontSize: '0.875rem', fontWeight: 700, width: '100%' }}
                    >
                      {isReassigning ? <RefreshCw size={14} className="spin" /> : null}
                      Xác nhận giao
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        )}
      </CustomModal>

      {/* Manual Add Modal */}
      <CustomModal
        isOpen={showManualAdd}
        onClose={() => setShowManualAdd(false)}
        title="Thêm Data Thủ Công"
        width="650px"
      >
        <div style={{ padding: '1.5rem', background: 'white' }}>
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
        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn outline" onClick={() => setShowManualAdd(false)}>Hủy</button>
          <button className="btn primary" onClick={handleManualSubmit} disabled={isSubmittingManual || (!manualData.phone && !manualData.email)} style={{ background: 'var(--color-primary)' }}>
            {isSubmittingManual ? 'Đang lưu...' : 'Lưu & Giao Data'}
          </button>
        </div>
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
