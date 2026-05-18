
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelActive?: string;
  labelInactive?: string;
}

export const ToggleSwitch = ({ checked, onChange, labelActive = 'Đang hoạt động', labelInactive = 'Tạm dừng' }: ToggleSwitchProps) => {
  return (
    <div 
      style={{ 
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem', 
        background: 'var(--color-bg)', padding: '4px', borderRadius: '50px',
        border: '1px solid var(--color-border)',
        userSelect: 'none'
      }}
    >
      <div 
        onClick={() => onChange(true)}
        style={{
          padding: '6px 12px', borderRadius: '50px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
          background: checked ? 'var(--color-success-light)' : 'transparent',
          color: checked ? 'var(--color-success)' : 'var(--color-text-muted)',
          transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', gap: 6
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: checked ? 'var(--color-success)' : 'transparent' }} />
        {labelActive}
      </div>
      <div 
        onClick={() => onChange(false)}
        style={{
          padding: '6px 12px', borderRadius: '50px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
          background: !checked ? 'var(--color-surface)' : 'transparent',
          color: !checked ? 'var(--color-text)' : 'var(--color-text-muted)',
          boxShadow: !checked ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          border: !checked ? '1px solid var(--color-border)' : '1px solid transparent',
          transition: 'all 0.2s'
        }}
      >
        {labelInactive}
      </div>
    </div>
  );
};
