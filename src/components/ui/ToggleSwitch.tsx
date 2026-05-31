interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  small?: boolean;
}

export const ToggleSwitch = ({ checked, onChange, small = false }: ToggleSwitchProps) => {
  const width = small ? 32 : 44;
  const height = small ? 18 : 24;
  const borderRadius = small ? 18 : 24;
  const knobSize = small ? 14 : 20;
  const leftPos = checked ? (small ? 16 : 22) : 2;

  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width,
        height,
        borderRadius,
        background: checked ? '#10b981' : '#cbd5e1',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      <div
        style={{
          width: knobSize,
          height: knobSize,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: leftPos,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
      />
    </div>
  );
};
