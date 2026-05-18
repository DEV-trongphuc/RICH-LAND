<form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
  <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flex: 1, overflow: 'hidden', minHeight: 0 }}>
    
    {/* LEFT COLUMN */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
      <div className="form-group">
        <label className="form-label">Tên Vòng <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <input 
          className="form-input" 
          placeholder="VD: Vòng 1 — Form Đăng Ký" 
          value={formData.round_name}
          onChange={e => setFormData({ ...formData, round_name: e.target.value })}
          required
          autoFocus
        />
      </div>
      
      <div className="form-group">
        <label className="form-label">Email CC khi chia Data</label>
        <input 
          className="form-input" 
          placeholder="VD: giamdoc@domation.vn, quanly@domation.vn" 
          value={formData.cc_emails}
          onChange={e => setFormData({ ...formData, cc_emails: e.target.value })}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Phân tách các email bằng dấu phẩy (,). Các email này sẽ nhận thông báo mỗi khi có Data rơi vào vòng này.</p>
      </div>
      
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14}/> Trạng thái Vòng</label>
        <div style={{ marginTop: 8 }}>
          <ToggleSwitch 
            checked={formData.is_active === 1}
            onChange={(checked) => setFormData({ ...formData, is_active: checked ? 1 : 0 })}
          />
        </div>
      </div>

      {formData.selected_users.length > 0 && (
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14}/> Chọn Sale bắt đầu / kế tiếp (Tuỳ chọn)</label>
          <div ref={startSaleDropdownRef} style={{ position: 'relative' }}>
            <div 
              className="form-input" 
              onClick={() => setShowStartSaleDropdown(!showStartSaleDropdown)}
              style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}
            >
              {formData.starting_consultant_id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => {
                      const c = consultants.find(x => Number(x.id) === formData.starting_consultant_id);
                      if (!c) return '-- Mặc định (Theo thứ tự thêm vào) --';
                      const initials = c.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                      return (
                        <>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: getColorForName(c.name), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                            {initials}
                          </div>
                          <span style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--color-text)' }}>{c.name}</span>
                        </>
                      )
                  })()}
                </div>
              ) : (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>-- Mặc định (Theo thứ tự thêm vào) --</span>
              )}
              <span style={{ transform: showStartSaleDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--color-text-muted)', display: 'inline-block', fontSize: '0.75rem' }}>▼</span>
            </div>
            
            {showStartSaleDropdown && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, zIndex: 50,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.1), 0 -4px 6px -2px rgba(0, 0, 0, 0.05)', maxHeight: 150, overflowY: 'auto'
              }}>
                <div 
                  onClick={() => { setFormData({ ...formData, starting_consultant_id: null }); setShowStartSaleDropdown(false); }}
                  style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', fontSize: '0.875rem', background: formData.starting_consultant_id === null ? 'var(--color-bg)' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = formData.starting_consultant_id === null ? 'var(--color-bg)' : 'transparent'}
                >
                  -- Mặc định (Theo thứ tự thêm vào) --
                </div>
                {formData.selected_users.map(id => {
                  const c = consultants.find(x => x.id === id);
                  if (!c) return null;
                  const isSelected = formData.starting_consultant_id === id;
                  const initials = c.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                  return (
                    <div 
                      key={id}
                      onClick={() => { setFormData({ ...formData, starting_consultant_id: id }); setShowStartSaleDropdown(false); }}
                      style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', background: isSelected ? 'var(--color-primary-light)' : 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = 'var(--color-bg)'; }}
                      onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: getColorForName(c.name), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                        {c.name}
                      </div>
                      {isSelected && <Check size={14} color="var(--color-primary)" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Người được chọn sẽ là người nhận Data tiếp theo của vòng này.
          </p>
        </div>
      )}
    </div>

    {/* RIGHT COLUMN */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden', minHeight: 0 }}>
      {/* Custom Multi-Select with Avatars */}
      <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14}/> Chọn Tư vấn viên vào vòng này</label>
        
        {/* Search Input Box */}
        <div style={{ position: 'relative' }}>
          <input 
            className="form-input" 
            style={{ paddingLeft: '2.5rem', background: '#f8fafc', border: '1px solid #cbd5e1' }}
            placeholder="Tìm kiếm và chọn Tư vấn viên..."
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
            onFocus={() => setShowDropdown(true)}
          />
          <div style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }}><Search size={16} /></div>
        </div>

        {/* Dropdown Options */}
        {showDropdown && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, zIndex: 50,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
            boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.1), 0 -4px 6px -2px rgba(0, 0, 0, 0.05)', maxHeight: 180, overflowY: 'auto'
          }}>
            {consultants.filter(c => c.name.toLowerCase().includes(searchUser.toLowerCase())).map(user => {
              const isSelected = formData.selected_users.includes(Number(user.id));
              const initials = user.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
              
              return (
                <div 
                  key={user.id}
                  onClick={() => toggleUserSelection(user.id)}
                  style={{
                    padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
                    background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = 'var(--color-bg)'; }}
                  onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: getColorForName(user.name), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>{user.name}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{user.email} • {user.status === 'active' ? 'Đang nhận data' : 'Không nhận data'}</p>
                  </div>
                  {isSelected && <Check size={16} color="var(--color-primary)" />}
                </div>
              );
            })}
            {consultants.filter(c => c.name.toLowerCase().includes(searchUser.toLowerCase())).length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                Không tìm thấy tư vấn viên nào
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Consultants List Block */}
      {formData.selected_users.length > 0 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }} className="custom-scrollbar">
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Tư vấn viên đã chọn ({formData.selected_users.length}):</div>
          {formData.selected_users.map(userId => {
            const user = consultants.find(c => Number(c.id) === userId);
            if (!user) return null;
            const initials = user.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
            return (
              <div key={user.id} style={{
                display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem',
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
                transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ 
                    width: 28, height: 28, borderRadius: '50%', 
                    background: getColorForName(user.name) + '20', color: getColorForName(user.name), 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    fontSize: '0.7rem', fontWeight: 700 
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{user.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{user.email}</div>
                  </div>
                  <button 
                    type="button" 
                    onClick={(e) => removeUser(user.id, e)} 
                    style={{ 
                      color: 'var(--color-text-muted)', padding: 4, borderRadius: 6, 
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s'
                    }} 
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'var(--color-danger-light)'; }} 
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                {/* Special Rule Ratio Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Nhận 1 Data sau mỗi</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="99" 
                    value={formData.ratios[user.id] || 1} 
                    onChange={e => setFormData({...formData, ratios: {...formData.ratios, [user.id]: Math.max(1, parseInt(e.target.value) || 1)}})}
                    style={{ width: 44, border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', outline: 'none', color: 'var(--color-primary)', fontWeight: 700, background: 'var(--color-bg)' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>vòng {formData.ratios[user.id] > 1 ? '(Bỏ qua ' + ((formData.ratios[user.id] || 1) - 1) + ' vòng)' : '(Mặc định)'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>

  <div style={{ padding: '1.25rem', background: '#f8fafc', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)', marginTop: 'auto' }}>
    <button type="button" className="btn outline" onClick={() => { setModalOpen(false); setShowDropdown(false); }}>Hủy bỏ</button>
    <button type="submit" className="btn primary">
      {editingRound ? 'Cập nhật' : 'Thêm mới'}
    </button>
  </div>
</form>
