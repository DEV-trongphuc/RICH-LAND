import React, { useEffect, useState } from 'react';

// ─── Simple hook for responsive skeletons ──────────────────────────────────
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

// ─── Skeleton primitive ─────────────────────────────────────────────────────
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export const Skeleton = ({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) => (
  <>
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--skeleton-base, #e2e8f0) 25%, var(--skeleton-shine, #f1f5f9) 50%, var(--skeleton-base, #e2e8f0) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.6s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}
    />
    <style>{`
      @keyframes skeletonShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  </>
);

// ─── KPI card skeleton ───────────────────────────────────────────────────────
export const KpiCardSkeleton = () => (
  <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Skeleton width={80} height={12} />
      <Skeleton width={32} height={32} borderRadius="50%" />
    </div>
    <Skeleton width={65} height={24} />
    <Skeleton width={50} height={10} />
  </div>
);

// ─── Table row skeleton ──────────────────────────────────────────────────────
export const TableRowSkeleton = ({ cols = 4 }: { cols?: number }) => (
  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: '1rem 1.25rem' }}>
        <Skeleton width={i === 0 ? 120 : i === cols - 1 ? 65 : 85} height={13} />
        {i === 0 && <Skeleton width={70} height={9} style={{ marginTop: 5 }} />}
      </td>
    ))}
  </tr>
);

// ─── Table skeleton (full) ───────────────────────────────────────────────────
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => {
  const isMobile = useResponsive();
  const activeCols = isMobile ? Math.min(cols, 2) : cols;

  return (
    <div className="card skeleton-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 16 }}>
        {Array.from({ length: activeCols }).map((_, i) => (
          <Skeleton key={i} width={i === 0 ? 100 : 70} height={11} />
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={activeCols} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Card skeleton (general) ─────────────────────────────────────────────────
export const CardSkeleton = ({ height = 120 }: { height?: number }) => (
  <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Skeleton width={40} height={40} borderRadius="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="35%" height={11} />
      </div>
    </div>
    <Skeleton width="100%" height={height - 75} borderRadius={8} />
  </div>
);

// ─── Page header skeleton ────────────────────────────────────────────────────
export const PageHeaderSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <Skeleton width={isMobile ? '60%' : 200} height={20} />
        <Skeleton width={isMobile ? '80%' : 280} height={12} />
      </div>
      {!isMobile && <Skeleton width={120} height={36} borderRadius={8} />}
    </div>
  );
};

// ─── Stat row skeleton ───────────────────────────────────────────────────────
export const StatRowSkeleton = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
    <Skeleton width={32} height={32} borderRadius="50%" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Skeleton width="50%" height={12} />
      <Skeleton width="30%" height={10} />
    </div>
    <Skeleton width={45} height={20} borderRadius={10} />
  </div>
);

// ─── Round card skeleton ─────────────────────────────────────────────────────
export const RoundCardSkeleton = () => (
  <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width={140} height={16} />
        <Skeleton width={70} height={20} borderRadius={16} />
      </div>
      <Skeleton width={24} height={24} borderRadius={6} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <StatRowSkeleton key={i} />
      ))}
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <Skeleton width={75} height={30} borderRadius={6} />
      <Skeleton width={90} height={30} borderRadius={6} />
    </div>
  </div>
);

// ─── Calendar skeleton ────────────────────────────────────────────────────────
export const CalendarSkeleton = () => {
  const isMobile = useResponsive();
  const totalCells = isMobile ? 7 : 28; // On mobile, just show one row/week skeleton

  return (
    <div className="skeleton-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: isMobile ? 'minmax(65px, 1fr)' : 'minmax(110px, 1fr)', width: '100%' }}>
      {Array.from({ length: totalCells }).map((_, i) => (
        <div
          key={i}
          style={{
            borderRight: '1px solid var(--color-border-light)',
            borderBottom: '1px solid var(--color-border-light)',
            padding: isMobile ? '0.375rem' : '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 4 : 8,
            background: i % 7 === 5 || i % 7 === 6 ? 'var(--color-calendar-weekend, rgba(0,0,0,0.01))' : 'transparent'
          }}
        >
          <Skeleton width={15} height={10} />
          {!isMobile && (
            <>
              <Skeleton width="80%" height={9} style={{ marginTop: 4 }} />
              <Skeleton width="55%" height={9} />
            </>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Chart skeleton ──────────────────────────────────────────────────────────
export const ChartSkeleton = ({ height = 300 }: { height?: number }) => {
  const isMobile = useResponsive();
  const barsCount = isMobile ? 6 : 12;

  return (
    <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={isMobile ? 120 : 160} height={16} />
        <Skeleton width={80} height={12} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: isMobile ? 8 : 16, height: height - 55, padding: '8px 0' }}>
        {Array.from({ length: barsCount }).map((_, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
            <Skeleton width="100%" height={`${Math.max(15, Math.sin(i) * 35 + 50)}%`} borderRadius="4px 4px 0 0" />
          </div>
        ))}
      </div>
    </div>
  );
};
