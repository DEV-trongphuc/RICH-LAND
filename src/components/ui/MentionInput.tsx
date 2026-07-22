import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from './Avatar';

interface User {
  id: number;
  full_name: string;
  role: string;
  avatar_url?: string;
  avatar?: string;
}

interface MentionInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: any) => void;
  users?: User[];
  onImagePaste?: (file: File) => void;
  onFilePaste?: (file: File) => void;
}

export const MentionInput: React.FC<MentionInputProps> = ({ value, onChange, users: propUsers, onImagePaste, onFilePaste, ...props }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isTeamMember = (u: User) => {
    if (!u || !u.role) return false;
    const r = u.role.toLowerCase();
    return ['admin', 'superadmin', 'super_admin', 'sales', 'sale', 'manager', 'assistant', 'telesale', 'prescreener', 'director', 'staff', 'employee'].includes(r);
  };

  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      console.log("MentionInput using propUsers:", propUsers);
      setUsers(propUsers.filter(isTeamMember));
      return;
    }
    // Fetch users for mentions
    console.log("MentionInput fetching users from API...");
    const usersEndpoint = '/users?all=1';
    api.get(usersEndpoint).then(res => {
      const d = res.data.data;
      const list = Array.isArray(d) ? d : (d?.items || []);
      console.log("MentionInput API response list:", list);
      const mapped = list.map((u: any) => ({
        ...u,
        id: u.id,
        full_name: u.full_name || u.name || u.username || '',
        avatar_url: u.avatar_url || u.avatar || '',
        role: u.role || 'sale'
      }));
      const filtered = mapped.filter(isTeamMember);
      setUsers(filtered);
    }).catch(err => {
      console.error("MentionInput failed to load users:", err);
      setUsers([]);
    });
  }, [propUsers, currentUser?.role]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showDropdown && textareaRef.current) {
        const wrapper = textareaRef.current.parentElement;
        if (wrapper && !wrapper.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);

  // Reset selectedIndex when filter matches or dropdown changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, showDropdown]);
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(e);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    
    // Check if we are typing a mention
    const match = textBeforeCursor.match(/@([^\s]*)$/);
    if (match) {
      setSearchQuery(match[1].toLowerCase());
      setShowDropdown(true);
      setCursorPos(cursor - match[0].length); // position of the '@'
    } else {
      setShowDropdown(false);
    }
  };
  const handleSelectUser = (user: User) => {
    if (cursorPos === null || !textareaRef.current) return;
    
    const val = value;
    const beforeMention = val.slice(0, cursorPos);
    const afterMention = val.slice(textareaRef.current.selectionStart);
    const fullName = user.full_name || 'user';
    
    const newValue = `${beforeMention}@${fullName.replace(/\s+/g, '_')} ${afterMention}`;
    
    // Simulate an event to pass to parent's onChange
    const fakeEvent = {
      target: { value: newValue }
    } as any;
    
    onChange(fakeEvent);
    setShowDropdown(false);
    
    // Focus back
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Set cursor after the inserted name
        const newPos = cursorPos + fullName.replace(/\s+/g, '_').length + 2;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectUser(filteredUsers[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
      }
    }
  };

  const filteredUsers = users.filter(u => {
    // Exclude the currently logged in user
    if (currentUser && u.id === currentUser.id) {
      return false;
    }
    const name = u.full_name ? String(u.full_name).toLowerCase() : '';
    const role = u.role ? String(u.role).toLowerCase() : '';
    return name.includes(searchQuery) || role.includes(searchQuery);
  });

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            if (onImagePaste) {
              e.preventDefault();
              onImagePaste(file);
              return;
            } else if (onFilePaste) {
              e.preventDefault();
              onFilePaste(file);
              return;
            }
          }
        } else if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && onFilePaste) {
            e.preventDefault();
            onFilePaste(file);
            return;
          }
        }
      }
    }
    if (props.onPaste) {
      props.onPaste(e);
    }
  };

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0 }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`form-textarea ${props.className || ''}`}
        {...props}
        style={{ width: '100%', ...props.style }}
      />
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '180px',
              overflowY: 'auto',
              zIndex: 100,
              width: '100%',
              marginBottom: '4px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Search input header */}
            <div 
              style={{ 
                padding: '6px 8px', 
                borderBottom: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-light)',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}
              onClick={e => e.stopPropagation()}
            >
              <input
                type="text"
                placeholder="Gõ để tìm tên hoặc vai trò..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value.toLowerCase())}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  fontSize: '0.75rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  outline: 'none',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredUsers.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Không tìm thấy kết quả
                </div>
              ) : (
                filteredUsers.map((u, idx) => {
                  const fullName = u.full_name || 'Không tên';
                  const roleName = u.role || 'user';
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--color-border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--color-text)',
                        background: idx === selectedIndex ? 'var(--color-bg)' : 'transparent'
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Avatar name={fullName} src={u.avatar_url || u.avatar} size={20} />
                      <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{fullName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{roleName}</div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
