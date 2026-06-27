import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { MapPin, ChevronRight, Check, Search, Globe, ArrowLeft, X } from 'lucide-react';
import { motion } from 'framer-motion';
import cityData from '../../assets/ctiy.json';

// ─── Types ────────────────────────────────────────────────────
interface City { code: string | number; name: string; }
interface Ward { city: string; wnew: string; wold: string; }

interface AddressSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────
const getCleanCityName = (name: string) => {
  const match = name.match(/\[(.*?)\]/);
  return match ? match[1] : name.replace(/\s*\(.*?\)\s*/g, '').trim();
};

// ─── Component ────────────────────────────────────────────────
export const AddressSelect: React.FC<AddressSelectProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Chọn địa chỉ...',
  required,
}) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [isForeign, setIsForeign] = useState(false);
  const [foreignText, setForeignText] = useState('');

  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
  const [street, setStreet] = useState('');

  const cities = (cityData as any).cities as City[];
  const allWards = (cityData as any).wards as Ward[];

  const filteredCities = useMemo(() =>
    cities.filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const filteredWards = useMemo(() => {
    if (!selectedCity) return [];
    const cleanName = getCleanCityName(selectedCity.name);
    const wards = allWards.filter(w => w.city === cleanName);
    return search ? wards.filter(w =>
      w.wnew.toLowerCase().includes(search.toLowerCase()) ||
      w.wold.toLowerCase().includes(search.toLowerCase())
    ) : wards;
  }, [selectedCity, search]);

  const handleOpen = () => {
    setStep(1); setSearch(''); setIsForeign(false);
    setSelectedCity(null); setSelectedWard(null); setStreet(''); setForeignText('');
    setOpen(true);
  };

  const handleSelectCity = (city: City) => {
    setSelectedCity(city); setSelectedWard(null);
    setStep(2); setSearch('');
  };

  const handleSelectWard = (ward: Ward) => {
    setSelectedWard(ward); setStep(3); setSearch('');
  };

  const handleConfirm = () => {
    if (isForeign) {
      onChange(foreignText.trim());
    } else {
      const parts = [
        street.trim(),
        selectedWard?.wnew || '',
        selectedCity ? getCleanCityName(selectedCity.name) : '',
      ].filter(Boolean);
      onChange(parts.join(', '));
    }
    setOpen(false);
  };

  const stepLabels = ['Tỉnh / Thành phố', 'Quận / Huyện / Xã', 'Số nhà & Đường'];

  return (
    <>
      {/* ── Trigger ── */}
      {label && (
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={13} />
          {label}{required && <span className="text-danger"> *</span>}
        </label>
      )}
      <div
        onClick={handleOpen}
        className="form-input"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          cursor: 'pointer', userSelect: 'none',
          color: value ? 'var(--color-text)' : 'var(--color-text-muted)',
          minHeight: '2.75rem',
        }}
      >
        <MapPin size={16} style={{ color: value ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: value ? 600 : 400 }}>
          {value || placeholder}
        </span>
        <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      </div>

      {/* ── Modal Portal ── */}
      {open && ReactDOM.createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Backdrop */}
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }} onClick={() => setOpen(false)} />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'relative', width: '100%', maxWidth: '460px',
              backgroundColor: 'var(--color-surface)', borderRadius: '24px',
              boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column',
              maxHeight: '80vh', overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '1.5rem 1.75rem 1rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text)' }}>Chọn địa chỉ</h3>

                  {/* Breadcrumb steps */}
                  {!isForeign && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                      {[1, 2, 3].map((s, i) => (
                        <React.Fragment key={s}>
                          <span
                            onClick={() => { if (step > s) { setStep(s as 1|2|3); setSearch(''); } }}
                            style={{
                              fontSize: '0.7rem', fontWeight: 700,
                              color: step >= s ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              cursor: step > s ? 'pointer' : 'default',
                              textDecoration: step > s ? 'underline' : 'none',
                            }}
                          >
                            {stepLabels[i]}
                          </span>
                          {i < 2 && <ChevronRight size={10} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="btn-icon sm"
                  style={{ marginTop: '2px', borderRadius: '10px' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Foreign toggle */}
              <button
                onClick={() => setIsForeign(f => !f)}
                style={{
                  marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.75rem', fontWeight: 700,
                  color: isForeign ? 'var(--color-primary)' : 'var(--color-text-light)',
                  background: isForeign ? 'rgba(var(--color-primary-rgb, 124,58,237),0.08)' : 'var(--color-bg)',
                  border: `1px solid ${isForeign ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: '999px', padding: '4px 12px', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <Globe size={12} />
                Địa chỉ nước ngoài
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {isForeign ? (
                /* ── Foreign address free-form ── */
                <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: 1.5 }}>
                    Nhập địa chỉ đầy đủ bằng tiếng Anh hoặc ngôn ngữ địa phương.
                  </p>
                  <textarea
                    autoFocus
                    className="form-input"
                    rows={4}
                    placeholder="VD: 123 Baker Street, London, UK, SW1A 1AA"
                    value={foreignText}
                    onChange={e => setForeignText(e.target.value)}
                    style={{ resize: 'vertical', borderRadius: '12px', fontWeight: 500 }}
                  />
                </div>
              ) : (
                <>
                  {/* ── Search ── */}
                  {step < 3 && (
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                        <input
                          autoFocus
                          type="text"
                          className="form-input"
                          placeholder={step === 1 ? 'Tìm tỉnh / thành phố...' : 'Tìm quận, huyện, xã...'}
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          style={{ paddingLeft: '2.5rem', borderRadius: '10px' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Step 1: Cities ── */}
                  {step === 1 && (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {filteredCities.map(c => (
                        <div
                          key={c.code}
                          onClick={() => handleSelectCity(c)}
                          style={{
                            padding: '0.875rem 1.75rem',
                            borderBottom: '1px solid var(--color-border-light)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9rem' }}>
                            {getCleanCityName(c.name)}
                          </span>
                          {selectedCity?.code === c.code && <Check size={16} style={{ color: 'var(--color-primary)' }} />}
                        </div>
                      ))}
                      {filteredCities.length === 0 && (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          Không tìm thấy tỉnh/thành phố nào
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Step 2: Wards ── */}
                  {step === 2 && (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {filteredWards.length === 0 && !search ? (
                        <div style={{ padding: '2rem 1.75rem', textAlign: 'center' }}>
                          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            Không có dữ liệu xã/phường cho tỉnh này.
                          </p>
                          <button className="btn primary sm" onClick={() => setStep(3)}>Nhập địa chỉ cụ thể</button>
                        </div>
                      ) : (
                        filteredWards.map((w, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectWard(w)}
                            style={{
                              padding: '0.75rem 1.75rem',
                              borderBottom: '1px solid var(--color-border-light)',
                              cursor: 'pointer', transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9rem' }}>{w.wnew}</span>
                              {selectedWard?.wnew === w.wnew && <Check size={16} style={{ color: 'var(--color-primary)' }} />}
                            </div>
                            {w.wold && w.wold !== w.wnew && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                (Cũ: {w.wold})
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* ── Step 3: Street address ── */}
                  {step === 3 && (
                    <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Summary chip */}
                      <div style={{
                        background: 'var(--color-bg)', borderRadius: '12px',
                        padding: '0.75rem 1rem', fontSize: '0.8rem',
                        color: 'var(--color-text-light)', fontWeight: 600, lineHeight: 1.5,
                        border: '1px solid var(--color-border-light)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                          {[selectedWard?.wnew, selectedCity ? getCleanCityName(selectedCity.name) : ''].filter(Boolean).join(', ')}
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Số nhà, Tên đường</label>
                        <input
                          autoFocus
                          type="text"
                          className="form-input"
                          placeholder="VD: 123 Đường Lê Lợi"
                          value={street}
                          onChange={e => setStreet(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                          style={{ borderRadius: '12px' }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '1rem 1.75rem',
              borderTop: '1px solid var(--color-border-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--color-bg)',
            }}>
              {/* Back button */}
              {!isForeign && step > 1 ? (
                <button
                  className="btn secondary sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => { setStep((step - 1) as 1|2|3); setSearch(''); }}
                >
                  <ArrowLeft size={14} /> Quay lại
                </button>
              ) : (
                <div />
              )}

              {/* Confirm */}
              {(isForeign || step === 3 || (step === 2 && selectedCity)) && (
                <button
                  className="btn primary"
                  onClick={handleConfirm}
                  disabled={isForeign ? !foreignText.trim() : (step === 3 ? false : !selectedCity)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={16} />
                  {step === 2 && !isForeign ? 'Bỏ qua xã/phường' : 'Xác nhận địa chỉ'}
                </button>
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </>
  );
};
