import React from 'react';

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
  <div className="card skeleton-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Skeleton width={100} height={12} />
      <Skeleton width={36} height={36} borderRadius="50%" />
    </div>
    <Skeleton width={80} height={28} />
    <Skeleton width={60} height={10} />
  </div>
);

// ─── Table row skeleton ──────────────────────────────────────────────────────
export const TableRowSkeleton = ({ cols = 4 }: { cols?: number }) => (
  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: '1.25rem 1.5rem' }}>
        <Skeleton width={i === 0 ? 140 : i === cols - 1 ? 80 : 100} height={14} />
        {i === 0 && <Skeleton width={80} height={10} style={{ marginTop: 6 }} />}
      </td>
    ))}
  </tr>
);

// ─── Table skeleton (full) ───────────────────────────────────────────────────
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="card skeleton-card" style={{ padding: 0, overflow: 'hidden' }}>
    {/* Header */}
    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 16 }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} width={i === 0 ? 120 : 80} height={11} />
      ))}
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Card skeleton (general) ─────────────────────────────────────────────────
export const CardSkeleton = ({ height = 120 }: { height?: number }) => (
  <div className="card skeleton-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Skeleton width={44} height={44} borderRadius="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={11} />
      </div>
    </div>
    <Skeleton width="100%" height={height - 80} borderRadius={8} />
  </div>
);

// ─── Page header skeleton ────────────────────────────────────────────────────
export const PageHeaderSkeleton = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Skeleton width={220} height={22} />
      <Skeleton width={300} height={13} />
    </div>
    <Skeleton width={140} height={38} borderRadius={10} />
  </div>
);

// ─── Stat row skeleton ───────────────────────────────────────────────────────
export const StatRowSkeleton = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
    <Skeleton width={36} height={36} borderRadius="50%" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Skeleton width="55%" height={13} />
      <Skeleton width="35%" height={10} />
    </div>
    <Skeleton width={50} height={22} borderRadius={12} />
  </div>
);

// ─── Round card skeleton ─────────────────────────────────────────────────────
export const RoundCardSkeleton = () => (
  <div className="card skeleton-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width={160} height={18} />
        <Skeleton width={80} height={22} borderRadius={20} />
      </div>
      <Skeleton width={28} height={28} borderRadius={8} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <StatRowSkeleton key={i} />
      ))}
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <Skeleton width={80} height={32} borderRadius={8} />
      <Skeleton width={100} height={32} borderRadius={8} />
    </div>
  </div>
);

// ─── Calendar skeleton ────────────────────────────────────────────────────────
export const CalendarSkeleton = () => (
  <div className="skeleton-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(110px, 1fr)', width: '100%' }}>
    {Array.from({ length: 28 }).map((_, i) => (
      <div
        key={i}
        style={{
          borderRight: '1px solid var(--color-border-light)',
          borderBottom: '1px solid var(--color-border-light)',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: i % 7 === 5 || i % 7 === 6 ? 'var(--color-calendar-weekend, rgba(0,0,0,0.01))' : 'transparent'
        }}
      >
        <Skeleton width={20} height={12} />
        <Skeleton width="80%" height={10} style={{ marginTop: 4 }} />
        <Skeleton width="50%" height={10} />
      </div>
    ))}
  </div>
);

// ─── Chart skeleton ──────────────────────────────────────────────────────────
export const ChartSkeleton = ({ height = 300 }: { height?: number }) => (
  <div className="card skeleton-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton width={180} height={16} />
      <Skeleton width={100} height={12} />
    </div>
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 16, height: height - 60, padding: '10px 0' }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
          <Skeleton width="100%" height={`${Math.max(15, Math.sin(i) * 40 + 50)}%`} borderRadius="4px 4px 0 0" />
        </div>
      ))}
    </div>
  </div>
);
