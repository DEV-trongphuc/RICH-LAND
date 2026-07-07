import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface PaginationProps {
  total: number;
  page: number;
  pageSize?: number;
  onChange: (page: number) => void;
  showSizeChanger?: boolean;
  onPageSizeChange?: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  total,
  page,
  pageSize = 50,
  onChange,
  showSizeChanger,
  onPageSizeChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 4) pages.push('...');
    for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) pages.push(i);
    if (page < totalPages - 3) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  if (total === 0) return null;

  return (
    <div className="pagination">
      <div className="pagination-info">
        Hiển thị <strong>{start}</strong>–<strong>{end}</strong> trong <strong>{total}</strong> kết quả
        {showSizeChanger && onPageSizeChange && (
          <div style={{ marginLeft: '0.75rem', width: '140px', display: 'inline-block' }}>
            <CustomSelect
              options={[3, 6, 12, 24, 50, 100].map(n => ({ value: n, label: `${n} / trang` }))}
              value={pageSize}
              onChange={v => { onPageSizeChange(Number(v)); onChange(1); }}
              direction="up"
            />
          </div>
        )}
      </div>

      <div className="pagination-pages">
        <button
          className="pagination-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          title="Trang trước"
        >
          <ChevronLeft size={15} />
        </button>

        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} style={{ padding: '0 4px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>…</span>
          ) : (
            <button
              key={p}
              className={`pagination-btn ${page === p ? 'active' : ''}`}
              onClick={() => onChange(p as number)}
            >
              {p}
            </button>
          )
        )}

        <button
          className="pagination-btn"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          title="Trang sau"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};
